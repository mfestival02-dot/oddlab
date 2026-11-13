import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

let _grad = null;
export function gradientMap() {
  if (_grad) return _grad;
  const data = new Uint8Array([150, 205, 240, 255]);
  _grad = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  _grad.minFilter = THREE.NearestFilter;
  _grad.magFilter = THREE.NearestFilter;
  _grad.generateMipmaps = false;
  _grad.needsUpdate = true;
  return _grad;
}

export function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...extra });
}

// soft fabric bump for plush look
let _fab = null;
export function fabricTexture() {
  if (_fab) return _fab;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  _fab = new THREE.CanvasTexture(c);
  _fab.wrapS = _fab.wrapT = THREE.RepeatWrapping;
  _fab.repeat.set(3, 3);
  return _fab;
}

// inverted-hull outline (soft colored)
export function addOutline(mesh, color, thickness = 0.05) {
  const m = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
  );
  m.scale.setScalar(1 + thickness);
  m.userData.isOutline = true;
  mesh.add(m);
  return m;
}

export function darker(hex, k = 0.6) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return c;
}
export function lighter(hex, k = 0.5) {
  return new THREE.Color(hex).lerp(new THREE.Color(0xffffff), k);
}

// ---------------- audio ----------------
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.vol = 0.55;
  }
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.vol;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 1.0;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.vol;
  }
  tone({ f = 440, f2 = null, d = 0.15, type = 'sine', v = 0.2, delay = 0, attack = 0.006 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + d + 0.05);
  }
  noise({ d = 0.2, v = 0.2, f = 1200, f2 = null, q = 0.8, type = 'lowpass', delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const fl = this.ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
    fl.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fl);
    fl.connect(g);
    g.connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + d + 0.05);
  }
  // continuous sound with live control
  hum({ type = 'sawtooth', f = 90, filter = 600, v = 0 } = {}) {
    if (!this.ctx) return null;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const fl = this.ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = filter;
    const g = this.ctx.createGain();
    g.gain.value = v;
    o.connect(fl);
    fl.connect(g);
    g.connect(this.master);
    o.start();
    const ctx = this.ctx;
    return {
      set(freq, vol, filt) {
        const t = ctx.currentTime;
        if (freq != null) o.frequency.setTargetAtTime(freq, t, 0.03);
        if (vol != null) g.gain.setTargetAtTime(vol, t, 0.03);
        if (filt != null) fl.frequency.setTargetAtTime(filt, t, 0.03);
      },
      osc: o,
    };
  }
}

// tiny chiptune loop
export class Music {
  constructor(sfx, { bpm = 132, melody = [], bass = [], v = 0.035, wave = 'square' } = {}) {
    this.sfx = sfx;
    this.bpm = bpm;
    this.melody = melody;
    this.bass = bass;
    this.v = v;
    this.wave = wave;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.rate = 1;
  }
  start() {
    if (!this.sfx.ctx || this.timer) return;
    this.nextTime = this.sfx.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), 50);
  }
  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
  tick() {
    const ctx = this.sfx.ctx;
    const stepDur = 60 / this.bpm / 2 / this.rate;
    while (this.nextTime < ctx.currentTime + 0.2) {
      const i = this.step % this.melody.length;
      const m = this.melody[i];
      const b = this.bass[i % this.bass.length];
      const delay = this.nextTime - ctx.currentTime;
      if (m) this.sfx.tone({ f: m, d: stepDur * 0.9, type: this.wave, v: this.v, delay });
      if (b) this.sfx.tone({ f: b, d: stepDur * 1.6, type: 'triangle', v: this.v * 1.6, delay });
      this.nextTime += stepDur;
      this.step++;
    }
  }
}

export const NOTE = (() => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const out = {};
  for (let o = 2; o <= 6; o++)
    names.forEach((n, i) => {
      out[n + o] = 440 * Math.pow(2, (i - 9 + (o - 4) * 12) / 12);
    });
  return out;
})();
export function seq(str) {
  // "C5 E5 - G5 ..." '-' = rest
  return str.trim().split(/\s+/).map((t) => (t === '-' ? 0 : NOTE[t]));
}

// keyboard
export function makeKeys() {
  const down = new Set();
  const pressed = new Set();
  addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    down.add(e.code);
  });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => down.clear());
  return {
    down: (c) => down.has(c),
    any: (...cs) => cs.some((c) => down.has(c)),
    hit: (c) => pressed.has(c),
    endFrame: () => pressed.clear(),
  };
}

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData = { canvas: c, ctx: g };
  return t;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
