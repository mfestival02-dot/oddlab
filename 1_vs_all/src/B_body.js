// ───────── 시안 B (2차): 캔버스 손그림 — 대본 8줄, 150 BPM, 17초 ─────────
// 피드백 반영: 전략 그림+번뜩 표정 / 관객석 채움 / 포켓몬 대치 구도 / O·X 팻말 / 극적 뒤집기 / 왕관 졸라맨·A팀 B팀 / 인게임 컷 / 엔딩 대안(ENDV)
const PAPER = '#f4ecd6', NAVY = '#1e2a4a', INKC = '#2b2420', RED = '#d9452b', BLUE = '#2f5bd1', YEL = '#f2c230', CHALK = '#f6f1e4', GREEN = '#3a9d5d', VIOLET = '#8e44c9', BOARD = '#2f6b4f', SKYB = '#39a0e5', PINKR = '#e8452b';
const L = i => i * 2;
const ENDV = window.ENDV || 0;
const crowd = makeCrowd(11);
const boilF = t => Math.floor(t * 8);
const jit = (i, bf, amp = 2) => (hash(i, bf) - 0.5) * 2 * amp;
const grain = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const im = g.createImageData(256, 256); const r = mulberry32(3); for (let i = 0; i < im.data.length; i += 4) { const v = 200 + r() * 55; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 26; } g.putImageData(im, 0, 0); return c; })();
// 인게임 프레임 (game/*.jpg, 30fps)
const FR = { decibel: 36, math: 36, ten: 36, nim: 66 }; const IMGS = {}; const imgLoads = [];
for (const [n, c] of Object.entries(FR)) { IMGS[n] = []; for (let i = 1; i <= c; i++) { const im = new Image(); im.src = `game/${n}_${String(i).padStart(3, '0')}.jpg`; IMGS[n].push(im); imgLoads.push(new Promise(r => { im.onload = r; im.onerror = r; })); } }

