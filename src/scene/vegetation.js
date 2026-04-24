import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { VEGETATION_CONFIG } from './sceneConfig.js';
import { CAMP_GRASS_CLEAR_ZONE } from './campProps.js';
import grassColorUrl from '../../Texture_prof/Herbe/color.webp';
import grassNormalUrl from '../../Texture_prof/Herbe/normal.webp';
import grassRmaoUrl from '../../Texture_prof/Herbe/rmao.webp';
import bushColorUrl from '../../Texture_prof/Buisson/BaseColor.webp';
import bushNormalUrl from '../../Texture_prof/Buisson/Normal.webp';
import bushOrmUrl from '../../Texture_prof/Buisson/OcclusionRoughnessMetallic.webp';

const TEMP_OBJECT = new THREE.Object3D();
const TEMP_SIZE = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const TEMP_NORMAL = new THREE.Vector3();
const TEMP_ALIGN_QUAT = new THREE.Quaternion();
const TEMP_TWIST_QUAT = new THREE.Quaternion();
const TEX_LOADER = new THREE.TextureLoader();
const TERRAIN_RAYCASTER = new THREE.Raycaster();
const TERRAIN_RAY_ORIGIN = new THREE.Vector3();
const TERRAIN_RAY_DIRECTION = new THREE.Vector3(0, -1, 0);
const TERRAIN_SAMPLER_CACHE = new WeakMap();

// Replace these mesh-name specs if you swap to another GLB.
const TREE_VARIANT_SPECS = [
  {
    name: 'tree-stylized-01',
    targetHeight: 11.0,
    meshNames: [
      'tree-stylized-01_tree-branch-stylized-diffuse_0',
      'tree-stylized-01_tree-wood_0',
    ],
  },
  {
    name: 'tree-stylized-02-dry',
    targetHeight: 10.2,
    meshNames: [
      'tree-stylized-02-dry_tree-bark-02_0',
      'tree-stylized-02-dry_tree-branches-dry-diffuse_0',
    ],
  },
  {
    name: 'tree-stylized-03-autumn-yellow',
    targetHeight: 10.8,
    meshNames: [
      'tree-stylized-03-autumn-yellow_tree-branches-autumn-yellow-mix-diffuse_0',
      'tree-stylized-03-autumn-yellow_tree-bark-03_0',
    ],
  },
  {
    name: 'tree-stylized-04-green',
    targetHeight: 11.2,
    meshNames: [
      'tree-stylized-04-green_tree-04_0',
      'tree-stylized-04-green_tree-branches-mix-diffuse_0',
    ],
  },
  {
    name: 'tree-stylized-05-autumn-brown',
    targetHeight: 11.0,
    meshNames: [
      'tree-stylized-05-autumn-brown_tree-branches-autumn-mix-diffuse_0',
      'tree-stylized-05-autumn-brown_tree-bark-03_0',
    ],
  },
];

const FLOWER_VARIANT_SPECS = [
  {
    name: 'daisy-01',
    targetHeight: 0.72,
    meshNames: [
      'daisy-flower-diffuse-01_daisy-flower-diffuse_0',
      'daisy-flower-diffuse-01_daisy-stem-diffuse_0',
    ],
  },
  {
    name: 'daisy-02',
    targetHeight: 0.72,
    meshNames: [
      'daisy-flower-diffuse-02_daisy-flower-diffuse_0',
      'daisy-flower-diffuse-02_daisy-stem-diffuse_0',
    ],
  },
  {
    name: 'daisy-03',
    targetHeight: 0.72,
    meshNames: [
      'daisy-flower-diffuse-03_daisy-flower-diffuse_0',
      'daisy-flower-diffuse-03_daisy-stem-diffuse-02_0',
    ],
  },
  {
    name: 'daffodil-01',
    targetHeight: 0.78,
    meshNames: [
      'daffodil-flower-01_daffodil-stem-01-diffuse_0',
      'daffodil-flower-01_daffodil-flower-yellow_0',
    ],
  },
  {
    name: 'daffodil-02',
    targetHeight: 0.78,
    meshNames: [
      'daffodil-flower-02_daffodil-flower-white_0',
      'daffodil-flower-02_daffodil-stem-02-diffuse_0',
    ],
  },
];

function setupGroundCoverTexture(texture, isColor = false) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (isColor) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
}

function createGroundCoverMaterial(colorUrl, normalUrl, ormUrl, alphaCutoff = 0.44) {
  const map = TEX_LOADER.load(colorUrl);

  setupGroundCoverTexture(map, true);

  return new THREE.MeshBasicMaterial({
    map,
    color: 0xffffff,
    transparent: false,
    alphaTest: alphaCutoff,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    fog: true,
    toneMapped: false,
  });
}

