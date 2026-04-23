import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { NAVIGATION_CONFIG } from './sceneConfig.js';

export function createCinematicCamera({ camera, domElement, getTerrainHeight, riverCurve, pondCenter }) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.autoRotate = false;
  controls.minDistance = 6;
  controls.maxDistance = 150;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = 1.52;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;

  const targetY = getTerrainHeight(pondCenter.x, pondCenter.z) + 2.1;
  controls.target.set(pondCenter.x, targetY, pondCenter.z);

  camera.position.set(pondCenter.x + 46, targetY + 20, pondCenter.z + 34);
  camera.lookAt(controls.target);

  const state = {
    desiredFov: 46,
  };

  camera.fov = state.desiredFov;
  camera.updateProjectionMatrix();

  const onKeyDown = (event) => {
    const key = (event.key || '').toLowerCase();

    if (key === 'p') {
      event.preventDefault();
      state.desiredFov = THREE.MathUtils.clamp(
        state.desiredFov - NAVIGATION_CONFIG.zoomStepKey * 0.08,
        NAVIGATION_CONFIG.minFov,
        NAVIGATION_CONFIG.maxFov
      );
      return;
    }

    if (key === 'm') {
      event.preventDefault();
      state.desiredFov = THREE.MathUtils.clamp(
        state.desiredFov + NAVIGATION_CONFIG.zoomStepKey * 0.08,
        NAVIGATION_CONFIG.minFov,
        NAVIGATION_CONFIG.maxFov
      );
    }
  };

  window.addEventListener('keydown', onKeyDown, { passive: false });

  function update(elapsedTime, deltaTime) {
    controls.update();

    camera.fov = THREE.MathUtils.lerp(camera.fov, state.desiredFov, Math.min(1, deltaTime * 9));
    camera.updateProjectionMatrix();
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    controls.dispose();
  }

  return {
    update,
    dispose,
  };
}
