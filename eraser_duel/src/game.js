// 턴 진행과 승패 판정. 화면·입력 장치와 무관하다.
import { DT, defaultSettings, initialLayout, TYPES } from './config.js';
import { Sim, yawQuat } from './sim.js';

export const PHASE = { AIM: 'aim', POWER: 'power', PHYSICS: 'physics', RESULT: 'result' };
export const PHASE_KO = { aim: '조준', power: '파워 선택', physics: '물리 진행', result: '결과' };
const AIM_SPEED = 1.5;            // 방향 조절 속도(라디안/초)
const MIN_GAUGE_TIME = 0.15;      // 게이지를 시작하자마자 같은 입력으로 발사되는 것을 막는다

export class Game {
  constructor(RAPIER) {
    this.R = RAPIER;
    this.pending = defaultSettings();    // 패널에서 편집 중인 값(다음 발사부터 적용)
    this.sim = null;
    this.acc = 0;
    this.savedShot = null;               // '발사 전 상태 저장'으로 남긴 것
    this.lastShot = null;                // 마지막 발사 직전 상태(자동 저장)
    this.onEvent = () => {};
    this.types = ['normal', 'normal'];
    this.layoutMode = 'near';             // 'match' 일반 경기(멀리서 시작) / 'near' 개발자 검증(가까이)
    this.events = [];                    // 연출·소리용 사건 기록(그리는 쪽에서 꺼내 쓴다)
    this.restart();
  }

  // ---------- 초기화·복원 ----------
  _build(state, settings) {
    if (this.sim) this.sim.free();
    this.sim = new Sim(this.R, state, settings);
    this.prev = this.sim.getState().bodies; this.curr = this.prev;
    this.acc = 0;
    this.timers = { phys: 0, stable: 0, perch: 0, other: 0 };
    this.perchOwner = null; this.lastUp = null; this.lastUpT = 0; this.poseRef = null; this.poseAt = -9; this.stillFor = 0;
    this.stuck = false;
    this.result = null;
    this.gauge = { t: 0, value: 0 };
    this.info = { touching: false, upper: null, normalY: 0 };
    this.launchInfo = null;
    this.hit = 1;
    this.spot = 0;                       // 고른 누름 자리(현재 차례인 사람의 것)
    this.pressing = false;
    this.events.length = 0;
  }
  restart() {
    const L = initialLayout(this.types, this.layoutMode, this.rnd || Math.random);
    this.player = 0;
    this.turnNo = 1;
    this.aim = [...L.aim];
    if (this.layoutMode === 'match') this.aim = L.bodies.map((b, i) => Math.atan2(L.bodies[1 - i].p[2] - b.p[2], L.bodies[1 - i].p[0] - b.p[0]));
    this._build({ bodies: L.bodies.map((b) => ({ p: b.p, q: yawQuat(b.yaw), type: b.type })) }, { ...this.pending });
    this.spot = this.bestSpot();
    this.phase = PHASE.AIM;
    this.onEvent('restart');
  }
  get applied() { return this.sim.S; }

  // 발사 직전 상태 한 벌: 위치·회전·속도·수면, 차례, 방향·파워, 적용할 설정
  snapshot(angle = this.aim[this.player], power = null, hit = this.hit, spot = null) {
    return { kind: 'eraser-duel-shot', version: 1, state: this.sim.getState(), player: this.player, aim: [...this.aim], angle, power, hit, spot, settings: { ...this.pending } };
  }
  restore(snap, { useSnapSettings = true } = {}) {
    if (useSnapSettings) this.pending = { ...snap.settings };
    this.player = snap.player;
    this.aim = [...snap.aim];
    this.aim[this.player] = snap.angle;
    this._build(snap.state, { ...this.pending });
    this.types = snap.state.bodies.map((b) => b.type || 'normal');
    this.hit = snap.hit ?? 1;
    this.spot = snap.spot ?? this.bestSpot();
    this.phase = PHASE.AIM;
    this.onEvent('restore');
  }

