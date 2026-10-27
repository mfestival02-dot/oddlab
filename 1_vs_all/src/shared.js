// ───────────────────────── shared.js ─────────────────────────
// 多지니어스 1 vs 200 인트로 공통 엔진: 시간 함수 기반 렌더 + Web Audio 합성 + WAV 내보내기
// 모든 그림/소리는 전역 시간 t(초)의 순수 함수. Math.random / setInterval 사용 금지.

const CFG = window.CFG || {};
const W = 1920, H = 1080, FPS = 30, DUR = CFG.dur ?? 17.0, BPM = CFG.bpm ?? 150;
const BEAT = 60 / BPM;            // 150 BPM → 0.4s
const B = n => n * BEAT;          // n번째 비트의 시간
window.DUR = DUR;
// 음악 구간(비트): build = 풀드럼 시작, drop = 임팩트+플립, title = 타이틀, 기본은 17초 8줄 대본용
const SB = Object.assign({ build: 5, drop: 20, title: 35 }, CFG.secBeats || {});
const SEC = { s1: 0, s2: B(SB.build), s3: B(SB.drop), s4: B(SB.title) };
// 픽셀 그림 (da-genius 게임 앱의 썸네일 데이터) — pix(ctx, 'megaphone', x, y, 칸 크기)
function pix(ctx, name, x, y, cell = 6, { alpha = 1, center = true } = {}) {
  const rows = (typeof PIX !== 'undefined' ? PIX : {})[name]; if (!rows) return; const w = rows[0].length * cell, h = rows.length * cell;
  ctx.save(); ctx.globalAlpha *= alpha; const ox = center ? x - w / 2 : x, oy = center ? y - h / 2 : y;
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = PIXCOL[r[i]]; if (!c) continue; ctx.fillStyle = c; ctx.fillRect(ox + i * cell, oy + j * cell, cell + 0.5, cell + 0.5); } });
  ctx.restore(); return { w, h };
}

// ── easing ──
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const easeInExpo = x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10);
const easeInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOutBack = x => { const c = 1.70158, d = c + 1; return 1 + d * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const easeOutElastic = x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (2 * Math.PI / 3)) + 1;
// t0에서 시작해 d초 동안 0→1 (ease 적용)
const prog = (t, t0, d, ease = easeOutExpo) => ease(clamp((t - t0) / d));
// 구간 [a,b] 안에 있는가
const within = (t, a, b) => t >= a && t < b;
// 비트 펀치: 각 비트 직후 1→0으로 감쇠
const beatPulse = (t, from = 0, decay = 6) => { if (t < from) return 0; const p = (t - from) % BEAT; return Math.exp(-decay * p / BEAT); };

// ── seeded PRNG / noise ──
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = (x, y = 0, z = 0) => { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
// 부드러운 1D 노이즈 (-1..1)
function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, u); }

// ── 200명 참가자 기본 배치 (시드 고정) ──
function makeCrowd(seed = 7) {
  const r = mulberry32(seed), arr = [];
  for (let i = 0; i < 200; i++) arr.push({ i, r1: r(), r2: r(), r3: r(), r4: r(), ang: (i / 200) * Math.PI * 2 });
  return arr;
}

