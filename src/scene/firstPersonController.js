import * as THREE from 'three';
import { NAVIGATION_CONFIG } from './sceneConfig.js';

const ACTION_TO_CODES = {
  forward: ['ArrowUp', 'KeyZ', 'KeyW'],
  backward: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyQ', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  zoomIn: ['KeyP'],
  zoomOut: ['KeyM'],
};

const ACTION_TO_KEYS = {
  forward: ['arrowup', 'z', 'w'],
  backward: ['arrowdown', 's'],
  left: ['arrowleft', 'q', 'a'],
  right: ['arrowright', 'd'],
  zoomIn: ['p'],
  zoomOut: ['m'],
};

function normalizeKey(key) {
  return typeof key === 'string' ? key.toLowerCase() : '';
}

function resolveAction(event) {
  for (const action of Object.keys(ACTION_TO_CODES)) {
    if (ACTION_TO_CODES[action].includes(event.code)) {
      return action;
    }
  }

  const normalizedKey = normalizeKey(event.key);
  for (const action of Object.keys(ACTION_TO_KEYS)) {
    if (ACTION_TO_KEYS[action].includes(normalizedKey)) {
      return action;
    }
  }

  return null;
}

function getPointerNdc(event, domElement) {
  const rect = domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  return new THREE.Vector2(x, y);
}

