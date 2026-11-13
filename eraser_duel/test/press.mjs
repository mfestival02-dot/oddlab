// 눌러 튕기기 확인(조정용): 누름 자리별 이동·회전, 종류별로 한 번에 갈 수 있는 거리
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, PHASE } from '../src/game.js';
import { TYPES, TYPE_KEYS, DT } from '../src/config.js';
await RAPIER.init();
const g = new Game(RAPIER); g.layoutMode = 'match'; g.rnd = () => 0.5;
const shot = (type, spot, power) => {
  g.types = [type, 'normal']; g.restart();
  g.restore({ state: { bodies: [{ p: [0, TYPES[type].dims[1] + 0.002, 0], q: { x: 0, y: 0, z: 0, w: 1 }, type }, { p: [2.6, 0.052, 1.7], q: { x: 0, y: 0, z: 0, w: 1 }, type: 'normal' }] }, player: 0, aim: [0, 0], angle: 0, power: null, settings: g.pending });
  const p0 = [...g.curr[0].p];
  g.fireSpot(spot, power); let t = 0, spin = 0, maxY = 0;
  while (g.phase === PHASE.PHYSICS && t < 20) { g.tick(); t += DT; spin += Math.hypot(...g.curr[0].av) * DT; maxY = Math.max(maxY, g.curr[0].p[1]); }
  const p = g.curr[0].p, a = g.launchInfo.angle, dx = p[0] - p0[0], dz = p[2] - p0[2];
  return { fwd: dx * Math.cos(a) + dz * Math.sin(a), side: -dx * Math.sin(a) + dz * Math.cos(a), spin: spin * 57.3, maxY, fell: g.sim.fallen[0], kind: g.launchInfo.kind };
};
for (const type of process.argv[2] ? [process.argv[2]] : TYPE_KEYS) {
  g.types = [type, 'normal']; g.restart(); const n = g.spots().length;
  const rows = [];
  for (let s = 0; s < n; s++) { const P = +(process.argv[3] || 0.6); const r = shot(type, s, P), a = shot(type, s, P - 0.03), b = shot(type, s, P + 0.03); rows.push(`${r.kind}${s}: 앞 ${(r.fwd * 10).toFixed(0)}cm 옆 ${(r.side * 10).toFixed(0)}cm 회전 ${r.spin.toFixed(0)}도 높이 ${(r.maxY * 10).toFixed(1)}cm, 힘 ±3%에 ${(Math.max(Math.hypot(a.fwd - r.fwd, a.side - r.side), Math.hypot(b.fwd - r.fwd, b.side - r.side)) * 10).toFixed(1)}cm${r.fell ? ' 낙하' : ''}`); }
  const far = shot(type, 0, 1);
  console.log(`${TYPES[type].name}(${type}) 자리 ${n}개, 최대 힘으로 ${(far.fwd * 10).toFixed(0)}cm${far.fell ? '(낙하)' : ''}\n   ` + rows.join('\n   '));
}