  // ---------- 입력 ----------
  turn(dir, dt) {                        // 조준 중에만 방향이 바뀐다
    if (this.phase !== PHASE.AIM) return;
    this.aim[this.player] += dir * AIM_SPEED * dt;
  }
  // ---------- 손가락으로 누르기(실제 경기 조작) ----------
  spots() { return this.sim.spots(this.player); }
  bestSpot() {                           // 상대 쪽으로 가장 곧게 나가는 자리(차례 시작 때 기본 선택)
    const a = this.curr[this.player].p, b = this.curr[1 - this.player].p, want = Math.atan2(b[2] - a[2], b[0] - a[0]);
    let best = 0, bd = 9;
    this.sim.spots(this.player).forEach((s, i) => { const d = Math.abs(((s.angle - want + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) + (s.kind === '꼭짓점' ? 0.15 : 0); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  selectSpot(i) {                        // 조준 중에만 자리를 바꾼다
    if (this.phase !== PHASE.AIM) return;
    const n = this.spots().length;
    this.spot = ((i % n) + n) % n;
    this.aim[this.player] = this.spots()[this.spot].angle;
  }
  cycleSpot(dir) { this.selectSpot(this.spot + dir); }
  pressAt(t) { return Math.min(1, Math.max(0, t) / this.applied.pressTime); }      // 누른 시간 → 힘(0~1)
  pressDown() {                          // 꾹 누르기 시작
    if (this.phase !== PHASE.AIM) return false;
    this.phase = PHASE.POWER; this.pressing = true;
    this.gauge = { t: 0, value: 0 };
    this.onEvent('gauge');
    return true;
  }
  pressUp() {                            // 손을 떼면 튕긴다
    if (this.phase !== PHASE.POWER || !this.pressing) return false;
    if (this.gauge.t < MIN_GAUGE_TIME) { this.phase = PHASE.AIM; this.pressing = false; this.gauge = { t: 0, value: 0 }; return false; }   // 살짝 건드린 것은 누른 것으로 치지 않는다
    return this.fireSpot(this.spot, this.pressAt(this.gauge.t));
  }
  fireSpot(spot, power) {
    if (this.phase !== PHASE.AIM && this.phase !== PHASE.POWER) return false;
    const n = this.spots().length; spot = Math.max(0, Math.min(n - 1, spot | 0));
    this.lastShot = this.snapshot(this.spots()[spot].angle, power, 1, spot);
    this._build(this.lastShot.state, { ...this.pending });
    this.spot = spot;
    this.launchInfo = this.sim.press(this.player, spot, power);
    this.aim[this.player] = this.launchInfo.angle;
    this.shotPower = power; this.pressing = false;
    this.phase = PHASE.PHYSICS;
    this.events.push({ type: 'launch', i: this.player, power, p: this.curr[this.player].p, kind: this.launchInfo.kind });
    this.onEvent('fire');
    return true;
  }
  setHit(h) {                            // 누르는 위치: 0 앞 / 1 가운데 / 2 뒤 (조준 중에만)
    if (this.phase !== PHASE.AIM) return;
    this.hit = Math.max(0, Math.min(2, h));
  }
  press() {                              // 스페이스·버튼: 게이지 시작 → 튕기기
    if (this.phase === PHASE.AIM) {
      this.phase = PHASE.POWER;
      this.gauge = { t: 0, value: 0 }; this.pressing = false;
      this.onEvent('gauge');
      return 'gauge';
    }
    if (this.phase === PHASE.POWER && this.gauge.t >= MIN_GAUGE_TIME) {
      this.fire(this.aim[this.player], this.gauge.value, this.hit);
      return 'fire';
    }
    return null;
  }
  // 방향과 파워를 직접 지정해서 발사(일반 플레이는 press()를 거쳐 여기로 온다)
  fire(angle, power, hit = this.hit) {
    if (this.phase !== PHASE.AIM && this.phase !== PHASE.POWER) return false;
    this.aim[this.player] = angle;
    this.lastShot = this.snapshot(angle, power, hit);
    // 설정은 발사 시점에 확정한다: 새 값이 있으면 같은 상태로 물리 세계를 다시 만든다
    this._build(this.lastShot.state, { ...this.pending });
    this.hit = hit;
    this.launchInfo = this.sim.launch(this.player, angle, power, hit);
    this.shotPower = power;
    this.events.push({ type: 'launch', i: this.player, power, p: this.curr[this.player].p });
    this.phase = PHASE.PHYSICS;
    this.onEvent('fire');
    return true;
  }
  replayLast() {                         // 같은 조건으로 다시 발사
    if (!this.lastShot) return false;
    const s = this.lastShot;
    this.restore(s);
    return s.spot != null ? this.fireSpot(s.spot, s.power) : this.fire(s.angle, s.power, s.hit ?? 1);
  }

  // ---------- 진행 ----------
  // 실제 흐른 시간을 받아 고정 간격으로 나눠 계산한다. 반환값은 그리기 보간 비율.
  advance(realDt) {
    this.acc += Math.min(Math.max(realDt, 0), 0.1);    // 프레임이 밀려도 한 번에 0.1초까지만
    while (this.acc >= DT) { this.tick(); this.acc -= DT; }
    return this.acc / DT;
  }
  gaugeAt(t) { const u = (Math.max(0, t) / this.applied.gaugePeriod) % 1; return u < 0.5 ? u * 2 : 2 - u * 2; }   // 0 → 1 → 0 왕복
  tick() {
    if (this.phase === PHASE.POWER) {
      this.gauge.t += DT;
      if (this.pressing) {
        this.gauge.value = this.pressAt(this.gauge.t);
        if (this.gauge.t > this.applied.pressTime + this.applied.pressHold) this.fireSpot(this.spot, 1);     // 너무 오래 누르면 손가락이 미끄러진다
      } else this.gauge.value = this.gaugeAt(this.gauge.t);
    }
    if (this.phase === PHASE.PHYSICS || this.phase === PHASE.RESULT) {
      this.prev = this.curr;
      const wasFallen = [...this.sim.fallen];
      this.sim.step();
      this.curr = this.sim.getState().bodies;
      // 속도가 갑자기 바뀌면 부딪힌 것: 세기와 위치를 기록해 둔다
      const g = this.applied.gravity * DT;
      for (let i = 0; i < 2; i++) {
        const a = this.prev[i].lv, b = this.curr[i].lv;
        const dv = Math.hypot(b[0] - a[0], b[1] - a[1] + g, b[2] - a[2]);
        if (dv > 0.9) this.events.push({ type: 'impact', i, strength: dv, p: this.curr[i].p, down: a[1] < -0.5, other: this.sim.contact().touching });
        if (this.sim.fallen[i] && !wasFallen[i]) this.events.push({ type: 'fall', i, p: this.curr[i].p });
      }
    }
    if (this.phase === PHASE.PHYSICS) this.judge();
  }

  judge() {
    const S = this.applied, sim = this.sim, T = this.timers;
    T.phys += DT;
    // 오래 걸리면 미세한 떨림은 멈춘 것으로 봐 준다. 그래도 안 끝나면 다시 시도를 안내한다.
    const relax = T.phys > 10 ? 3 : 1;
    const slow = [0, 1].map((i) => { const v = sim.speeds(i); return v.lin < S.stableLin * relax && v.ang < S.stableAng * relax; });
    // 제자리에서 까딱거리기만 하는 것은 멈춘 것으로 본다: 1초 동안 위치(1mm)와 자세(약 2도)가 그대로이면 '제자리'
    if (T.phys - (this.poseAt ?? -9) >= 1) {
      const same = this.poseRef && this.curr.every((c, i) => { const r = this.poseRef[i]; return Math.hypot(c.p[0] - r.p[0], c.p[1] - r.p[1], c.p[2] - r.p[2]) < 0.01 && Math.abs(c.q.x * r.q.x + c.q.y * r.q.y + c.q.z * r.q.z + c.q.w * r.q.w) > 0.9994; });
      this.stillFor = same ? (this.stillFor || 0) + 1 : 0;
      this.poseRef = this.curr.map((c) => ({ p: [...c.p], q: { ...c.q } })); this.poseAt = T.phys;
    }
    if (this.stillFor >= 2) { slow[0] = slow[1] = true; }
    const fallen = sim.fallen;
    this.info = sim.contact();
    // 받침 판단이 한두 순간 끊기는 것은 이어서 본다(여러 덩어리로 된 지우개는 접촉이 깜빡일 수 있다)
    if (this.info.upper !== null) { this.lastUp = this.info.upper; this.lastUpT = T.phys; }
    else if (this.lastUp != null && T.phys - this.lastUpT < 0.12 && this.info.touching) this.info.upper = this.lastUp;

    // 1) 낙하를 먼저 본다
    if (fallen[0] || fallen[1]) {
      if (fallen[0] && fallen[1]) return this.finish(null, 'both-fell');
      const other = fallen[0] ? 1 : 0;
      T.other = slow[other] ? T.other + DT : 0;       // 남은 쪽이 책상 위에서 멈출 때까지 기다린다(같이 떨어지면 무승부)
      if (T.other >= S.stableHold) return this.finish(other, 'fell');
    } else {
      // 2) 걸침: 실제로 받쳐진 접촉이 끊기지 않고 유지되어야 한다
      const up = this.info.upper;
      if (up !== null && up === this.perchOwner && slow[0] && slow[1]) { if (T.perch === 0) this.events.push({ type: 'perch-start', i: up, p: this.curr[up].p }); T.perch += DT; }
      else { if (T.perch > 0.2) this.events.push({ type: 'perch-lost', i: this.perchOwner, p: this.curr[this.perchOwner ?? 0].p }); T.perch = 0; this.perchOwner = up; }
      if (T.perch >= S.perchHold) return this.finish(this.perchOwner, 'perch');
      // 3) 둘 다 멈췄고 걸친 것도 아니면 차례를 넘긴다
      T.stable = slow[0] && slow[1] ? T.stable + DT : 0;
      if (T.stable >= S.stableHold && up === null) return this.nextTurn();
    }
    if (T.phys > 25 && !this.stuck) { this.stuck = true; this.onEvent('stuck'); }
  }
  finish(winner, reason) {
    this.result = { winner, reason };
    this.phase = PHASE.RESULT;
    this.onEvent('result');
  }
  nextTurn() {
    this.player = 1 - this.player;
    this.turnNo = (this.turnNo || 1) + 1;
    this.phase = PHASE.AIM;
    this.gauge = { t: 0, value: 0 };
    this.timers = { phys: 0, stable: 0, perch: 0, other: 0 };
    this.perchOwner = null; this.lastUp = null; this.lastUpT = 0; this.poseRef = null; this.poseAt = -9; this.stillFor = 0;
    this.hit = 1; this.pressing = false;
    // 다음 사람의 기본 방향은 상대 쪽
    const a = this.curr[this.player].p, b = this.curr[1 - this.player].p;
    this.aim[this.player] = Math.atan2(b[2] - a[2], b[0] - a[0]);
    this.spot = this.bestSpot(); this.aim[this.player] = this.spots()[this.spot].angle;
    this.onEvent('turn');
  }
  retryTurn() {                          // 물리가 끝나지 않을 때: 이번 발사 전으로 되돌린다
    if (this.lastShot) this.restore(this.lastShot, { useSnapSettings: false });
  }

  // 화면 없이 결과만 필요할 때(검증용): 결과나 차례 넘김까지 돌린다
  runUntilSettled(maxTime = 30) {
    const start = this.player;
    let t = 0;
    while (this.phase === PHASE.PHYSICS && t < maxTime) { this.tick(); t += DT; }
    return { phase: this.phase, result: this.result, turnPassed: this.phase === PHASE.AIM && this.player !== start, time: t };
  }
}
