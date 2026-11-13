// 일반 경기 배치(멀리서 시작)가 의도대로 어려운지 본다: 첫 턴에 끝낼 수 있는 발사의 비율, 컴퓨터끼리 둔 경기의 길이.
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, PHASE } from '../src/game.js';
import { Planner } from '../src/ai.js';
await RAPIER.init();
let seed = 4242; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const N = +(process.argv[2] || 10);
// 1) 첫 턴: 누름 자리 전부 × 힘 17단계 가운데 올라타는 발사가 몇 개인가
let first = [], g = new Game(RAPIER); g.layoutMode = 'match'; g.rnd = rnd;
for (let k = 0; k < N; k++) {
  g.restart(); const snap = g.snapshot(); let wins = 0, falls = 0, total = 0;
  for (let sp = 0; sp < g.spots().length; sp++) for (let p = 0.2; p <= 1.001; p += 0.05) {
    g.restore(snap); g.fireSpot(sp, p); g.runUntilSettled(15); total++;
    if (g.result?.reason === 'perch' && g.result.winner === 0) wins++; else if (g.result?.reason === 'fell' && g.result.winner === 1) falls++;
  }
  first.push({ wins, falls, total });
}
const sum = (f) => first.reduce((a, b) => a + f(b), 0);
console.log(`첫 턴에 올라타는 발사: 배치 ${N}개 × ${first[0].total}발 중 ${sum((x) => x.wins)}발 (${(100 * sum((x) => x.wins) / sum((x) => x.total)).toFixed(2)}%), 배치별 ${first.map((x) => x.wins).join(' ')}`);
console.log(`첫 턴에 스스로 떨어지는 발사: ${(100 * sum((x) => x.falls) / sum((x) => x.total)).toFixed(1)}%`);
// 2) 컴퓨터끼리 경기: 몇 턴 만에, 어떻게 끝나는가
const turns = [], ends = {};
for (let k = 0; k < N; k++) {
  const m = new Game(RAPIER); m.layoutMode = 'match'; m.rnd = rnd; m.restart();
  let n = 0;
  while (m.phase !== PHASE.RESULT && n < 40) {
    const pl = new Planner(RAPIER, m, 0.4); while (!pl.step(50));
    m.fireSpot(pl.shot.spot, pl.shot.power); m.runUntilSettled(25); n++;
  }
  turns.push(n); const key = m.result ? m.result.reason : '미결'; ends[key] = (ends[key] || 0) + 1;
}
turns.sort((a, b) => a - b);
console.log(`컴퓨터끼리 ${N}판: 끝날 때까지 턴 수 ${turns.join(' ')} (가운데값 ${turns[Math.floor(N / 2)]}), 끝난 이유 ${JSON.stringify(ends)}`);
