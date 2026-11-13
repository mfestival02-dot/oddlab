// 효과음: 파일 없이 그 자리에서 만들어 낸다.
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; this.last = {}; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.out = this.ctx.createGain(); this.out.gain.value = this.muted ? 0 : 0.6; this.out.connect(this.ctx.destination);
    const n = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, n, n);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  setMuted(m) { this.muted = m; if (this.out) this.out.gain.value = m ? 0 : 0.6; }
  _ok(name, gap) { if (!this.ctx) return false; const t = this.ctx.currentTime; if (gap && t - (this.last[name] || -9) < gap) return false; this.last[name] = t; return true; }
  tone(f, f2, d, v, type = 'sine', delay = 0) {
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + d + 0.05);
  }
  noise(d, v, f, type = 'bandpass', q = 1, delay = 0, f2 = null) {
    const t = this.ctx.currentTime + delay, s = this.ctx.createBufferSource(), fl = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d); fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fl); fl.connect(g); g.connect(this.out); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }
  click() { if (this._ok('click', 0.03)) { this.noise(0.03, 0.25, 2600, 'bandpass', 2); this.tone(520, 380, 0.05, 0.08, 'triangle'); } }
  tick() { if (this._ok('tick', 0.02)) this.noise(0.035, 0.12, 3800, 'bandpass', 3); }                 // 자 눈금을 긁는 연필
  scratch() { if (this._ok('scratch', 0.1)) for (let i = 0; i < 4; i++) this.noise(0.07, 0.14, 2400 + i * 300, 'bandpass', 1.5, i * 0.07); }   // 분필
  flick(p) { if (this._ok('flick', 0.05)) { this.tone(190 + p * 120, 70, 0.14, 0.35 + p * 0.25, 'sine'); this.noise(0.09, 0.2 + p * 0.25, 900, 'lowpass'); } }
  thud(k) { if (this._ok('thud', 0.07)) { const v = Math.min(0.6, 0.08 + k * 0.5); this.tone(150, 60, 0.11, v, 'sine'); this.noise(0.06, v * 0.6, 500, 'lowpass'); } }
  fall() { if (this._ok('fall', 0.3)) this.tone(720, 110, 0.75, 0.2, 'triangle'); }
  stamp() { if (this._ok('stamp', 0.3)) { this.tone(110, 45, 0.25, 0.7, 'sine'); this.noise(0.12, 0.45, 700, 'lowpass'); this.noise(0.05, 0.2, 3000, 'highpass', 1, 0.02); } }
  bell() { if (this._ok('bell', 0.5)) [[784, 0], [659, 0.32], [784, 0.64], [988, 0.96]].forEach(([f, d]) => { this.tone(f, null, 0.5, 0.16, 'sine', d); this.tone(f * 2.01, null, 0.3, 0.05, 'sine', d); }); }  // 학교 종
  whoosh() { if (this._ok('whoosh', 0.3)) this.noise(0.55, 0.22, 500, 'bandpass', 0.8, 0, 1800); }               // 느린 화면에 들어갈 때
  heart() { if (this._ok('heart', 0.3)) { this.tone(70, 48, 0.12, 0.5, 'sine'); this.tone(64, 44, 0.12, 0.38, 'sine', 0.16); } }  // 두근두근
  pop() { if (this._ok('pop', 0.2)) { this.noise(0.12, 0.35, 1800, 'highpass', 0.7); this.tone(420, 900, 0.1, 0.18, 'triangle'); } }   // 꽃가루
  sad() { if (this._ok('sad', 0.5)) [[392, 0], [330, 0.22], [262, 0.44]].forEach(([f, d]) => this.tone(f, null, 0.3, 0.14, 'triangle', d)); }
}
