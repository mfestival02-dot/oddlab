// 겉모습 곡면 검사: 모양 지우개의 겉면이 충돌 모양의 바깥 치수·무게중심과 맞는지 본다(물리와 무관).
import { TYPES, shapeOf } from '../src/config.js';
import { shapeMesh, fieldOf } from '../src/lookgeo.js';
let bad = 0;
for (const k of Object.keys(TYPES)) {
  if (shapeOf(k).plain) continue;
  const t0 = performance.now(), m = shapeMesh(k), ms = performance.now() - t0;
  const lo = [1, 1, 1], hi = [-1, -1, -1];
  for (let i = 0; i < m.pos.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], m.pos[i + a]); hi[a] = Math.max(hi[a], m.pos[i + a]); }
  const dims = TYPES[k].dims, { off } = fieldOf(k);
  // 충돌 모양의 양쪽 끝(조각 모서리 기준, 무게중심 좌표)
  const clo = [1, 1, 1], chi = [-1, -1, -1];
  for (const p of shapeOf(k).parts) for (const v of p.corners) for (let a = 0; a < 3; a++) { clo[a] = Math.min(clo[a], v[a] - off[a]); chi[a] = Math.max(chi[a], v[a] - off[a]); }
  // 바깥 치수: 겉모습의 양쪽 끝이 충돌 모양의 양쪽 끝과 몇 mm 다른가(1 단위 = 100mm, +는 겉모습이 더 큼)
  const diff = [0, 1, 2].flatMap((a) => [clo[a] - lo[a], hi[a] - chi[a]]), worst = Math.max(...diff.map(Math.abs)) * 100;
  // 무게중심 차이: 겉모습 안쪽 부피의 중심(격자 표본) vs 충돌 무게중심(원점)
  const { sdf } = fieldOf(k); let n = 0; const com = [0, 0, 0]; const h = 0.006;
  for (let x = -dims[0]; x <= dims[0]; x += h) for (let y = -dims[1]; y <= dims[1]; y += h) for (let z = -dims[2]; z <= dims[2]; z += h) if (sdf(x, y, z) < 0) { n++; com[0] += x; com[1] += y; com[2] += z; }
  const cm = com.map((v) => (v / n) * 100), cmErr = Math.hypot(...cm);
  // 면 방향: 삼각형의 기하 법선이 꼭짓점 법선(거리장 기울기)과 반대인 비율
  let flip = 0; const P = m.pos, N = m.nrm, I = m.idx;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c2] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3], u = [0, 1, 2].map((q) => P[b + q] - P[a + q]), w = [0, 1, 2].map((q) => P[c2 + q] - P[a + q]);
    const g = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if ([0, 1, 2].reduce((s, q) => s + g[q] * (N[a + q] + N[b + q] + N[c2 + q]), 0) < 0) flip++;
  }
  const flipPct = (100 * flip) / (I.length / 3);
  const ok = worst < 2.5 && cmErr < 2.5 && flipPct < 0.5;
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'BAD'} ${k.padEnd(7)} 꼭짓점 ${String(m.pos.length / 3).padStart(6)} 삼각형 ${String(m.idx.length / 3).padStart(6)} ${ms.toFixed(0).padStart(4)}ms  끝 차이(mm, x-/x+/y-/y+/z-/z+) ${diff.map((v) => (v * 100).toFixed(1)).join('/')}  무게중심차(mm) ${cm.map((v) => v.toFixed(1)).join('/')}  뒤집힌 면 ${flipPct.toFixed(2)}%`);
}
if (bad) { console.log(`겉모습 검사 실패 ${bad}종`); process.exit(1); }
console.log('겉모습 검사 통과');
