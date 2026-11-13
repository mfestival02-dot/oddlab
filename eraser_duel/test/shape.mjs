// 면·모서리·꼭짓점 접촉의 차이를 고정 시나리오로 확인한다. 시나리오는 test/scenarios.json에 저장되어 그대로 다시 돌릴 수 있다.
import RAPIER from '@dimforge/rapier3d-compat';
import fs from 'fs';
import { Game, PHASE } from '../src/game.js';
import { Planner } from '../src/ai.js';
import { yawQuat } from '../src/sim.js';
import { defaultSettings, TYPES, DT } from '../src/config.js';
await RAPIER.init();
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '통과' : '실패'}  ${name}${detail ? '  — ' + detail : ''}`); };
const H = TYPES.normal.dims[1] + 0.002, deg = (d) => (d * Math.PI) / 180;
// 시나리오: 두 지우개의 위치(x,z)·놓인 각도, 발사 방향·파워·누르는 곳
const SC = {
  '긴 축 방향(면으로 밀기)':   { a: [-1.5, 0, 0],  b: [2.4, 1.6, 0], aim: 0, power: 0.6, hit: 1 },
  '짧은 축 방향(넓은 면으로 밀기)': { a: [-1.5, 0, 90], b: [2.4, 1.6, 0], aim: 0, power: 0.6, hit: 1 },
  '비스듬히 45도(꼭짓점 쪽을 침)': { a: [-1.5, 0, 45], b: [2.4, 1.6, 0], aim: 0, power: 0.6, hit: 1 },
  '비스듬히 60도(꼭짓점 쪽을 침)': { a: [-1.5, 0, 60], b: [2.4, 1.6, 0], aim: 0, power: 0.6, hit: 1 },
  '상대의 넓은 면에 면으로 충돌': { a: [-0.9, 0, 0],  b: [0, 0, 90],  aim: 0, power: 0.62, hit: 0 },
  '상대의 모서리에 비껴 충돌':   { a: [-0.9, 0.22, 0], b: [0, 0, 90],  aim: 0, power: 0.62, hit: 0 },
  '상대의 꼭짓점에 충돌':       { a: [-0.9, 0.2, 0], b: [0.1, 0, 0], aim: 0, power: 0.62, hit: 0 },
};
fs.writeFileSync(new URL('./scenarios.json', import.meta.url), JSON.stringify({ note: 'a·b = [x, z, 놓인 각도(도)], 보통 지우개, 기본 설정. aim은 도, hit은 0 앞 / 1 가운데 / 2 뒤', settings: defaultSettings(), scenarios: SC }, null, 2) + '\n');
const g = new Game(RAPIER);
function run(s, dAim = 0, dz = 0) {
  g.restore({ state: { bodies: [{ p: [s.a[0], H, s.a[1] + dz], q: yawQuat(deg(s.a[2])), type: 'normal' }, { p: [s.b[0], H, s.b[1]], q: yawQuat(deg(s.b[2])), type: 'normal' }] }, player: 0, aim: [0, Math.PI], angle: 0, power: null, settings: defaultSettings() });
  g.fire(deg(s.aim + dAim), s.power, s.hit);
  let spinA = 0, spinB = 0, t = 0;
  while (g.phase === PHASE.PHYSICS && t < 20) { g.tick(); t += DT; spinA += Math.abs(g.curr[0].av[1]) * DT; spinB += Math.hypot(...g.curr[1].av) * DT; }
  return { a: [...g.curr[0].p], b: [...g.curr[1].p], spinA: spinA * 57.3, spinB: spinB * 57.3, side: g.curr[0].p[2] - s.a[1] - dz };
}
const dist = (p, q) => Math.hypot(p[0] - q[0], p[2] - q[2]);
const R = {};
for (const [name, s] of Object.entries(SC)) {
  const base = run(s), again = run(s), l = run(s, -2), r = run(s, 2), zl = run(s, 0, -0.02), zr = run(s, 0, 0.02);
  R[name] = { ...base, same: dist(base.a, again.a) + dist(base.b, again.b), aimSpread: Math.max(dist(base.a, l.a), dist(base.a, r.a)), bSpread: Math.max(dist(base.b, zl.b), dist(base.b, zr.b)), bMove: dist(base.b, [s.b[0], 0, s.b[1]]) };
  console.log(`      ${name}: 내 지우개 제자리 회전 ${R[name].spinA.toFixed(0)}도, 옆으로 ${(base.side * 10).toFixed(1)}cm, 방향 ±2도에 도착점 ${(R[name].aimSpread * 10).toFixed(1)}cm 차이 | 상대 ${(R[name].bMove * 10).toFixed(1)}cm 밀리고 ${R[name].spinB.toFixed(0)}도 돎, 위치 ±2mm에 상대 도착점 ${(R[name].bSpread * 10).toFixed(1)}cm 차이`);
}
const k = Object.keys(SC);
check('S1. 같은 시나리오를 다시 돌리면 결과가 똑같다(어려움이 무작위에서 오지 않는다)', Object.values(R).every((x) => x.same === 0));
check('S2. 면으로 밀면(긴 축·짧은 축) 거의 돌지 않고 곧게 간다', R[k[0]].spinA < 15 && R[k[1]].spinA < 15 && Math.abs(R[k[0]].side) < 0.05 && Math.abs(R[k[1]].side) < 0.05);
check('S3. 비스듬히 놓인 지우개를 밀면 꼭짓점 쪽을 치게 되어 크게 돈다', R[k[2]].spinA > 10 * Math.max(R[k[0]].spinA, R[k[1]].spinA, 5) && R[k[3]].spinA > 10 * Math.max(R[k[0]].spinA, R[k[1]].spinA, 5), `45도 ${R[k[2]].spinA.toFixed(0)}도, 60도 ${R[k[3]].spinA.toFixed(0)}도 회전`);
check('S4. 비스듬한 발사는 작은 방향 차이에 더 민감하다(읽기 어렵다)', Math.max(R[k[2]].aimSpread, R[k[3]].aimSpread) > 1.5 * Math.max(R[k[0]].aimSpread, R[k[1]].aimSpread), `면 ${(Math.max(R[k[0]].aimSpread, R[k[1]].aimSpread) * 10).toFixed(1)}cm vs 비스듬 ${(Math.max(R[k[2]].aimSpread, R[k[3]].aimSpread) * 10).toFixed(1)}cm`);
check('S5. 상대의 넓은 면에 면으로 부딪히면 상대가 거의 돌지 않고 밀린다', R[k[4]].bMove > 0.05 && R[k[4]].spinB < 40, `${(R[k[4]].bMove * 10).toFixed(1)}cm, ${R[k[4]].spinB.toFixed(0)}도`);
check('S6. 상대의 모서리를 비껴 치면 면으로 칠 때보다 상대가 더 많이 돈다', R[k[5]].spinB > 1.5 * R[k[4]].spinB, `면 ${R[k[4]].spinB.toFixed(0)}도 / 모서리 ${R[k[5]].spinB.toFixed(0)}도 / 꼭짓점 ${R[k[6]].spinB.toFixed(0)}도`);
check('S7. 꼭짓점끼리 스치는 충돌은 닿는 위치의 작은 차이(±2mm)에 더 민감하다', R[k[6]].bSpread > 1.5 * R[k[4]].bSpread, `면 ${(R[k[4]].bSpread * 10).toFixed(2)}cm / 모서리 ${(R[k[5]].bSpread * 10).toFixed(2)}cm / 꼭짓점 ${(R[k[6]].bSpread * 10).toFixed(2)}cm`);
// 일반 경기 배치에서 여러 턴 접근한 뒤 승부가 난다(컴퓨터끼리, 사람 수준으로 빗나가게)
{
  let seed = 777; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const realRandom = Math.random; Math.random = rnd;                    // 컴퓨터의 빗나감도 고정해 다시 돌릴 수 있게 한다
  const m = new Game(RAPIER); m.layoutMode = 'match'; m.rnd = rnd; m.restart();
  const d0 = dist(m.curr[0].p, m.curr[1].p); let n = 0; const log = [];
  while (m.phase !== PHASE.RESULT && n < 40) { const pl = new Planner(RAPIER, m, 0.15); while (!pl.step(50)); log.push(`${m.player + 1}P ${(pl.shot.power * 100).toFixed(0)}%`); m.fire(pl.shot.angle, pl.shot.power, pl.shot.hit); m.runUntilSettled(25); n++; }
  Math.random = realRandom;
  check('S8. 일반 경기 배치(40cm)에서 여러 턴 접근한 끝에 승부가 난다', !!m.result && n >= 2, `시작 거리 ${(d0 * 10).toFixed(0)}cm, ${n}턴(${log.join(' → ')}), 결과 ${m.result ? `${m.result.winner === null ? '무승부' : (m.result.winner + 1) + 'P 승'}(${m.result.reason})` : '미결'}`);
}
console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