export function createFirstPersonController({
  camera,
  domElement,
  terrain,
  getTerrainHeight,
  riverCurve,
  pondCenter,
}) {
  const actions = new Set();

  const state = {
    yaw: 0,
    pitch: -0.03,
    eyeHeight: NAVIGATION_CONFIG.eyeHeight,
    moveSpeed: NAVIGATION_CONFIG.moveSpeed,
    strafeSpeed: NAVIGATION_CONFIG.strafeSpeed,
    maxSlopeStep: NAVIGATION_CONFIG.maxSlopeStep,
    desiredFov: camera.fov,
    clickHoldForward: false,
  };

  const spawnAnchor = riverCurve.getPointAt(0.42);
  const spawnTangent = riverCurve.getTangentAt(0.42).normalize();
  const spawnSide = new THREE.Vector3(-spawnTangent.z, 0, spawnTangent.x).normalize();

  const spawn = spawnAnchor
    .clone()
    .addScaledVector(spawnTangent, -4.0)
    .addScaledVector(spawnSide, 4.6);

  spawn.y = getTerrainHeight(spawn.x, spawn.z) + state.eyeHeight;

  const lookDirection = pondCenter.clone().sub(spawn);
  lookDirection.y = 0;
  lookDirection.normalize();

  state.yaw = Math.atan2(lookDirection.x, lookDirection.z);

  camera.position.copy(spawn);
  camera.rotation.order = 'YXZ';
  camera.rotation.set(state.pitch, state.yaw, 0);

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const moveDirection = new THREE.Vector3();
  const nextPosition = new THREE.Vector3();
  const targetDirection = new THREE.Vector3();

  const raycaster = new THREE.Raycaster();
  const moveTarget = new THREE.Vector3();
  let hasMoveTarget = false;

  const onKeyDown = (event) => {
    const action = resolveAction(event);
    if (!action) {
      return;
    }

    event.preventDefault();
    actions.add(action);
  };

  const onKeyUp = (event) => {
    const action = resolveAction(event);
    if (!action) {
      return;
    }

    event.preventDefault();
    actions.delete(action);
  };

  const onPointerDown = (event) => {
    if (event.button !== 0) {
      return;
    }

    domElement.focus();
    state.clickHoldForward = true;

    const pointer = getPointerNdc(event, domElement);
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObject(terrain, false);

    if (intersections.length > 0) {
      const point = intersections[0].point;
      moveTarget.set(point.x, getTerrainHeight(point.x, point.z) + state.eyeHeight, point.z);
      hasMoveTarget = true;

      targetDirection.set(moveTarget.x - camera.position.x, 0, moveTarget.z - camera.position.z);
      if (targetDirection.lengthSq() > 1e-6) {
        targetDirection.normalize();
        state.yaw = Math.atan2(targetDirection.x, targetDirection.z);
      }
    }
  };

  const onPointerUp = (event) => {
    if (event.button !== 0) {
      return;
    }

    state.clickHoldForward = false;
  };

  const onWheel = (event) => {
    event.preventDefault();

    const step = event.deltaY > 0 ? NAVIGATION_CONFIG.zoomStepWheel : -NAVIGATION_CONFIG.zoomStepWheel;
    state.desiredFov = THREE.MathUtils.clamp(
      state.desiredFov + step,
      NAVIGATION_CONFIG.minFov,
      NAVIGATION_CONFIG.maxFov
    );
  };

  const onContextMenu = (event) => {
    event.preventDefault();
  };

  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp, { passive: false });
  domElement.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('pointerup', onPointerUp, { passive: false });
  domElement.addEventListener('wheel', onWheel, { passive: false });
  domElement.addEventListener('contextmenu', onContextMenu);

  function update(deltaTime) {
    const forwardAxis = (actions.has('forward') ? 1 : 0) - (actions.has('backward') ? 1 : 0);
    const strafeAxis = (actions.has('right') ? 1 : 0) - (actions.has('left') ? 1 : 0);

    const keyZoomAxis = (actions.has('zoomOut') ? 1 : 0) - (actions.has('zoomIn') ? 1 : 0);
    if (keyZoomAxis !== 0) {
      state.desiredFov = THREE.MathUtils.clamp(
        state.desiredFov + keyZoomAxis * NAVIGATION_CONFIG.zoomStepKey * deltaTime,
        NAVIGATION_CONFIG.minFov,
        NAVIGATION_CONFIG.maxFov
      );
    }

    forward.set(Math.sin(state.yaw), 0, Math.cos(state.yaw)).normalize();
    right.set(forward.z, 0, -forward.x).normalize();

    let autoForward = state.clickHoldForward ? 1 : 0;

    if (hasMoveTarget) {
      targetDirection.set(moveTarget.x - camera.position.x, 0, moveTarget.z - camera.position.z);
      const targetDistance = targetDirection.length();

      if (targetDistance < 0.55) {
        hasMoveTarget = false;
        autoForward = 0;
      } else {
        targetDirection.normalize();
        state.yaw = Math.atan2(targetDirection.x, targetDirection.z);
        autoForward = 1;
      }
    }

    moveDirection
      .set(0, 0, 0)
      .addScaledVector(forward, (forwardAxis + autoForward) * state.moveSpeed)
      .addScaledVector(right, strafeAxis * state.strafeSpeed);

    if (moveDirection.lengthSq() > 1e-6) {
      moveDirection.normalize().multiplyScalar(state.moveSpeed * deltaTime);
    }

    nextPosition.copy(camera.position).add(moveDirection);

    const currentGround = getTerrainHeight(camera.position.x, camera.position.z);
    const nextGround = getTerrainHeight(nextPosition.x, nextPosition.z);

    if (nextGround - currentGround < state.maxSlopeStep) {
      camera.position.x = nextPosition.x;
      camera.position.z = nextPosition.z;
    }

    const desiredHeight = getTerrainHeight(camera.position.x, camera.position.z) + state.eyeHeight;
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, desiredHeight, Math.min(1, deltaTime * 12));

    camera.rotation.set(state.pitch, state.yaw, 0);

    camera.fov = THREE.MathUtils.lerp(camera.fov, state.desiredFov, Math.min(1, deltaTime * 10));
    camera.updateProjectionMatrix();
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    domElement.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    domElement.removeEventListener('wheel', onWheel);
    domElement.removeEventListener('contextmenu', onContextMenu);
  }

  return {
    update,
    dispose,
  };
}
