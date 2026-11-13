// 지우개 겉모습. 그리는 모양은 충돌 모양과 따로 만들고, 충돌 모양의 바깥 치수와 무게중심에 맞춘다.
//  - 직육면체 지우개: Poly Haven의 CC0 지우개 모델(assets/models, CREDITS.md)을 모서리 폭을 지킨 채 늘려 쓰고,
//    그 모델의 노멀맵(고무 표면의 패임)을 입힌다. 색·때·연필 자국은 모델의 UV 위에 직접 구워 그린다.
//  - 모양 지우개: 충돌 조각을 둥글린 거리장으로 이어 만든 곡면(lookgeo.js)에 색을 칠하고 틀 이음선·눈·입을 붙인다.
import * as THREE from 'three';
import { TYPES, TYPE_KEYS, GEOM, shapeOf } from './config.js';
import { shapeMesh, fieldOf, surfY, seamLoops, fbm, vnoise, sstep, clamp, segDist, ell, DESIGN } from './lookgeo.js';
import EM from '../assets/models/eraser_mesh.json';
import NRM_URL from '../assets/models/eraser_normal.jpg';

const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
const HAND = '"Gaegu",' + FONT;
const { abs, min, max, hypot, floor, cos, sin, PI } = Math;

// ---- 텍스처 준비
// 외부 노멀맵은 data URL이라 금방 풀리지만 비동기다. 풀리기 전에 만든 재질은 풀린 뒤에 붙여 준다.
const extNormal = new THREE.Texture(); extNormal.flipY = false; extNormal.wrapS = extNormal.wrapT = THREE.ClampToEdgeWrapping;
let extReady = false; const waiting = [];
if (typeof Image !== 'undefined') {
  const img = new Image();
  img.onload = () => { extNormal.image = img; extNormal.needsUpdate = true; extReady = true; for (const m of waiting.splice(0)) { m.normalMap = extNormal; m.needsUpdate = true; } };
  img.src = NRM_URL;
}
const useExtNormal = (m) => { if (extReady) m.normalMap = extNormal; else waiting.push(m); m.normalScale = new THREE.Vector2(1.1, 1.1); return m; };

// 고무 표면의 잔 패임(이어 붙여도 이음매가 없는 잡음으로 만든 노멀맵)
let micro = null;
function microNormal() {
  if (micro) return micro;
  const S = 256, P = 16, hgt = new Float32Array(S * S);
  const hp = (x, y, p) => { x = ((x % p) + p) % p; y = ((y % p) + p) % p; let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const vn = (x, y, p) => { const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return (hp(xi, yi, p) * (1 - u) + hp(xi + 1, yi, p) * u) * (1 - v) + (hp(xi, yi + 1, p) * (1 - u) + hp(xi + 1, yi + 1, p) * u) * v; };
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    let a = 0, s = 1, f = P / S, p = P;
    for (let o = 0; o < 4; o++) { a += s * vn(i * f, j * f, p); s *= 0.5; f *= 2; p *= 2; }
    hgt[i + S * j] = a;
  }
  // 작은 곰보 자국
  let sd = 3; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 260; n++) { const cx = r() * S, cy = r() * S, rad = 1.5 + r() * 3.5; for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) { const d = hypot(x, y) / rad; if (d < 1) { const ii = ((floor(cx + x) % S) + S) % S, jj = ((floor(cy + y) % S) + S) % S; hgt[ii + S * jj] -= 0.35 * (1 - d * d); } } }
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), im = g.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = hgt[((i + 1) % S) + S * j] - hgt[((i + S - 1) % S) + S * j], dy = hgt[i + S * ((j + 1) % S)] - hgt[i + S * ((j + S - 1) % S)];
    const k = 1.6, nx = -dx * k, ny = -dy * k, l = hypot(nx, ny, 1), o = 4 * (i + S * j);
    im.data[o] = (nx / l * 0.5 + 0.5) * 255; im.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; im.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[o + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  micro = new THREE.CanvasTexture(c); micro.wrapS = micro.wrapT = THREE.RepeatWrapping; micro.colorSpace = THREE.NoColorSpace;
  return micro;
}

