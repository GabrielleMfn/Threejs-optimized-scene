import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const TENT_TARGET = {
  x: -59.27,
  z: -6.24,
  targetHeight: 4.3,
  yaw: Math.PI * 0.22,
};

const BONFIRE_TARGET = {
  x: -54.46,
  z: -0.55,
  targetHeight: 1.6,
  yaw: Math.PI * 0.1,
};

export const CAMP_GRASS_CLEAR_ZONE = {
  x: (TENT_TARGET.x + BONFIRE_TARGET.x) * 0.5,
  z: (TENT_TARGET.z + BONFIRE_TARGET.z) * 0.5,
  radius: 2.15,
};

function sampleTerrainNormal(getTerrainHeight, x, z, step = 0.7) {
  const heightX1 = getTerrainHeight(x + step, z);
  const heightX0 = getTerrainHeight(x - step, z);
  const heightZ1 = getTerrainHeight(x, z + step);
  const heightZ0 = getTerrainHeight(x, z - step);

  return new THREE.Vector3(
    heightX0 - heightX1,
    step * 2,
    heightZ0 - heightZ1
  ).normalize();
}

function placeModelOnTerrain(root, model, target, getTerrainHeight) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  bounds.getSize(size);

  const baseHeight = Math.max(0.001, size.y);
  const scale = target.targetHeight / baseHeight;
  model.scale.setScalar(scale);

  model.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3().setFromObject(model);
  const minY = scaledBounds.min.y;

  const terrainY = getTerrainHeight(target.x, target.z);
  const normal = sampleTerrainNormal(getTerrainHeight, target.x, target.z);

  root.position.set(target.x, terrainY, target.z);
  root.quaternion.setFromUnitVectors(WORLD_UP, normal);
  root.rotation.y += target.yaw;

  model.position.set(0, -minY + 0.01, 0);
  root.add(model);
  root.updateMatrixWorld(true);
  root.matrixAutoUpdate = false;
  model.matrixAutoUpdate = false;

  return { x: target.x, y: terrainY, z: target.z, scale };
}

function loadProp(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve(gltf.scene),
      undefined,
      (error) => reject(error)
    );
  });
}

export async function createCampProps(scene, getTerrainHeight) {
  const loader = new GLTFLoader();

  const [tentModel, bonfireModel] = await Promise.all([
    loadProp(loader, '/tent_xyz.glb'),
    loadProp(loader, '/bonfire_and_pot.glb'),
  ]);

  const tentRoot = new THREE.Group();
  const bonfireRoot = new THREE.Group();

  tentModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });

  bonfireModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });

  const tentPlacement = placeModelOnTerrain(tentRoot, tentModel, TENT_TARGET, getTerrainHeight);
  const bonfirePlacement = placeModelOnTerrain(
    bonfireRoot,
    bonfireModel,
    BONFIRE_TARGET,
    getTerrainHeight
  );

  scene.add(tentRoot);
  scene.add(bonfireRoot);

  console.info('Camp props loaded', { tentPlacement, bonfirePlacement });

  return {
    tent: tentRoot,
    bonfire: bonfireRoot,
  };
}
