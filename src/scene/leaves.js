import * as THREE from 'three';

const TEMP_OBJECT = new THREE.Object3D();

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function buildLeafState() {
  return {
    x: randomBetween(-70, 70),
    y: randomBetween(8, 24),
    z: randomBetween(-70, 70),
    fallSpeed: randomBetween(0.35, 0.8),
    drift: randomBetween(0.35, 1.2),
    spin: randomBetween(-2.1, 2.1),
    tilt: randomBetween(-0.8, 0.8),
    yaw: randomBetween(0, Math.PI * 2),
    phase: randomBetween(0, Math.PI * 2),
  };
}

function resetLeaf(state) {
  state.x = randomBetween(-72, 72);
  state.y = randomBetween(14, 26);
  state.z = randomBetween(-72, 72);
  state.fallSpeed = randomBetween(0.35, 0.8);
  state.drift = randomBetween(0.35, 1.2);
  state.spin = randomBetween(-2.1, 2.1);
  state.tilt = randomBetween(-0.8, 0.8);
  state.yaw = randomBetween(0, Math.PI * 2);
  state.phase = randomBetween(0, Math.PI * 2);
}

export function createFallingLeaves(scene, getTerrainHeight) {
  const leafCount = 28;
  const geometry = new THREE.PlaneGeometry(0.32, 0.14);
  const material = new THREE.MeshBasicMaterial({
    color: 0xd38f4f,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
  });

  const leaves = new THREE.InstancedMesh(geometry, material, leafCount);
  const states = [];

  for (let i = 0; i < leafCount; i += 1) {
    const state = buildLeafState();
    states.push(state);

    TEMP_OBJECT.position.set(state.x, state.y, state.z);
    TEMP_OBJECT.rotation.set(state.tilt, state.yaw, state.phase);
    TEMP_OBJECT.scale.setScalar(randomBetween(0.8, 1.2));
    TEMP_OBJECT.updateMatrix();

    leaves.setMatrixAt(i, TEMP_OBJECT.matrix);
  }

  leaves.instanceMatrix.needsUpdate = true;
  scene.add(leaves);

  return {
    update(elapsedTime, deltaTime) {
      for (let i = 0; i < states.length; i += 1) {
        const state = states[i];

        state.y -= state.fallSpeed * deltaTime;
        state.x += Math.sin(elapsedTime * 0.9 + state.phase) * state.drift * deltaTime;
        state.z += Math.cos(elapsedTime * 0.7 + state.phase * 0.6) * state.drift * deltaTime;
        state.yaw += state.spin * deltaTime;

        const groundLevel = getTerrainHeight(state.x, state.z) + 0.22;
        if (state.y <= groundLevel) {
          resetLeaf(state);
        }

        TEMP_OBJECT.position.set(state.x, state.y, state.z);
        TEMP_OBJECT.rotation.set(state.tilt, state.yaw, state.phase);
        TEMP_OBJECT.scale.setScalar(1);
        TEMP_OBJECT.updateMatrix();

        leaves.setMatrixAt(i, TEMP_OBJECT.matrix);
      }

      leaves.instanceMatrix.needsUpdate = true;
    },
  };
}