function paper(ctx, color = PAPER, ink = false) {
  ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalAlpha = ink ? 0.5 : 1; ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = ink ? CHALK : INKC; ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) { const y = hash(i, 5) * H, x = hash(i, 6) * W; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 60 + hash(i, 7) * 120, y + (hash(i, 8) - .5) * 30); ctx.stroke(); } ctx.restore();
}
function ink(ctx, pts, { w = 6, color = INKC, seed = 0, bf = 0, p = 1, amp = 2, close = false } = {}) {
  if (p <= 0) return; const n = Math.min(pts.length, Math.max(2, Math.ceil(pts.length * p)));
  ctx.save(); ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.lineWidth = pass ? w * 0.4 : w; ctx.globalAlpha = pass ? 0.5 : 1; ctx.beginPath();
    for (let i = 0; i < n; i++) { const q = pts[i]; ctx[i ? 'lineTo' : 'moveTo'](q[0] + jit(seed + i * 7 + pass * 3, bf, amp), q[1] + jit(seed + i * 7 + 1 + pass * 3, bf, amp)); }
    if (close && p >= 1) ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
}
const circlePts = (cx, cy, r, n = 28, a0 = -Math.PI / 2) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(a0 + i / n * Math.PI * 2 * 1.02) * r, cy + Math.sin(a0 + i / n * Math.PI * 2 * 1.02) * r]);
function cutout(ctx, cx, cy, w, h, color, { rot = 0, seed = 1, scale = 1, alpha = 1 } = {}) {
  if (scale <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(scale, scale);
  const pts = []; const edge = (x1, y1, x2, y2, k) => { for (let i = 0; i < 8; i++) { const u = i / 8; pts.push([lerp(x1, x2, u) + (hash(seed, k, i) - .5) * 9, lerp(y1, y2, u) + (hash(seed, k + 50, i) - .5) * 9]); } };
  edge(-w / 2, -h / 2, w / 2, -h / 2, 1); edge(w / 2, -h / 2, w / 2, h / 2, 2); edge(w / 2, h / 2, -w / 2, h / 2, 3); edge(-w / 2, h / 2, -w / 2, -h / 2, 4);
  const path = () => { ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.closePath(); };
  ctx.save(); ctx.translate(5, 8); path(); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill(); ctx.restore();
  path(); ctx.fillStyle = color; ctx.fill();
  ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = ctx.createPattern(grain, 'repeat'); path(); ctx.fill(); ctx.restore();
  ctx.restore();
}
function hand(ctx, s, x, y, { size = 120, color = INKC, font = 'Ssukssuk', p = 1, bf = 0, seed = 0, align = 'center', rot = 0, alpha = 1 } = {}) {
  if (p <= 0) return; const f = `400 ${size}px ${font}`; const w = textWidth(ctx, s, f);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x + jit(seed, bf, 1.5), y + jit(seed + 1, bf, 1.5)); ctx.rotate(rot);
  const left = align === 'center' ? -w / 2 : align === 'left' ? 0 : -w;
  ctx.beginPath(); ctx.rect(left - 20, -size, w * p + 40, size * 2); ctx.clip();
  txt(ctx, s, 0, 0, { size, font, weight: 400, fill: color, stroke: color, lw: size * 0.06, align });
  ctx.restore(); return w;
}
function person(ctx, x, y, s, { color = INKC, seed = 0, bf = 0, p = 1, crown = false, rot = 0 } = {}) {
  if (p <= 0) return; ctx.save(); if (rot) { ctx.translate(x, y); ctx.rotate(rot); ctx.translate(-x, -y); }
  ink(ctx, circlePts(x, y - s * 1.1, s * 0.4, 14), { w: s * 0.12, color, seed, bf, p: Math.min(1, p * 2), amp: s * 0.035 });
  const body = [[x, y - s * 0.65], [x, y + s * 0.25]]; const arms = [[x - s * 0.5, y - s * 0.1], [x, y - s * 0.5], [x + s * 0.5, y - s * 0.1]]; const legs = [[x - s * 0.4, y + s * 0.9], [x, y + s * 0.25], [x + s * 0.4, y + s * 0.9]];
  const p2 = clamp(p * 2 - 1); ink(ctx, body, { w: s * 0.11, color, seed: seed + 3, bf, p: p2, amp: s * 0.03 }); ink(ctx, arms, { w: s * 0.1, color, seed: seed + 6, bf, p: p2, amp: s * 0.03 }); ink(ctx, legs, { w: s * 0.1, color, seed: seed + 9, bf, p: p2, amp: s * 0.03 });
  if (crown) { const cy = y - s * 1.65; cutout(ctx, x, cy, s * 0.95, s * 0.5, YEL, { seed: 77, rot: 0.05 }); ink(ctx, [[x - s * .45, cy + s * .25], [x - s * .45, cy - s * .25], [x - s * .22, cy], [x, cy - s * .3], [x + s * .22, cy], [x + s * .45, cy - s * .25], [x + s * .45, cy + s * .25]], { w: s * 0.08, seed: 80, bf, amp: s * .03, close: true }); }
  ctx.restore();
}
// 큰 낙서 얼굴: expr 'think' | 'smirk' | 'flash'(번뜩) | 'shock'
function bigFace(ctx, x, y, r, bf, { seed = 50, p = 1, color = INKC, expr = 'think' } = {}) {
  ink(ctx, circlePts(x, y, r, 36), { w: r * 0.04, color, seed, bf, p, amp: 3 });
  if (p < 0.6) return;
  if (expr === 'flash') {
    ink(ctx, circlePts(x - r * .3, y - r * .1, r * .13, 14), { w: r * .035, color, seed: seed + 1, bf }); ink(ctx, circlePts(x + r * .3, y - r * .1, r * .13, 14), { w: r * .035, color, seed: seed + 2, bf });
    ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x - r * .27, y - r * .12, r * .05, 0, 7); ctx.arc(x + r * .33, y - r * .12, r * .05, 0, 7); ctx.fill(); ctx.restore();
    ink(ctx, [[x - r * .45, y - r * .32], [x - r * .15, y - r * .38]], { w: r * .04, color, seed: seed + 4, bf }); ink(ctx, [[x + r * .15, y - r * .38], [x + r * .45, y - r * .32]], { w: r * .04, color, seed: seed + 5, bf });
    ink(ctx, [[x - r * .3, y + r * .3], [x, y + r * .42], [x + r * .35, y + r * .22]], { w: r * .04, color, seed: seed + 3, bf });
    for (let i = 0; i < 4; i++) { const a = -Math.PI * 0.75 + i * 0.28; ink(ctx, [[x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1], [x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45]], { w: r * .045, color: YEL, seed: seed + 10 + i, bf, amp: 3 }); }
  } else if (expr === 'shock') { ink(ctx, circlePts(x - r * .3, y - r * .1, r * .12, 12), { w: r * .035, color, seed: seed + 1, bf }); ink(ctx, circlePts(x + r * .3, y - r * .1, r * .12, 12), { w: r * .035, color, seed: seed + 2, bf }); ink(ctx, circlePts(x, y + r * .4, r * .14, 12), { w: r * .035, color, seed: seed + 3, bf }); }
  else { ink(ctx, [[x - r * .4, y - r * .1], [x - r * .2, y - r * .14]], { w: r * .04, color, seed: seed + 1, bf }); ink(ctx, [[x + r * .2, y - r * .14], [x + r * .4, y - r * .1]], { w: r * .04, color, seed: seed + 2, bf });
    if (expr === 'smirk') ink(ctx, [[x - r * .3, y + r * .35], [x, y + r * .42], [x + r * .35, y + r * .25]], { w: r * .04, color, seed: seed + 3, bf }); else ink(ctx, [[x - r * .25, y + r * .35], [x + r * .25, y + r * .35]], { w: r * .04, color, seed: seed + 3, bf }); }
}
// 뒤통수+어깨 실루엣 (잉크 외곽 + 단색 채움)
function silInk(ctx, x, y, s, bf, { fill = NAVY, line = INKC, seed = 0, alpha = 1, lw = 0 } = {}) {
  ctx.save(); ctx.globalAlpha *= alpha;
  const pts = []; const hn = 16; for (let i = 0; i <= hn; i++) { const a = Math.PI + i / hn * Math.PI; pts.push([x + Math.cos(a) * s * .32, y - s * .95 + Math.sin(a) * s * .32]); }
  pts.push([x + s * .3, y - s * .66], [x + s * .5, y - s * .55], [x + s * .62, y], [x - s * .62, y], [x - s * .5, y - s * .55], [x - s * .3, y - s * .66]);
  ctx.beginPath(); pts.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0] + jit(seed + i, bf, s * .02), q[1] + jit(seed + i + 50, bf, s * .02))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = lw || Math.max(2, s * .05); ctx.strokeStyle = line; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
}
// 관객석 (D의 원근 배치, B 색)
const SEATS = crowd.map(c => { const r = Math.floor(c.i / 20), k = c.i % 20; const u = (k + 0.5) / 20 - 0.5 + (c.r1 - .5) * 0.02; const spread = 0.62 + r * 0.075; return { r, x: 960 + u * W * spread + (c.r3 - .5) * 30, y: 560 + Math.pow(r / 9, 1.5) * 560 + (c.r2 - .5) * 20, s: (40 + r * 18) * (0.9 + c.r4 * 0.2), fill: c.r1 < 0.12 ? RED : c.r1 > 0.88 ? BLUE : NAVY }; });
function hall(ctx, t, bf, { rise = null, alpha = 1, yoff = 0, fillOverride = null } = {}) {
  for (let r = 0; r < 10; r++) SEATS.forEach((q, i) => { if (q.r !== r) return; let dy = 0, a = alpha; if (rise) { const p = prog(t, rise + (9 - r) * 0.11, 0.35, easeOutExpo); if (p <= 0) return; dy = (1 - p) * 140; a *= p; } silInk(ctx, q.x, q.y + dy + yoff, q.s, bf, { fill: fillOverride || q.fill, seed: i * 3, alpha: a }); });
}
// O / X 팻말 (첨부 이미지 참고: 파란 네모 O, 빨간 네모 X, 손잡이)
function paddle(ctx, x, y, kind, bf, { scale = 1, rot = 0, alpha = 1 } = {}) {
  if (scale <= 0) return; const col = kind === 'O' ? SKYB : PINKR;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale);
  ctx.save(); ctx.translate(6, 10); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.roundRect(-190, -190, 380, 380, 44); ctx.fill(); ctx.beginPath(); ctx.roundRect(-45, 170, 90, 330, 40); ctx.fill(); ctx.restore();
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-45, 170, 90, 330, 40); ctx.fill();
  ctx.beginPath(); ctx.roundRect(-190, -190, 380, 380, 44); ctx.fill();
  ctx.fillStyle = CHALK; ctx.beginPath(); ctx.roundRect(-150, -150, 300, 300, 30); ctx.fill();
  ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = 50;
  if (kind === 'O') { ctx.beginPath(); ctx.arc(0, 0, 92, 0, 7); ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(-95, -95); ctx.lineTo(95, 95); ctx.moveTo(95, -95); ctx.lineTo(-95, 95); ctx.stroke(); }
  ctx.restore();
  ink(ctx, [[-190, -190], [190, -190], [190, 190], [-190, 190]].map(([a, b]) => [x + (a * Math.cos(rot) - b * Math.sin(rot)) * scale, y + (a * Math.sin(rot) + b * Math.cos(rot)) * scale]), { w: 5, seed: kind === 'O' ? 300 : 310, bf, amp: 2.5, close: true, color: INKC });
}
function lightbulb(ctx, bx, by, bf, p) { cutout(ctx, bx, by, 150, 170, YEL, { seed: 9, scale: easeOutBack(clamp(p)) }); ink(ctx, circlePts(bx, by - 10, 60, 20), { w: 7, seed: 70, bf, p, amp: 3 }); ink(ctx, [[bx - 25, by + 55], [bx + 25, by + 55]], { w: 7, seed: 71, bf, p }); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.5; ink(ctx, [[bx + Math.cos(a) * 85, by - 10 + Math.sin(a) * 85], [bx + Math.cos(a) * 115, by - 10 + Math.sin(a) * 115]], { w: 6, color: RED, seed: 72 + i, bf, p: clamp(p * 2 - 1) }); } }
function crowdDraw(ctx, t, bf, { color = INKC, accent = BLUE, alpha = 1, split = 0, rows = [0, 10], y0 = 600, dy = 50 } = {}) {
  crowd.forEach((c, i) => { const r = Math.floor(c.i / 20); if (r < rows[0] || r >= rows[1]) return; const x = 120 + (c.i % 20) * 88 + c.r1 * 16, y = y0 + (r - rows[0]) * dy + c.r2 * 8;
    let col = i % 9 === 0 ? accent : color; let dx = 0; if (split) { const left = x < 960; col = left ? RED : BLUE; dx = (left ? -1 : 1) * 70 * split; }
    ctx.save(); ctx.globalAlpha = alpha; person(ctx, x + dx, y, 16, { seed: i * 13, bf, color: col }); ctx.restore(); });
}
function banner(ctx, s, x, y, w, h, color, textColor, { p = 1, rot = -0.03, seed = 4, bf = 0, size = 190, tseed = 90, punch = 1.3 } = {}) {
  cutout(ctx, x, y, w, h, color, { rot, seed, scale: lerp(punch, 1, easeOutBack(clamp(p))) });
  hand(ctx, s, x, y + size * 0.03, { size, color: textColor, bf, seed: tseed, rot, p: clamp(p * 1.6 - 0.2) });
}
// 인게임 사진 (종이 액자 + 프레임 시퀀스)
function photo(ctx, name, fi, x, y, w, h, bf, { rot = 0, scale = 1, seed = 1 } = {}) {
  if (scale <= 0) return; const im = IMGS[name][clamp(fi, 0, FR[name] - 1) | 0]; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale);
  cutout(ctx, 0, 0, w + 44, h + 44, CHALK, { seed }); if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -w / 2, -h / 2, w, h);
  ctx.restore();
}
const CUTS = [['decibel', 12.0, 0.45, 0], ['math', 12.45, 0.45, 0], ['ten', 12.9, 0.45, 0], ['nim', 13.35, 0.65, 11]];
const ROUNDS = [['1R', '데시벨 게임', RED], ['2R', 'NIM 게임', BLUE], ['3R', '수학문제 맞추기', VIOLET], ['4R', '10초 맞추기', GREEN]];

