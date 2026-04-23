export const NAVIGATION_CONFIG = {
  eyeHeight: 2.28,
  moveSpeed: 7.4,
  strafeSpeed: 6.8,
  maxSlopeStep: 0.24,
  minFov: 30,
  maxFov: 78,
  zoomStepWheel: 1.6,
  zoomStepKey: 20,
};

export const VEGETATION_CONFIG = {
  trees: {
    totalCount: 860,
    edgeInner: 66,
    edgeOuter: 88,
    nearRiverOffsetMin: 13,
    nearRiverOffsetMax: 22,
    centerExclusionRadius: 24,
    impostorStartRadius: 70,
    impostorRatio: 0.6,
  },
  flowers: {
    count: 980,
    riverOffsetMin: 4.8,
    riverOffsetMax: 11.4,
    pondRingMin: 3.4,
    pondRingMax: 8.6,
  },
  grass: {
    riverBankCount: 2200,
    meadowCount: 4800,
    riverOffsetMin: 4.2,
    riverOffsetMax: 11.2,
    pondRingMin: 2.2,
    pondRingMax: 8.4,
    meadowRadius: 88,
    lodNearDistance: 24,
    lodMidDistance: 44,
    lodFarDistance: 66,
    lodMidStride: 4,
    lodFarStride: 12,
    lodUpdateInterval: 0.3,
  },
  waterExclusion: {
    pondPadding: 0.0,
    riverWidth: 5.8,
  },
};

