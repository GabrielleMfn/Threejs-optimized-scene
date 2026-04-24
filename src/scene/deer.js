import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetUrl } from '../utils/assetUrl.js';

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

function createLowPolyDeer(color = 0x9a7550) {
  const deer = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0.03,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.08, 5, 10), bodyMaterial);
  body.rotation.z = Math.PI * 0.5;
  body.position.set(0, 1.08, 0);

  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.52, 4, 8), bodyMaterial);
  neck.position.set(0.58, 1.46, 0);
  neck.rotation.z = -Math.PI * 0.34;

  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.35, 4, 8), bodyMaterial);
  head.position.set(0.84, 1.63, 0);
  head.rotation.z = -Math.PI * 0.22;

  const legGeometry = new THREE.CylinderGeometry(0.055, 0.065, 0.98, 6);
  const legOffsets = [
    [0.34, 0.46],
    [0.34, -0.46],
    [-0.34, 0.42],
    [-0.34, -0.42],
  ];

  for (let i = 0; i < legOffsets.length; i += 1) {
    const [x, z] = legOffsets[i];
    const leg = new THREE.Mesh(legGeometry, bodyMaterial);
    leg.position.set(x, 0.5, z);
    deer.add(leg);
  }

  deer.add(body, neck, head);
  return deer;
}

function fitModelToTargetHeight(model, targetHeight) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  bounds.getSize(size);

  const baseHeight = Math.max(0.001, size.y);
  const scale = targetHeight / baseHeight;
  model.scale.setScalar(scale);

  model.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3().setFromObject(model);
  const minY = scaledBounds.min.y;
  model.position.set(0, -minY + 0.02, 0);

  return scale;
}

function placeStaticDeerRoot(root, getTerrainHeight, riverCurve, pondCenter) {
  const terrainY = Number.isFinite(TARGET_DEER_POSITION.y)
    ? TARGET_DEER_POSITION.y
    : getTerrainHeight(TARGET_DEER_POSITION.x, TARGET_DEER_POSITION.z);

  const terrainNormal = sampleTerrainNormal(
    getTerrainHeight,
    TARGET_DEER_POSITION.x,
    TARGET_DEER_POSITION.z
  );

  const lookTarget = getRiverLookTarget(riverCurve, pondCenter, TARGET_DEER_POSITION);
  const headingAngle = Math.atan2(
    lookTarget.x - TARGET_DEER_POSITION.x,
    lookTarget.z - TARGET_DEER_POSITION.z
  );

  root.position.set(TARGET_DEER_POSITION.x, terrainY, TARGET_DEER_POSITION.z);
  root.quaternion.setFromUnitVectors(WORLD_UP, terrainNormal);
  root.rotation.y += headingAngle;
}

export function createDeer(scene, getTerrainHeight, riverCurve, pondCenter, options = {}) {
  const loader = new GLTFLoader();

  function createFallbackMarker() {
    const deerRoot = new THREE.Group();
    const deerHeading = new THREE.Group();
    const lod = new THREE.LOD();

    const nearDeer = createLowPolyDeer(0x8f6c4b);
    const farDeer = createLowPolyDeer(0x74563d);
    fitModelToTargetHeight(nearDeer, TARGET_DEER_HEIGHT * 0.96);
    fitModelToTargetHeight(farDeer, TARGET_DEER_HEIGHT * 0.9);

    lod.addLevel(nearDeer, 0);
    lod.addLevel(farDeer, 62);

    deerHeading.add(lod);
    deerRoot.add(deerHeading);
    placeStaticDeerRoot(deerRoot, getTerrainHeight, riverCurve, pondCenter);
    deerRoot.updateMatrixWorld(true);
    deerRoot.matrixAutoUpdate = false;
    deerHeading.matrixAutoUpdate = false;

    deerRoot.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });

    scene.add(deerRoot);

    console.info('Using lightweight deer fallback with LOD');

    return {
      deer: deerRoot,
      update(camera) {
        if (camera) {
          lod.update(camera);
        }
      },
    };
  }

  return new Promise((resolve) => {
    loader.load(
      assetUrl('/cerf/23870b8f869b49b8ad9b09a020bedd30_Textured.gltf'),
      (gltf) => {
        const deerRoot = new THREE.Group();
        const deerHeading = new THREE.Group();
        const deerLod = new THREE.LOD();
        const deer = gltf.scene;
        deer.rotation.set(-Math.PI * 0.5, 0, 0);
        const farDeer = createLowPolyDeer(0x6f523a);

        const scale = fitModelToTargetHeight(deer, TARGET_DEER_HEIGHT);
        fitModelToTargetHeight(farDeer, TARGET_DEER_HEIGHT * 0.9);

        deerLod.addLevel(deer, 0);
        deerLod.addLevel(farDeer, 120);

        deer.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
          }
        });

        farDeer.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
          }
        });

        deerHeading.add(deerLod);
        deerRoot.add(deerHeading);
        placeStaticDeerRoot(deerRoot, getTerrainHeight, riverCurve, pondCenter);
        deerRoot.updateMatrixWorld(true);
        deerRoot.matrixAutoUpdate = false;
        deerHeading.matrixAutoUpdate = false;
        scene.add(deerRoot);

        console.info('Deer loaded', {
          position: deerRoot.position.toArray(),
          scale,
        });

        resolve({
          deer: deerRoot,
          update(camera) {
            if (camera) {
              deerLod.update(camera);
            }
          },
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