function cloneMaterial(material, fallbackColor) {
  if (Array.isArray(material) && material.length > 0) {
    return material[0].clone();
  }

  if (material) {
    return material.clone();
  }

  return new THREE.MeshStandardMaterial({
    color: fallbackColor,
    roughness: 0.9,
    metalness: 0.02,
  });
}

function bakeMeshPart(mesh, fallbackColor) {
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();

  return {
    geometry,
    material: cloneMaterial(mesh.material, fallbackColor),
  };
}

function computeVariantBounds(parts) {
  const totalBox = new THREE.Box3();
  let initialized = false;

  for (const part of parts) {
    if (!part.geometry.boundingBox) {
      part.geometry.computeBoundingBox();
    }

    if (!part.geometry.boundingBox) {
      continue;
    }

    if (!initialized) {
      totalBox.copy(part.geometry.boundingBox);
      initialized = true;
      continue;
    }

    totalBox.union(part.geometry.boundingBox);
  }

  return {
    initialized,
    box: totalBox,
  };
}

function normalizeVariantPivot(parts) {
  const bounds = computeVariantBounds(parts);
  if (!bounds.initialized) {
    return;
  }

  const centerX = (bounds.box.min.x + bounds.box.max.x) * 0.5;
  const centerZ = (bounds.box.min.z + bounds.box.max.z) * 0.5;
  const offsetY = -bounds.box.min.y;

  for (const part of parts) {
    part.geometry.translate(-centerX, offsetY, -centerZ);
    part.geometry.computeBoundingBox();
  }
}

function computeVariantHeight(parts) {
  const bounds = computeVariantBounds(parts);
  if (!bounds.initialized) {
    return 1;
  }

  bounds.box.getSize(TEMP_SIZE);
  return Math.max(0.001, TEMP_SIZE.y);
}

function buildManualVariants(meshMap, specs, fallbackColor) {
  const variants = [];

  for (const spec of specs) {
    const meshes = spec.meshNames
      .map((name) => meshMap.get(name))
      .filter((mesh) => Boolean(mesh));

    if (meshes.length === 0) {
      continue;
    }

    const parts = meshes.map((mesh) => bakeMeshPart(mesh, fallbackColor));
    normalizeVariantPivot(parts);
    const measuredHeight = computeVariantHeight(parts);
    const baseScale = spec.targetHeight / measuredHeight;

    variants.push({
      name: spec.name,
      parts,
      baseScale,
    });
  }

  return variants;
}

function createFallbackVariants(category) {
  if (category === 'trees') {
    return [
      {
        name: 'fallback-tree',
        baseScale: 1,
        parts: [
          {
            geometry: new THREE.ConeGeometry(0.95, 7.8, 8),
            material: new THREE.MeshStandardMaterial({ color: 0x4d7d45, roughness: 0.92, metalness: 0.03 }),
          },
        ],
      },
    ];
  }

  if (category === 'flowers') {
    return [
      {
        name: 'fallback-flower',
        baseScale: 1,
        parts: [
          {
            geometry: new THREE.TetrahedronGeometry(0.2, 0),
            material: new THREE.MeshStandardMaterial({ color: 0xff8fb9, roughness: 0.86, metalness: 0.01 }),
          },
        ],
      },
    ];
  }

  return [
    {
      name: 'fallback-grass',
      baseScale: 1,
      parts: [
        {
          geometry: new THREE.ConeGeometry(0.15, 0.95, 5),
          material: new THREE.MeshStandardMaterial({ color: 0x65a952, roughness: 1.0, metalness: 0.0 }),
        },
      ],
    },
  ];
}

function sampleEdgePosition(inner = 66, outer = 88) {
  const angle = Math.random() * Math.PI * 2;
  const radius = inner + Math.random() * (outer - inner);

  return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
}

function sampleNearRiver(curve, minOffset, maxOffset) {
  const t = Math.random();
  const point = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

  const sign = Math.random() < 0.5 ? -1 : 1;
  const offset = minOffset + Math.random() * (maxOffset - minOffset);

  return new THREE.Vector3(
    point.x + normal.x * offset * sign + (Math.random() - 0.5) * 1.2,
    0,
    point.z + normal.z * offset * sign + (Math.random() - 0.5) * 1.2
  );
}