// ---- 색
const C = (h) => new THREE.Color(h);
function palette(pl, tone = 0) {
  const main = new THREE.Color(pl.color).lerp(C(0xffffff), 0.16), hsl = {}; main.getHSL(hsl);
  main.setHSL((hsl.h + tone * 0.035 + 1) % 1, hsl.s, clamp(hsl.l + tone * 0.16, 0.32, 0.78));
  const w = C(0xffffff);
  return {
    main, light: main.clone().lerp(w, 0.5), pale: main.clone().lerp(C(0xfff8ee), 0.8), dark: main.clone().multiplyScalar(0.62), deep: main.clone().multiplyScalar(0.36),
    ink: C(0x2a2229), pink: C(0xff8fa3).lerp(main, 0.18), accent: C(0xffcf3f).lerp(main, 0.1), white: C(0xfbf7ef), graphite: C(0x4c4e56),
  };
}
let seedN = 1; const rng = (s) => { seedN = s; return () => (seedN = (seedN * 16807) % 2147483647) / 2147483647; };
const typeSeed = (type) => [...type].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 99991 + 11;
// 종류별 닳은 정도(그림만): 새것은 깨끗하고 닳은 것은 많이 더럽다
const WEAR = { sharp: 0.05, normal: 0.5, worn: 1.0, half: 0.7, flat: 0.45, square: 0.4, long: 0.5, art: 0.35, mini: 0.6, jumbo: 0.4, bouncy: 0.45 };

