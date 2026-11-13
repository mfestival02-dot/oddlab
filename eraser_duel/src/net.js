// 온라인: 서버 연결과, 서버가 보내 준 경기 상태를 로컬 게임과 같은 모양으로 보여 주는 대리 객체.
// 여기서는 물리를 계산하지 않는다. 입력만 보내고, 받은 상태 사이를 보간해서 그린다.
import { PHASE } from './game.js';
import { yawQuat, spotsFor } from './sim.js';

const TOKEN_KEY = 'eraser-duel-token';
export class Net {
  constructor() { this.ws = null; this.status = 'off'; this.h = {}; this.want = false; this.tries = 0; this.name = ''; this.rtt = 0; this.onStatus = () => {}; }
  // 서버 주소: 기본은 지금 페이지를 내준 곳. ?server=wss://… 로 바꿀 수 있다. 파일로 직접 연 경우에는 온라인을 쓸 수 없다.
  url() {
    const q = new URLSearchParams(location.search).get('server');
    if (q) return q;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  }
  on(type, fn) { this.h[type] = fn; }
  set(status) { this.status = status; this.onStatus(status); }
  open(name) {
    this.name = name; this.want = true;
    const url = this.url();
    if (!url) { this.set('unavailable'); return; }
    if (this.ws && this.ws.readyState <= 1) return;
    this.set(this.tries ? 'reconnecting' : 'connecting');
    let token = null; try { token = sessionStorage.getItem(TOKEN_KEY); } catch { /* 무시 */ }
    const ws = this.ws = new WebSocket(url);
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', name, token })); };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome') { this.tries = 0; try { sessionStorage.setItem(TOKEN_KEY, m.token); } catch { /* 무시 */ } this.set('online'); }
      else if (m.t === 'sping') this.send({ t: 'spong', s: m.s });
      else if (m.t === 'pong') this.rtt = performance.now() - m.c;
      if (this.h[m.t]) this.h[m.t](m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.want) { this.set('off'); return; }
      this.set('reconnecting');                              // 잠깐 끊긴 것이면 같은 토큰으로 다시 붙는다
      this.timer = setTimeout(() => this.open(this.name), Math.min(5000, 400 * 2 ** this.tries++));
    };
    ws.onerror = () => {};
    clearInterval(this.pinger);
    this.pinger = setInterval(() => this.send({ t: 'ping', c: performance.now() }), 3000);
  }
  close() { this.want = false; clearTimeout(this.timer); clearInterval(this.pinger); if (this.ws) this.ws.close(); this.ws = null; this.set('off'); }
  send(m) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(m)); return true; } return false; }
}

const AIM_SPEED = 1.5, MIN_GAUGE = 0.15;
export class NetGame {
  constructor(net) {
    this.online = true; this.net = net; this.onEvent = () => {}; this.events = [];
    this.types = ['normal', 'normal']; this.names = ['', '']; this.mySeat = 0; this.matchId = 0;
    this.applied = { perchHold: 0.8, stableHold: 0.45, pressTime: 1.3, pressHold: 0.6 }; this.pending = this.applied;
    this.layoutMode = 'match';
    this.reset();
  }
  reset() {
    this.phase = PHASE.AIM; this.player = 0; this.turnNo = 0; this.seqNo = 0;
    this.aim = [0, Math.PI]; this.hit = 1; this.spot = 0; this.pressing = false; this.gauge = { t: 0, value: 0, t0: 0, at: 0 };
    this.timers = { perch: 0, stable: 0, phys: 0, other: 0 }; this.info = { upper: null, touching: false, normalY: 0 };
    this.result = null; this.shotPower = 0; this.stuck = false; this.lastShot = null; this.launchInfo = null; this.turnLeft = 0;
    const b = (x, yaw) => ({ p: [x, 0.052, 0], q: yawQuat(yaw), lv: [0, 0, 0], av: [0, 0, 0] });
    this.buf = []; this.prev = this.curr = [b(-2, 0), b(2, Math.PI)];
    this.sim = { fallen: [false, false], speeds: (i) => ({ lin: Math.hypot(...this.curr[i].lv), ang: 0 }), S: this.applied };
    this.busy = false; this.aimDirty = false; this.aimSentAt = 0; this.events.length = 0;
  }
  get viewSeat() { return this.mySeat; }                       // 카메라는 늘 내 자리에서 본다
  canAct() { return !this.result && this.player === this.mySeat && (this.phase === PHASE.AIM || this.phase === PHASE.POWER); }
  pressAt(t) { return Math.min(1, Math.max(0, t) / this.applied.pressTime); }
  spots() { const b = this.curr[this.player]; return spotsFor(this.types[this.player], b.p, b.q); }