// ── 텍스트 ──
function txt(ctx, s, x, y, o = {}) {
  ctx.save();
  ctx.font = `${o.weight || 900} ${o.size || 80}px ${o.font || 'Pretendard'}`;
  ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.baseline || 'middle';
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  if (o.lw) { ctx.lineJoin = 'round'; ctx.lineWidth = o.lw; ctx.strokeStyle = o.stroke || '#000'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.fill || '#fff'; ctx.fillText(s, x, y);
  ctx.restore();
}
function textWidth(ctx, s, font) { ctx.save(); ctx.font = font; const w = ctx.measureText(s).width; ctx.restore(); return w; }

// 카메라 흔들림 (비트 직후 2~3프레임)
function shake(t, from, amp = 8, seed = 1) { const p = beatPulse(t, from, 14); return { x: noise1(t * 60, seed) * amp * p, y: noise1(t * 60, seed + 9) * amp * p }; }

// ───────────────────────── AUDIO ─────────────────────────
// P: 스타일별 파라미터. ticks: 글자 찍힘 시각 배열
function scheduleAudio(ctx, dest, P, ticks = []) {
  const t0 = ctx.currentTime + 0.05;
  const master = ctx.createGain(); master.gain.value = (P.master ?? 0.8) * 0.6;   // 피크 여유 (-6 dBFS 목표)
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.12;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -8; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
  master.connect(comp); comp.connect(lim); lim.connect(dest);

  // 노이즈 버퍼
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  { const d = nb.getChannelData(0), r = mulberry32(99); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
  const noise = (at, dur, { hp = 0, lp = 20000, g = 0.3, attack = 0.002, bp = 0, q = 1 } = {}) => {
    const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true;
    let node = s;
    if (bp) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = bp; f.Q.value = q; node.connect(f); node = f; }
    if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    if (lp < 20000) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    const env = ctx.createGain(); env.gain.setValueAtTime(0, at); env.gain.linearRampToValueAtTime(g, at + attack); env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    node.connect(env); env.connect(master); s.start(at); s.stop(at + dur + 0.05);
  };
  const tone = (at, dur, f1, { f2 = f1, type = 'sine', g = 0.5, attack = 0.002, lp = 0, lpQ = 1, lpEnd = 0, detune = 0 } = {}) => {
    const o = ctx.createOscillator(); o.type = type; o.detune.value = detune;
    o.frequency.setValueAtTime(f1, at); if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, at + dur * 0.6);
    let node = o;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = lpQ; f.frequency.setValueAtTime(lp, at); if (lpEnd) f.frequency.exponentialRampToValueAtTime(lpEnd, at + dur); node.connect(f); node = f; }
    const env = ctx.createGain(); env.gain.setValueAtTime(0, at); env.gain.linearRampToValueAtTime(g, at + attack); env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    node.connect(env); env.connect(master); o.start(at); o.stop(at + dur + 0.05);
  };
  const kick = (at, g = 0.9) => { tone(at, 0.28, 150, { f2: 42, g }); noise(at, 0.02, { hp: 2000, g: 0.15 }); };
  const boom = (at, g = 0.9) => { tone(at, 0.9, 70, { f2: 38, g }); noise(at, 0.5, { lp: 1200, g: 0.25, attack: 0.01 }); };
  const hat = (at, g = 0.12, dur = 0.035) => noise(at, dur, { hp: 7000, g });
  const clap = (at, g = 0.3) => { for (let k = 0; k < 3; k++) noise(at + k * 0.012, 0.06, { bp: 1500, q: 1.2, g: g * (1 - k * 0.2) }); noise(at + 0.03, 0.18, { bp: 1800, q: 0.8, g: g * 0.6 }); };
  const riser = (at, dur, g = 0.25) => {
    const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.setValueAtTime(200, at); f.frequency.exponentialRampToValueAtTime(6000, at + dur);
    const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, at); env.gain.exponentialRampToValueAtTime(g, at + dur); env.gain.setValueAtTime(0.0001, at + dur + 0.001);
    s.connect(f); f.connect(env); env.connect(master); s.start(at); s.stop(at + dur + 0.02);
  };
  const tick = (at, f = 2000, g = 0.12) => tone(at, 0.025, f, { g, attack: 0.001 });

  const N = { A1: 55, C2: 65.41, E2: 82.41, G2: 98, A2: 110, C3: 130.81, E3: 164.81, G3: 196, A3: 220, C4: 261.63, E4: 329.63, G4: 392, A4: 440 };
  const arp = P.arp || ['A1', 'C2', 'E2', 'G2'];
  const s2 = t0 + SEC.s2, s3 = t0 + SEC.s3, s4 = t0 + SEC.s4, end = t0 + DUR;

  // ── 드럼 ──
  const NB = Math.ceil(DUR / BEAT), bS = SB.build, dS = SB.drop, tS = SB.title;
  const taiko = (at, g = 0.8) => { tone(at, 0.45, 95, { f2: 48, g }); noise(at, 0.12, { lp: 900, g: 0.2 }); };
  for (let n = 0; n < NB; n++) {
    const at = t0 + B(n);
    if (at >= end) break;
    if (n < bS) { if (n % 2 === 0) (P.taiko ? taiko : kick)(at, 0.8); }
    else if (n >= tS) { if (!P.titleSilent && n % 2 === 0) (P.taiko ? taiko : kick)(at, 0.55); }
    else kick(at, 0.95);
    if (P.taiko && n >= bS && n < tS && n % 2 === 0) taiko(at, 0.6);
    if (P.clap && n >= bS && n < tS && n % 2 === 1) clap(at, 0.3);
    if (P.hats && n >= bS && n < tS) { hat(at, 0.14); hat(at + BEAT / 2, 0.08); }
    if (P.shaker && n >= bS && n < tS) { hat(at + BEAT / 4, 0.05, 0.06); hat(at + BEAT * 3 / 4, 0.05, 0.06); }
    if (P.wood && n >= bS && n < tS) tone(at + BEAT / 2, 0.04, 820, { g: 0.12, attack: 0.001 });
  }
  // ── 베이스 아르페지오 (16분) ──
  if (P.bass !== false) {
    for (let n = bS; n < NB; n++) for (let k = 0; k < 4; k++) {
      const at = t0 + B(n) + k * BEAT / 4; if (at >= end) break;
      if (n >= tS && P.titleSilent) break;
      const up = n >= dS ? 2 : 1;                           // 드롭 후 한 옥타브 위
      const f = N[arp[(n * 4 + k) % arp.length]] * up;
      const quiet = n >= tS && P.outroThin;
      if (quiet && k % 2 === 1) continue;
      tone(at, BEAT / 4 * 0.9, f, { type: P.bassType || 'sawtooth', g: P.bassGain ?? 0.28, lp: k === 0 ? P.lpOpen ?? 1200 : P.lpClose ?? 400, lpEnd: P.lpClose ?? 400, lpQ: 6 });
    }
  }
  // ── 패드 (수채 스타일 등) ──
  if (P.pad) {
    const chords = [['A2', 'C3', 'E3'], ['A2', 'C3', 'G3'], ['A2', 'E3', 'A3'], ['A2', 'C3', 'E3']];
    for (let n = 0; n < NB; n += 2) {
      const at = t0 + B(n); if (at >= end) break;
      const ch = chords[(n / 2) % 4 | 0];
      ch.forEach((nm, i) => tone(at, BEAT * 2, N[nm], { type: 'triangle', g: 0.08, attack: 0.08, lp: 900, detune: (i - 1) * 7 }));
    }
  }
  // ── 리드 스탭 (드롭 구간) ──
  if (P.stabs) for (let n = dS + 1; n < tS; n++) { const at = t0 + B(n); const f = N[['A3', 'A3', 'C4', 'G3', 'A3', 'E4', 'C4', 'G3', 'A3', 'A3', 'C4', 'E4', 'G3', 'A3', 'C4'][(n - dS - 1) % 15]]; tone(at, 0.16, f, { type: 'sawtooth', g: 0.14, lp: 2600, lpEnd: 600, lpQ: 3 }); tone(at, 0.16, f * 1.5, { type: 'square', g: 0.04, lp: 2000, lpEnd: 500 }); }
  // ── 라이저 / 임팩트 ──
  riser(s2 - 1.0, 1.0, 0.22); riser(s3 - 0.6, 0.6, 0.3); riser(s4 - 0.5, 0.5, 0.2);
  boom(s2, 0.8); boom(s3, 1.0); boom(s4, 0.9);
  if (P.bell) { [[0, 440], [0.25, 659.25], [0.5, 880]].forEach(([d, f]) => { tone(s4 + d, 2.2, f, { type: 'sine', g: 0.16, attack: 0.01 }); tone(s4 + d, 1.2, f * 2.76, { type: 'sine', g: 0.04, attack: 0.01 }); }); }
  if (P.endHit) boom(end - 0.4 > s4 ? t0 + B(NB - 2) : s4, 0.5);
  // 드롭 플래시: 리버스 심벌 꼬리
  noise(s3, 0.9, { hp: 3000, g: 0.18, attack: 0.005 });
  // ── 글자 찍힘 ──
  ticks.forEach(([at, f]) => tick(t0 + at, f || P.tickFreq || 2000, P.tickGain ?? 0.1));
  return t0;
}

