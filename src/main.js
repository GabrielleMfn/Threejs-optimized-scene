import './style.css';
import * as THREE from 'three';
import forestModel from '../assets/forest.glb';
import { initScene, resizeRenderer } from './scene/initScene.js';
import { createLighting } from './scene/lighting.js';
import { createTerrain } from './scene/terrain.js';
import { createWater } from './scene/water.js';
import { createVegetation } from './scene/vegetation.js';
import { createFireflies } from './scene/particles.js';
import { createFallingLeaves } from './scene/leaves.js';
import { createCinematicCamera } from './scene/cinematicCamera.js';
import { createDeer } from './scene/deer.js';
import { createCampProps } from './scene/campProps.js';
import { assetUrl } from './utils/assetUrl.js';

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

function createAudioToggle() {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.top = '52px';
  wrapper.style.right = '12px';
  wrapper.style.zIndex = '1000';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'center';

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Toggle forest ambience');
  button.style.width = '42px';
  button.style.height = '42px';
  button.style.borderRadius = '8px';
  button.style.border = '1px solid rgba(173, 255, 207, 0.2)';
  button.style.background = 'rgba(8, 16, 14, 0.6)';
  button.style.backdropFilter = 'blur(4px)';
  button.style.cursor = 'pointer';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.padding = '0';
  button.style.color = '#e8fff0';
  button.style.boxShadow = 'none';
  button.style.touchAction = 'manipulation';

  const icon = document.createElement('img');
  icon.alt = '';
  icon.width = 24;
  icon.height = 24;
  icon.style.display = 'block';
  icon.style.pointerEvents = 'none';
  button.appendChild(icon);

  const audio = new Audio(assetUrl('/audio/Forest_ambience.ogg'));
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0.45;

  let isPlaying = false;

  function syncState() {
    icon.src = isPlaying
      ? assetUrl('/audio/volume-up-32.svg')
      : assetUrl('/audio/muet-32.svg');
    button.title = isPlaying ? 'Mute ambience' : 'Play ambience';
    button.setAttribute('aria-pressed', String(isPlaying));
  }

  async function toggleAudio() {
    try {
      if (audio.paused) {
        await audio.play();
        isPlaying = true;
      } else {
        audio.pause();
        isPlaying = false;
      }
      syncState();
    } catch (error) {
      console.warn('Unable to toggle ambience audio', error);
    }
  }

  button.addEventListener('click', toggleAudio);

  syncState();
  wrapper.appendChild(button);
  document.body.appendChild(wrapper);

  return {
    audio,
    wrapper,
    button,
    dispose() {
      audio.pause();
      audio.src = '';
      button.removeEventListener('click', toggleAudio);
      wrapper.remove();
    },
  };
}

/*
// TEMPORARILY DISABLED: terrain coordinate overlay (kept here for quick re-enable)
function createTerrainCoordinateMonitor(camera, domElement, terrainMesh) {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.top = '52px';
  el.style.right = '12px';
  el.style.padding = '8px 10px';
  el.style.borderRadius = '8px';
  el.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  el.style.fontSize = '12px';
  el.style.color = '#d9f5ff';
  el.style.background = 'rgba(8, 16, 22, 0.6)';
  el.style.backdropFilter = 'blur(4px)';
  el.style.border = '1px solid rgba(173, 225, 255, 0.22)';
  el.style.zIndex = '1000';
  el.style.pointerEvents = 'none';
  el.textContent = 'Terrain: --';
  document.body.appendChild(el);

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  function onPointerMove(event) {
    if (!terrainMesh) {
      el.textContent = 'Terrain: unavailable';
      return;
    }

    const rect = domElement.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObject(terrainMesh, false)[0];

    if (!hit) {
      el.textContent = 'Terrain: no hit';
      return;
    }

    const x = hit.point.x.toFixed(2);
    const y = hit.point.y.toFixed(2);
    const z = hit.point.z.toFixed(2);
    el.textContent = `Terrain XYZ: (${x}, ${y}, ${z})`;
  }

  function onPointerLeave() {
    el.textContent = 'Terrain: --';
  }

  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerleave', onPointerLeave);

  return {
    dispose() {
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerleave', onPointerLeave);
      el.remove();
    },
  };
}
*/

async function initForestScene() {
  const app = document.querySelector('#app');
  const { scene, camera, renderer, clock, composer } = initScene(app);
  const fpsMonitor = createFpsMonitor();
  const audioToggle = createAudioToggle();

  createLighting(scene, renderer);

  const terrain = createTerrain(scene, renderer);
  // const terrainCoordinateMonitor = createTerrainCoordinateMonitor(
  //   camera,
  //   renderer.domElement,
  //   terrain.terrain
  // );
  const terrainCoordinateMonitor = null;
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

  const deer = await createDeer(
    scene,
    getTerrainHeight,
    water.riverCurve,
    water.pondCenter
  );
  await createCampProps(scene, getTerrainHeight);

  const onResize = () => {
    resizeRenderer(camera, renderer, composer);
  };

  const onUnload = () => {
    cameraController.dispose();
    fpsMonitor.dispose();
    audioToggle.dispose();
    if (terrainCoordinateMonitor) {
      terrainCoordinateMonitor.dispose();
    }
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
    if (deer && deer.update) {
      deer.update(deltaTime);
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
