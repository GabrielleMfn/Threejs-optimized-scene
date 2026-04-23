import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const TARGET_DEER_POSITION = new THREE.Vector3(-44.70, 3.25, 28.42);
const TARGET_DEER_HEIGHT = 3.8;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

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

function getRiverLookTarget(riverCurve, pondCenter, fromPosition) {
  if (riverCurve) {
    let bestPoint = null;
    let bestDistanceSq = Number.POSITIVE_INFINITY;

    for (let i = 0; i <= 80; i += 1) {
      const point = riverCurve.getPointAt(i / 80);
      const dx = point.x - fromPosition.x;
      const dz = point.z - fromPosition.z;
      const distanceSq = dx * dx + dz * dz;

      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestPoint = point;
      }
    }

    if (bestPoint) {
      return bestPoint;
    }
  }

  return pondCenter || new THREE.Vector3(0, fromPosition.y, 0);
}

export function createDeer(scene, getTerrainHeight, riverCurve, pondCenter) {
  const loader = new GLTFLoader();

  function createFallbackMarker() {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff3344 })
    );

    marker.position.copy(TARGET_DEER_POSITION);
    scene.add(marker);

    return {
      deer: marker,
      update() {},
    };
  }

  return new Promise((resolve) => {
    loader.load(
      '/cerf/23870b8f869b49b8ad9b09a020bedd30_Textured.gltf',
      (gltf) => {
        const deerRoot = new THREE.Group();
        const deerHeading = new THREE.Group();
        const deer = gltf.scene;
        deer.rotation.set(-Math.PI * 0.5, 0, 0);

        deer.updateMatrixWorld(true);
        const initialBounds = new THREE.Box3().setFromObject(deer);
        const initialSize = new THREE.Vector3();
        initialBounds.getSize(initialSize);

        const baseHeight = Math.max(0.001, initialSize.y);
        const scale = TARGET_DEER_HEIGHT / baseHeight;
        deer.scale.setScalar(scale);

        deer.updateMatrixWorld(true);
        const scaledBounds = new THREE.Box3().setFromObject(deer);
        const minY = scaledBounds.min.y;

        const terrainY = Number.isFinite(TARGET_DEER_POSITION.y)
          ? TARGET_DEER_POSITION.y
          : getTerrainHeight(TARGET_DEER_POSITION.x, TARGET_DEER_POSITION.z);

        const terrainNormal = sampleTerrainNormal(
          getTerrainHeight,
          TARGET_DEER_POSITION.x,
          TARGET_DEER_POSITION.z
        );

        deer.position.set(0, -minY + 0.02, 0);

        const lookTarget = getRiverLookTarget(riverCurve, pondCenter, TARGET_DEER_POSITION);
        const headingAngle = Math.atan2(
          lookTarget.x - TARGET_DEER_POSITION.x,
          lookTarget.z - TARGET_DEER_POSITION.z
        );

        deerHeading.rotation.y = headingAngle;

        deer.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
          }
        });

        deerRoot.position.set(
          TARGET_DEER_POSITION.x,
          terrainY,
          TARGET_DEER_POSITION.z
        );
        deerRoot.quaternion.setFromUnitVectors(WORLD_UP, terrainNormal);
        deerHeading.add(deer);
        deerRoot.add(deerHeading);
        deerRoot.updateMatrixWorld(true);
        deerRoot.matrixAutoUpdate = false;
        deerHeading.matrixAutoUpdate = false;
        deer.matrixAutoUpdate = false;
        scene.add(deerRoot);

        console.info('Deer loaded', {
          position: deerRoot.position.toArray(),
          scale,
        });

        resolve({
          deer: deerRoot,
          update() {},
        });
      },
      undefined,
      (error) => {
        console.warn('Failed to load deer model', error);
        resolve(createFallbackMarker());
      }
    );
  });
}
