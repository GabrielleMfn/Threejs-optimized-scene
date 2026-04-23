import './style.css';
import forestModel from '../assets/forest.glb';
import { initScene, resizeRenderer } from './scene/initScene.js';
import { createLighting } from './scene/lighting.js';
import { createTerrain } from './scene/terrain.js';
import { createWater } from './scene/water.js';
import { createVegetation } from './scene/vegetation.js';
import { createFireflies } from './scene/particles.js';
import { createFallingLeaves } from './scene/leaves.js';
import { createCinematicCamera } from './scene/cinematicCamera.js';

function createFpsMonitor() {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.top = '12px';
  el.style.right = '12px';
  el.style.padding = '8px 10px';
  el.style.borderRadius = '8px';
  el.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  el.style.fontSize = '12px';
  el.style.color = '#e8fff0';
  el.style.background = 'rgba(8, 16, 14, 0.6)';
  el.style.backdropFilter = 'blur(4px)';
  el.style.border = '1px solid rgba(173, 255, 207, 0.2)';
  el.style.zIndex = '1000';
  el.style.pointerEvents = 'none';
  el.textContent = 'FPS: --';
  document.body.appendChild(el);

  let frameCount = 0;
  let lastSampleTime = performance.now();

  return {
    update(nowMs) {
      frameCount += 1;

      const elapsedMs = nowMs - lastSampleTime;
      if (elapsedMs >= 500) {
        const fps = (frameCount * 1000) / elapsedMs;
        const isGood = fps >= 60;
        el.textContent = `FPS: ${fps.toFixed(1)} ${isGood ? 'OK' : 'LOW'}`;
        el.style.color = isGood ? '#d5ffe4' : '#ffe2c6';
        frameCount = 0;
        lastSampleTime = nowMs;
      }
    },
    dispose() {
      el.remove();
    },
  };
}

async function initForestScene() {
  const app = document.querySelector('#app');
  const { scene, camera, renderer, clock, composer } = initScene(app);
  const fpsMonitor = createFpsMonitor();

  createLighting(scene, renderer);

  const terrain = createTerrain(scene, renderer);
  const { getTerrainHeight } = terrain;
  const water = createWater(scene, getTerrainHeight);
  const cameraController = createCinematicCamera({
    camera,
    domElement: renderer.domElement,
    getTerrainHeight,
    riverCurve: water.riverCurve,
    pondCenter: water.pondCenter,
  });

  const fireflies = createFireflies(
    scene,
    water.riverCurve,
    water.pondCenter,
    water.pondRadius,
    getTerrainHeight
  );
  const leaves = createFallingLeaves(scene, getTerrainHeight);

  const vegetation = await createVegetation(
    scene,
    getTerrainHeight,
    water.riverCurve,
    water.pondCenter,
    water.pondRadius,
    forestModel,
    terrain.terrain
  );

  const onResize = () => {
    resizeRenderer(camera, renderer, composer);
  };

  const onUnload = () => {
    cameraController.dispose();
    fpsMonitor.dispose();
  };

  window.addEventListener('resize', onResize);
  window.addEventListener('beforeunload', onUnload);

  function animate(nowMs = performance.now()) {
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = Math.min(clock.getDelta(), 0.033);

    cameraController.update(elapsedTime, deltaTime);
    water.update(elapsedTime);
    fireflies.update(elapsedTime);
    leaves.update(elapsedTime, deltaTime);
    if (vegetation && vegetation.update) {
      vegetation.update(camera.position, elapsedTime);
    }
    fpsMonitor.update(nowMs);

    composer.render();
    requestAnimationFrame(animate);
  }

  animate();
}

initForestScene().catch((error) => {
  console.error('Failed to initialize forest scene:', error);
});
