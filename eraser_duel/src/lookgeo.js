// 모양 지우개의 겉모습 곡면. 충돌 조각(config.js의 parts)을 둥글린 거리장(SDF)으로 바꿔 부드럽게 잇고,
// 종류별로 얕은 돋을새김·오목새김을 더한 뒤 표면 그물(surface nets)로 다각형을 뽑는다.
// 물리와는 무관하다. 바깥 치수는 충돌 조각을 넘지 않도록 둥글림을 안쪽으로 준다(돋을새김만 1mm 안쪽으로 살짝 나온다).
// 이 파일은 THREE에 기대지 않아 Node에서도 검사할 수 있다(test/look.mjs).
import { TYPES, shapeOf } from './config.js';

const { abs, min, max, hypot, sqrt, floor, cos, sin } = Math;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const smin = (a, b, k) => { const h = max(k - abs(a - b), 0) / k; return min(a, b) - h * h * k * 0.25; };
// 값 잡음(정수 격자 해시) — 같은 입력이면 늘 같은 값
const hash3 = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
export function vnoise(x, y, z) {
  const xi = floor(x), yi = floor(y), zi = floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
}
export function fbm(x, y, z, oct = 4) { let a = 0, s = 0.5, f = 1; for (let i = 0; i < oct; i++) { a += s * vnoise(x * f, y * f, z * f); f *= 2.03; s *= 0.5; } return a / (1 - 0.5 ** oct); }

// ---- 기본 거리 함수
// 둥근 모서리 직사각형(xz 평면, 반치수 hx·hz, 모서리 반경 rc)
const sdRect = (x, z, hx, hz, rc) => { const qx = abs(x) - hx + rc, qz = abs(z) - hz + rc; return min(max(qx, qz), 0) + hypot(max(qx, 0), max(qz, 0)) - rc; };
// 평면 모양 d2를 위아래 반높이 hh로 세우고 위·아래 모서리를 re만큼 둥글린다
const slab = (d2, y, hh, re) => { const dx = d2 + re, dy = abs(y) - hh + re; return min(max(dx, dy), 0) + hypot(max(dx, 0), max(dy, 0)) - re; };
export const ell = (x, y, z, rx, ry, rz) => (hypot(x / rx, y / ry, z / rz) - 1) * min(rx, ry, rz);
export const segDist = (x, z, ax, az, bx, bz) => { const px = x - ax, pz = z - az, dx = bx - ax, dz = bz - az, t = clamp((px * dx + pz * dz) / (dx * dx + dz * dz || 1), 0, 1); return hypot(px - dx * t, pz - dz * t); };
// 겉면 바로 안쪽(깊이 depth)까지만 판다
export const engrave = (d, lineDist, w, depth) => max(d, min(w - lineDist, d + depth));
// 사원수 회전
const qrot = (q, x, y, z) => { const tx = 2 * (q.y * z - q.z * y), ty = 2 * (q.z * x - q.x * z), tz = 2 * (q.x * y - q.y * x); return [x + q.w * tx + (q.y * tz - q.z * ty), y + q.w * ty + (q.z * tx - q.x * tz), z + q.w * tz + (q.x * ty - q.y * tx)]; };
const qinv = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });

// 볼록 다면체: 점들에서 바깥 평면을 찾는다(점 수가 적어 전수 조사로 충분)
function hullPlanes(pts) {
  const planes = [];
  for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) for (let c = b + 1; c < pts.length; c++) {
    const [A, B, C] = [pts[a], pts[b], pts[c]];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = hypot(...n); if (l < 1e-9) continue;
    n = n.map((x) => x / l); let d = n[0] * A[0] + n[1] * A[1] + n[2] * A[2];
    let pos = 0, neg = 0; for (const p of pts) { const s = n[0] * p[0] + n[1] * p[1] + n[2] * p[2] - d; if (s > 1e-7) pos++; else if (s < -1e-7) neg++; }
    if (pos && neg) continue;
    if (pos) { n = n.map((x) => -x); d = -d; }
    if (!planes.some((p) => p.n[0] * n[0] + p.n[1] * n[1] + p.n[2] * n[2] > 0.9999)) planes.push({ n, d });
  }
  return planes;
}

