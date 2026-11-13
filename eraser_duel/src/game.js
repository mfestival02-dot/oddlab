// 턴 진행과 승패 판정. 화면·입력 장치와 무관하다.
import { DT, defaultSettings, initialLayout } from './config.js';
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
    this.restart();
  }

  // ---------- 초기화·복원 ----------
  _build(state, settings) {
    if (this.sim) this.sim.free();
    this.sim = new Sim(this.R, state, settings);
    this.prev = this.sim.getState().bodies; this.curr = this.prev;
    this.acc = 0;
    this.timers = { phys: 0, stable: 0, perch: 0, other: 0 };
    this.perchOwner = null;
    this.stuck = false;
    this.result = null;
    this.gauge = { t: 0, value: 0 };
    this.info = { touching: false, upper: null, normalY: 0 };
    this.launchInfo = null;
  }
  restart() {
    const L = initialLayout();
    this.player = 0;
    this.aim = [...L.aim];
    this._build({ bodies: L.bodies.map((b) => ({ p: b.p, q: yawQuat(b.yaw) })) }, { ...this.pending });
    this.phase = PHASE.AIM;
    this.onEvent('restart');
  }
  get applied() { return this.sim.S; }

  // 발사 직전 상태 한 벌: 위치·회전·속도·수면, 차례, 방향·파워, 적용할 설정
  snapshot(angle = this.aim[this.player], power = null) {
    return { kind: 'eraser-duel-shot', version: 1, state: this.sim.getState(), player: this.player, aim: [...this.aim], angle, power, settings: { ...this.pending } };
  }
  restore(snap, { useSnapSettings = true } = {}) {
    if (useSnapSettings) this.pending = { ...snap.settings };
    this.player = snap.player;
    this.aim = [...snap.aim];
    this.aim[this.player] = snap.angle;
    this._build(snap.state, { ...this.pending });
    this.phase = PHASE.AIM;
    this.onEvent('restore');
  }

  // ---------- 입력 ----------
  turn(dir, dt) {                        // 조준 중에만 방향이 바뀐다
    if (this.phase !== PHASE.AIM) return;
    this.aim[this.player] += dir * AIM_SPEED * dt;
  }
  press() {                              // 스페이스·버튼: 게이지 시작 → 튕기기
    if (this.phase === PHASE.AIM) {
      this.phase = PHASE.POWER;
      this.gauge = { t: 0, value: 0 };
      this.onEvent('gauge');
      return 'gauge';
    }
    if (this.phase === PHASE.POWER && this.gauge.t >= MIN_GAUGE_TIME) {
      this.fire(this.aim[this.player], this.gauge.value);
      return 'fire';
    }
    return null;
  }
  // 방향과 파워를 직접 지정해서 발사(일반 플레이는 press()를 거쳐 여기로 온다)
  fire(angle, power) {
    if (this.phase !== PHASE.AIM && this.phase !== PHASE.POWER) return false;
    this.aim[this.player] = angle;
    this.lastShot = this.snapshot(angle, power);
    // 설정은 발사 시점에 확정한다: 새 값이 있으면 같은 상태로 물리 세계를 다시 만든다
    this._build(this.lastShot.state, { ...this.pending });
    this.launchInfo = this.sim.launch(this.player, angle, power);
    this.shotPower = power;
    this.phase = PHASE.PHYSICS;
    this.onEvent('fire');
    return true;
  }
  replayLast() {                         // 같은 조건으로 다시 발사
    if (!this.lastShot) return false;
    const s = this.lastShot;
    this.restore(s);
    return this.fire(s.angle, s.power);
  }

  // ---------- 진행 ----------
  // 실제 흐른 시간을 받아 고정 간격으로 나눠 계산한다. 반환값은 그리기 보간 비율.
  advance(realDt) {
    this.acc += Math.min(Math.max(realDt, 0), 0.1);    // 프레임이 밀려도 한 번에 0.1초까지만
    while (this.acc >= DT) { this.tick(); this.acc -= DT; }
    return this.acc / DT;
  }
  tick() {
    if (this.phase === PHASE.POWER) {
      this.gauge.t += DT;
      const u = (this.gauge.t / this.applied.gaugePeriod) % 1;
      this.gauge.value = u < 0.5 ? u * 2 : 2 - u * 2;   // 0 → 1 → 0 왕복
    }
    if (this.phase === PHASE.PHYSICS || this.phase === PHASE.RESULT) {
      this.prev = this.curr;
      this.sim.step();
      this.curr = this.sim.getState().bodies;
    }
    if (this.phase === PHASE.PHYSICS) this.judge();
  }

  judge() {
    const S = this.applied, sim = this.sim, T = this.timers;
    T.phys += DT;
    // 오래 걸리면 미세한 떨림은 멈춘 것으로 봐 준다. 그래도 안 끝나면 다시 시도를 안내한다.
    const relax = T.phys > 10 ? 3 : 1;
    const slow = [0, 1].map((i) => { const v = sim.speeds(i); return v.lin < S.stableLin * relax && v.ang < S.stableAng * relax; });
    const fallen = sim.fallen;
    this.info = sim.contact();

    // 1) 낙하를 먼저 본다
    if (fallen[0] || fallen[1]) {
      if (fallen[0] && fallen[1]) return this.finish(null, 'both-fell');
      const other = fallen[0] ? 1 : 0;
      T.other = slow[other] ? T.other + DT : 0;       // 남은 쪽이 책상 위에서 멈출 때까지 기다린다(같이 떨어지면 무승부)
      if (T.other >= S.stableHold) return this.finish(other, 'fell');
    } else {
      // 2) 걸침: 실제로 받쳐진 접촉이 끊기지 않고 유지되어야 한다
      const up = this.info.upper;
      if (up !== null && up === this.perchOwner && slow[0] && slow[1]) T.perch += DT;
      else { T.perch = 0; this.perchOwner = up; }
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
    this.phase = PHASE.AIM;
    this.gauge = { t: 0, value: 0 };
    this.timers = { phys: 0, stable: 0, perch: 0, other: 0 };
    this.perchOwner = null;
    // 다음 사람의 기본 방향은 상대 쪽
    const a = this.curr[this.player].p, b = this.curr[1 - this.player].p;
    this.aim[this.player] = Math.atan2(b[2] - a[2], b[0] - a[0]);
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