function sampleAlongRiverBand(curve, t, minOffset, maxOffset) {
  const point = curve.getPointAt(THREE.MathUtils.euclideanModulo(t, 1));
  const tangent = curve.getTangentAt(THREE.MathUtils.euclideanModulo(t, 1)).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const sign = Math.random() < 0.5 ? -1 : 1;
  const offset = minOffset + Math.random() * (maxOffset - minOffset);

  return new THREE.Vector3(
    point.x + normal.x * offset * sign,
    0,
    point.z + normal.z * offset * sign
  );
}

function sampleNearPond(pondCenter, pondRadius, minRing, maxRing) {
  const angle = Math.random() * Math.PI * 2;
  const radius = pondRadius + minRing + Math.random() * (maxRing - minRing);

  return new THREE.Vector3(
    pondCenter.x + Math.cos(angle) * radius,
    0,
    pondCenter.z + Math.sin(angle) * radius
  );
}

function sampleRandomGround(radius) {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * radius;
  return new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
}

function projectToTerrain(terrainMesh, position) {
  if (!terrainMesh) {
    return position.clone();
  }

  TERRAIN_RAY_ORIGIN.set(position.x, 120, position.z);
  TERRAIN_RAYCASTER.set(TERRAIN_RAY_ORIGIN, TERRAIN_RAY_DIRECTION);
  const hit = TERRAIN_RAYCASTER.intersectObject(terrainMesh, false)[0];

  if (!hit) {
    return position.clone();
  }

  return hit.point.clone();
}

function getTerrainSurfaceSampler(terrainMesh) {
  if (!terrainMesh) {
    return null;
  }

  if (TERRAIN_SAMPLER_CACHE.has(terrainMesh)) {
    return TERRAIN_SAMPLER_CACHE.get(terrainMesh);
  }

  const sampler = new MeshSurfaceSampler(terrainMesh).build();
  TERRAIN_SAMPLER_CACHE.set(terrainMesh, sampler);
  return sampler;
}

function sampleTerrainSurfacePoint(sampler, targetPosition, targetNormal) {
  if (!sampler) {
    return false;
  }

  sampler.sample(targetPosition, targetNormal);
  return true;
}

function sampleCoveredTerrainPoint({
  terrainSampler,
  riverSamples,
  pondCenter,
  pondRadius,
  minRiverDistance,
  maxRiverDistance,
  targetPosition,
  targetNormal,
  maxAttempts = 28,
}) {
  if (!terrainSampler) {
    return false;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    sampleTerrainSurfacePoint(terrainSampler, targetPosition, targetNormal);

    if (isInWaterZone(targetPosition.x, targetPosition.z, riverSamples, pondCenter, pondRadius)) {
      continue;
    }

    const riverDistance = distanceToRiverSamples(targetPosition.x, targetPosition.z, riverSamples);
    if (riverDistance < minRiverDistance || riverDistance > maxRiverDistance) {
      continue;
    }

    return true;
  }

  return false;
}

function createRiverSamples(curve, sampleCount = 96) {
  const points = [];

  for (let i = 0; i <= sampleCount; i += 1) {
    points.push(curve.getPointAt(i / sampleCount));
  }

  return points;
}

function distancePointToSegment2D(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;

  const abSq = abx * abx + abz * abz;
  const t = abSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apz * abz) / abSq)) : 0;

  const cx = ax + abx * t;
  const cz = az + abz * t;
  return Math.hypot(px - cx, pz - cz);
}

