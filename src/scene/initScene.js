import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

const SKY_COLOR = 0xc7e9ff;
const FOG_COLOR = 0xcde3d9;

export function initScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0062);

  const camera = new THREE.PerspectiveCamera(
    47,
    window.innerWidth / window.innerHeight,
    0.1,
    320
  );
  camera.position.set(0, 8, 24);
  camera.lookAt(0, 2, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = false;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.style.outline = 'none';

  container.appendChild(renderer.domElement);
  renderer.domElement.focus();
  renderer.domElement.addEventListener('pointerdown', () => {
    renderer.domElement.focus();
  });

  // Post-processing: Subtle bloom effect
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2,
    0.4,
    0.85
  );
  bloomPass.threshold = 0.9;
  bloomPass.strength = 0.012;
  bloomPass.radius = 0.1;
  composer.addPass(bloomPass);

  return {
    scene,
    camera,
    renderer,
    clock: new THREE.Clock(),
    composer,
  };
}

export function resizeRenderer(camera, renderer, composer) {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) {
    composer.setSize(window.innerWidth, window.innerHeight);
  }
}

export function measureTerrain(getTerrainHeight, range = 82, step = 4) {
  let minHeight = Number.POSITIVE_INFINITY;
  let maxHeight = Number.NEGATIVE_INFINITY;
  let sumHeight = 0;
  let count = 0;

  for (let x = -range; x <= range; x += step) {
    for (let z = -range; z <= range; z += step) {
      const y = getTerrainHeight(x, z);
      minHeight = Math.min(minHeight, y);
      maxHeight = Math.max(maxHeight, y);
      sumHeight += y;
      count += 1;
    }
  }

  return {
    minHeight,
    maxHeight,
    averageHeight: sumHeight / Math.max(1, count),
    relief: maxHeight - minHeight,
  };
}

export function placeHeroCamera(camera, getTerrainHeight, pondCenter, riverCurve) {
  const terrainMetrics = measureTerrain(getTerrainHeight);

  const cameraAnchor = riverCurve.getPointAt(0.56);
  const cameraTangent = riverCurve.getTangentAt(0.56).normalize();
  const cameraSide = new THREE.Vector3(-cameraTangent.z, 0, cameraTangent.x).normalize();

  const cameraPosition = cameraAnchor
    .clone()
    .addScaledVector(cameraTangent, -13.5)
    .addScaledVector(cameraSide, -8.8);

  const elevationOffset = Math.max(6.8, terrainMetrics.relief * 0.48);
  cameraPosition.y = getTerrainHeight(cameraPosition.x, cameraPosition.z) + elevationOffset;

  const lookAt = pondCenter.clone().addScaledVector(cameraTangent, 5.0);
  lookAt.y = getTerrainHeight(lookAt.x, lookAt.z) + 1.9;

  camera.position.copy(cameraPosition);
  camera.lookAt(lookAt);

  return {
    terrainMetrics,
    cameraPosition,
    lookAt,
  };
}
