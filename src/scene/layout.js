import * as THREE from 'three';

export const POND_RADIUS = 8.4;
export const POND_CENTER = new THREE.Vector3(-26, 0, 18);

const RIVER_CONTROL_POINTS = [
  new THREE.Vector3(6, 0, 90),
  new THREE.Vector3(14, 0, 78),
  new THREE.Vector3(22, 0, 66),
  new THREE.Vector3(18, 0, 54),
  new THREE.Vector3(6, 0, 42),
  new THREE.Vector3(-8, 0, 31),
  new THREE.Vector3(-18, 0, 22),
  new THREE.Vector3(-20, 0, 10),
  new THREE.Vector3(-10, 0, -3),
  new THREE.Vector3(4, 0, -16),
  new THREE.Vector3(18, 0, -29),
  new THREE.Vector3(22, 0, -43),
  new THREE.Vector3(12, 0, -56),
  new THREE.Vector3(-2, 0, -68),
  new THREE.Vector3(-16, 0, -80),
  new THREE.Vector3(-24, 0, -90),
];

export function createRiverCurve() {
  return new THREE.CatmullRomCurve3(
    RIVER_CONTROL_POINTS.map((point) => point.clone()),
    false,
    'centripetal',
    0.28
  );
}

export function smoothstep(edge0, edge1, x) {
  if (edge0 === edge1) {
    return 0;
  }

  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function sampleCurveDistance(curve, x, z, samples = 96) {
  let minDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i <= samples; i += 1) {
    const point = curve.getPointAt(i / samples);
    const distance = Math.hypot(x - point.x, z - point.z);

    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

