// 기본 배치에서 방향·파워를 훑어 결과 지도를 그린다.  사용: node test/tune.mjs key=value ...
import RAPIER from '@dimforge/rapier3d-compat';
import { Game } from '../src/game.js';
await RAPIER.init();
const over = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')).map(([k, v]) => [k, +v]));
const g = new Game(RAPIER);
Object.assign(g.pending, over);
const powers = []; for (let p = 0.15; p <= 1.001; p += 0.05) powers.push(+p.toFixed(2));
const angles = [-12, -8, -4, 0, 4, 8, 12];
console.log('설정', JSON.stringify(over), '  P=내가 올라탐  x=상대가 내 위  .=차례 넘김  F=내가 떨어짐  f=상대가 떨어짐  D=무승부');
console.log('각도\\파워 ' + powers.map((p) => String(Math.round(p * 100)).padStart(3)).join(''));
let wins = 0;
for (const a of angles) {
  let row = '';
  for (const p of powers) {
    g.restart();
    g.fire((a * Math.PI) / 180, p);
    const r = g.runUntilSettled();
    let c = '?';
    if (r.phase === 'result') {
      const { winner, reason } = r.result;
      c = reason === 'perch' ? (winner === 0 ? 'P' : 'x') : reason === 'both-fell' ? 'D' : winner === 0 ? 'f' : 'F';
    } else if (r.turnPassed) c = '.';
    if (c === 'P') wins++;
    row += '  ' + c;
  }
  console.log(String(a).padStart(4) + '도    ' + row);
}
console.log('올라탄 횟수', wins);
// 한 발의 궤적 요약
for (const p of [0.25, 0.55, 0.9]) {
  g.restart(); g.fire(0, p);
  let maxY = 0, x0 = g.curr[0].p[0], t = 0;
  while (g.phase === 'physics' && t < 30) { g.tick(); t += 1 / 120; maxY = Math.max(maxY, g.curr[0].p[1]); }
  console.log(`파워 ${p}: 이동 ${(g.curr[0].p[0] - x0).toFixed(2)}, 최고 높이 ${maxY.toFixed(3)}, 걸린 시간 ${t.toFixed(2)}s, 앞들림토크 ${g.launchInfo.torqueNoseUp.toFixed(3)}`);
}