// ---- 종류별 겉모습 설계. 좌표는 config.js의 원래 좌표(무게중심 옮기기 전).
// re: 위아래 모서리 둥글림, rc: 상자 조각의 평면 모서리 반경, k: 조각 잇는 부드러움, seam: 틀 이음선
export const DESIGN = {
  bear: { re: 0.024, k: 0.03, seam: true,
    extra(d, x, y, z) {
      if (y > 0) {
        d = smin(d, ell(x - 0.105, y - 0.045, z, 0.052, 0.013, 0.062), 0.012);                     // 주둥이
        for (const s of [-1, 1]) {
          d = engrave(d, hypot((x - 0.243) / 1.0, z - s * 0.1), 0.026, 0.0045);                     // 귓속
          d = smin(d, ell(x + 0.025, y - 0.044, z - s * 0.118, 0.04, 0.012, 0.03), 0.01);           // 팔
          d = smin(d, ell(x + 0.215, y - 0.044, z - s * 0.088, 0.034, 0.011, 0.042), 0.01);         // 발
        }
      }
      return d;
    } },
  rabbit: { re: 0.02, k: 0.026, seam: true, rc: 0.019,
    extra(d, x, y, z) {
      if (y > 0) {
        for (const s of [-1, 1]) {
          const c = cos(0.12), sn = sin(0.12) * -s, lx = (x - 0.27) * c - (z - s * 0.05) * sn, lz = (x - 0.27) * sn + (z - s * 0.05) * c;
          d = engrave(d, ell(lx, 0, lz, 0.075, 1, 0.014), 0, 0.004);                    // 귓속(길쭉한 홈)
          d = smin(d, ell(x - 0.035, y - 0.04, z - s * 0.017, 0.022, 0.011, 0.022), 0.008);          // 볼 주머니
          d = smin(d, ell(x + 0.215, y - 0.04, z - s * 0.072, 0.035, 0.01, 0.026), 0.008);           // 발
          d = smin(d, ell(x + 0.035, y - 0.04, z - s * 0.088, 0.026, 0.01, 0.022), 0.008);           // 앞발
        }
        d = smin(d, ell(x + 0.215, y - 0.04, z, 0.03, 0.013, 0.03), 0.01);                           // 꼬리
      }
      return d;
    } },
  turtle: { re: 0.022, reBig: 0.04, k: 0.03, seam: true,
    extra(d, x, y, z) {
      if (y > 0.025) {
        const r = hypot(x, z);
        if (r < 0.16) d = smin(d, ell(x, y - 0.052, z, 0.135, 0.024, 0.135), 0.02);                // 등딱지 볼록
        let g = abs(r - 0.15);
        if (r < 0.155) for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3, b = a + Math.PI / 3;
          g = min(g, segDist(x, z, cos(a) * 0.062, sin(a) * 0.062, cos(b) * 0.062, sin(b) * 0.062), segDist(x, z, cos(a) * 0.062, sin(a) * 0.062, cos(a) * 0.15, sin(a) * 0.15));
        }
        d = engrave(d, g, 0.0042, 0.0035);                                       // 등딱지 무늬 홈
      }
      return d;
    } },
  wrest1: { re: 0.018, k: 0.03, seam: true, rc: 0.032,
    extra(d, x, y, z, S) {
      if (y > 0) {
        for (const s of [-1, 1]) {
          d = smin(d, ell(x - 0.04, y - 0.041, z - s * 0.032, 0.036, 0.009, 0.03), 0.01);            // 가슴
          const f = S.at(s > 0 ? 2 : 3, [0, 0, 0.056 * s]);                                          // 주먹(팔 끝)
          d = smin(d, ell(x - f[0], y - 0.036, z - f[2], 0.042, 0.012, 0.036), 0.012);
        }
      }
      return d;
    } },
  wrest2: { re: 0.03, k: 0.036, seam: true, rc: 0.036,
    extra(d, x, y, z) {
      if (y > 0) {
        d = smin(d, ell(x + 0.02, y - 0.06, z, 0.088, 0.022, 0.078), 0.02);                         // 배
        for (const s of [-1, 1]) d = smin(d, ell(x - 0.055, y - 0.066, z - s * 0.04, 0.04, 0.012, 0.038), 0.012);   // 가슴
        d = smin(d, ell(x - 0.135, y - 0.07, z, 0.045, 0.02, 0.012), 0.012);                         // 머리 가운데 볏
      }
      return d;
    } },
  roll: { re: 0.009, k: 0.01, seam: false },
  prism: { re: 0.006, k: 0.01, seam: false },
};