function distanceToRiverSamples(x, z, riverSamples) {
  let minDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < riverSamples.length - 1; i += 1) {
    const a = riverSamples[i];
    const b = riverSamples[i + 1];

    const distance = distancePointToSegment2D(x, z, a.x, a.z, b.x, b.z);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

function isInWaterZone(x, z, riverSamples, pondCenter, pondRadius) {
  if (pondRadius > 0.01) {
    const pondDistance = Math.hypot(x - pondCenter.x, z - pondCenter.z);
    if (pondDistance < pondRadius + VEGETATION_CONFIG.waterExclusion.pondPadding) {
      return true;
    }
  }

  const riverDistance = distanceToRiverSamples(x, z, riverSamples);
  return riverDistance < VEGETATION_CONFIG.waterExclusion.riverWidth;
}

function isInCampClearZone(x, z) {
  if (!CAMP_GRASS_CLEAR_ZONE) {
    return false;
  }

  const dx = x - CAMP_GRASS_CLEAR_ZONE.x;
  const dz = z - CAMP_GRASS_CLEAR_ZONE.z;
  return dx * dx + dz * dz < CAMP_GRASS_CLEAR_ZONE.radius * CAMP_GRASS_CLEAR_ZONE.radius;
}

function createScatteredGroundCover(
  scene,
  getTerrainHeight,
  riverCurve,
  pondCenter,
  pondRadius,
  riverSamples,
  terrainMesh,
  options = {}
) {
  const grassConfig = VEGETATION_CONFIG.grass;
  const densityScale = Math.max(0.35, Math.min(1, options.grassDensityScale || 1));
  const farLodBoost = Math.max(1, options.grassFarLodBoost || 1);
  const grassCount = Math.max(
    900,
    Math.floor(
      (Math.floor(grassConfig.riverBankCount * 0.7) + Math.floor(grassConfig.meadowCount * 0.72)) * densityScale
    )
  );
  const bushCount = Math.max(80, Math.floor(grassConfig.riverBankCount * 0.12 * densityScale));
  const terrainSampler = getTerrainSurfaceSampler(terrainMesh);
  const sampledPosition = new THREE.Vector3();
  const sampledNormal = new THREE.Vector3();
  const spawnPosition = new THREE.Vector3();

  const grassCellSize = 0.48;
  const grassMinDistanceSq = 0.34 * 0.34;
  const bushCellSize = 0.9;
  const bushMinDistanceSq = 0.68 * 0.68;
  const grassCells = new Map();
  const bushCells = new Map();

  function toCellKey(x, z, cellSize) {
    const cx = Math.floor(x / cellSize);
    const cz = Math.floor(z / cellSize);
    return `${cx},${cz}`;
  }

  function canPlaceWithSpacing(cellMap, x, z, cellSize, minDistanceSq) {
    const cx = Math.floor(x / cellSize);
    const cz = Math.floor(z / cellSize);

    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const key = `${cx + dx},${cz + dz}`;
        const points = cellMap.get(key);
        if (!points) {
          continue;
        }

        for (let i = 0; i < points.length; i += 1) {
          const point = points[i];
          const ddx = x - point.x;
          const ddz = z - point.z;
          if (ddx * ddx + ddz * ddz < minDistanceSq) {
            return false;
          }
        }
      }
    }

    return true;
  }

  function registerPlacedPoint(cellMap, x, z, cellSize) {
    const key = toCellKey(x, z, cellSize);
    const points = cellMap.get(key);
    if (points) {
      points.push({ x, z });
      return;
    }

    cellMap.set(key, [{ x, z }]);
  }

  const grassGeometry = new THREE.PlaneGeometry(1.05, 1.7, 1, 1);
  grassGeometry.translate(0, 0.85, 0);

  const bushGeometry = new THREE.PlaneGeometry(1.9, 2.2, 1, 1);
  bushGeometry.translate(0, 1.1, 0);

  const grassMaterial = createGroundCoverMaterial(grassColorUrl, grassNormalUrl, grassRmaoUrl, 0.14);
  const bushMaterial = createGroundCoverMaterial(bushColorUrl, bushNormalUrl, bushOrmUrl, 0.16);

  const grassA = new THREE.InstancedMesh(grassGeometry, grassMaterial, grassCount);
  const grassB = new THREE.InstancedMesh(grassGeometry, grassMaterial, grassCount);
  const bushesA = new THREE.InstancedMesh(bushGeometry, bushMaterial, bushCount);
  const bushesB = new THREE.InstancedMesh(bushGeometry, bushMaterial, bushCount);
  const grassRecords = [];

  const safeRiverOffsetMin = VEGETATION_CONFIG.waterExclusion.riverWidth + 1.8;
  const safeRiverOffsetMax = safeRiverOffsetMin + 9.6;

  for (let i = 0; i < grassCount; i += 1) {
    const wantsRiverBand = Math.random() < 0.52;
    const minRiverDistance = wantsRiverBand ? safeRiverOffsetMin : safeRiverOffsetMin + 2.4;
    const maxRiverDistance = wantsRiverBand ? safeRiverOffsetMax : grassConfig.meadowRadius;

    if (!sampleCoveredTerrainPoint({
      terrainSampler,
      riverSamples,
      pondCenter,
      pondRadius,
      minRiverDistance,
      maxRiverDistance,
      targetPosition: sampledPosition,
      targetNormal: sampledNormal,
    })) {
      i -= 1;
      continue;
    }

    if (isInCampClearZone(sampledPosition.x, sampledPosition.z)) {
      i -= 1;
      continue;
    }

    if (!canPlaceWithSpacing(grassCells, sampledPosition.x, sampledPosition.z, grassCellSize, grassMinDistanceSq)) {
      i -= 1;
      continue;
    }

    registerPlacedPoint(grassCells, sampledPosition.x, sampledPosition.z, grassCellSize);

    spawnPosition.copy(sampledPosition).addScaledVector(sampledNormal, 0.002);
    const scale = 0.72 + Math.random() * 1.08;
    const rot = Math.random() * Math.PI * 2;

    TEMP_NORMAL.copy(sampledNormal).normalize();
    TEMP_ALIGN_QUAT.setFromUnitVectors(WORLD_UP, TEMP_NORMAL);

    TEMP_OBJECT.position.copy(spawnPosition);
    TEMP_TWIST_QUAT.setFromAxisAngle(TEMP_NORMAL, rot);
    TEMP_OBJECT.quaternion.copy(TEMP_ALIGN_QUAT).multiply(TEMP_TWIST_QUAT);
    TEMP_OBJECT.scale.set(scale, scale * (0.9 + Math.random() * 0.4), 1);
    TEMP_OBJECT.updateMatrix();
    grassA.setMatrixAt(i, TEMP_OBJECT.matrix);
    const matrixA = TEMP_OBJECT.matrix.clone();

    TEMP_TWIST_QUAT.setFromAxisAngle(TEMP_NORMAL, rot + Math.PI * 0.5);
    TEMP_OBJECT.quaternion.copy(TEMP_ALIGN_QUAT).multiply(TEMP_TWIST_QUAT);
    TEMP_OBJECT.updateMatrix();
    grassB.setMatrixAt(i, TEMP_OBJECT.matrix);
    const matrixB = TEMP_OBJECT.matrix.clone();

    grassRecords.push({
      x: sampledPosition.x,
      z: sampledPosition.z,
      matrixA,
      matrixB,
    });
  }

  const bushOffsetMin = VEGETATION_CONFIG.waterExclusion.riverWidth + 5.4;
  const bushOffsetMax = bushOffsetMin + 8.8;

  for (let i = 0; i < bushCount; i += 1) {
    if (!sampleCoveredTerrainPoint({
      terrainSampler,
      riverSamples,
      pondCenter,
      pondRadius,
      minRiverDistance: bushOffsetMin,
      maxRiverDistance: bushOffsetMax,
      targetPosition: sampledPosition,
      targetNormal: sampledNormal,
    })) {
      i -= 1;
      continue;
    }

    if (!canPlaceWithSpacing(bushCells, sampledPosition.x, sampledPosition.z, bushCellSize, bushMinDistanceSq)) {
      i -= 1;
      continue;
    }

    registerPlacedPoint(bushCells, sampledPosition.x, sampledPosition.z, bushCellSize);

    spawnPosition.copy(sampledPosition).addScaledVector(sampledNormal, 0.003);
    const scale = 0.72 + Math.random() * 0.56;
    const rot = Math.random() * Math.PI * 2;

    TEMP_NORMAL.copy(sampledNormal).normalize();
    TEMP_ALIGN_QUAT.setFromUnitVectors(WORLD_UP, TEMP_NORMAL);

    TEMP_OBJECT.position.copy(spawnPosition);
    TEMP_TWIST_QUAT.setFromAxisAngle(TEMP_NORMAL, rot);
    TEMP_OBJECT.quaternion.copy(TEMP_ALIGN_QUAT).multiply(TEMP_TWIST_QUAT);
    TEMP_OBJECT.scale.set(scale, scale * (0.88 + Math.random() * 0.42), 1);
    TEMP_OBJECT.updateMatrix();
    bushesA.setMatrixAt(i, TEMP_OBJECT.matrix);

    TEMP_TWIST_QUAT.setFromAxisAngle(TEMP_NORMAL, rot + Math.PI * 0.5);
    TEMP_OBJECT.quaternion.copy(TEMP_ALIGN_QUAT).multiply(TEMP_TWIST_QUAT);
    TEMP_OBJECT.updateMatrix();
    bushesB.setMatrixAt(i, TEMP_OBJECT.matrix);
  }

  grassA.instanceMatrix.needsUpdate = true;
  grassB.instanceMatrix.needsUpdate = true;
  bushesA.instanceMatrix.needsUpdate = true;
  bushesB.instanceMatrix.needsUpdate = true;

  grassA.frustumCulled = true;
  grassB.frustumCulled = true;
  bushesA.frustumCulled = true;
  bushesB.frustumCulled = true;

  scene.add(grassA);
  scene.add(grassB);
  scene.add(bushesA);
  scene.add(bushesB);

  const nearDistanceSq = grassConfig.lodNearDistance * grassConfig.lodNearDistance;
  const midDistanceSq = grassConfig.lodMidDistance * grassConfig.lodMidDistance;
  const farDistanceSq = grassConfig.lodFarDistance * grassConfig.lodFarDistance;
  const midStride = Math.max(1, grassConfig.lodMidStride || 3);
  const farStride = Math.max(midStride + 1, Math.floor((grassConfig.lodFarStride || 8) * farLodBoost));
  const updateInterval = Math.max(0.15, grassConfig.lodUpdateInterval || 0.35);
  let lastUpdateTime = -1000;

  function applyGrassLod(cameraPosition) {
    let activeIndex = 0;

    for (let i = 0; i < grassRecords.length; i += 1) {
      const item = grassRecords[i];
      const dx = item.x - cameraPosition.x;
      const dz = item.z - cameraPosition.z;
      const distSq = dx * dx + dz * dz;

      let keep = false;
      if (distSq <= nearDistanceSq) {
        keep = true;
      } else if (distSq <= midDistanceSq) {
        keep = i % midStride === 0;
      } else if (distSq <= farDistanceSq) {
        keep = i % farStride === 0;
      }

      if (!keep) {
        continue;
      }

      grassA.setMatrixAt(activeIndex, item.matrixA);
      grassB.setMatrixAt(activeIndex, item.matrixB);
      activeIndex += 1;
    }

    grassA.count = activeIndex;
    grassB.count = activeIndex;
    grassA.instanceMatrix.needsUpdate = true;
    grassB.instanceMatrix.needsUpdate = true;
  }

  applyGrassLod(new THREE.Vector3(0, 0, 24));

  return {
    update(cameraPosition, elapsedTime) {
      if (!cameraPosition) {
        return;
      }

      if (elapsedTime - lastUpdateTime < updateInterval) {
        return;
      }

      applyGrassLod(cameraPosition);
      lastUpdateTime = elapsedTime;
    },
  };
}

