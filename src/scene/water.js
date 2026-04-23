import * as THREE from 'three';
import { POND_CENTER, createRiverCurve } from './layout.js';

// Seascape-inspired water adapted to a localized river for real-time performance.
const WATER_VERTEX_SHADER = `
uniform float uTime;
uniform float uWaveAmp;
uniform float uWaveScale;
uniform float uIsRiver;
uniform vec2 uFlowDirection;

varying vec2 vUv;
varying vec2 vFlowUv;
varying vec3 vWorldPosition;
varying vec3 vNormalDirection;
varying float vEdgeMask;

const int ITER_GEOMETRY = 3;
const float SEA_HEIGHT = 0.6;
const float SEA_CHOPPY = 4.0;
const float SEA_SPEED = 0.8;
const float SEA_FREQ = 0.16;
const mat2 OCTAVE_M = mat2(1.6, 1.2, -1.2, 1.6);

float hash12(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

float noise12(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  return -1.0 + 2.0 * mix(
    mix(hash12(i + vec2(0.0, 0.0)), hash12(i + vec2(1.0, 0.0)), u.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float seaOctave(vec2 uv, float choppy) {
  uv += noise12(uv);
  vec2 wv = 1.0 - abs(sin(uv));
  vec2 swv = abs(cos(uv));
  wv = mix(wv, swv, wv);
  return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
}

float seaHeightGeometry(vec2 uv, float seaTime) {
  float freq = SEA_FREQ;
  float amp = SEA_HEIGHT;
  float choppy = SEA_CHOPPY;
  float height = 0.0;

  for (int i = 0; i < ITER_GEOMETRY; i++) {
    float d = seaOctave((uv + seaTime) * freq, choppy);
    d += seaOctave((uv - seaTime) * freq, choppy);
    height += d * amp;

    uv *= OCTAVE_M;
    freq *= 1.9;
    amp *= 0.22;
    choppy = mix(choppy, 1.0, 0.2);
  }

  return height;
}

void main() {
  vUv = uv;

  vec4 worldPosition = modelMatrix * vec4(position, 1.0);

  float seaTime = 1.0 + uTime * SEA_SPEED;
  vec2 flowUv = worldPosition.xz * uWaveScale;
  if (uIsRiver > 0.5) {
    flowUv = vec2(vUv.x * 2.35, vUv.y * 14.0);
  }

  flowUv.x *= 0.75;

  vec2 seaUv = flowUv;
  if (uIsRiver > 0.5) {
    seaUv += vec2(0.0, uTime * 0.42);
  } else {
    seaUv += uFlowDirection * uTime * 0.16;
  }

  vec2 distortion = vec2(
    noise12(flowUv * 1.3 + seaTime * 0.2),
    noise12(flowUv * 1.5 - seaTime * 0.24)
  ) * 0.08;
  seaUv += distortion;

  float edgeMask = 1.0;
  float waveHeight = seaHeightGeometry(seaUv, seaTime) * uWaveAmp;
  worldPosition.y += waveHeight * edgeMask;

  vEdgeMask = edgeMask;
  vFlowUv = flowUv;
  vWorldPosition = worldPosition.xyz;
  vNormalDirection = normalize(mat3(modelMatrix) * normal);

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const WATER_FRAGMENT_SHADER = `
uniform float uTime;
uniform float uWaveScale;
uniform float uIsRiver;
uniform vec2 uFlowDirection;
uniform vec3 uColorShallow;
uniform vec3 uColorDeep;
uniform vec3 uWaterTint;
uniform vec3 uReflectionTint;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;

varying vec2 vUv;
varying vec2 vFlowUv;
varying vec3 vWorldPosition;
varying vec3 vNormalDirection;
varying float vEdgeMask;

const float PI = 3.141592;
const int ITER_FRAGMENT = 5;
const float SEA_HEIGHT = 0.6;
const float SEA_CHOPPY = 4.0;
const float SEA_SPEED = 0.8;
const float SEA_FREQ = 0.16;
const mat2 OCTAVE_M = mat2(1.6, 1.2, -1.2, 1.6);