// 종류 하나의 거리장. 반환: sdf(x,y,z) (무게중심 좌표), part(x,y,z) 가장 가까운 조각 번호, off(원래 좌표 = 무게중심 좌표 + off)
const fields = {};
export function fieldOf(type) {
  if (fields[type]) return fields[type];
  const T = TYPES[type], sh = shapeOf(type), D = DESIGN[type];
  const p0 = T.parts[0], s0 = sh.parts[0];
  const off = p0.s === 'hull' ? [0, 1, 2].map((k) => p0.pts[0][k] - s0.pts[0][k]) : [0, 1, 2].map((k) => p0.p[k] - s0.p[k]);
  const parts = sh.parts.map((pt) => {
    if (pt.s === 'hull') { const pl = hullPlanes(pt.pts); const re = D.re; return (x, y, z) => { let o = 0, i = -1e9; for (const { n, d } of pl) { const e = n[0] * x + n[1] * y + n[2] * z - (d - re); if (e > 0) o += e * e; if (e > i) i = e; } return sqrt(o) + min(i, 0) - re; }; }
    const qi = qinv(pt.q), [cx, cy, cz] = pt.p;
    if (pt.s === 'ball') return (x, y, z) => hypot(x - cx, y - cy, z - cz) - pt.rad;
    const hh = pt.s === 'cyl' ? pt.hh : pt.h[1];
    const re = min((pt.s === 'cyl' && pt.rad > 0.12 && D.reBig) || D.re, hh * 0.85);
    if (pt.s === 'cyl') return (x, y, z) => { const [lx, ly, lz] = qrot(qi, x - cx, y - cy, z - cz); return slab(hypot(lx, lz) - pt.rad, ly, hh, re); };
    const rc = min(D.rc || 0.02, pt.h[0] * 0.95, pt.h[2] * 0.95);
    return (x, y, z) => { const [lx, ly, lz] = qrot(qi, x - cx, y - cy, z - cz); return slab(sdRect(lx, lz, pt.h[0], pt.h[2], rc), ly, hh, re); };
  });
  // S.at(조각 번호, 조각 안 좌표) → 원래 좌표
  const S = { at: (i, l) => { const pt = sh.parts[Math.round(i)]; const v = qrot(pt.q, ...l); return [v[0] + pt.p[0] + off[0], v[1] + pt.p[1] + off[1], v[2] + pt.p[2] + off[2]]; } };
  // 잇는 부분이 부드럽게 부풀어도 충돌 모양의 바깥 상자는 넘지 않게 자른다(책상에 파묻혀 보이지 않게)
  const lo = [1, 1, 1], hi = [-1, -1, -1];
  for (const p of sh.parts) for (const v of p.corners) for (let a = 0; a < 3; a++) { lo[a] = min(lo[a], v[a] - off[a]); hi[a] = max(hi[a], v[a] - off[a]); }
  const base = (x, y, z) => { let d = parts[0](x, y, z); for (let i = 1; i < parts.length; i++) d = smin(d, parts[i](x, y, z), D.k); return max(d, lo[0] - x, x - hi[0], lo[1] - y, y - hi[1], lo[2] - z, z - hi[2]); };
  const sdf = D.extra ? (x, y, z) => D.extra(base(x, y, z), x + off[0], y + off[1], z + off[2], S) : base;
  const part = (x, y, z) => { let b = 0, bd = 1e9; parts.forEach((f, i) => { const d = f(x, y, z); if (d < bd) { bd = d; b = i; } }); return b; };
  return (fields[type] = { sdf, part, off, S });
}

