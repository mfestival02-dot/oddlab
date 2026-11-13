// 지우개 능력치를 지어내지 않고 실제로 재서 src/stats.json에 적는다.  실행: node tools/measure_stats.mjs
// 속도 = 끝을 60% 힘으로 눌렀을 때 간 거리, 튀는 높이 = 그때 뜬 높이,
// 균형 = 모든 자리를 70% 힘으로 눌렀을 때 넘어지지 않고 원래 면으로 멈춘 비율, 무게 = 질량.
import RAPIER from '@dimforge/rapier3d-compat';
import fs from 'fs';
import { Game, PHASE } from '../src/game.js';
import { TYPES, TYPE_KEYS, DT, defaultSettings } from '../src/config.js';
await RAPIER.init();
const g = new Game(RAPIER), raw = {};
const rot = (q, v) => { const { x, y, z, w } = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]); return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]; };
const place = (type) => g.restore({ state: { bodies: [{ p: [0, TYPES[type].dims[1] + 0.002, 0], q: { x: 0, y: 0, z: 0, w: 1 }, type }, { p: [2.6, 0.052, 1.7], q: { x: 0, y: 0, z: 0, w: 1 }, type: 'normal' }] }, player: 0, aim: [0, 0], angle: 0, power: null, settings: defaultSettings() });
for (const type of TYPE_KEYS) {
  place(type);
  const spots = g.spots(), end = Math.max(0, spots.findIndex((s) => s.kind === '끝'));
  g.fireSpot(end, 0.6); let maxY = 0, t = 0;
  while (g.phase === PHASE.PHYSICS && t < 20) { g.tick(); t += DT; maxY = Math.max(maxY, g.curr[0].p[1]); }
  const speed = Math.hypot(g.curr[0].p[0], g.curr[0].p[2]), hop = maxY - TYPES[type].dims[1];
  let steady = 0;
  for (let i = 0; i < spots.length; i++) { place(type); g.fireSpot(i, 0.7); g.runUntilSettled(15); if (Math.abs(rot(g.curr[0].q, [0, 1, 0])[1]) > 0.9 && g.curr[0].p[1] > -0.2) steady++; }      // 뒤집혀도 납작하게 누웠으면 안정으로 본다
  raw[type] = { speed, hop, balance: steady / spots.length, weight: TYPES[type].mass };
}
const max = (k) => Math.max(...Object.values(raw).map((r) => r[k]));
const out = {};
for (const [k, r] of Object.entries(raw)) out[k] = { speed: +(r.speed / max('speed')).toFixed(2), hop: +(r.hop / max('hop')).toFixed(2), balance: +r.balance.toFixed(2), weight: +(r.weight / max('weight')).toFixed(2), cm: +(r.speed * 10).toFixed(1), hopCm: +(r.hop * 10).toFixed(1) };
fs.writeFileSync(new URL('../src/stats.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
for (const [k, v] of Object.entries(out)) console.log(`${TYPES[k].name.padEnd(8)} 속도 ${String(v.cm).padStart(5)}cm  튀는 높이 ${String(v.hopCm).padStart(4)}cm  균형 ${(v.balance * 100).toFixed(0).padStart(3)}%  무게 ${TYPES[k].mass}`);