// ================= 직육면체 지우개(외부 모델) =================
const EXT = [0, 1, 2].map((a) => EM.pos.reduce((m, v, i) => (i % 3 === a ? max(m, abs(v)) : m), 0));
const BEV = [0.0232, 0.0126, 0.0125];                 // 원본 모델의 모서리 폭(게임 단위)
const plainGeos = {};
function plainGeo(type) {
  if (plainGeos[type]) return plainGeos[type];
  const T = TYPES[type], dims = T.dims, wear = WEAR[type] ?? 0.5;
  const b = clamp((T.round ?? GEOM.round) / GEOM.round, 0.35, 2.4);
  const n = EM.pos.length, pos = new Float32Array(n);
  for (let i = 0; i < n; i += 3) {
    const xr = EM.pos[i] / EXT[0];
    for (let a = 0; a < 3; a++) {
      const c = EM.pos[i + a], H = dims[a], a0 = EXT[a] - BEV[a];
      // 모서리 폭은 원본 비율을 지키고, 종이 띠 밖으로 나온 끝(+x)은 쓰면서 닳아 더 둥글다
      let bw = BEV[a] * b * (a === 0 ? (c > 0 ? 1 + wear * 1.2 : 1) : 1 + wear * 1.3 * sstep(0.35, 1, xr));
      bw = min(bw, H * 0.7);
      const ac = abs(c);
      pos[i + a] = ac <= a0 ? (c / a0) * (H - bw) : Math.sign(c) * (H - bw + ((ac - a0) / BEV[a]) * bw);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(EM.nrm), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(EM.uv), 2));
  g.setIndex(EM.idx);
  return (plainGeos[type] = { g, b, wear });
}
// 모델 UV 위에 색을 굽는다: 삼각형마다 화소의 3D 위치를 되짚어 때·연필 자국·닳은 끝을 칠한다.
// 얼룩 양(mask)은 종류마다 한 번만 구하고, 플레이어 색은 그 위에 입힌다.
const masks = {};
function plainMask(type, geo, W, H) {
  const key = type + W; if (masks[key]) return masks[key];
  const T = TYPES[type], [hx, , hz] = T.dims, wear = geo.wear, r = rng(typeSeed(type));
  // 노출된 끝 쪽 윗면의 연필 자국(지우다 묻은 흑연 줄)
  const lines = [];
  for (let i = 0; i < 3 + floor(wear * 5); i++) { const x = hx * (0.5 + r() * 0.45), z = hz * (r() * 1.6 - 0.8), a = r() * PI, L = 0.02 + r() * 0.05; lines.push([x, z, x + cos(a) * L, z + sin(a) * L * 0.6, 0.0016 + r() * 0.0016]); }
  const P = geo.g.attributes.position.array, N = geo.g.attributes.normal.array, UV = EM.uv, I = EM.idx;
  const shadeA = new Float32Array(W * H).fill(1), tA = new Float32Array(W * H);
  const col = (o, x, y, z, nx, ny, nz) => {
    const ex = sstep(0.4 * hx, hx, x), streak = fbm(x * 30, y * 230, z * 230, 3);
    let t = wear * ex * (0.18 + 0.55 * max(0, nx)) * (0.45 + streak) + wear * 0.28 * max(0, -ny) * ex;
    t += wear * 0.22 * sstep(0.55, 0.8, fbm(x * 22 + 3, y * 22, z * 22, 3));
    t += wear * (1 - max(abs(nx), abs(ny), abs(nz))) * 1.1 * (0.25 + ex);
    if (ny > 0.6) for (const [ax, az, bx, bz, w] of lines) { const d = segDist(x, z, ax, az, bx, bz); if (d < w) t += 0.55 * (1 - d / w) * (0.4 + vnoise(x * 400, 0, z * 400)); }
    if (vnoise(x * 700, y * 700, z * 700) > 0.9) t += 0.12 * wear;                // 작은 티끌
    shadeA[o] = 1 + (fbm(x * 90, y * 90, z * 90, 3) - 0.5) * 0.07; tA[o] = clamp(t, 0, 0.8);
  };
  for (let f = 0; f < I.length; f += 3) {
    const v = [I[f], I[f + 1], I[f + 2]], u = v.map((k) => [UV[k * 2] * W, UV[k * 2 + 1] * H]);
    const area = (u[1][0] - u[0][0]) * (u[2][1] - u[0][1]) - (u[2][0] - u[0][0]) * (u[1][1] - u[0][1]); if (abs(area) < 1e-6) continue;
    const x0 = max(0, floor(min(u[0][0], u[1][0], u[2][0]) - 2)), x1 = min(W - 1, Math.ceil(max(u[0][0], u[1][0], u[2][0]) + 2));
    const y0 = max(0, floor(min(u[0][1], u[1][1], u[2][1]) - 2)), y1 = min(H - 1, Math.ceil(max(u[0][1], u[1][1], u[2][1]) + 2));
    const len = [0, 1, 2].map((e) => hypot(u[(e + 2) % 3][0] - u[(e + 1) % 3][0], u[(e + 2) % 3][1] - u[(e + 1) % 3][1]));
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const qx = px + 0.5, qy = py + 0.5;
      const w = [0, 1, 2].map((e) => { const A = u[(e + 1) % 3], B = u[(e + 2) % 3]; return ((B[0] - A[0]) * (qy - A[1]) - (B[1] - A[1]) * (qx - A[0])) / area; });
      if (w.some((wi, e) => (wi * abs(area)) / (len[e] || 1) < -1.5)) continue;         // 가장자리 바깥 1.5화소까지 번지게 칠한다
      const wc = w.map((wi) => max(0, wi)), s = wc[0] + wc[1] + wc[2] || 1;
      const at = (arr, k) => (arr[v[0] * 3 + k] * wc[0] + arr[v[1] * 3 + k] * wc[1] + arr[v[2] * 3 + k] * wc[2]) / s;
      col(px + W * py, at(P, 0), at(P, 1), at(P, 2), at(N, 0), at(N, 1), at(N, 2));
    }
  }
  return (masks[key] = { shadeA, tA });
}
function bakePlain(type, pl, geo, small) {
  const W = small ? 112 : 224, H = small ? 240 : 480, { shadeA, tA } = plainMask(type, geo, W, H);
  const base = new THREE.Color(pl.rubber).convertLinearToSRGB(), gr = C(0x4a4c55).convertLinearToSRGB();
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g2 = c.getContext('2d'), im = g2.createImageData(W, H), D = im.data;
  for (let i = 0; i < W * H; i++) {
    const sh = shadeA[i], t = tA[i], o = i * 4;
    D[o] = (base.r * sh * (1 - t) + gr.r * t) * 255; D[o + 1] = (base.g * sh * (1 - t) + gr.g * t) * 255; D[o + 2] = (base.b * sh * (1 - t) + gr.b * t) * 255; D[o + 3] = 255;
  }
  g2.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = small ? 1 : 4;
  return t;
}
// 종이 띠: 고무 단면(둥근 직사각형)을 감싸는 관. u는 길이 방향, v는 둘레(바닥 가운데에서 +z 옆 → 위 → -z 옆 → 바닥).
function sleeveGeo(A, B, r, xa, xb) {
  // (y, z, 법선y, 법선z). 각 φ는 (cos φ, sin φ) = (y, z) 방향: 바닥(π) → +z(π/2) → 위(0) → -z(-π/2) → 바닥(-π)
  const ring = [], arc = (cy, cz, a0) => { for (let i = 0; i <= 6; i++) { const a = a0 - (i / 6) * (PI / 2); ring.push([cy + r * cos(a), cz + r * sin(a), cos(a), sin(a)]); } };
  ring.push([-A, 0, -1, 0]);
  arc(-A + r, B - r, PI); arc(A - r, B - r, PI / 2); arc(A - r, -(B - r), 0); arc(-A + r, -(B - r), -PI / 2);
  ring.push([-A, 0, -1, 0]);
  const pts = []; for (const p of ring) if (!pts.length || hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 1e-6) pts.push(p);
  const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = s[s.length - 1], rows = 5, pos = [], nrm = [], uv = [], idx = [];
  for (let k = 0; k < rows; k++) { const x = xa + ((xb - xa) * k) / (rows - 1); pts.forEach((p, i) => { pos.push(x, p[0], p[1]); nrm.push(0, p[2], p[3]); uv.push(k / (rows - 1), s[i] / L); }); }
  const m = pts.length;
  for (let k = 0; k < rows - 1; k++) for (let i = 0; i < m - 1; i++) { const a = k * m + i, b = a + 1, c = a + m, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  // 둘레 위치 → 면 구간(텍스처를 그릴 때 쓴다)
  const seg = (a, b) => [s[a] / L, s[b] / L];
  const span = (f) => { const ids = pts.map((p, i) => (f(p) ? i : -1)).filter((i) => i >= 0); return seg(ids[0], ids[ids.length - 1]); };
  return { g, top: span((p) => p[2] > 0.999), sideP: span((p) => p[3] > 0.999), sideN: span((p) => p[3] < -0.999), L };
}
function sleeveTexture(pl, type, sl, wear, small) {
  const T = TYPES[type], W = 512, H = 1024, k = small ? 0.375 : 0.75;      // 512×1024 기준으로 그리고 줄여 담는다
  const c = document.createElement('canvas'); c.width = W * k; c.height = H * k; const g = c.getContext('2d'); g.scale(k, k);
  const row = (v) => (1 - v) * H;                       // flipY: 둘레 v=1이 그림 맨 위
  const band = (sg) => { const a = row(sg[1]), b = row(sg[0]); return [a, b, (a + b) / 2, b - a]; };
  const [t0, t1, tc, th] = band(sl.top), [p0, p1, pc, ph] = band(sl.sideP), [n0, n1, nc, nh] = band(sl.sideN);
  const r = rng(typeSeed(type) + (pl.name === '1P' ? 0 : 5));
  const dark = '#' + new THREE.Color(pl.color).multiplyScalar(0.55).getHexString();
  // 바탕: 플레이어 색 종이, 엷은 빗금과 종이 결
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, pl.css); gr.addColorStop(0.5, pl.css); gr.addColorStop(1, dark);
  g.fillStyle = pl.css; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = 0.09; g.strokeStyle = '#fff'; g.lineWidth = 9; for (let i = -H; i < W + H; i += 30) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H * 0.6, H); g.stroke(); } g.restore();
  for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1); }
  // 띠 양 끝을 도는 흰 두 줄
  g.fillStyle = 'rgba(255,255,255,0.95)'; for (const x of [10, W - 22]) { g.fillRect(x, 0, 12, H); }
  g.fillStyle = dark; for (const x of [26, W - 32]) g.fillRect(x, 0, 5, H);
  // 윗면: 이름표
  g.save(); g.beginPath(); g.rect(36, t0, W - 72, th); g.clip();
  const tg = g.createLinearGradient(0, t0, 0, t1); tg.addColorStop(0, 'rgba(255,255,255,0.10)'); tg.addColorStop(1, 'rgba(0,0,0,0.08)'); g.fillStyle = tg; g.fillRect(0, t0, W, th);
  const bx = 98, br = th * 0.3;
  g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, tc, br, 0, 7); g.fill();
  g.strokeStyle = dark; g.lineWidth = 4; g.beginPath(); g.arc(bx, tc, br - 7, 0, 7); g.stroke();
  g.fillStyle = pl.css; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${br * 0.9}px ${FONT}`; g.fillText(pl.name, bx, tc + 2);
  const nx = (bx + br + W - 40) / 2;
  g.font = `900 ${th * 0.42}px ${FONT}`; g.lineJoin = 'round'; g.lineWidth = 10; g.strokeStyle = dark; g.strokeText(T.name, nx, tc + th * 0.04); g.fillStyle = '#fff'; g.fillText(T.name, nx, tc + th * 0.04);
  g.font = `700 ${th * 0.11}px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.88)'; g.fillText('말 랑 지 우 개', nx, t0 + th * 0.16);
  g.font = `700 ${th * 0.1}px ${FONT}`; g.fillText('★ ★ ★', nx, t1 - th * 0.15);
  g.restore();
  // +z 옆면: 흰 띠에 한 줄 설명
  const side = (y0, h, flip, text) => {
    g.save(); g.translate(W / 2, y0 + h / 2); if (flip) g.rotate(PI); g.translate(-W / 2, -h / 2);
    g.fillStyle = 'rgba(255,255,255,0.93)'; g.fillRect(36, h * 0.18, W - 72, h * 0.64);
    g.fillStyle = dark; g.font = `700 ${h * 0.36}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.beginPath(); g.arc(58, h / 2, h * 0.12, 0, 7); g.fill();
    g.fillText(text, 78, h / 2 + 1, W - 130); g.restore();
  };
  side(p0, ph, false, T.desc);
  side(n0, nh, true, '부드럽게 잘 지워져요 · 교실용');
  // 바닥: 가짜 바코드와 번호
  const bt = row(0.04), bb = row(0);
  g.fillStyle = '#fff'; g.fillRect(W * 0.3, bt - 4, W * 0.4, bb - bt + 4);
  g.fillStyle = '#222'; for (let x = W * 0.32; x < W * 0.68; x += 3 + floor(r() * 4)) g.fillRect(x, bt, 1 + floor(r() * 3), (bb - bt) * 0.7);
  // 닳음: 모서리에 쓸린 흰 자국, 끝의 해진 가장자리, 접힌 금, 연필 낙서
  const scuff = (y, n) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(255,255,255,${0.12 + r() * 0.3 * wear})`; g.fillRect(40 + r() * (W - 80), y + (r() - 0.5) * 10, 8 + r() * 60, 1 + r() * 2); } };
  for (const y of [t0, t1, p0, p1, n0, n1]) scuff(y, floor(10 + 40 * wear));
  for (const x of [0, W - 8]) for (let y = 0; y < H; y += 5) { if (r() < 0.25 + wear * 0.4) { g.fillStyle = `rgba(255,250,235,${0.3 + r() * 0.5})`; g.fillRect(x + r() * 4, y, 2 + r() * 6, 2 + r() * 4); } }
  if (wear > 0.2) { g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(W * 0.62, t0); g.lineTo(W * 0.7, t1); g.stroke(); g.strokeStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.moveTo(W * 0.62 + 3, t0); g.lineTo(W * 0.7 + 3, t1); g.stroke(); }
  if (wear > 0.4) {
    g.save(); g.strokeStyle = 'rgba(40,40,48,0.55)'; g.lineWidth = 3; g.lineCap = 'round';
    const sx = W - 70, sy = t0 + th * 0.28, R = th * 0.1;                 // 연필로 그린 작은 별
    g.beginPath(); for (let i = 0; i <= 5; i++) { const a = -PI / 2 + i * (4 * PI / 5); g.lineTo(sx + cos(a) * R, sy + sin(a) * R); } g.stroke(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = small ? 1 : 8;
  return t;
}
function plainEraser(pl, type, small) {
  const T = TYPES[type], [hx, hy, hz] = T.dims, geo = plainGeo(type);
  const rubber = new THREE.Mesh(geo.g, useExtNormal(new THREE.MeshStandardMaterial({ map: bakePlain(type, pl, geo, small), roughness: 0.8 })));
  const th = 0.0022, r = min(BEV[1] * geo.b, hy * 0.7) + th;
  const sl = sleeveGeo(hy + th, hz + th, min(r, hy), -hx * 0.82, hx * 0.42);
  const sleeve = new THREE.Mesh(sl.g, new THREE.MeshStandardMaterial({ map: sleeveTexture(pl, type, sl, geo.wear, small), roughness: 0.72, side: THREE.DoubleSide }));
  rubber.castShadow = rubber.receiveShadow = sleeve.castShadow = sleeve.receiveShadow = true;
  return [rubber, sleeve];
}

// ================= 모양 지우개(곡면) =================
const shapeGeos = {};
function shapeBase(type) {
  if (shapeGeos[type]) return shapeGeos[type];
  const m = shapeMesh(type), n = m.pos.length / 3, uv = new Float32Array(n * 2), S = 14;
  for (let i = 0; i < n; i++) {                        // 상자 투영 UV(잔 패임 노멀맵용)
    const [x, y, z] = [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]], [a, b, c] = [abs(m.nrm[i * 3]), abs(m.nrm[i * 3 + 1]), abs(m.nrm[i * 3 + 2])];
    const [u, v] = b >= a && b >= c ? [x, z] : a >= c ? [z, y] : [x, y]; uv[i * 2] = u * S; uv[i * 2 + 1] = v * S;
  }
  return (shapeGeos[type] = { pos: new THREE.BufferAttribute(m.pos, 3), nrm: new THREE.BufferAttribute(m.nrm, 3), uv: new THREE.BufferAttribute(uv, 2), idx: new THREE.BufferAttribute(m.idx, 1), m });
}
// 종류별 색칠. x,y,z는 config.js 원래 좌표, pi는 가장 가까운 조각, up은 윗면 쪽인지(0~1).
// fill(c, 색, 부호 거리): 거리 < 0 인 안쪽을 칠하되 경계는 0.5mm에 걸쳐 부드럽게 섞는다(꼭짓점 색의 계단 무늬를 없앤다)
const fill = (c, col, sd, w = 0.005, a = 1) => { const t = clamp(0.5 - sd / w, 0, 1) * a; if (t > 0) c.lerp(col, t); };
const PAINT = {
  bear(c, P, x, y, z, pi, up) {
    if (up < 0.05) return;
    fill(c, P.light, ell(x + 0.1, 0, z, 0.075, 1, 0.08), 0.005, up);
    fill(c, P.pale, ell(x - 0.105, 0, z, 0.052, 1, 0.062), 0.005, up);
    for (const s of [-1, 1]) {
      fill(c, P.pink, hypot(x - 0.243, z - s * 0.1) - 0.024, 0.005, up);
      const ck = hypot(x - 0.15, z - s * 0.082); fill(c, P.pink, ck - 0.012, 0.024, up * 0.7);
      fill(c, P.pink, hypot(x + 0.222, z - s * 0.088) - 0.016, 0.004, up);
      for (const t of [-1, 0, 1]) fill(c, P.pink, hypot(x + 0.191, z - s * 0.088 - t * 0.016) - 0.0062, 0.003, up);
    }
  },
  rabbit(c, P, x, y, z, pi, up) {
    if (up < 0.05) return;
    fill(c, P.pale, ell(x + 0.125, 0, z, 0.07, 1, 0.075), 0.005, up);
    for (const s of [-1, 1]) {
      const cs = cos(0.12), sn = sin(0.12) * -s, lx = (x - 0.27) * cs - (z - s * 0.05) * sn, lz = (x - 0.27) * sn + (z - s * 0.05) * cs;
      fill(c, P.pink, ell(lx, 0, lz, 0.08, 1, 0.017), 0.004, up);
      fill(c, P.white, hypot(x - 0.035, z - s * 0.017) - 0.021, 0.004, up);
      fill(c, P.pink, hypot(x - 0.07, z - s * 0.068) - 0.01, 0.02, up * 0.8);
      fill(c, P.pale, ell(x + 0.215, 0, z - s * 0.072, 0.035, 1, 0.026), 0.004, up);
    }
    fill(c, P.white, hypot(x + 0.215, z) - 0.029, 0.005, up);
  },
  turtle(c, P, x, y, z, pi, up) {
    const r = hypot(x, z);
    if (pi === 0) {
      c.copy(P.dark);
      if (y > 0.02) {
        const a = Math.atan2(z, x), sec = floor(a / (PI / 3) + 6) % 6, ca = (sec + 0.5) * (PI / 3);
        const d = r < 0.062 ? r / 0.062 : hypot(x - cos(ca) * 0.108, z - sin(ca) * 0.108) / 0.06;
        c.lerp(P.main, clamp(1 - d, 0, 1) * 0.85);
        fill(c, P.light, 0.15 - r, 0.006, up);
      }
    } else {
      c.copy(P.light).lerp(P.main, 0.45);
      fill(c, P.main, 0.7 - vnoise(x * 70, y * 70, z * 70), 0.12, 0.3);
    }
  },
  wrest1(c, P, x, y, z, pi, up, F) {
    if (pi === 1) {                                    // 머리: 복면
      c.copy(P.white);
      fill(c, P.main, abs(z) - 0.011, 0.004, up);
      for (const s of [-1, 1]) { const e = ell(x - 0.168, 0, z - s * 0.023, 0.017, 1, 0.013); fill(c, P.main, abs(e + 0.002) - 0.0035, 0.003); fill(c, P.pale, e, 0.003); }
      fill(c, P.ink, ell(x - 0.118, 0, z, 0.011, 1, 0.02), 0.004, up);
    } else if (pi === 0) {
      fill(c, P.deep, x + 0.03, 0.005);
      fill(c, P.accent, abs(x + 0.039) - 0.0085, 0.004);
    } else if (pi >= 4) {                              // 다리: 장화와 끈
      const lp = F.local(pi, x, y, z); fill(c, P.deep, lp[0] + 0.03, 0.005);
      fill(c, P.white, min(abs(lp[0] + 0.065), abs(lp[0] + 0.047)) - 0.0028, 0.003);
    } else {                                           // 팔: 손목 띠
      const lp = F.local(pi, x, y, z), t = lp[2] * (pi === 2 ? 1 : -1); fill(c, P.accent, abs(t - 0.021) - 0.009, 0.004);
    }
  },
  wrest2(c, P, x, y, z, pi, up) {
    if (pi === 1) { c.copy(P.light); fill(c, P.deep, max(abs(z) - 0.013, x - 0.18), 0.004, up); }
    else if (pi === 0) {
      fill(c, P.deep, x + 0.07, 0.005);
      fill(c, P.accent, abs(x + 0.0575) - 0.0175, 0.004);
      fill(c, P.white.clone().lerp(P.accent, 0.35), ell(x + 0.0575, 0, z, 0.026, 1, 0.034), 0.004, up);
      fill(c, P.accent, abs(ell(x + 0.0575, 0, z, 0.026, 1, 0.034) + 0.006) - 0.002, 0.003, up);
    } else if (pi >= 4) c.copy(P.deep);
  },
  roll(c, P, x, y, z, pi, up, F, nx, ny, nz) {
    if (abs(nx) > 0.6) { c.copy(P.dark); return; }
    const a = Math.atan2(nz, ny), k = Math.round((a - PI / 6) / (PI / 3));
    c.multiplyScalar((k & 1) ? 0.88 : 1);
    fill(c, P.pale, abs(x) - 0.075, 0.004);
    fill(c, P.deep, abs(abs(x) - 0.07) - 0.004, 0.003);
    const dots = hypot(((x + 1) * 40) % 1 - 0.5, ((a + 7) * 3) % 1 - 0.5) / 40; fill(c, P.light, max(dots - 0.004, abs(x) - 0.055), 0.003);
    fill(c, P.accent, abs(abs(x) - 0.148) - 0.012, 0.004);
  },
  prism(c, P, x, y, z, pi, up, F, nx, ny, nz) {
    if (abs(nx) > 0.6) { c.copy(P.dark); return; }
    if (ny < -0.9) return;
    const u = ((x * 9 + abs(z) * 9 + 10) % 1); fill(c, P.light, (abs(u - 0.16) - 0.16) / 9, 0.003);
    fill(c, P.deep, 0.07 - y, 0.004);
  },
};
// 붙임 그림: 눈·코·입·눈썹(원래 좌표, 위에서 내려 붙인다)
const DECOR = {
  bear: [['eye', 0.178, 0.05, 0.0135], ['eye', 0.178, -0.05, 0.0135], ['nose', 0.13, 0, 0.017], ['line', [[0.112, 0.018], [0.102, 0.009], [0.106, 0], [0.102, -0.009], [0.112, -0.018]]], ['line', [[0.13, 0], [0.108, 0]]]],
  rabbit: [['eye', 0.1, 0.048, 0.013], ['eye', 0.1, -0.048, 0.013], ['nose', 0.056, 0, 0.011],
    ['line', [[0.03, 0.04], [0.042, 0.075]]], ['line', [[0.026, 0.035], [0.028, 0.078]]], ['line', [[0.03, -0.04], [0.042, -0.075]]], ['line', [[0.026, -0.035], [0.028, -0.078]]]],
  turtle: [['eye', 0.247, 0.032, 0.011], ['eye', 0.247, -0.032, 0.011], ['line', [[0.262, 0.016], [0.268, 0], [0.262, -0.016]]]],
  wrest1: [['eye', 0.168, 0.023, 0.0085], ['eye', 0.168, -0.023, 0.0085], ['line', [[0.188, 0.036], [0.184, 0.01]]], ['line', [[0.188, -0.036], [0.184, -0.01]]]],
  wrest2: [['eye', 0.186, 0.026, 0.0105], ['eye', 0.186, -0.026, 0.0105], ['line', [[0.198, 0.045], [0.195, 0.01]]], ['line', [[0.198, -0.045], [0.195, -0.01]]], ['line', [[0.165, 0.025], [0.17, 0], [0.165, -0.025]]]],
};
const inkMat = new THREE.MeshStandardMaterial({ color: 0x241c22, roughness: 0.28 }), shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const decoGeo = { eye: new THREE.SphereGeometry(1, 16, 10), shine: new THREE.SphereGeometry(1, 8, 6) };
function shapeEraser(pl, type) {
  const T = TYPES[type], P = palette(pl, T.tone || 0), B = shapeBase(type), F = fieldOf(type), sh = shapeOf(type), wear = 0.55;
  const off = F.off, n = B.m.pos.length / 3, col = new Float32Array(n * 3), c = new THREE.Color(), pos = B.m.pos, nr = B.m.nrm;
  const paint = PAINT[type];
  // 조각 안 좌표(원래 좌표 → 조각 기준). 레슬러의 손목·장화 위치를 칠할 때 쓴다
  const local = (pi, x, y, z) => { const pt = sh.parts[pi], q = pt.q, vx = x - off[0] - pt.p[0], vy = y - off[1] - pt.p[1], vz = z - off[2] - pt.p[2]; const qi = { x: -q.x, y: -q.y, z: -q.z, w: q.w }; const tx = 2 * (qi.y * vz - qi.z * vy), ty = 2 * (qi.z * vx - qi.x * vz), tz = 2 * (qi.x * vy - qi.y * vx); return [vx + qi.w * tx + (qi.y * tz - qi.z * ty), vy + qi.w * ty + (qi.z * tx - qi.x * tz), vz + qi.w * tz + (qi.x * ty - qi.y * tx)]; };
  const Fx = { local };
  for (let i = 0; i < n; i++) {
    const sx = pos[i * 3], sy = pos[i * 3 + 1], sz = pos[i * 3 + 2], nx = nr[i * 3], ny = nr[i * 3 + 1], nz = nr[i * 3 + 2];
    const x = sx + off[0], y = sy + off[1], z = sz + off[2], pi = F.part(sx, sy, sz);
    c.copy(P.main);
    const up = sstep(0.2, 0.7, ny);
    paint && paint(c, P, x, y, z, pi, up, Fx, nx, ny, nz);
    // 오목한 곳은 어둡게(겉면 바깥 1mm에서 거리장을 다시 재 본 값으로 구석을 찾는다)
    const ao = clamp(F.sdf(sx + nx * 0.012, sy + ny * 0.012, sz + nz * 0.012) / 0.012, 0, 1);
    c.multiplyScalar(0.62 + 0.38 * ao);
    // 얼룩덜룩한 고무 + 때 + 흑연 + 쓸려 밝아진 곳
    c.multiplyScalar(1 + (fbm(sx * 60, sy * 60, sz * 60, 3) - 0.5) * 0.08);
    const side = 1 - abs(ny), gph = wear * sstep(0.58, 0.82, fbm(sx * 16 + 5, sy * 16, sz * 16, 3)) * (0.25 + side * 0.75);
    c.lerp(P.graphite, gph * 0.45);
    c.lerp(P.graphite, wear * 0.18 * sstep(0.6, 0.85, fbm(sx * 30, sy * 30 + 9, sz * 30, 3)));
    if (ny > 0.8) c.lerp(C(0xffffff), wear * 0.16 * sstep(0.55, 0.8, fbm(sx * 25 + 2, 0, sz * 25, 3)));
    if (vnoise(sx * 600, sy * 600, sz * 600) > 0.92) c.multiplyScalar(0.85);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', B.pos); g.setAttribute('normal', B.nrm); g.setAttribute('uv', B.uv); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(B.idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), hypot(...sh.dims) + 0.02);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, normalMap: microNormal(), normalScale: new THREE.Vector2(0.32, 0.32) });
  const body = new THREE.Mesh(g, mat); body.castShadow = body.receiveShadow = true;
  const out = [body];
  // 틀 이음선: 고무를 찍어 낸 두 틀이 맞물린 자리의 가는 턱
  if (DESIGN[type].seam) {
    const seamMat = new THREE.MeshStandardMaterial({ color: P.main.clone().lerp(C(0xffffff), 0.08), roughness: 0.6 });
    for (const loop of seamLoops(type)) {
      const pts = loop.filter((_, i) => i % 2 === 0).map(([x, y, z]) => {
        const e = 0.002, gx = F.sdf(x + e, y, z) - F.sdf(x - e, y, z), gz = F.sdf(x, y, z + e) - F.sdf(x, y, z - e), l = hypot(gx, gz) || 1;
        return new THREE.Vector3(x + (gx / l) * 0.0003, y, z + (gz / l) * 0.0003);
      });
      if (pts.length < 6) continue;
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 2, 0.0012, 4, true), seamMat); m.castShadow = false; out.push(m);
    }
  }
  // 눈·코·입
  for (const d of DECOR[type] || []) {
    const put = (x, z, lift = 0) => { const sx = x - off[0], sz = z - off[2], sy = surfY(type, sx, sz); return sy === null ? null : new THREE.Vector3(sx, sy + lift, sz); };
    const normalAt = (p) => { const e = 0.002, gx = F.sdf(p.x + e, p.y, p.z) - F.sdf(p.x - e, p.y, p.z), gy = F.sdf(p.x, p.y + e, p.z) - F.sdf(p.x, p.y - e, p.z), gz = F.sdf(p.x, p.y, p.z + e) - F.sdf(p.x, p.y, p.z - e); return new THREE.Vector3(gx, gy, gz).normalize(); };
    if (d[0] === 'eye' || d[0] === 'nose') {
      const p = put(d[1], d[2]); if (!p) continue; const nv = normalAt(p), r = d[3];
      const m = new THREE.Mesh(decoGeo.eye, inkMat); m.position.copy(p); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nv);
      m.scale.set(d[0] === 'nose' ? r * 0.85 : r, r * 0.42, r * (d[0] === 'nose' ? 1.25 : 1)); out.push(m);
      if (d[0] === 'eye') { const s = new THREE.Mesh(decoGeo.shine, shineMat); s.position.copy(p).addScaledVector(nv, r * 0.38); s.position.x -= r * 0.3; s.position.z += r * 0.3; s.scale.setScalar(r * 0.3); out.push(s); }
    } else if (d[0] === 'line') {
      const pts = []; const L = d[1];
      for (let i = 0; i < L.length - 1; i++) for (let t = 0; t < 1; t += 0.2) { const p = put(L[i][0] + (L[i + 1][0] - L[i][0]) * t, L[i][1] + (L[i + 1][1] - L[i][1]) * t, 0.0004); if (p) pts.push(p); }
      const last = put(L[L.length - 1][0], L[L.length - 1][1], 0.0004); if (last) pts.push(last);
      if (pts.length < 2) continue;
      out.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, 0.0026, 5, false), inkMat));
    }
  }
  return out;
}

// 지우개 하나의 겉모습 메시들(무게중심 좌표). pl: { color, rubber, css, name }, small: 고르기 화면용 작은 텍스처
export function eraserMeshes(pl, type, small = false) {
  return shapeOf(type).plain ? plainEraser(pl, type, small) : shapeEraser(pl, type);
}
export { TYPE_KEYS };