// 표면 그물: 격자 칸마다 꼭짓점 하나, 부호가 바뀌는 격자 변마다 사각형 하나. 꼭짓점은 거리장 기울기로 표면에 붙인다.
const meshes = {};
export function shapeMesh(type, h = 0.0042) {
  if (meshes[type]) return meshes[type];
  const { sdf } = fieldOf(type), dims = TYPES[type].dims, pad = 0.012 + 2 * h;
  const lo = dims.map((v) => -v - pad), n = dims.map((v) => Math.ceil((2 * v + 2 * pad) / h) + 1);
  const [nx, ny, nz] = n, F = new Float32Array(nx * ny * nz);
  // 거친 격자(3칸마다)를 먼저 재고, 표면에서 먼 곳은 거친 값을 그대로 쓴다(부호만 맞으면 된다)
  const c = 3, cx = Math.ceil(nx / c) + 1, cy = Math.ceil(ny / c) + 1, cz = Math.ceil(nz / c) + 1, Cg = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) Cg[i + cx * (j + cy * k)] = sdf(lo[0] + i * c * h, lo[1] + j * c * h, lo[2] + k * c * h);
  const far = c * h * 1.8;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v = Cg[Math.round(i / c) + cx * (Math.round(j / c) + cy * Math.round(k / c))];
    F[i + nx * (j + ny * k)] = abs(v) > far ? v : sdf(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h);
  }
  const cid = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const vid = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1), P = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let m = 0;
    for (let c = 0; c < 8; c++) { const v = F[(i + (c & 1)) + nx * ((j + ((c >> 1) & 1)) + ny * (k + (c >> 2)))]; cv[c] = v; if (v < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of E) {
      if ((cv[a] < 0) === (cv[b] < 0)) continue;
      const t = cv[a] / (cv[a] - cv[b]);
      sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t; sz += (a >> 2) + ((b >> 2) - (a >> 2)) * t; cnt++;
    }
    vid[cid(i, j, k)] = P.length / 3;
    P.push(lo[0] + (i + sx / cnt) * h, lo[1] + (j + sy / cnt) * h, lo[2] + (k + sz / cnt) * h);
  }
  // 표면에 붙이고 법선 구하기
  const e = h * 0.35, N = new Float32Array(P.length);
  const grad = (x, y, z) => [sdf(x + e, y, z) - sdf(x - e, y, z), sdf(x, y + e, z) - sdf(x, y - e, z), sdf(x, y, z + e) - sdf(x, y, z - e)];
  for (let v = 0; v < P.length; v += 3) {
    const d = sdf(P[v], P[v + 1], P[v + 2]), g = grad(P[v], P[v + 1], P[v + 2]), l = hypot(...g) || 1;
    const s = clamp((d * 2 * e) / l, -h * 0.5, h * 0.5) / l; P[v] -= g[0] * s; P[v + 1] -= g[1] * s; P[v + 2] -= g[2] * s;
    N[v] = g[0] / l; N[v + 1] = g[1] / l; N[v + 2] = g[2] / l;
  }
  // 면
  const I = [];
  const quad = (a, b, c, d, ax, out) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    // 방향: 칸 순서 (-,-)(+,-)(+,+)(-,+)는 x·z축 변에서 +축, y축 변에서 -축을 본다. 바깥(out)과 다르면 뒤집는다
    const p = (q) => [P[q * 3], P[q * 3 + 1], P[q * 3 + 2]], A = p(a), C = p(c);
    if ((ax === 1 ? -1 : 1) * out < 0) [b, d] = [d, b];
    const D = p(d), Bq = p(b), dac = hypot(A[0] - C[0], A[1] - C[1], A[2] - C[2]), dbd = hypot(Bq[0] - D[0], Bq[1] - D[1], Bq[2] - D[2]);
    if (dac <= dbd) I.push(a, b, c, a, c, d); else I.push(a, b, d, b, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = F[i + nx * (j + ny * k)], b = F[i + 1 + nx * (j + ny * k)]; if ((a < 0) === (b < 0)) continue;
    quad(vid[cid(i, j - 1, k - 1)], vid[cid(i, j, k - 1)], vid[cid(i, j, k)], vid[cid(i, j - 1, k)], 0, a < 0 ? 1 : -1);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = F[i + nx * (j + ny * k)], b = F[i + nx * (j + 1 + ny * k)]; if ((a < 0) === (b < 0)) continue;
    quad(vid[cid(i - 1, j, k - 1)], vid[cid(i, j, k - 1)], vid[cid(i, j, k)], vid[cid(i - 1, j, k)], 1, a < 0 ? 1 : -1);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = F[i + nx * (j + ny * k)], b = F[i + nx * (j + ny * (k + 1))]; if ((a < 0) === (b < 0)) continue;
    quad(vid[cid(i - 1, j - 1, k)], vid[cid(i, j - 1, k)], vid[cid(i, j, k)], vid[cid(i - 1, j, k)], 2, a < 0 ? 1 : -1);
  }
  const pos = new Float32Array(P);
  return (meshes[type] = { pos, nrm: N, idx: P.length / 3 > 65535 ? new Uint32Array(I) : new Uint16Array(I) });
}