function assignTransformsToVariants(variants, transforms) {
  const buckets = variants.map(() => []);

  for (let i = 0; i < transforms.length; i += 1) {
    const variantIndex = Math.floor(Math.random() * variants.length);
    buckets[variantIndex].push(transforms[i]);
  }

  return buckets;
}

function instantiateVariant(scene, variant, transforms) {
  if (transforms.length === 0) {
    return;
  }

  for (const part of variant.parts) {
    const instance = new THREE.InstancedMesh(part.geometry, part.material, transforms.length);

    for (let i = 0; i < transforms.length; i += 1) {
      const transform = transforms[i];

      TEMP_OBJECT.position.set(transform.x, transform.y, transform.z);
      TEMP_OBJECT.rotation.set(0, transform.rotationY, 0);
      TEMP_OBJECT.scale.setScalar(transform.scale);
      TEMP_OBJECT.updateMatrix();

      instance.setMatrixAt(i, TEMP_OBJECT.matrix);
    }

    instance.instanceMatrix.needsUpdate = true;
    scene.add(instance);
  }
}

function buildTransforms({
  count,
  sampler,
  getTerrainHeight,
  baseScaleFn,
  jitterY = 0.03,
  terrainMesh,
  validator,
  maxAttempts = 24,
}) {
  const transforms = [];

  for (let i = 0; i < count; i += 1) {
    let position = sampler();

    if (validator) {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (validator(position)) {
          break;
        }

        position = sampler();
      }
    }

    const terrainPoint = projectToTerrain(terrainMesh, position);
    const y = terrainPoint.y + jitterY;

    transforms.push({
      x: terrainPoint.x,
      y,
      z: terrainPoint.z,
      rotationY: Math.random() * Math.PI * 2,
      scale: baseScaleFn(),
    });
  }

  return transforms;
}

function createTreeImpostorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;

  const context = canvas.getContext('2d');

  context.clearRect(0, 0, canvas.width, canvas.height);

  const crown = context.createRadialGradient(64, 84, 6, 64, 84, 76);
  crown.addColorStop(0, 'rgba(173, 104, 56, 0.98)');
  crown.addColorStop(0.45, 'rgba(130, 72, 36, 0.95)');
  crown.addColorStop(1, 'rgba(64, 38, 26, 0)');

  context.fillStyle = crown;
  context.beginPath();
  context.ellipse(64, 96, 56, 76, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = 'rgba(78, 49, 34, 0.95)';
  context.fillRect(58, 120, 12, 124);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createTreeImpostors(scene, transforms) {
  if (transforms.length === 0) {
    return;
  }

  const texture = createTreeImpostorTexture();
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.36,
    depthWrite: false,
    color: 0xbec999,
    side: THREE.DoubleSide,
    fog: true,
  });

  const impostorsA = new THREE.InstancedMesh(geometry, material, transforms.length);
  const impostorsB = new THREE.InstancedMesh(geometry, material, transforms.length);

  for (let i = 0; i < transforms.length; i += 1) {
    const transform = transforms[i];

    const height = 8.6 + Math.random() * 5.4;
    const width = height * (0.38 + Math.random() * 0.18);

    TEMP_OBJECT.position.set(transform.x, transform.y + height * 0.5, transform.z);
    TEMP_OBJECT.rotation.set(0, transform.rotationY, 0);
    TEMP_OBJECT.scale.set(width, height, 1);
    TEMP_OBJECT.updateMatrix();
    impostorsA.setMatrixAt(i, TEMP_OBJECT.matrix);

    TEMP_OBJECT.rotation.set(0, transform.rotationY + Math.PI * 0.5, 0);
    TEMP_OBJECT.updateMatrix();
    impostorsB.setMatrixAt(i, TEMP_OBJECT.matrix);
  }

  impostorsA.instanceMatrix.needsUpdate = true;
  impostorsB.instanceMatrix.needsUpdate = true;
  scene.add(impostorsA);
  scene.add(impostorsB);
}

