// 물리 버그 점검: 관통, 에너지 증가, 떠서 멈춤·파고듦, 끝나지 않는 떨림.  실행: node test/audit.mjs
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, PHASE } from '../src/game.js';
import { Sim, yawQuat } from '../src/sim.js';
import { GEOM, DT, defaultSettings, TYPES, TYPE_KEYS } from '../src/config.js';
await RAPIER.init();
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '통과' : '문제'}  ${name}${detail ? '  — ' + detail : ''}`); };
const S = defaultSettings();
const rot = (q, v) => { const { x, y, z, w } = q, [vx, vy, vz] = v; const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx); return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)]; };
// 지우개의 가장 낮은 점 높이
const lowest = (b, dims) => { const ax = rot(b.q, [1, 0, 0]), ay = rot(b.q, [0, 1, 0]), az = rot(b.q, [0, 0, 1]); return b.p[1] - (Math.abs(ax[1]) * dims[0] + Math.abs(ay[1]) * dims[1] + Math.abs(az[1]) * dims[2]); };
const euler = (x, y, z) => { const c = Math.cos, s = Math.sin; const [cx, sx, cy, sy, cz, sz] = [c(x / 2), s(x / 2), c(y / 2), s(y / 2), c(z / 2), s(z / 2)]; return { x: sx * cy * cz + cx * sy * sz, y: cx * sy * cz - sx * cy * sz, z: cx * cy * sz + sx * sy * cz, w: cx * cy * cz - sx * sy * sz }; };

// 1. 관통: 최대 파워를 포함한 발사에서 책상 아래로 파고들거나 상대를 뚫고 지나가는가
{
  let worst = 0, worstAt = '', through = 0, n = 0;
  for (const t of TYPE_KEYS.filter((k) => !TYPES[k].parts)) for (const hit of [0, 1, 2]) for (const ang of [-20, -6, 0, 6, 20]) for (const p of [0.6, 0.8, 1.0]) {      // 꼭짓점 위치를 정확히 아는 직육면체로 잰다
    const g = new Game(RAPIER); g.layoutMode = 'near'; g.types = [t, 'jumbo']; g.restart(); g.fire((ang * Math.PI) / 180, p, hit); n++;
    let tt = 0, prevSide = Math.sign(g.curr[0].p[0] - g.curr[1].p[0]);
    while (g.phase === PHASE.PHYSICS && tt < 6) {
      g.tick(); tt += DT;
      // 책상 위에 있는 꼭짓점만 본다(가장자리 밖으로 내민 꼭짓점이 책상 윗면보다 낮은 것은 정상)
      for (let i = 0; i < 2; i++) {
        const b = g.curr[i], d = TYPES[g.types[i]].dims;
        if (b.p[1] < -0.2) continue;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
          const c = rot(b.q, [sx * d[0], sy * d[1], sz * d[2]]), x = b.p[0] + c[0], y = b.p[1] + c[1], z = b.p[2] + c[2];
          if (Math.abs(x) < GEOM.desk.hx - 0.02 && Math.abs(z) < GEOM.desk.hz - 0.02 && y < worst) { worst = y; worstAt = `${t} 누르는곳${hit} ${ang}도 ${p * 100}%`; }
        }
      }
    }
  }
  // 빠르게 도는 꼭짓점은 한두 계산 간격(1/240초) 동안 책상에 살짝 박혔다가 밀려 나온다. 지우개 두께(1cm) 안쪽이면 뚫고 지나가지는 않은 것으로 본다.
  check('1. 빠른 발사에서 책상을 뚫고 지나가지 않는다(순간 박힘은 두께 미만)', worst > -0.09, `${n}발, 순간적으로 가장 깊이 박힌 정도 ${(-worst * 10).toFixed(2)}cm (${worstAt})`);
}
// 2. 에너지: 모서리·꼭짓점으로 떨어뜨렸을 때 튀면서 에너지가 늘어나는가
{
  let worstGain = 0, at = '';
  const poses = { 면: [0, 0, 0], 긴모서리: [Math.PI / 4, 0, 0], 짧은모서리: [0, 0, Math.PI / 4], 꼭짓점: [0.62, 0.3, 0.78], 세운꼭짓점: [1.1, 0.5, 0.4] };
  for (const t of TYPE_KEYS) for (const [name, e] of Object.entries(poses)) for (const h of [0.5, 1.5]) {
    const sim = new Sim(RAPIER, { bodies: [{ p: [0, h, 0], q: euler(...e), type: t }, { p: [2.2, TYPES.normal.dims[1], 1.2], q: yawQuat(0), type: 'normal' }] }, S);
    const b = sim.bodies[0], m = b.mass();
    const E = () => { const v = b.linvel(), p = b.translation(); const w = b.angvel(); const I = b.effectiveWorldInvInertiaSqrt ? 0 : 0; return 0.5 * m * (v.x * v.x + v.y * v.y + v.z * v.z) + m * S.gravity * p.y; };
    let Emin = E(), peak = 0;
    for (let k = 0; k < 600; k++) { sim.step(); const e2 = E(); if (e2 - Emin > peak) peak = e2 - Emin; Emin = Math.min(Emin, e2); }
    const rel = peak / (m * S.gravity * h);
    if (rel > worstGain) { worstGain = rel; at = `${t} ${name} 높이 ${h}`; }
    sim.free();
  }
  // 회전 에너지가 이동 에너지로 바뀌는 만큼의 오르내림은 정상이다. 낙하 높이의 25%를 넘게 되돌아 솟으면 비정상으로 본다.
  check('2. 모서리·꼭짓점 충돌에서 에너지가 비정상적으로 늘지 않는다', worstGain < 0.25, `바닥을 친 뒤 되찾은 (이동+위치)에너지 최대 = 낙하 에너지의 ${(worstGain * 100).toFixed(1)}% (${at})`);
}
// 3. 놓인 높이: 책상 위·상대 위에 멈췄을 때 떠 있거나 파고들지 않는가
{
  let worst = 0, at = '';
  for (const t of TYPE_KEYS.filter((k) => !TYPES[k].parts)) {
    const d = TYPES[t].dims;
    const sim = new Sim(RAPIER, { bodies: [{ p: [0, d[1] + 0.3, 0], q: yawQuat(0.3), type: t }, { p: [1.5, TYPES.jumbo.dims[1], 0], q: yawQuat(0), type: 'jumbo' }] }, S);
    for (let k = 0; k < 480; k++) sim.step();
    const gap = sim.bodies[0].translation().y - d[1];
    if (Math.abs(gap) > Math.abs(worst)) { worst = gap; at = `${t} 책상 위`; }
    sim.free();
    const sim2 = new Sim(RAPIER, { bodies: [{ p: [0.05, TYPES.jumbo.dims[1] * 2 + d[1] + 0.2, 0], q: yawQuat(0.5), type: t }, { p: [0, TYPES.jumbo.dims[1], 0], q: yawQuat(0), type: 'jumbo' }] }, S);
    for (let k = 0; k < 600; k++) sim2.step();
    const gap2 = sim2.bodies[0].translation().y - sim2.bodies[1].translation().y - TYPES.jumbo.dims[1] - d[1];
    if (Math.abs(gap2) > Math.abs(worst)) { worst = gap2; at = `${t} 점보 위`; }
    sim2.free();
  }
  check('3. 멈췄을 때 떠 있거나 파고들지 않는다', Math.abs(worst) < 0.004, `가장 큰 어긋남 ${(worst * 10).toFixed(3)}cm (${at}, 음수면 파고듦)`);
}
// 4. 떨림: 모든 발사가 제한 시간 안에 끝나는가
{
  let n = 0, stuck = 0, relaxed = 0, longest = 0;
  for (const a of TYPE_KEYS) for (const b of TYPE_KEYS) for (const hit of [0, 1, 2]) for (const ang of [-10, 0, 10]) for (const p of [0.3, 0.55, 0.8]) {
    const g = new Game(RAPIER); g.layoutMode = 'near'; g.types = [a, b]; g.restart(); g.fire((ang * Math.PI) / 180, p, hit); n++;
    const r = g.runUntilSettled(40);
    if (g.stuck || g.phase === PHASE.PHYSICS) stuck++; else if (g.timers.phys > 10 || r.time > 10) relaxed++;
    longest = Math.max(longest, r.time);
  }
  check('4. 미세한 떨림 때문에 턴이 안 끝나는 발사가 없다', stuck === 0, `${n}발 중 끝나지 않음 ${stuck}, 10초 넘겨 기준 완화로 끝남 ${relaxed}, 가장 오래 ${longest.toFixed(1)}초`);
}
// 5. 충돌체와 그림의 크기: 그리는 쪽은 TYPES.dims를 그대로 쓰므로 충돌체의 바깥 치수만 확인한다
{
  let ok = true; const notes = [];
  for (const t of TYPE_KEYS.filter((k) => !TYPES[k].parts)) {
    const sim = new Sim(RAPIER, { bodies: [{ p: [0, 1, 0], q: yawQuat(0), type: t }, { p: [2, 1, 0], q: yawQuat(0), type: t }] }, S);
    const he = sim.cols[0][0].halfExtents(), r = sim.cols[0][0].roundRadius();
    const outer = [he.x + r, he.y + r, he.z + r];
    if (outer.some((v, i) => Math.abs(v - TYPES[t].dims[i]) > 1e-6)) ok = false;
    notes.push(`${TYPES[t].name} ${outer.map((v) => (v * 20).toFixed(1)).join('×')}cm`);
    sim.free();
  }
  check('5. 충돌체 바깥 치수가 그리는 모양과 같다', ok, notes.join(', '));
}
// 6. 모양 지우개: 책상 위에 떨어뜨렸을 때 책상을 뚫지 않고 그 위에 멈추는가
{
  let ok = true; const notes = [];
  for (const t of TYPE_KEYS.filter((k) => TYPES[k].parts)) {
    const sim = new Sim(RAPIER, { bodies: [{ p: [0, 0.6, 0], q: euler(0.4, 0.3, 0.2), type: t }, { p: [2.2, TYPES.normal.dims[1], 1.2], q: yawQuat(0), type: 'normal' }] }, S);
    let minY = 9; for (let k = 0; k < 720; k++) { sim.step(); minY = Math.min(minY, sim.bodies[0].translation().y); }
    const y = sim.bodies[0].translation().y, v = sim.speeds(0);
    if (!(minY > 0.015 && y < 0.25 && v.lin < 0.05 && v.ang < 0.3)) ok = false;
    notes.push(`${TYPES[t].name} ${(y * 10).toFixed(1)}cm`);
    sim.free();
  }
  check('6. 모양 지우개가 책상을 뚫지 않고 그 위에 가만히 멈춘다(중심 높이)', ok, notes.join(', '));
}
console.log(`\n통과 ${pass} / 문제 ${fail}`);