// ── WAV 인코더 ──
function bufferToWav(buf) {
  const ch = buf.numberOfChannels, len = buf.length * ch * 2 + 44, ab = new ArrayBuffer(len), v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, len - 8, true); ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, len - 44, true);
  let o = 44; const chs = []; for (let c = 0; c < ch; c++) chs.push(buf.getChannelData(c));
  for (let i = 0; i < buf.length; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, chs[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true); o += 2; }
  return ab;
}
async function renderAudioBase64(P, ticks) {
  const off = new OfflineAudioContext(2, 48000 * DUR, 48000);
  scheduleAudio(off, off.destination, P, ticks);
  const buf = await off.startRendering();
  const bytes = new Uint8Array(bufferToWav(buf)); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// ── 플레이어 부트스트랩 ──
// render(t)를 정의한 뒤 boot({audio:P, ticks}) 호출
function boot({ audio, ticks = [], render }) {
  const cv = document.getElementById('c'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  window.render = t => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); render(ctx, t); ctx.restore(); };
  window.renderAudio = () => renderAudioBase64(audio, ticks);
  const fontsReady = Promise.all([...document.fonts].map(f => f.load().catch(() => 0))).then(() => document.fonts.ready);
  window.READY = fontsReady;
  const q = new URLSearchParams(location.search);
  if (q.has('frame')) { fontsReady.then(() => window.render(+q.get('frame') / FPS)); return; }
  fontsReady.then(() => window.render(0));
  const btn = document.getElementById('play');
  btn.onclick = async () => {
    btn.style.display = 'none';
    const ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume();
    let start = scheduleAudio(ac, ac.destination, audio, ticks);
    const loop = () => { let t = ac.currentTime - start; if (t >= DUR) { start = scheduleAudio(ac, ac.destination, audio, ticks); t = 0; } window.render(Math.max(0, t)); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  };
}
