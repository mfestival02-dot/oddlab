// 필수 검증: 화면 없이 게임 로직과 물리를 그대로 돌려 확인한다.  실행: npm test
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, PHASE } from '../src/game.js';
import { yawQuat } from '../src/sim.js';
import { GEOM, DT, defaultSettings, validateSettings, initialLayout, TYPES, TYPE_KEYS, HITS } from '../src/config.js';
const [HX, HY, HZ] = TYPES.normal.dims;
import { SUCCESS_PRESET } from '../src/preset.js';
await RAPIER.init();

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '통과' : '실패'}  ${name}${detail ? '  — ' + detail : ''}`); };
const rad = (d) => (d * Math.PI) / 180;
const flat = (x, z, yaw = 0, extra = {}) => ({ p: [x, HY + 0.002, z], q: yawQuat(yaw), ...extra });
function scene(bodies, player = 0) {      // 원하는 상태에서 물리만 진행시킨다
  const g = new Game(RAPIER);
  g.restore({ state: { bodies }, player, aim: [0, Math.PI], angle: 0, power: null, settings: defaultSettings() });
  g.phase = PHASE.PHYSICS;
  return g;
}
function shot(angleDeg, power, g = new Game(RAPIER)) {
  g.restart(); g.fire(rad(angleDeg), power);
  const x0 = g.curr[0].p[0];
  let maxY = 0, spin = 0, t = 0, maxPerch = 0;
  while (g.phase === PHASE.PHYSICS && t < 30) { g.tick(); t += DT; maxY = Math.max(maxY, g.curr[0].p[1]); spin += g.sim.speeds(0).ang * DT; maxPerch = Math.max(maxPerch, g.timers.perch); }
  return { g, travel: g.curr[0].p[0] - x0, maxY, spin, t, result: g.result, passed: g.phase === PHASE.AIM };
}
const desc = (r) => (r.result ? `${r.result.winner === null ? '무승부' : (r.result.winner + 1) + 'P 승'}(${r.result.reason})` : r.passed ? '차례 넘김' : '미결');

// 1~3. 약·중·강
const weak = shot(0, 0.25), mid = shot(0, 0.65), strong = shot(0, 0.98);
for (const [n, r] of [['약 25%', weak], ['중 65%', mid], ['강 98%', strong]])
  console.log(`      ${n}: 이동 ${r.travel.toFixed(2)}, 최고 높이 ${r.maxY.toFixed(3)}, 누적 회전 ${r.spin.toFixed(2)}rad, ${r.t.toFixed(2)}초, ${desc(r)}`);
check('1. 약한 발사는 짧게 이동하고 차례가 넘어간다', weak.passed && weak.travel > 0.02 && weak.travel < 0.5, `이동 ${weak.travel.toFixed(2)}`);
check('2. 중간 발사로 상대 위에 올라타 승리한다', mid.result?.reason === 'perch' && mid.result.winner === 0, desc(mid));
check('3. 강한 발사는 더 멀리·더 높이·더 많이 돌고 낙하 위험이 있다', strong.travel > mid.travel * 1.5 && strong.maxY > mid.maxY && strong.spin > mid.spin, `${desc(strong)}, 이동 ${strong.travel.toFixed(2)} vs ${mid.travel.toFixed(2)}`);
check('3b. 파워에 따라 결과가 연속적으로 달라진다(고정 동작 아님)', (() => { const a = shot(0, 0.3).travel, b = shot(0, 0.35).travel, c = shot(0, 0.4).travel; return a < b && b < c; })());

// 4. 프리셋 반복
{
  const finals = [];
  for (let i = 0; i < 6; i++) {
    const g = new Game(RAPIER); g.pending = { ...SUCCESS_PRESET.settings }; g.restart();
    g.fire(rad(SUCCESS_PRESET.angleDeg), SUCCESS_PRESET.power); g.runUntilSettled();
    if (i === 3) { g.replayLast(); g.runUntilSettled(); }            // '같은 조건으로 다시 발사' 경로도 섞는다
    finals.push({ r: g.result, p: g.curr[0].p });
  }
  const allWin = finals.every((f) => f.r?.reason === 'perch' && f.r.winner === 0);
  const drift = Math.max(...finals.map((f) => Math.hypot(f.p[0] - finals[0].p[0], f.p[1] - finals[0].p[1], f.p[2] - finals[0].p[2])));
  check('4. 성공 프리셋을 6번 반복해도 매번 올라탄다', allWin, `최종 위치 차이 최대 ${drift.toExponential(1)}`);
}

// 5. 프리셋 주변의 여유
{
  const powers = [0.5, 0.525, 0.55, 0.575, 0.6, 0.625, 0.65, 0.675, 0.7, 0.725, 0.75, 0.775, 0.8, 0.825, 0.85], angles = [-8, -6, -4, -2, 0, 2, 4, 6, 8];
  let n = 0, total = 0;
  console.log('      방향\\파워 ' + powers.map((p) => (p * 100).toFixed(0).padStart(3)).join(''));
  for (const a of angles) {
    let row = '';
    for (const p of powers) { const r = shot(a, p); const ok = r.result?.reason === 'perch' && r.result.winner === 0; total++; if (ok) n++; row += '  ' + (ok ? 'O' : r.result ? 'x' : '.'); }
    console.log('      ' + String(a).padStart(4) + '도    ' + row);
  }
  check('5. 프리셋 주변 방향·파워에서도 성공한다(조작 여유)', n >= 20, `${total}칸 중 ${n}칸 성공 (O 올라탐 / . 차례 넘김 / x 그 밖의 결과)`);
}

// 6. 옆면끼리 부딪혀 나란히 멈춤
{
  const g = scene([flat(-0.3, 0, 0, { lv: [0, 0, 4] }), flat(-0.3, 0.3, 0)]);
  let touched = false, t = 0;
  while (g.phase === PHASE.PHYSICS && t < 20) { g.tick(); t += DT; if (g.info.touching) touched = true; }
  check('6. 옆면 충돌 뒤 나란히 멈추면 승리가 아니다', touched && g.result === null && g.phase === PHASE.AIM, `접촉 발생 ${touched}, 차례 넘김`);
}
// 7. 공중에서 스쳐 지나감
{
  const g = scene([{ p: [-0.75, 0.24, 0], q: yawQuat(0), lv: [13, 1.5, 0] }, flat(0, 0, 0)]);
  let overlapT = 0, t = 0, maxPerch = 0;
  while (g.phase === PHASE.PHYSICS && t < 20) { g.tick(); t += DT; if (Math.abs(g.curr[0].p[0]) < 0.4 && g.curr[0].p[1] > 0.1) overlapT += DT; maxPerch = Math.max(maxPerch, g.timers.perch); }
  check('7. 상대 위를 공중에서 지나가는 것만으로는 승리가 아니다', overlapT > 0.03 && overlapT < 0.3 && g.result?.reason !== 'perch', `위를 지난 시간 ${overlapT.toFixed(2)}초, 걸침 타이머 최대 ${maxPerch.toFixed(2)}초, 결과 ${g.result ? g.result.reason : '차례 넘김'}`);
}
// 8. 잠깐 올라갔다가 미끄러져 떨어짐
{
  const g = scene([{ p: [0.2, HY * 3 + 0.004, 0], q: yawQuat(0), lv: [5, 0, 0] }, flat(0, 0, 0)]);
  let onTop = 0, t = 0;
  while (g.phase === PHASE.PHYSICS && t < 20) { g.tick(); t += DT; if (g.info.upper === 0) onTop += DT; }
  check('8. 잠깐 올라갔다 미끄러져 내려오면 승리가 아니다', onTop > 0.02 && onTop < 0.8 && g.result === null, `받쳐진 시간 ${onTop.toFixed(2)}초(기준 0.8초), ${g.result ? g.result.reason : '차례 넘김'}`);
}
// 9. 책상 밖으로 일부만 나감
{
  const edge = GEOM.desk.hx - HX + 0.2;               // 길이의 40%가 책상 밖
  const g = scene([flat(edge, 0, 0), flat(-1, 0, 0)]);
  let t = 0; while (g.phase === PHASE.PHYSICS && t < 20) { g.tick(); t += DT; }
  check('9. 일부가 책상 밖으로 나와도 받쳐져 있으면 패배가 아니다', !g.sim.fallen[0] && g.result === null && g.curr[0].p[1] > 0, `높이 ${g.curr[0].p[1].toFixed(3)}, 밖으로 나온 길이 0.2/0.5`);
}
// 10. 한쪽만 낙하
{
  const g = scene([flat(2.4, 0, 0, { lv: [10, 0, 0] }), flat(-1, 0, 0)]);
  let t = 0, firstFallT = null; while (g.phase === PHASE.PHYSICS && t < 20) { g.tick(); t += DT; if (firstFallT === null && g.sim.fallen[0]) firstFallT = t; }
  check('10. 한쪽만 떨어지면 떨어진 쪽이 진다', g.result?.reason === 'fell' && g.result.winner === 1, `낙하 판정 ${firstFallT?.toFixed(2)}초, 결과 확정 ${t.toFixed(2)}초`);
}
// 11. 둘 다 낙하 (두 번째는 조금 늦게 떨어진다)
{
  const g = scene([flat(2.4, 0, 0, { lv: [10, 0, 0] }), flat(-1.5, 0, 0, { lv: [-12, 0, 0] })]);
  let t = 0, f0 = null, f1 = null; while (g.phase === PHASE.PHYSICS && t < 20) { g.tick(); t += DT; if (f0 === null && g.sim.fallen[0]) f0 = t; if (f1 === null && g.sim.fallen[1]) f1 = t; }
  check('11. 둘 다 떨어지면 무승부(먼저 떨어진 쪽만 보고 확정하지 않는다)', g.result?.reason === 'both-fell' && g.result.winner === null && f1 > f0, `낙하 시각 ${f0?.toFixed(2)}초 / ${f1?.toFixed(2)}초`);
}
// 12. 반복 입력
{
  const g = new Game(RAPIER); let fires = 0; g.onEvent = (t) => { if (t === 'fire') fires++; };
  const a = g.press(), b = g.press(), c = g.press();          // 같은 순간에 세 번
  check('12a. 게이지를 시작한 입력으로 곧바로 발사되지 않는다', a === 'gauge' && b === null && c === null && fires === 0 && g.phase === PHASE.POWER);
  g.turn(1, 0.5); const aimBefore = g.aim[0];
  for (let i = 0; i < 120; i++) g.tick();
  g.turn(1, 0.5);
  check('12b. 게이지가 움직이는 동안 방향은 고정된다', g.aim[0] === aimBefore);
  const d = g.press(), e = g.press(), f = g.press();
  check('12c. 한 차례에 한 번만 발사된다', d === 'fire' && e === null && f === null && fires === 1 && g.phase === PHASE.PHYSICS);
  g.runUntilSettled();
  if (g.phase === PHASE.AIM) check('12d. 차례가 넘어가면 상대 지우개만 발사된다', (() => { g.fire(g.aim[1], 0.3); const ev = g.events.find((e) => e.type === 'launch'); for (let i = 0; i < 4; i++) g.tick(); return g.player === 1 && g.lastShot.player === 1 && ev && ev.i === 1 && Math.hypot(g.curr[1].lv[0], g.curr[1].lv[2]) > 0.1; })(), '충격은 2P 지우개에만 준다(붙어 있던 1P가 밀리는 것은 정상)');
}
// 13. 재시작
{
  const g = new Game(RAPIER); g.fire(0, 0.8); for (let i = 0; i < 40; i++) g.tick();
  g.restart();
  const L = initialLayout();
  const still = g.curr.every((b) => Math.hypot(...b.lv) < 1e-9 && Math.hypot(...b.av) < 1e-9);
  const placed = g.curr.every((b, i) => Math.hypot(b.p[0] - L.bodies[i].p[0], b.p[2] - L.bodies[i].p[2]) < 1e-6);
  const clean = g.player === 0 && g.phase === PHASE.AIM && g.gauge.value === 0 && Object.values(g.timers).every((v) => v === 0) && g.result === null && g.perchOwner === null && g.acc === 0;
  check('13. 재시작하면 속도·판정 타이머·차례·게이지가 모두 초기화된다', still && placed && clean);
}
// 14. 설정 내보내기·가져오기
{
  const s = defaultSettings(); s.impulse = 12.3; s.friction = 0.91;
  const round = validateSettings(JSON.parse(JSON.stringify(s)));
  const bad1 = validateSettings({ ...s, friction: 99 }), bad2 = validateSettings({ ...s, impulse: 'abc' }), bad3 = validateSettings({ version: 1 }), bad4 = validateSettings({ ...s, version: 7 }), bad5 = validateSettings([1, 2]);
  check('14. 설정을 내보냈다 가져오면 같고, 잘못된 값은 이유와 함께 거부한다', round.ok && round.settings.impulse === 12.3 && round.settings.friction === 0.91 && !bad1.ok && !bad2.ok && !bad3.ok && !bad4.ok && !bad5.ok,
    `거부 예: "${bad1.errors[0]}" / "${bad2.errors[0]}"`);
  const g = new Game(RAPIER); g.fire(0, 0.65); for (let i = 0; i < 10; i++) g.tick();
  g.pending.impulse = 3;
  check('14b. 발사 중에 바꾼 설정은 지금 시뮬레이션에 섞이지 않고 다음 발사부터 적용된다', g.applied.impulse === 16 && g.pending.impulse === 3);
}
// 15. 그리기 프레임률이 달라도 물리 결과가 같다
{
  const run = (frameDt) => {
    const g = new Game(RAPIER); g.fire(0, 0.65);
    let t = 0, k = 0; while (g.phase === PHASE.PHYSICS && t < 30) { const d = typeof frameDt === 'function' ? frameDt(k++) : frameDt; g.advance(d); t += d; }
    return { r: g.result, p: g.curr[0].p, q: g.curr[0].q, ticks: Math.round(g.timers.phys / DT) };
  };
  const a = run(1 / 30), b = run(1 / 60), c = run(1 / 144), d = run((k) => [0.004, 0.021, 0.013, 0.033, 0.008][k % 5]);
  const diff = (x, y) => Math.hypot(x.p[0] - y.p[0], x.p[1] - y.p[1], x.p[2] - y.p[2]);
  check('15. 30·60·144fps와 들쭉날쭉한 프레임에서 최종 결과가 같다', [a, b, c, d].every((x) => x.r?.reason === 'perch' && x.ticks === a.ticks) && diff(a, b) < 1e-4 && diff(a, c) < 1e-4 && diff(a, d) < 1e-4, `승리 확정까지 물리 걸음 수 ${[a, b, c, d].map((x) => x.ticks).join(' / ')}, 위치 차이 최대 ${Math.max(diff(a, b), diff(a, c), diff(a, d)).toExponential(1)}`);
  const g = new Game(RAPIER); g.fire(0, 0.65); const before = g.sim.time; g.advance(5);
  check('15b. 프레임이 5초 밀려도 한 번에 0.1초까지만 계산한다', Math.abs(g.sim.time - before - 0.1) < DT * 1.5, `진행된 시간 ${(g.sim.time - before).toFixed(3)}초`);
}
// 그 밖: 뒤집히거나 옆으로 선 지우개도 발사 계산이 깨지지 않는다
{
  const poses = [['뒤집힘', { x: 1, y: 0, z: 0, w: 0 }, HY], ['옆으로 섬', { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }, HZ], ['세로로 섬', { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 }, HX]];
  let ok = true, note = [];
  for (const [name, q, h] of poses) {
    const g = new Game(RAPIER);
    g.restore({ state: { bodies: [{ p: [-0.75, h + 0.002, 0], q }, flat(0.75, 0, Math.PI)] }, player: 0, aim: [0, Math.PI], angle: 0, power: null, settings: defaultSettings() });
    g.fire(0, 0.6); const x0 = g.curr[0].p[0]; g.runUntilSettled();
    const fin = g.curr[0].p.every(Number.isFinite) && Number.isFinite(g.curr[0].q.w);
    const moved = g.curr[0].p[0] - x0;
    ok = ok && fin && moved > 0.05; note.push(`${name} 이동 ${moved.toFixed(2)}`);
  }
  check('16. 뒤집히거나 선 자세에서도 발사가 정상 동작한다', ok, note.join(', '));
}
// 2P도 같은 방식으로 올라탈 수 있다
{
  let won = null;
  for (const p of [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]) {
    const g = new Game(RAPIER); g.fire(Math.PI / 2, 0.15); g.runUntilSettled();   // 1P는 옆으로 살짝만
    if (g.phase !== PHASE.AIM || g.player !== 1) continue;
    const me = g.curr[1].p, op = g.curr[0].p;
    g.fire(Math.atan2(op[2] - me[2], op[0] - me[0]), p); g.runUntilSettled();
    if (g.result?.reason === 'perch' && g.result.winner === 1) { won = p; break; }
  }
  check('17. 2P도 일반 발사로 1P 위에 올라타 승리할 수 있다', won !== null, won !== null ? `파워 ${won * 100}%` : '');
}
// 올라탄 쪽이 차례와 무관하게 이긴다
{
  const g = scene([flat(0, 0, 0), { p: [0.08, HY * 3 + 0.004, 0], q: yawQuat(0.4) }], 0);
  g.runUntilSettled();
  check('18. 누구 차례든 최종적으로 위에 받쳐진 쪽이 이긴다', g.result?.reason === 'perch' && g.result.winner === 1, `1P 차례에 2P가 위 → ${g.result ? (g.result.winner + 1) + 'P 승' : '미결'}`);
}
// 지우개 종류: 눌러 튕기기로 올라타기가 성립하는지(가까운 검증 배치, 상대 쪽을 향한 자리 × 힘 15단계)
{
  const g = new Game(RAPIER); const atk = {}, def = {}; let shots = 0;
  for (const a of TYPE_KEYS) for (const b of TYPE_KEYS) {
    g.types = [a, b]; g.restart(); const snap = g.snapshot();
    const toward = g.spots().map((sp, i) => [i, Math.abs(Math.atan2(Math.sin(sp.angle), Math.cos(sp.angle)))]).filter((x) => x[1] < 0.6).map((x) => x[0]);
    let n = 0;
    for (const sp of toward) for (let p = 0.3; p <= 1.001; p += 0.05) { g.restore(snap); g.fireSpot(sp, p); g.runUntilSettled(15); shots++; if (g.result?.reason === 'perch' && g.result.winner === 0) n++; }
    atk[a] = (atk[a] || 0) + (n > 0 ? 1 : 0); def[b] = (def[b] || 0) + (n > 0 ? 1 : 0);
  }
  const N = TYPE_KEYS.length, name = (k) => TYPES[k].name;
  const weakAtk = TYPE_KEYS.filter((k) => atk[k] === 0), hardDef = TYPE_KEYS.filter((k) => def[k] < N / 3);
  check(`19. 지우개 ${N}종 모두 눌러 튕기기로 다른 지우개 위에 올라탈 수 있다`, weakAtk.length === 0, `${shots}발. 올라탈 수 있는 상대 수: ${TYPE_KEYS.map((k) => `${name(k)} ${atk[k]}`).join(', ')}`);
  console.log(`      올라타이기 어려운 지우개(18종 중 6종 미만에게만 허용): ${hardDef.map((k) => `${name(k)} ${def[k]}`).join(', ') || '없음'}`);
  g.types = ['jumbo', 'mini']; g.restart();
  const m0 = g.sim.bodies[0].mass(), m1 = g.sim.bodies[1].mass();
  check('19b. 종류에 따라 크기와 무게가 실제로 다르다', Math.abs(m0 - 2.1) < 1e-3 && Math.abs(m1 - 0.5) < 1e-3 && g.sim.dims[0][0] === 0.33 && g.curr[1].type === 'mini', `점보 ${m0.toFixed(2)} / 꼬마 ${m1.toFixed(2)}`);
  g.types = ['sharp', 'worn']; g.restart();
  check('19c. 각진 지우개와 닳은 지우개는 충돌체 모서리 반경이 다르다', g.sim.cols[0][0].roundRadius() < 0.006 && g.sim.cols[1][0].roundRadius() > 0.025, `새것 ${g.sim.cols[0][0].roundRadius().toFixed(3)} / 닳은 ${g.sim.cols[1][0].roundRadius().toFixed(3)}`);
}
// 누르는 위치
{
  const peak = (h) => { const g = new Game(RAPIER); g.fire(0, 0.6, h); let m = 0, t = 0; while (g.phase === PHASE.PHYSICS && t < 0.35) { g.tick(); t += DT; m = Math.max(m, g.curr[0].p[1]); } return m; };
  const f = peak(0), c = peak(1), b = peak(2);
  check('20. 누르는 위치에 따라 뜨는 높이가 달라진다(앞 < 가운데 < 뒤)', f < c && c < b, `앞 ${f.toFixed(3)} / 가운데 ${c.toFixed(3)} / 뒤 ${b.toFixed(3)}`);
  const g = new Game(RAPIER); g.setHit(2); g.press(); for (let i = 0; i < 40; i++) g.tick(); g.setHit(0); const hitLocked = g.hit === 2; g.press();
  check('20b. 누르는 위치는 조준 중에만 바뀌고, 저장·복원해도 유지된다', hitLocked && g.lastShot.hit === 2 && (() => { g.restore(g.lastShot); return g.hit === 2; })());
}
// 연출용 사건 기록
{
  const g = new Game(RAPIER); g.fire(0, 0.65); const seen = new Set();
  let t = 0; while (g.phase === PHASE.PHYSICS && t < 20) { g.tick(); t += DT; for (const e of g.events) seen.add(e.type); g.events.length = 0; }
  const g2 = new Game(RAPIER); g2.fire(0, 1); let fell = false; t = 0; while (g2.phase === PHASE.PHYSICS && t < 20) { g2.tick(); t += DT; if (g2.events.some((e) => e.type === 'fall')) fell = true; g2.events.length = 0; }
  check('21. 발사·충돌·걸침 시작·낙하가 연출용 사건으로 기록된다', seen.has('impact') && seen.has('perch-start') && fell, [...seen].join(', ') + (fell ? ', fall' : ''));
}
// 손가락으로 눌러 튕기기
{
  const g = new Game(RAPIER); g.types = ['normal', 'normal']; g.restart();
  const n = g.spots().length, s0 = g.spot;
  g.cycleSpot(1); const s1 = g.spot; g.selectSpot(-1); const wrap = g.spot === n - 1; g.selectSpot(s0);
  g.pressDown(); for (let i = 0; i < 10; i++) g.tick(); const tap = g.pressUp();
  check('22. 누름 자리를 돌려 가며 고를 수 있고, 살짝 건드린 것은 취소된다', n === 8 && s1 === (s0 + 1) % n && wrap && tap === false && g.phase === PHASE.AIM, `자리 ${n}개`);
  g.pressDown(); for (let i = 0; i < 100; i++) g.tick(); g.cycleSpot(1); const locked = g.spot === s0, half = g.gauge.value;
  const fired = g.pressUp(), again = g.pressUp();
  check('22b. 누르는 동안 힘이 차고 자리는 고정되며, 떼면 그 힘으로 한 번만 튕긴다', locked && Math.abs(half - 100 * DT / g.applied.pressTime) < 0.01 && fired === true && again === false && Math.abs(g.shotPower - half) < 1e-9 && g.lastShot.spot === s0, `힘 ${(half * 100).toFixed(0)}%`);
  const g2 = new Game(RAPIER); g2.pressDown(); let t = 0; while (g2.phase === PHASE.POWER && t < 5) { g2.tick(); t += DT; }
  check('22c. 끝까지 누르고 있으면 저절로 튕긴다(최대 힘)', g2.phase === PHASE.PHYSICS && g2.shotPower === 1 && Math.abs(t - (g2.applied.pressTime + g2.applied.pressHold)) < 0.03, `${t.toFixed(2)}초`);
  // 누른 자리의 반대쪽으로 나간다
  const g3 = new Game(RAPIER); g3.restore({ state: { bodies: [flat(0, 0, 0.4), flat(2.4, 1.6, 0)] }, player: 0, aim: [0, 0], angle: 0, power: null, settings: defaultSettings() });
  let okDir = true; const kinds = new Set();
  for (let i = 0; i < 8; i++) { g3.restore(g3.lastShot ?? g3.snapshot()); const sp = g3.spots()[i]; kinds.add(sp.kind); const snap = g3.snapshot(); g3.fireSpot(i, 0.4); for (let k = 0; k < 12; k++) g3.tick(); const v = g3.curr[0].lv; if (v[0] * sp.dir[0] + v[2] * sp.dir[2] < 0.3) okDir = false; g3.restore(snap); g3.lastShot = snap; }
  check('22d. 지우개는 누른 자리의 반대쪽으로 튀어 나간다(끝·옆·꼭짓점 모두)', okDir && kinds.has('끝') && kinds.has('옆') && kinds.has('꼭짓점'));
  // 자세가 바뀌면 위로 온 면의 자리를 쓴다
  const g4 = new Game(RAPIER); g4.restore({ state: { bodies: [{ p: [0, HZ + 0.002, 0], q: { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }, type: 'normal' }, flat(2.4, 1.6, 0)] }, player: 0, aim: [0, 0], angle: 0, power: null, settings: defaultSettings() });
  const up = g4.spots(); const topY = HZ * 2;
  g4.fireSpot(0, 0.5); const x0 = 0; g4.runUntilSettled();
  check('22e. 옆으로 선 지우개도 위로 온 면의 자리를 눌러 튕길 수 있다', up.every((s) => Math.abs(s.p[1] - topY) < 0.01) && g4.curr[0].p.every(Number.isFinite) && Math.hypot(g4.curr[0].p[0] - x0, g4.curr[0].p[2]) > 0.05, `자리 높이 ${(up[0].p[1] * 10).toFixed(1)}cm`);
  // 끝과 꼭짓점의 차이
  const meas = (i, p) => { const g5 = new Game(RAPIER); g5.restore({ state: { bodies: [flat(0, 0, 0), flat(2.4, 1.6, 0)] }, player: 0, aim: [0, 0], angle: 0, power: null, settings: defaultSettings() }); g5.fireSpot(i, p); let m = 0, tt = 0, sp = 0; while (g5.phase === PHASE.PHYSICS && tt < 20) { g5.tick(); tt += DT; m = Math.max(m, g5.curr[0].p[1]); sp += Math.hypot(...g5.curr[0].av) * DT; } return { p: g5.curr[0].p, maxY: m, spin: sp * 57.3 }; };
  const spread = (i) => { const a = meas(i, 0.72), b = meas(i, 0.75), c = meas(i, 0.78); return { d: Math.max(Math.hypot(a.p[0] - b.p[0], a.p[2] - b.p[2]), Math.hypot(c.p[0] - b.p[0], c.p[2] - b.p[2])), ...b }; };
  const end = spread(0), corner = spread(1);
  check('22f. 꼭짓점을 누르면 끝을 누를 때보다 훨씬 높이 뜨고 많이 돌며, 힘의 작은 차이에 훨씬 민감하다', corner.maxY > end.maxY * 2 && corner.spin > end.spin * 2 && corner.d > end.d * 3, `끝: 높이 ${(end.maxY * 10).toFixed(1)}cm, 회전 ${end.spin.toFixed(0)}도, 힘 ±3%에 ${(end.d * 10).toFixed(1)}cm / 꼭짓점: ${(corner.maxY * 10).toFixed(1)}cm, ${corner.spin.toFixed(0)}도, ${(corner.d * 10).toFixed(1)}cm`);
  const r1 = meas(1, 0.75), r2 = meas(1, 0.75);
  check('22g. 꼭짓점 발사도 같은 조건이면 결과가 똑같다(무작위가 아니다)', r1.p.every((v, k) => v === r2.p[k]));
}
console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
