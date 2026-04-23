import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

export function createLighting(scene, renderer) {
  const ambient = new THREE.AmbientLight(0xc8e0ff, 0.24);
  scene.add(ambient);

  const hemisphere = new THREE.HemisphereLight(0xb9e2ff, 0x95b17a, 0.34);
  scene.add(hemisphere);

  const daylightSun = new THREE.DirectionalLight(0xffffff, 1.35);
  daylightSun.position.set(-42, 64, -18);
  scene.add(daylightSun);

  const fillLight = new THREE.DirectionalLight(0xd8f0ff, 0.18);
  fillLight.position.set(36, 24, 28);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xf1fbff, 0.08);
  rimLight.position.set(32, 14, 28);
  scene.add(rimLight);

  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = 10.0;
  skyUniforms.rayleigh.value = 3.0;
  skyUniforms.mieCoefficient.value = 0.005;
  skyUniforms.mieDirectionalG.value = 0.7;
  skyUniforms.cloudCoverage.value = 0.28;
  skyUniforms.cloudDensity.value = 0.22;
  skyUniforms.cloudElevation.value = 0.42;
  skyUniforms.showSunDisc.value = 1.0;

  const sun = new THREE.Vector3();
  const phi = THREE.MathUtils.degToRad(90 - 8.0);
  const theta = THREE.MathUtils.degToRad(180);
  sun.setFromSphericalCoords(1, phi, theta);
  skyUniforms.sunPosition.value.copy(sun);

  scene.background = new THREE.Color(0x9ec7df);
  scene.fog.color.set(0xb8d0cb);

  if (renderer) {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(sky);
    const envTarget = pmremGenerator.fromScene(envScene);
    scene.environment = envTarget.texture;
    sky.material.uniforms.showSunDisc.value = 0.0;
    scene.add(sky);
  }
}
