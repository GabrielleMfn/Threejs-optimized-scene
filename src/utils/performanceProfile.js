export function getPerformanceProfile() {
  const hardwareThreads = Number(navigator.hardwareConcurrency || 8);
  const memoryGb = Number(navigator.deviceMemory || 8);
  const isCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  const isLowEnd = hardwareThreads <= 4 || memoryGb <= 4;
  const isMobileLike = isCoarsePointer || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  return {
    isLowEnd,
    isMobileLike,
    grassDensityScale: isLowEnd ? 0.82 : 1,
    grassFarLodBoost: isLowEnd ? 1.2 : 1,
    preferLightweightProps: false,
    preferLightweightDeer: false,
  };
}
