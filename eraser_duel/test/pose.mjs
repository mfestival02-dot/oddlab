// 지우개가 놓인 각도에 따라 같은 발사가 어떻게 달라지는지 본다(조정·검증용).
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, PHASE } from '../src/game.js';
import { yawQuat } from '../src/sim.js';
import { defaultSettings, TYPES, DT } from '../src/config.js';
await RAPIER.init();
const type = process.argv[2] || 'normal', power = +(process.argv[3] || 0.5);
export function shotFrom(yawDeg, aimDeg, p, g = new Game(RAPIER)) {
  g.restore({ state: { bodies: [{ p: [-1.5, TYPES[type].dims[1] + 0.002, 0], q: yawQuat((yawDeg * Math.PI) / 180), type }, { p: [2.4, TYPES.normal.dims[1] + 0.002, 1.6], q: yawQuat(0), type: 'normal' }] }, player: 0, aim: [0, Math.PI], angle: 0, power: null, settings: defaultSettings() });
  g.fire((aimDeg * Math.PI) / 180, p, 1);
  let spin = 0, t = 0, maxY = 0;
  while (g.phase === PHASE.PHYSICS && t < 20) { g.tick(); t += DT; spin += Math.abs(g.curr[0].av[1]) * DT; maxY = Math.max(maxY, g.curr[0].p[1]); }
  const b = g.curr[0].p;
  return { fwd: b[0] + 1.5, side: b[2], spin, maxY, sideHit: g.launchInfo.side, fell: g.sim.fallen[0] };
}
console.log(`${TYPES[type].name} 지우개, 파워 ${power * 100}%, 발사 방향은 항상 +x. 놓인 각도만 바꾼다.`);
console.log('놓인 각도   앞으로   옆으로   제자리 회전   손가락이 중심선에서 벗어난 거리   ±2도 흔들었을 때 도착점 차이');
for (const yaw of [0, 10, 20, 30, 45, 60, 70, 80, 90]) {
  const r = shotFrom(yaw, 0, power);
  const a = shotFrom(yaw, -2, power), c = shotFrom(yaw, 2, power);
  const spread = Math.max(Math.hypot(a.fwd - r.fwd, a.side - r.side), Math.hypot(c.fwd - r.fwd, c.side - r.side));
  console.log(`${String(yaw).padStart(5)}도   ${r.fwd.toFixed(2).padStart(6)}   ${r.side.toFixed(2).padStart(6)}   ${(r.spin * 57.3).toFixed(0).padStart(8)}도   ${r.sideHit.toFixed(3).padStart(14)}   ${spread.toFixed(2).padStart(22)}${r.fell ? '  (낙하)' : ''}`);
}