// 위에서 내려다본 겉면 높이(무게중심 좌표). 눈·입 같은 붙임 그림을 놓을 때 쓴다.
export function surfY(type, x, z, fromTop = true) {
  const { sdf } = fieldOf(type); let y = fromTop ? 0.3 : -0.3; const s = fromTop ? -1 : 1;
  for (let i = 0; i < 200; i++) { const d = sdf(x, y, z); if (d < 1e-5) break; y += s * max(d, 2e-4); if (abs(y) > 0.4) return null; }
  return y;
}
// 수평 단면 윤곽(틀 이음선). 가장 넓게 잘리는 높이를 골라 그 높이의 닫힌 선들을 돌려준다.
export function seamLoops(type) {
  const { sdf } = fieldOf(type), dims = TYPES[type].dims, h = 0.004;
  const nx = Math.ceil((2 * dims[0] + 0.04) / h), nz = Math.ceil((2 * dims[2] + 0.04) / h), x0 = -dims[0] - 0.02, z0 = -dims[2] - 0.02;
  let best = 0, by = 0;
  for (let t = -0.9; t <= 0.9001; t += 0.05) {
    const y = t * dims[1]; let a = 0;
    for (let i = 0; i < nx; i += 2) for (let k = 0; k < nz; k += 2) if (sdf(x0 + i * h, y, z0 + k * h) < 0) a++;
    if (a > best * 1.02 || (a >= best * 0.98 && abs(y) < abs(by))) { if (a > best) best = a; by = y; }
  }
  const G = new Float32Array(nx * nz); for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) G[i + nx * k] = sdf(x0 + i * h, by, z0 + k * h);
  // 사각 행진: 변 위의 교차점을 잇는 선분들
  const key = (i, k, s) => `${i},${k},${s}`, pt = {}, adj = {};
  const cross = (i, k, s) => { const kk = key(i, k, s); if (!pt[kk]) { const a = G[i + nx * k], b = s ? G[i + nx * (k + 1)] : G[i + 1 + nx * k], t = a / (a - b); pt[kk] = s ? [x0 + i * h, z0 + (k + t) * h] : [x0 + (i + t) * h, z0 + k * h]; } return kk; };
  const link = (a, b) => { (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); };
  for (let k = 0; k < nz - 1; k++) for (let i = 0; i < nx - 1; i++) {
    const c = [G[i + nx * k] < 0, G[i + 1 + nx * k] < 0, G[i + 1 + nx * (k + 1)] < 0, G[i + nx * (k + 1)] < 0];
    const ed = [];
    if (c[0] !== c[1]) ed.push(cross(i, k, 0)); if (c[1] !== c[2]) ed.push(cross(i + 1, k, 1)); if (c[3] !== c[2]) ed.push(cross(i, k + 1, 0)); if (c[0] !== c[3]) ed.push(cross(i, k, 1));
    if (ed.length === 2) link(ed[0], ed[1]); else if (ed.length === 4) { link(ed[0], ed[1]); link(ed[2], ed[3]); }
  }
  const seen = new Set(), loops = [];
  for (const s of Object.keys(adj)) {
    if (seen.has(s)) continue;
    const loop = []; let cur = s, prev = null;
    while (cur && !seen.has(cur)) { seen.add(cur); loop.push(pt[cur]); const nb = adj[cur].find((q) => q !== prev && !seen.has(q)); prev = cur; cur = nb; }
    if (loop.length > 12) loops.push(loop.map(([x, z]) => [x, by, z]));
  }
  return loops;
}
