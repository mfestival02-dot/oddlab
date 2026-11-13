// 지우개 종류별 배율을 무작위로 바꿔 '어느 상대에게든 올라탈 수 있는' 값을 찾는다(조정용).
import RAPIER from '@dimforge/rapier3d-compat';
import { Game } from '../src/game.js';
import { TYPES, TYPE_KEYS } from '../src/config.js';
await RAPIER.init();
const key = process.argv[2], N = +(process.argv[3] || 60);
let seed = 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const R = (a, b) => +(a + rnd() * (b - a)).toFixed(2);
const base = { ...TYPES[key] };
const g = new Game(RAPIER);
const score = () => {
  let per = [];
  for (const other of TYPE_KEYS) {
    let n = 0;
    for (const [a, b] of [[key, other], [other, key]]) {
      g.types = [a, b];
      for (const ang of [-4, 0, 4]) for (let p = 0.35; p <= 0.951; p += 0.05) { g.restart(); g.fire((ang * Math.PI) / 180, p); g.runUntilSettled(15); if (g.result?.reason === 'perch' && g.result.winner === 0) n++; }
    }
    per.push(n);
  }
  return { min: Math.min(...per), sum: per.reduce((a, b) => a + b, 0), per };
};
const out = [];
for (let i = 0; i < N; i++) {
  const o = i === 0 ? {} : { fr: R(0.7, 1.6), re: R(0.3, base.re), ang: R(0.8, 3), lift: R(0.7, 1.3), spin: R(-0.3, 0.2), push: R(0.85, 1.15) };
  Object.assign(TYPES[key], base, o);
  const s = score(); out.push({ ...s, o });
}
out.sort((a, b) => b.min * 100 + b.sum - (a.min * 100 + a.sum));
for (const r of out.slice(0, 5)) console.log(r.min, r.sum, JSON.stringify(r.per), JSON.stringify(r.o));