// ───────── 장면 ─────────
function S0(ctx, t, bf) { // 전략은 배웠다.
  paper(ctx); hand(ctx, '전략은 배웠다.', 960, 200, { size: 200, bf, seed: 10 });
  // 오른쪽: 칠판 위 OX 전략판 (3×3, 수를 두고 승리선)
  cutout(ctx, 1280, 640, 720, 460, BOARD, { rot: 0.02, seed: 21, scale: lerp(0.9, 1, prog(t, 0, 0.3, easeOutBack)) });
  const gx = 1280, gy = 640, g = 120;
  [[-1, 0], [1, 0]].forEach(([k, _], i) => { ink(ctx, [[gx + k * g / 2 * 1, gy - g * 1.5], [gx + k * g / 2, gy + g * 1.5]], { w: 7, color: CHALK, seed: 22 + i, bf, p: prog(t, 0.1 + i * 0.1, 0.25), amp: 2 }); ink(ctx, [[gx - g * 1.5, gy + k * g / 2], [gx + g * 1.5, gy + k * g / 2]], { w: 7, color: CHALK, seed: 24 + i, bf, p: prog(t, 0.3 + i * 0.1, 0.25), amp: 2 }); });
  const marks = [['O', 0, 0, 0.55], ['X', -1, -1, 0.75], ['O', -1, 1, 0.95], ['X', 1, -1, 1.15], ['O', 1, -1 + 2, 1.35]];
  marks.forEach(([m, cx, cy, st], i) => { const p = prog(t, st, 0.2); if (p <= 0) return; const x = gx + cx * g, y = gy + cy * g; if (m === 'O') ink(ctx, circlePts(x, y, 38, 16), { w: 8, color: SKYB, seed: 30 + i, bf, p }); else { ink(ctx, [[x - 34, y - 34], [x + 34, y + 34]], { w: 8, color: PINKR, seed: 30 + i, bf, p: Math.min(1, p * 2) }); ink(ctx, [[x + 34, y - 34], [x - 34, y + 34]], { w: 8, color: PINKR, seed: 40 + i, bf, p: clamp(p * 2 - 1) }); } });
  ink(ctx, [[gx - g * 1.3, gy - g * 1.3], [gx + g * 1.3, gy + g * 1.3]], { w: 12, color: YEL, seed: 45, bf, p: prog(t, 1.25, 0.3), amp: 3 }); // 승리선 (대각선)
  // 왼쪽 얼굴: 1.2초에 번뜩
  const flash = t >= 1.2; bigFace(ctx, 480, 640, 200, bf, { seed: 30, expr: flash ? 'flash' : 'think' });
  if (flash) lightbulb(ctx, 790, 400, bf, prog(t, 1.2, 0.35));
}
function S1(ctx, t, bf) { // 이제, 직접 승부할 시간!  — 관객석 채움 + 빨간 띠 유지
  paper(ctx);
  ctx.save(); ctx.globalAlpha = 0.25; const gr = ctx.createLinearGradient(0, 400, 0, 1080); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(30,42,74,0.6)'); ctx.fillStyle = gr; ctx.fillRect(0, 400, W, 680); ctx.restore();
  hall(ctx, t, bf, { rise: L(1) });
  banner(ctx, '이제, 직접 승부할 시간!', 960, 300, 1640, 280, RED, CHALK, { p: prog(t, L(1), 0.35), bf, seed: 4, size: 150 });
}
function S2(ctx, t, bf) { // 상대의 생각을 읽고! — 포켓몬 대치 구도
  paper(ctx);
  // 상대 (우상단) + 발판
  ink(ctx, circlePts(1500, 560, 260, 30).map(([x, y]) => [x, 560 + (y - 560) * 0.3]), { w: 6, seed: 60, bf, amp: 2, close: true });
  bigFace(ctx, 1500, 360, 190, bf, { seed: 41, expr: 'smirk', p: prog(t, L(2), 0.4) });
  // 나 (좌하단, 뒤통수 크게) + 발판
  ink(ctx, circlePts(460, 1000, 420, 30).map(([x, y]) => [x, 1000 + (y - 1000) * 0.25]), { w: 6, seed: 61, bf, amp: 2, close: true });
  const pp = prog(t, L(2), 0.4, easeOutExpo); silInk(ctx, 460, 1100 + (1 - pp) * 200, 520, bf, { fill: NAVY, seed: 62, lw: 9 });
  for (let i = 0; i < 5; i++) ink(ctx, [[380 + i * 40, 640 + hash(i, 3) * 30], [370 + i * 40, 600 + hash(i, 4) * 20]], { w: 6, color: INKC, seed: 63 + i, bf, amp: 2, p: pp });
  // 시선 연결 (점선 대각선) + ? !
  const p = prog(t, L(2) + B(1), 0.6); const pts = []; for (let i = 0; i <= 18; i++) pts.push([lerp(640, 1330, i / 18), lerp(640, 420, i / 18)]);
  for (let i = 0; i < 18; i += 2) { const q = pts[i], q2 = pts[i + 1]; if (i / 18 > p) break; ink(ctx, [q, q2], { w: 8, color: RED, seed: 66 + i, bf, amp: 2 }); }
  [[760, 520, '?', YEL, INKC], [1150, 350, '!', BLUE, CHALK]].forEach(([x, y, s, c, tc], i) => { const q = prog(t, L(2) + B(1.5 + i * 1.5), 0.35, easeOutBack); if (q <= 0) return; cutout(ctx, x, y, 150, 150, c, { seed: 44 + i, scale: q, rot: (i ? 1 : -1) * 0.1 }); hand(ctx, s, x, y + 8, { size: 120, bf, seed: 46 + i, color: tc, alpha: q }); });
  hand(ctx, '상대의 생각을 읽고!', 120, 170, { size: 150, bf, seed: 40, align: 'left', p: prog(t, L(2), 0.45, easeInOutCubic) });
}
function S3(ctx, t, bf) { // 순간의 선택으로! — O / X 팻말
  paper(ctx); hand(ctx, '순간의 선택으로!', 960, 190, { size: 190, bf, seed: 50, p: prog(t, L(3), 0.4, easeInOutCubic) });
  const p1 = prog(t, L(3), 0.4, easeOutBack), p2 = prog(t, L(3) + B(1.2), 0.4, easeOutBack), pick = prog(t, L(3) + B(3), 0.3, easeOutBack);
  paddle(ctx, 640, lerp(1400, 620, p1), 'O', bf, { rot: lerp(-0.25, -0.08, p1) + Math.sin(t * 9) * 0.03 * pick, scale: 1 + 0.08 * pick });
  paddle(ctx, 1280, lerp(1400, 620, p2), 'X', bf, { rot: lerp(0.25, 0.08, p2), alpha: 1 - 0.45 * pick });
  ink(ctx, circlePts(640, 640, 290, 30), { w: 14, color: YEL, seed: 65, bf, p: pick, amp: 7 });
}
function S4(ctx, t, bf) { // 승부를 뒤집어라! — 극적 뒤집기
  const lt = t - L(4); const flip = prog(t, L(4), 0.55, easeInOutCubic); const flipped = flip >= 0.5;
  const sh = shake(t, L(4), 16, 4);
  const drawPage = (fl, alpha) => {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(W / 2 + sh.x, H / 2 + sh.y); ctx.scale(1, Math.cos(fl * Math.PI)); ctx.translate(-W / 2, -H / 2);
    paper(ctx, fl >= 0.5 ? NAVY : PAPER, fl >= 0.5);
    crowd.forEach((c, i) => { const r = Math.floor(c.i / 20); const x = 120 + (c.i % 20) * 88 + c.r1 * 16, y = 600 + r * 50 + c.r2 * 8; const fall = prog(t, L(4) + 0.55 + c.r4 * 0.5, 0.7, easeInExpo); person(ctx, x, y - fall * 1300, 16, { seed: i * 13, bf, color: fl >= 0.5 ? CHALK : INKC, rot: fall * 6 * (c.r3 - .5) }); });
    ctx.restore();
  };
  paper(ctx, NAVY, true);
  if (flip > 0 && flip < 1) { drawPage(clamp(flip - 0.16), 0.25); drawPage(clamp(flip - 0.08), 0.4); }
  drawPage(flip, 1);
  if (flipped) { // 균열선
    for (let i = 0; i < 9; i++) { const a = hash(i, 2) * Math.PI * 2; const len = 300 + hash(i, 3) * 500; const pts = []; for (let k = 0; k <= 6; k++) pts.push([960 + Math.cos(a) * len * k / 6 + (hash(i, k) - .5) * 60, 640 + Math.sin(a) * len * k / 6 + (hash(i, k + 9) - .5) * 60]); ink(ctx, pts, { w: 5, color: CHALK, seed: 400 + i, bf, p: prog(t, L(4) + 0.4 + i * 0.03, 0.25), amp: 2 }); }
  }
  if (lt < 2 / FPS) { ctx.fillStyle = CHALK; ctx.fillRect(0, 0, W, H); }
  else if (lt >= BEAT * 2 && lt < BEAT * 2 + 1 / FPS) { ctx.fillStyle = 'rgba(246,241,228,0.5)'; ctx.fillRect(0, 0, W, H); }
  const p = prog(t, L(4) + 0.45, 0.35);
  ctx.save(); ctx.translate(sh.x * 0.6, sh.y * 0.6); banner(ctx, '승부를 뒤집어라!', 960, 640, 1560, 320, RED, CHALK, { p, bf, seed: 6, size: 190, tseed: 110, punch: 2.6 }); ctx.restore();
}
function S5(ctx, t, bf) { // 때로는 혼자, 때로는 팀으로!
  paper(ctx, NAVY, true);
  const p1 = prog(t, L(5), 0.4, easeInOutCubic), p2 = prog(t, L(5) + B(2.5), 0.4, easeInOutCubic), team = t >= L(5) + B(2.5);
  if (!team) { const p = prog(t, L(5), 0.4, easeOutBack); ctx.save(); ctx.translate(960, 640); ctx.scale(p, p); ctx.translate(-960, -640); person(ctx, 960, 640, 200, { seed: 500, bf, color: CHALK, crown: true }); ctx.restore(); hand(ctx, '때로는 혼자,', 960, 180, { size: 170, bf, seed: 120, color: CHALK, p: p1 }); }
  else {
    const sp = easeOutBack(p2); crowdDraw(ctx, t, bf, { split: sp, rows: [0, 7], y0: 640, dy: 60 });
    cutout(ctx, 400, 520, 320, 150, RED, { seed: 130, scale: sp, rot: -0.05 }); hand(ctx, 'A팀', 400, 528, { size: 110, color: CHALK, bf, seed: 131, alpha: sp });
    cutout(ctx, 1520, 520, 320, 150, BLUE, { seed: 132, scale: sp, rot: 0.05 }); hand(ctx, 'B팀', 1520, 528, { size: 110, color: CHALK, bf, seed: 133, alpha: sp });
    hand(ctx, 'VS', 960, 760, { size: 170, color: YEL, bf, seed: 134, p: p2 });
    hand(ctx, '때로는 혼자,', 500, 180, { size: 150, bf, seed: 120, color: CHALK }); hand(ctx, '때로는 팀으로!', 1400, 180, { size: 150, bf, seed: 121, color: YEL, p: p2 });
  }
}
function S6(ctx, t, bf) { // 이곳에 펼쳐지는 예측불허 두뇌대결! — 인게임 컷
  paper(ctx); crowdDraw(ctx, t, bf, { alpha: 0.35, rows: [0, 10], y0: 560, dy: 56 });
  CUTS.forEach(([name, t0, dur, from], i) => { if (t < t0) return; const p = prog(t, t0, 0.22, easeOutBack); const fi = from + Math.floor((t - t0) * 30); photo(ctx, name, Math.min(fi, from + dur * 30 + 8), 960 + (i % 2 ? 30 : -30), 640, 1180, 664, bf, { rot: (i % 2 ? 1 : -1) * 0.03, scale: lerp(1.35, 1, p), seed: 200 + i });
    const [rn, rname, rc] = ROUNDS[i]; cutout(ctx, 330 + (i % 2 ? 0 : -20), 330, 330, 110, rc, { seed: 210 + i, rot: -0.06, scale: p }); hand(ctx, `${rn} ${rname}`, 330 + (i % 2 ? 0 : -20), 336, { size: 54, color: CHALK, bf, seed: 220 + i, rot: -0.06, alpha: p }); });
  hand(ctx, '이곳에 펼쳐지는 예측불허 두뇌대결!', 960, 160, { size: 125, bf, seed: 140, p: prog(t, L(6), 0.5, easeInOutCubic) });
}
function S7(ctx, t, bf) { // 타이틀 (ENDV: 0 현재 / 1 팻말 / 2 칠판 / 3 객석)
  const p = prog(t, L(7) + 0.05, 0.4, easeOutBack), pw = prog(t, L(7) + 0.05, 0.5, easeInOutCubic), p2 = prog(t, L(7) + B(1.5), 0.35, easeOutBack), p3 = prog(t, L(7) + B(3), 0.5);
  if (ENDV === 3) { paper(ctx, NAVY, true); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(960, -100, 50, 960, 500, 1000); g.addColorStop(0, 'rgba(242,194,48,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(760, -50); ctx.lineTo(1160, -50); ctx.lineTo(1500, 1100); ctx.lineTo(420, 1100); ctx.closePath(); ctx.fill(); ctx.restore(); hall(ctx, t, bf, { yoff: 120, fillOverride: '#141c33' }); person(ctx, 960, 760, 110, { seed: 500, bf, color: CHALK, crown: true }); }
  else if (ENDV === 2) { paper(ctx); cutout(ctx, 960, 560, 1500, 760, BOARD, { rot: 0.01, seed: 300 }); bigFace(ctx, 230, 900, 150, bf, { seed: 310, expr: 'flash' }); }
  else { paper(ctx); crowdDraw(ctx, t, bf, { alpha: 0.35 }); }
  if (ENDV === 1) { paddle(ctx, 300, 700, 'O', bf, { rot: -0.2, scale: 0.9 * p }); paddle(ctx, 1620, 700, 'X', bf, { rot: 0.2, scale: 0.9 * p }); }
  const ty = ENDV === 2 ? 480 : ENDV === 3 ? 330 : 380;
  if (ENDV === 2) { hand(ctx, '多지니어스', 960, ty, { size: 260, bf, seed: 190, color: CHALK, p: pw }); }
  else { cutout(ctx, 960, ty, 1250, 340, YEL, { rot: -0.03, seed: 8, scale: lerp(1.4, 1, p) }); hand(ctx, '多지니어스', 960, ty + 12, { size: 260, bf, seed: 190, rot: -0.03, p: pw }); }
  if (ENDV !== 2 && ENDV !== 3) person(ctx, 960, ty - 230, 60, { seed: 501, bf, crown: true, color: INKC, p: p2 });
  if (p2 > 0) { cutout(ctx, 960, ty + 270, 640, 170, RED, { rot: 0.04, seed: 12, scale: lerp(1.3, 1, p2) }); hand(ctx, '1 VS ALL', 960, ty + 276, { size: 130, color: CHALK, bf, seed: 191, rot: 0.04 }); }
  hand(ctx, '한 명의 천재 VS 모두의 전략', 960, ENDV === 3 ? 980 : 850, { size: 90, bf, seed: 192, font: 'NanumPen', color: ENDV === 3 ? CHALK : ENDV === 2 ? CHALK : INKC, p: p3 });
  if (ENDV !== 3) for (let i = 0; i < 40; i++) { const st = L(7) + B(1) + hash(i, 1) * 0.6; const pp = prog(t, st, 2.2, x => x); if (pp <= 0) continue; cutout(ctx, 200 + hash(i, 2) * 1520, -40 + pp * 1200, 26, 40, [RED, YEL, BLUE, GREEN][i % 4], { rot: pp * 6 * (hash(i, 3) - .5), seed: i, alpha: 1 - pp * 0.3 }); }
}
function render(ctx, t) { const bf = boilF(t), li = Math.min(7, Math.floor(t / 2)); [S0, S1, S2, S3, S4, S5, S6, S7][li](ctx, t, bf); }
const TICKS = [[1.2, 1600], [L(1), 1100], [L(2), 1300], [L(2) + B(1.5), 1300], [L(2) + B(3), 1300], [L(3), 1100], [L(3) + B(1.2), 1100], [L(3) + B(3), 1500], [L(5), 1300], [L(5) + B(2.5), 1300], [12.0, 1200], [12.45, 1200], [12.9, 1200], [13.35, 1200], [L(7) + B(1.5), 1000]];
boot({ render, ticks: TICKS, audio: { clap: true, wood: true, shaker: true, bassType: 'triangle', bassGain: 0.34, lpOpen: 1600, lpClose: 500, stabs: false, tickFreq: 1200, tickGain: 0.08, outroThin: true, bell: true } });
window.READY = Promise.all([window.READY, ...imgLoads]);