  onMatch(m, seat) {
    this.reset();
    this.matchId = m.matchId; this.types = [...m.types]; this.names = [...m.names]; this.mySeat = seat;
    Object.assign(this.applied, m.settings);
    this.onEvent('restart');
  }
  onState(s) {
    if (s.m !== this.matchId || s.n <= this.seqNo) return;      // 지난 경기나 순서가 뒤바뀐 상태는 버린다
    this.seqNo = s.n;
    const bodies = s.b.map((a) => ({ p: [a[0], a[1], a[2]], q: { x: a[3], y: a[4], z: a[5], w: a[6] }, lv: [a[7], a[8], a[9]], av: [0, 0, 0] }));
    this.sim.fallen = s.b.map((a) => !!a[10]);
    this.buf.push({ at: performance.now(), bodies }); if (this.buf.length > 3) this.buf.shift();
    const wasTurn = this.turnNo, mineAiming = this.canAct() && this.phase === PHASE.AIM && s.ph === PHASE.AIM && s.pl === this.mySeat;
    this.player = s.pl; this.turnNo = s.turn;
    if (!s.res) this.phase = s.ph;
    if (!(mineAiming && this.spotDirty)) { this.spot = s.spot; this.aim = [...s.aim]; }      // 내가 방금 고른 자리가 서버에 닿기 전이면 내 손이 우선
    this.pressing = s.ph === PHASE.POWER;
    this.gauge.t0 = s.gt; this.gauge.at = performance.now();
    this.shotPower = s.sp; this.timers.perch = s.perch; this.info.upper = s.up; this.info.touching = s.up !== null; this.turnLeft = s.left;
    if (s.ph !== PHASE.AIM && s.ph !== PHASE.POWER) this.busy = false; else if (s.ph === PHASE.POWER && this.busy === 'down') this.busy = false;
    for (const e of s.ev || []) { this.events.push(e); if (e.type === 'launch') this.lastShot = { player: e.i }; }
    if (wasTurn && s.turn !== wasTurn && !s.res) { this.busy = false; this.onEvent('turn'); }
    if (s.res && !this.result) { this.result = s.res; this.phase = PHASE.RESULT; this.onEvent('result'); }
  }
  // ---- 로컬 게임과 같은 조작 창구 ----
  selectSpot(i) {
    if (!(this.canAct() && this.phase === PHASE.AIM && !this.busy)) return;
    const list = this.spots(), n = list.length; this.spot = ((i % n) + n) % n; this.aim[this.mySeat] = list[this.spot].angle;
    this.spotDirty = true; this.net.send({ t: 'spot', turn: this.turnNo, s: this.spot });
    setTimeout(() => { this.spotDirty = false; }, 400);
  }
  cycleSpot(dir) { this.selectSpot(this.spot + dir); }
  pressDown() {
    if (!this.canAct() || this.busy || this.phase !== PHASE.AIM) return false;
    this.net.send({ t: 'spot', turn: this.turnNo, s: this.spot });
    this.net.send({ t: 'down', turn: this.turnNo, id: Date.now() }); this.busy = 'down';
    return true;
  }
  pressUp() {
    if (!this.canAct() || this.phase !== PHASE.POWER || this.busy === 'up') return false;
    if (this.gauge.t < MIN_GAUGE) { this.wantUp = true; return false; }                 // 너무 빨리 뗐으면 최소 시간이 되자마자 뗀 것으로 보낸다
    this.net.send({ t: 'up', turn: this.turnNo, id: Date.now(), gt: this.gauge.t }); this.busy = 'up'; this.wantUp = false;    // 내 화면에서 잰 누른 시간을 함께 보낸다
    return true;
  }
  turn() {} setHit() {} press() { return null; }
  advance() {
    const now = performance.now(), n = this.buf.length;
    let alpha = 1;
    if (n >= 2) { const a = this.buf[n - 2], b = this.buf[n - 1]; this.prev = a.bodies; this.curr = b.bodies; alpha = Math.min(1, Math.max(0, (now - b.at) / Math.max(16, b.at - a.at))); }
    else if (n === 1) this.prev = this.curr = this.buf[0].bodies;
    if (this.phase === PHASE.POWER) { this.gauge.t = this.gauge.t0 + (now - this.gauge.at) / 1000; this.gauge.value = this.pressAt(this.gauge.t); if (this.wantUp) this.pressUp(); }
    else this.wantUp = false;
    return alpha;
  }
  // 온라인에서는 쓸 수 없는 것들(서버에도 받는 곳이 없다)
  fire() { return false; } fireSpot() { return false; } restart() {} restore() {} retryTurn() {} replayLast() { return false; } snapshot() { return null; }
}
