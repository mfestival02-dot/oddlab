// 컴퓨터 상대: 지금 상태에서 누름 자리와 힘을 여러 가지로 미리 돌려 보고 고른 뒤, 실력에 따라 힘을 조금 빗나가게 한다.
import { Game } from './game.js';

export class Planner {
  constructor(RAPIER, game, skill = 0.7) {
    this.snap = game.snapshot();
    this.me = game.player;
    this.box = Planner.box || (Planner.box = new Game(RAPIER));        // 실제 경기와 분리된 연습장
    this.cands = [];
    const n = game.spots().length;
    for (let s = 0; s < n; s++) for (let p = 0.2; p <= 1.001; p += 0.05) this.cands.push({ spot: s, power: p });
    this.i = 0; this.best = { score: -1e9, spot: game.spot, power: 0.5 };
    this.skill = skill; this.done = false;
  }
  // 한 프레임에 쓸 시간(ms)만큼만 계산한다
  step(budget = 5) {
    const t0 = performance.now(), me = this.me, box = this.box;
    while (this.i < this.cands.length && performance.now() - t0 < budget) {
      const c = this.cands[this.i++];
      box.restore(this.snap); box.fireSpot(c.spot, c.power); box.runUntilSettled(12);
      const r = box.result;
      let s;
      if (r) s = r.reason === 'perch' ? (r.winner === me ? 100 : -80) : r.reason === 'both-fell' ? -50 : r.winner === me ? 90 : -100;
      else { const a = box.curr[me].p, b = box.curr[1 - me].p; s = -Math.hypot(a[0] - b[0], a[2] - b[2]) * 4 - (Math.abs(a[0]) > 2.4 || Math.abs(a[2]) > 1.5 ? 12 : 0); }
      s += Math.random() * 0.5;
      if (s > this.best.score) this.best = { score: s, ...c };
    }
    if (this.i >= this.cands.length && !this.done) {
      this.done = true;
      const miss = 1 - this.skill, g = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
      this.shot = { spot: this.best.spot, power: Math.min(1, Math.max(0.15, this.best.power + g() * 0.16 * miss)), sure: this.best.score >= 90 };
    }
    return this.done;
  }
}
