import * as THREE from 'three';
import { POND_CENTER, POND_RADIUS, createRiverCurve, sampleCurveDistance, smoothstep } from './layout.js';
import terrainAlbedoUrl from '../../Mossy_Patchy_Ground_ihkcgdjzl_4k/Mossy_Patchy_Ground_ihkcgdjzl_4k_Albedo.jpg';
import terrainAoUrl from '../../Mossy_Patchy_Ground_ihkcgdjzl_4k/Mossy_Patchy_Ground_ihkcgdjzl_4k_AmbientOcclusion.jpg';
import terrainNormalUrl from '../../Mossy_Patchy_Ground_ihkcgdjzl_4k/Mossy_Patchy_Ground_ihkcgdjzl_4k_Normal.jpg';
import terrainRoughnessUrl from '../../Mossy_Patchy_Ground_ihkcgdjzl_4k/Mossy_Patchy_Ground_ihkcgdjzl_4k_Roughness.jpg';

const TERRAIN_RIVER_CURVE = createRiverCurve();
const TERRAIN_WORLD_OFFSET_Y = -0.18;
const TERRAIN_SIZE = 190;
const DEM_WIDTH = 200;
const DEM_HEIGHT = 200;
const DEM_MAX_ELEVATION = 18;

export function loadTerrain(file, callback) {
  const xhr = new XMLHttpRequest();
  xhr.responseType = 'arraybuffer';
  xhr.open('GET', file, true);
  xhr.onload = () => {
    if (xhr.response) {
      callback(new Uint16Array(xhr.response));
    }
  };
  xhr.send(null);
}

function hash2(x, z) {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function valueNoise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);

  const xf = x - xi;
  const zf = z - zi;

  const a = hash2(xi, zi);
  const b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1);
  const d = hash2(xi + 1, zi + 1);

  const ux = xf * xf * (3 - 2 * xf);
  const uz = zf * zf * (3 - 2 * zf);

  const x1 = a + (b - a) * ux;
  const x2 = c + (d - c) * ux;
  return x1 + (x2 - x1) * uz;
}

function fbm(x, z) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 0.03;

  for (let i = 0; i < 4; i += 1) {
    value += valueNoise(x * frequency, z * frequency) * amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value;
}

function generateDEMData() {
  const data = new Uint16Array(DEM_WIDTH * DEM_HEIGHT);
  const halfSize = TERRAIN_SIZE * 0.5;

  for (let z = 0; z < DEM_HEIGHT; z += 1) {
    for (let x = 0; x < DEM_WIDTH; x += 1) {
      const u = x / (DEM_WIDTH - 1);
      const v = z / (DEM_HEIGHT - 1);

      const worldX = -halfSize + u * TERRAIN_SIZE;
      const worldZ = -halfSize + v * TERRAIN_SIZE;

      const broad =
        Math.sin(worldX * 0.021 + worldZ * 0.006) * 0.21 +
        Math.cos(worldZ * 0.018 - worldX * 0.007) * 0.19;
      const medium = (fbm(worldX * 0.85, worldZ * 0.85) - 0.5) * 0.52;
      const micro = (fbm(worldX * 2.1, worldZ * 2.1) - 0.5) * 0.14;

      const edgeDistance = Math.hypot(worldX, worldZ);
      const edgeLift = smoothstep(42, 94, edgeDistance) * 0.36;

      const normalized = THREE.MathUtils.clamp(0.5 + broad + medium + micro + edgeLift, 0.0, 1.0);
      data[z * DEM_WIDTH + x] = Math.round(normalized * 65535);
    }
  }

  return data;
}

const DEM_DATA = generateDEMData();

function decodeDEMHeight(value) {
  return (value / 65535) * DEM_MAX_ELEVATION - 5.4;
}

function sampleDEMHeight(x, z) {
  const halfSize = TERRAIN_SIZE * 0.5;
  const u = (x + halfSize) / TERRAIN_SIZE;
  const v = (z + halfSize) / TERRAIN_SIZE;

  const clampedU = THREE.MathUtils.clamp(u, 0, 1);
  const clampedV = THREE.MathUtils.clamp(v, 0, 1);

  const fx = clampedU * (DEM_WIDTH - 1);
  const fz = clampedV * (DEM_HEIGHT - 1);

  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(x0 + 1, DEM_WIDTH - 1);
  const z1 = Math.min(z0 + 1, DEM_HEIGHT - 1);

  const tx = fx - x0;
  const tz = fz - z0;

  const h00 = decodeDEMHeight(DEM_DATA[z0 * DEM_WIDTH + x0]);
  const h10 = decodeDEMHeight(DEM_DATA[z0 * DEM_WIDTH + x1]);
  const h01 = decodeDEMHeight(DEM_DATA[z1 * DEM_WIDTH + x0]);
  const h11 = decodeDEMHeight(DEM_DATA[z1 * DEM_WIDTH + x1]);

  const hx0 = THREE.MathUtils.lerp(h00, h10, tx);
  const hx1 = THREE.MathUtils.lerp(h01, h11, tx);
  return THREE.MathUtils.lerp(hx0, hx1, tz);
}

function getTerrainShapeHeight(x, z) {
  const baseHeight = sampleDEMHeight(x, z);

  const riverDistance = sampleCurveDistance(TERRAIN_RIVER_CURVE, x, z, 88);
  const riverDepression = -Math.exp(-(riverDistance * riverDistance) / (2 * Math.pow(4.3, 2))) * 1.75;

  return baseHeight + riverDepression;
}

export function getTerrainHeight(x, z) {
  return getTerrainShapeHeight(x, z) + TERRAIN_WORLD_OFFSET_Y;
}

function configureTilingMap(texture, repeatScale) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatScale, repeatScale);
}

export function createTerrain(scene, renderer) {
  const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, DEM_WIDTH - 1, DEM_HEIGHT - 1);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    positions.setY(i, getTerrainShapeHeight(x, z));
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  const uv = geometry.attributes.uv;
  geometry.setAttribute('uv2', new THREE.Float32BufferAttribute(uv.array, 2));

  const textureLoader = new THREE.TextureLoader();
  const albedoMap = textureLoader.load(terrainAlbedoUrl);
  const normalMap = textureLoader.load(terrainNormalUrl);
  const roughnessMap = textureLoader.load(terrainRoughnessUrl);
  const aoMap = textureLoader.load(terrainAoUrl);

  const repeatScale = 9.5;
  configureTilingMap(albedoMap, repeatScale);
  configureTilingMap(normalMap, repeatScale);
  configureTilingMap(roughnessMap, repeatScale);
  configureTilingMap(aoMap, repeatScale);

  albedoMap.colorSpace = THREE.SRGBColorSpace;

  const anisotropy = renderer?.capabilities?.getMaxAnisotropy
    ? Math.min(8, renderer.capabilities.getMaxAnisotropy())
    : 1;
  albedoMap.anisotropy = anisotropy;
  normalMap.anisotropy = anisotropy;
  roughnessMap.anisotropy = anisotropy;
  aoMap.anisotropy = anisotropy;

  const material = new THREE.MeshStandardMaterial({
    map: albedoMap,
    normalMap,
    roughnessMap,
    aoMap,
    color: 0xa8a888,
    roughness: 1.0,
    metalness: 0.0,
    normalScale: new THREE.Vector2(0.7, 0.7),
    aoMapIntensity: 0.72,
  });

  const terrain = new THREE.Mesh(geometry, material);
  terrain.position.y = TERRAIN_WORLD_OFFSET_Y;
  terrain.receiveShadow = false;
  scene.add(terrain);

  return {
    terrain,
    getTerrainHeight,
  };
}
