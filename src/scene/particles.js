import * as THREE from 'three';

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;

  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);

  gradient.addColorStop(0, 'rgba(255, 250, 214, 1)');
  gradient.addColorStop(0.25, 'rgba(255, 240, 160, 0.8)');
  gradient.addColorStop(0.7, 'rgba(255, 200, 100, 0.12)');
  gradient.addColorStop(1, 'rgba(255, 180, 80, 0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function sampleNearRiver(curve) {
  const t = Math.random();
  const point = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const sign = Math.random() < 0.5 ? -1 : 1;
  const offset = 1.4 + Math.random() * 4.2;

  return new THREE.Vector3(
    point.x + normal.x * offset * sign,
    0,
    point.z + normal.z * offset * sign
  );
}

function sampleAcrossScene() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 28 + Math.sqrt(Math.random()) * 72;

  return new THREE.Vector3(
    Math.cos(angle) * radius,
    0,
    Math.sin(angle) * radius
  );
}

export function createFireflies(scene, riverCurve, pondCenter, pondRadius, getTerrainHeight) {
  const count = 900;
  const positions = new Float32Array(count * 3);
  const basePositions = new Float32Array(count * 3);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const point =
      Math.random() < 0.55
        ? sampleNearRiver(riverCurve)
        : sampleAcrossScene();

    point.y = getTerrainHeight(point.x, point.z) + 2.6 + Math.random() * 4.8;

    const index = i * 3;
    positions[index] = point.x;
    positions[index + 1] = point.y;
    positions[index + 2] = point.z;

    basePositions[index] = point.x;
    basePositions[index + 1] = point.y;
    basePositions[index + 2] = point.z;

    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    map: createGlowTexture(),
    size: 0.54,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: false,
    color: 0xfff1a1,
    sizeAttenuation: true,
  });
  material.toneMapped = false;

  const points = new THREE.Points(geometry, material);
  points.renderOrder = 10;
  points.frustumCulled = false;
  scene.add(points);

  return {
    update(elapsedTime) {
      const attribute = geometry.attributes.position;
      const array = attribute.array;

      for (let i = 0; i < count; i += 1) {
        const index = i * 3;
        const phase = phases[i];

        array[index] = basePositions[index] + Math.sin(elapsedTime * 0.31 + phase) * 0.32;
        array[index + 1] =
          basePositions[index + 1] +
          Math.sin(elapsedTime * 0.84 + phase * 1.7) * 0.52 +
          Math.cos(elapsedTime * 0.46 + phase) * 0.16;
        array[index + 2] = basePositions[index + 2] + Math.cos(elapsedTime * 0.36 + phase * 0.9) * 0.32;
      }

      attribute.needsUpdate = true;
    },
  };
}