function createTrees(scene, variants, getTerrainHeight, riverCurve, pondCenter, pondRadius, riverSamples, terrainMesh) {
  const treeConfig = VEGETATION_CONFIG.trees;

  const sampleTreePosition = () => {
    const random = Math.random();

    if (random < 0.68) {
      return sampleEdgePosition(treeConfig.edgeInner, treeConfig.edgeOuter);
    }

    return sampleNearRiver(riverCurve, treeConfig.nearRiverOffsetMin, treeConfig.nearRiverOffsetMax);
  };

  const transforms = buildTransforms({
    count: treeConfig.totalCount,
    sampler: sampleTreePosition,
    getTerrainHeight,
    baseScaleFn: () => 0.82 + Math.random() * 0.5,
    jitterY: 0.01,
    terrainMesh,
    validator: (position) => {
      const centerDistance = Math.hypot(position.x - pondCenter.x, position.z - pondCenter.z);
      if (centerDistance < pondRadius + treeConfig.centerExclusionRadius) {
        return false;
      }

      return !isInWaterZone(position.x, position.z, riverSamples, pondCenter, pondRadius);
    },
  });

  const detailedTransforms = [];
  const impostorTransforms = [];

  for (const transform of transforms) {
    const centerDistance = Math.hypot(transform.x - pondCenter.x, transform.z - pondCenter.z);

    if (
      centerDistance > treeConfig.impostorStartRadius &&
      Math.random() < treeConfig.impostorRatio
    ) {
      impostorTransforms.push(transform);
    } else {
      detailedTransforms.push(transform);
    }
  }

  const buckets = assignTransformsToVariants(variants, detailedTransforms);

  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i];
    const transformed = buckets[i].map((item) => ({
      ...item,
      scale: item.scale * variant.baseScale,
    }));

    instantiateVariant(scene, variant, transformed);
  }

  createTreeImpostors(scene, impostorTransforms);

  console.info('Tree LOD distribution', {
    detailed: detailedTransforms.length,
    impostors: impostorTransforms.length,
  });
}

function createFlowers(scene, variants, getTerrainHeight, riverCurve, pondCenter, pondRadius, riverSamples, terrainMesh) {
  const flowerConfig = VEGETATION_CONFIG.flowers;

  const transforms = buildTransforms({
    count: flowerConfig.count,
    sampler: () => {
      const random = Math.random();

      if (random < 0.84) {
        return sampleNearRiver(riverCurve, flowerConfig.riverOffsetMin, flowerConfig.riverOffsetMax);
      }

      return sampleNearPond(pondCenter, pondRadius, flowerConfig.pondRingMin, flowerConfig.pondRingMax);
    },
    getTerrainHeight,
    baseScaleFn: () => 0.78 + Math.random() * 0.6,
    jitterY: 0.012,
    terrainMesh,
    validator: (position) => !isInWaterZone(position.x, position.z, riverSamples, pondCenter, pondRadius),
  });

  const buckets = assignTransformsToVariants(variants, transforms);

  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i];
    const transformed = buckets[i].map((item) => ({
      ...item,
      scale: item.scale * variant.baseScale,
    }));

    instantiateVariant(scene, variant, transformed);
  }
}