float hash12(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

float noise12(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  return -1.0 + 2.0 * mix(
    mix(hash12(i + vec2(0.0, 0.0)), hash12(i + vec2(1.0, 0.0)), u.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float seaOctave(vec2 uv, float choppy) {
  uv += noise12(uv);
  vec2 wv = 1.0 - abs(sin(uv));
  vec2 swv = abs(cos(uv));
  wv = mix(wv, swv, wv);
  return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
}

float seaHeightDetailed(vec2 uv, float seaTime) {
  float freq = SEA_FREQ;
  float amp = SEA_HEIGHT;
  float choppy = SEA_CHOPPY;
  float height = 0.0;

  for (int i = 0; i < ITER_FRAGMENT; i++) {
    float d = seaOctave((uv + seaTime) * freq, choppy);
    d += seaOctave((uv - seaTime) * freq, choppy);
    height += d * amp;

    uv *= OCTAVE_M;
    freq *= 1.9;
    amp *= 0.22;
    choppy = mix(choppy, 1.0, 0.2);
  }

  return height;
}

vec3 getSkyColor(vec3 e) {
  float up = clamp(e.y * 0.5 + 0.5, 0.0, 1.0);
  return mix(uSkyHorizon, uSkyTop, up);
}

float diffuseTerm(vec3 n, vec3 l, float p) {
  return pow(dot(n, l) * 0.4 + 0.6, p);
}

float specularTerm(vec3 n, vec3 l, vec3 eye, float s) {
  float nrm = (s + 8.0) / (PI * 8.0);
  return pow(max(dot(reflect(-eye, n), l), 0.0), s) * nrm;
}

vec3 getWaterNormal(vec2 seaUv, float seaTime, float eps) {
  float center = seaHeightDetailed(seaUv, seaTime);
  float xOffset = seaHeightDetailed(seaUv + vec2(eps, 0.0), seaTime);
  float zOffset = seaHeightDetailed(seaUv + vec2(0.0, eps), seaTime);

  vec3 normal = vec3(center - xOffset, eps, center - zOffset);
  return normalize(normal);
}

void main() {
  float seaTime = 1.0 + uTime * SEA_SPEED;
  vec2 seaUv = vFlowUv;
  if (uIsRiver > 0.5) {
    seaUv += vec2(0.0, uTime * 0.42);
  } else {
    seaUv += uFlowDirection * uTime * 0.16;
  }

  vec2 distortion = vec2(
    noise12(vFlowUv * 1.25 + seaTime * 0.2),
    noise12(vFlowUv * 1.45 - seaTime * 0.26)
  ) * 0.09;
  seaUv += distortion;

  vec3 proceduralNormal = getWaterNormal(seaUv, seaTime, 0.08);
  vec3 normalDirection = normalize(mix(vNormalDirection, proceduralNormal, 0.84));

  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  vec3 lightDirection = normalize(vec3(-0.22, 0.92, -0.31));

  float fresnel = clamp(1.0 - dot(normalDirection, viewDirection), 0.0, 1.0);
  fresnel = min(fresnel * fresnel * fresnel, 0.72);

  vec3 reflected = getSkyColor(reflect(-viewDirection, normalDirection));

  float depthBand = clamp(seaHeightDetailed(seaUv * 0.72, seaTime) * 0.33, 0.0, 1.0);
  vec3 refracted = mix(uColorShallow, uColorDeep, depthBand);
  refracted += diffuseTerm(normalDirection, lightDirection, 70.0) * uWaterTint * 0.12;

  vec3 color = mix(refracted, reflected, fresnel);

  vec3 dist = vWorldPosition - cameraPosition;
  float atten = max(1.0 - dot(dist, dist) * 0.0012, 0.0);
  color += uWaterTint * (depthBand - 0.25) * 0.18 * atten;

  color += uReflectionTint * specularTerm(normalDirection, lightDirection, viewDirection, 420.0);

  if (uIsRiver > 0.5) {
    float riverEdge = smoothstep(0.0, 0.065, vUv.x) * (1.0 - smoothstep(0.935, 1.0, vUv.x));
    riverEdge = clamp(riverEdge * 1.2, 0.25, 1.0);

    float edgeDist = min(vUv.x, 1.0 - vUv.x);
    float bankFoam = 1.0 - smoothstep(0.02, 0.14, edgeDist);
    float foamPattern = sin(vUv.y * 170.0 + uTime * 7.5 + noise12(vFlowUv * 3.2) * 7.0) * 0.5 + 0.5;
    color += mix(uSkyHorizon, uReflectionTint, 0.45) * bankFoam * pow(foamPattern, 4.0) * 0.28;

    color *= mix(0.82, 1.0, riverEdge);
  }

  float baseAlpha = mix(0.98, 0.94, step(0.5, uIsRiver));
  float alpha = baseAlpha + fresnel * 0.06 - (1.0 - vEdgeMask) * 0.05;
  gl_FragColor = vec4(color, alpha);
}
`;

function buildRiverGeometry(curve, getTerrainHeight, width = 6.1, segments = 460) {
  const positions = [];
  const uvs = [];
  const indices = [];

  const computeWaterY = (sampleX, sampleZ) => getTerrainHeight(sampleX, sampleZ) + 0.08;

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const widthPulse = 0.94 + 0.08 * Math.sin(t * Math.PI * 2.0 + 0.25);
    const sourceTaper = THREE.MathUtils.lerp(0.88, 1.0, THREE.MathUtils.smoothstep(t, 0.0, 0.16));
    const endTaper = THREE.MathUtils.lerp(1.0, 0.74, THREE.MathUtils.smoothstep(t, 0.88, 1.0));
    const halfWidth = width * widthPulse * sourceTaper * endTaper;

    const left = point.clone().addScaledVector(side, halfWidth);
    const right = point.clone().addScaledVector(side, -halfWidth);

    left.y = computeWaterY(left.x, left.z);
    right.y = computeWaterY(right.x, right.z);

    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    uvs.push(0, t * 7.5, 1, t * 7.5);

    if (i < segments) {
      const stride = i * 2;
      indices.push(stride, stride + 1, stride + 2, stride + 1, stride + 3, stride + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function createWaterMaterial({
  isRiver,
  waveAmp,
  waveScale,
  flowDirection,
  shallow,
  deep,
  tint,
  reflectionTint,
  skyTop,
  skyHorizon,
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWaveAmp: { value: waveAmp },
      uWaveScale: { value: waveScale },
      uIsRiver: { value: isRiver ? 1 : 0 },
      uFlowDirection: { value: flowDirection.clone() },
      uColorShallow: { value: new THREE.Color(shallow) },
      uColorDeep: { value: new THREE.Color(deep) },
      uWaterTint: { value: new THREE.Color(tint) },
      uReflectionTint: { value: new THREE.Color(reflectionTint) },
      uSkyTop: { value: new THREE.Color(skyTop) },
      uSkyHorizon: { value: new THREE.Color(skyHorizon) },
    },
    vertexShader: WATER_VERTEX_SHADER,
    fragmentShader: WATER_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function createPondBorderStones(scene, pondCenter, pondRadius, getTerrainHeight) {
  const stoneCount = 50;
  const stoneGeometry = new THREE.DodecahedronGeometry(0.72, 0);
  const stoneMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: ROCK_DIFFUSE_MAP,
    roughnessMap: ROCK_ROUGHNESS_MAP,
    roughness: 1.0,
    metalness: 0.0,
  });

  const matrices = [];

  // One low-poly stone geometry is reused for the ring, with a gap where the river enters the pond.
  for (let i = 0; i < stoneCount; i += 1) {
    const angle = (i / stoneCount) * Math.PI * 2;

    const radius = pondRadius + 0.42 + (Math.random() - 0.5) * 0.24;

    const x = pondCenter.x + Math.cos(angle) * radius;
    const z = pondCenter.z + Math.sin(angle) * radius;
    const y = getTerrainHeight(x, z) + 0.34;

    const scale = 0.72 + Math.random() * 0.42;

    TEMP_OBJECT.position.set(x, y, z);
    TEMP_OBJECT.rotation.set(Math.random() * 0.45, angle + Math.random() * 0.35, Math.random() * 0.45);
    TEMP_OBJECT.scale.setScalar(scale);
    TEMP_OBJECT.updateMatrix();

    matrices.push(TEMP_OBJECT.matrix.clone());
  }

  const stones = new THREE.InstancedMesh(stoneGeometry, stoneMaterial, matrices.length);
  for (let i = 0; i < matrices.length; i += 1) {
    stones.setMatrixAt(i, matrices[i]);
  }

  stones.instanceMatrix.needsUpdate = true;
  scene.add(stones);
}

export function createWater(scene, getTerrainHeight) {
  const pondCenter = POND_CENTER.clone();
  pondCenter.y = getTerrainHeight(pondCenter.x, pondCenter.z) + 0.06;

  const riverCurve = createRiverCurve();

  const sharedPalette = {
    shallow: 0x6dc6ef,
    deep: 0x245c85,
    tint: 0x8ecdf0,
    reflectionTint: 0xeaf7ff,
    skyTop: 0x77c8ff,
    skyHorizon: 0xbfe8ff,
  };

  const riverMaterial = createWaterMaterial({
    ...sharedPalette,
    isRiver: true,
    waveAmp: 0.056,
    waveScale: 0.12,
    flowDirection: new THREE.Vector2(0.86, 0.2).normalize(),
  });

  const riverGeometry = buildRiverGeometry(riverCurve, getTerrainHeight, 6.1, 460);
  const river = new THREE.Mesh(riverGeometry, riverMaterial);
  scene.add(river);

  return {
    riverCurve,
    pondCenter,
    pondRadius: 0,
    update(elapsedTime) {
      riverMaterial.uniforms.uTime.value = elapsedTime;
    },
  };
}



