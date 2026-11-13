// 기본 배치에서 1P가 2P 위에 올라타는 것이 확인된 조건(test/verify.mjs가 매번 다시 확인한다).
export const SUCCESS_PRESET = {
  angleDeg: 0,
  power: 0.65,
  hit: 1,
  settings: { version: 1, impulse: 16, vAssist: 0.38, spinAssist: 0.26, hitBack: 0.32, hitSide: 0.85, hitHeight: -0.7, powerCurve: 1.25,
    friction: 0.6, restitution: 0.15, linDamp: 0.45, angDamp: 2.25, gravity: 60,
    stableLin: 0.06, stableAng: 0.35, stableHold: 0.45, perchHold: 0.8, gaugePeriod: 1.7 },
};