function createRiverBankGrass(scene, variants, getTerrainHeight, riverCurve, pondCenter, pondRadius, riverSamples) {
  const grassConfig = VEGETATION_CONFIG.grass;

  const transforms = buildTransforms({
    count: grassConfig.riverBankCount,
    sampler: () => {
      const random = Math.random();

      if (random < 0.65) {
        return sampleNearRiver(riverCurve, grassConfig.riverOffsetMin, grassConfig.riverOffsetMax);
      }

      return sampleNearPond(pondCenter, pondRadius, grassConfig.pondRingMin, grassConfig.pondRingMax);
    },
    getTerrainHeight,
    baseScaleFn: () => 0.76 + Math.random() * 0.62,
    jitterY: 0.004,
    validator: (position) => !isInWaterZone(position.x, position.z, riverSamples, pondCenter, pondRadius),
  });

  const buckets = assignTransformsToVariants(variants, transforms);

  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i];
    const transformed = buckets[i].map((item) => ({
      ...item,
      scale: item.scale * variant.baseScale,
    }));

    instantiateVariant(scene, variant, transformed);
  }
}


function createMeadowGrass(scene, variants, getTerrainHeight, riverSamples, pondCenter, pondRadius, terrainMesh) {
  const grassConfig = VEGETATION_CONFIG.grass;

  const transforms = buildTransforms({
    count: grassConfig.meadowCount,
    sampler: () => sampleRandomGround(grassConfig.meadowRadius),
    getTerrainHeight,
    baseScaleFn: () => 0.58 + Math.random() * 0.54,
    jitterY: 0.002,
    terrainMesh,
    validator: (position) => !isInWaterZone(position.x, position.z, riverSamples, pondCenter, pondRadius),
  });

  const buckets = assignTransformsToVariants(variants, transforms);

  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i];
    const transformed = buckets[i].map((item) => ({
      ...item,
      scale: item.scale * variant.baseScale,
    }));

    instantiateVariant(scene, variant, transformed);
  }
}

function buildVegetationVariants(meshMap) {
  const trees = buildManualVariants(meshMap, TREE_VARIANT_SPECS, 0x4d7d45);
  const flowers = buildManualVariants(meshMap, FLOWER_VARIANT_SPECS, 0xff8fb9);

  return {
    trees: trees.length > 0 ? trees : createFallbackVariants('trees'),
    flowers: flowers.length > 0 ? flowers : createFallbackVariants('flowers'),
  };
}

function placeVegetationInstances(
  scene,
  getTerrainHeight,
  riverCurve,
  pondCenter,
  pondRadius,
  variants,
  terrainMesh,
  options = {}
) {
  const riverSamples = createRiverSamples(riverCurve, 110);

  createTrees(scene, variants.trees, getTerrainHeight, riverCurve, pondCenter, pondRadius, riverSamples, terrainMesh);
  createFlowers(scene, variants.flowers, getTerrainHeight, riverCurve, pondCenter, pondRadius, riverSamples, terrainMesh);
  const groundCover = createScatteredGroundCover(
    scene,
    getTerrainHeight,
    riverCurve,
    pondCenter,
    pondRadius,
    riverSamples,
    terrainMesh,
    options
  );

  return {
    update(cameraPosition, elapsedTime) {
      if (groundCover && groundCover.update) {
        groundCover.update(cameraPosition, elapsedTime);
      }
    },
  };
}

export function createVegetation(
  scene,
  getTerrainHeight,
  riverCurve,
  pondCenter,
  pondRadius,
  forestModelUrl,
  terrainMesh,
  options = {}
) {
  const loader = new GLTFLoader();

  return new Promise((resolve) => {
    loader.load(
      forestModelUrl,
      (gltf) => {
        scene.add(gltf.scene);
        gltf.scene.visible = false;
        gltf.scene.updateMatrixWorld(true);

        const meshMap = new Map();

        // Required by spec: log every mesh name from the GLB.
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            console.log(child.name);
            meshMap.set(child.name, child);
          }
        });

        const variants = buildVegetationVariants(meshMap);

        console.info('Manual vegetation classification', {
          trees: variants.trees.map((variant) => variant.name),
          flowers: variants.flowers.map((variant) => variant.name),
          groundCover: ['texture-prof-herbe', 'texture-prof-buisson'],
        });

        const vegetationController = placeVegetationInstances(
          scene,
          getTerrainHeight,
          riverCurve,
          pondCenter,
          pondRadius,
          variants,
          terrainMesh,
          options
        );
        resolve(vegetationController);
      },
      undefined,
      () => {
        const vegetationController = placeVegetationInstances(
          scene,
          getTerrainHeight,
          riverCurve,
          pondCenter,
          pondRadius,
          {
            trees: createFallbackVariants('trees'),
            flowers: createFallbackVariants('flowers'),
          },
          terrainMesh,
          options
        );

        resolve(vegetationController);
      }
    );
  });
}

