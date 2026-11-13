// 설정을 무작위로 바꿔 가며 '중간 파워에서 올라타기 쉬운' 조합을 찾는다(개발용).
import RAPIER from '@dimforge/rapier3d-compat';
import { Game } from '../src/game.js';
await RAPIER.init();
const g = new Game(RAPIER);
let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const R = (a, b) => +(a + rnd() * (b - a)).toFixed(3);
const powers = [0.2, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9, 1.0], angles = [-6, 0, 6];
const outcome = (a, p) => {
  g.restart(); g.fire((a * Math.PI) / 180, p);
  const x0 = g.curr[0].p[0];
  const r = g.runUntilSettled(20);
  if (r.phase === 'result') { const { winner, reason } = r.result; return reason === 'perch' ? (winner === 0 ? 'P' : 'x') : reason === 'both-fell' ? 'D' : winner === 0 ? 'f' : 'F'; }
  return r.turnPassed ? (g.curr[0].p[0] - x0 < 0.35 ? 's' : '.') : '?';
};
const best = [];
const N = +(process.argv[2] || 150);
for (let n = 0; n < N; n++) {
  const o = { impulse: R(6, 22), vAssist: R(0, 0.9), spinAssist: R(-0.5, 0.5), hitBack: R(0, 1), hitHeight: R(-1, 1), friction: R(0.5, 1.2), restitution: R(0.05, 0.4), angDamp: R(0.3, 2.5), linDamp: R(0.05, 0.6), gravity: R(40, 98) };
  Object.assign(g.pending, o);
  let mid = 0, weakShort = 0, strongOver = 0, rows = [];
  for (const a of angles) {
    let row = '';
    for (const p of powers) {
      const c = outcome(a, p); row += c;
      if (c === 'P' && p >= 0.4 && p <= 0.7) mid++;
      if (p <= 0.3 && c === 's') weakShort++;
      if (p >= 0.9 && c !== 'P') strongOver++;
    }
    rows.push(row);
  }
  const score = mid * 2 + weakShort + strongOver;
  best.push({ score, mid, o, rows });
}
best.sort((a, b) => b.score - a.score);
for (const b of best.slice(0, 6)) console.log(b.score, b.mid, JSON.stringify(b.o), '\n   ', b.rows.join(' | '));
