// 지우개 따먹기 온라인 서버. 경기 상태(물리·차례·승패)는 여기서만 정하고, 브라우저는 입력만 보내고 받은 상태를 그린다.
// 실행: node server/index.mjs   (환경 변수: PORT, HOST, ALLOWED_ORIGINS, DEV=1)
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import RAPIER from '@dimforge/rapier3d-compat';
import { Game, PHASE } from '../src/game.js';
import { TYPES, defaultSettings } from '../src/config.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 5173), HOST = process.env.HOST || '0.0.0.0';
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const LIMITS = {
  graceMs: Number(process.env.GRACE_MS || 30000),        // 끊긴 사람을 기다려 주는 시간
  turnMs: Number(process.env.TURN_MS || 60000),          // 한 차례에 쓸 수 있는 시간
  idleRoomMs: Number(process.env.IDLE_ROOM_MS || 15 * 60000),
  maxRooms: 200, maxComp: 0.25,                           // 게이지 지연 보정 한도(초)
};
const MIN_GAUGE = 0.15;
await RAPIER.init();

const players = new Map();   // token → player
const rooms = new Map();     // code → room
const now = () => Date.now();
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const code4 = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let c; do { c = Array.from(crypto.randomBytes(5), (b) => A[b % A.length]).join(''); } while (rooms.has(c)); return c; };
const send = (p, msg) => { if (p && p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg)); };
const fail = (p, code, text) => send(p, { t: 'error', code, text });

function roomInfo(r) {
  return { t: 'room', code: r.code, name: r.name, public: r.public, phase: r.phase, matchId: r.matchId,
    seats: r.seats.map((p, i) => (p ? { name: p.name, ready: r.ready[i], connected: !!p.ws, type: r.types[i], rematch: r.rematch[i], graceLeft: p.dcAt ? Math.max(0, LIMITS.graceMs - (now() - p.dcAt)) : 0 } : null)) };
}
const cast = (r, msg) => r.seats.forEach((p) => send(p, msg));
const castRoom = (r) => r.seats.forEach((p, i) => send(p, { ...roomInfo(r), you: i }));
function publicList() {
  return [...rooms.values()].filter((r) => r.public && r.phase === 'lobby').map((r) => ({ code: r.code, name: r.name, count: r.seats.filter(Boolean).length, waiting: r.seats.filter(Boolean).length < 2 })).slice(0, 50);
}

function leaveRoom(p, why) {
  const r = p.room; if (!r) return;
  const seat = r.seats.indexOf(p);
  p.room = null; p.dcAt = 0;
  if (seat < 0) return;
  if (r.phase === 'playing') endMatch(r, 1 - seat, why === 'timeout' ? 'forfeit-timeout' : 'forfeit-left');
  r.seats[seat] = null; r.ready[seat] = false; r.rematch = [false, false];
  if (!r.seats[0] && !r.seats[1]) { destroyRoom(r); return; }
  castRoom(r);
}
function destroyRoom(r) { if (r.game) { r.game.sim.free(); r.game = null; } rooms.delete(r.code); }

function startMatch(r) {
  if (r.game) r.game.sim.free();
  const g = r.game = new Game(RAPIER);
  g.pending = defaultSettings();                 // 온라인 설정은 서버가 정한 기본값만 쓴다
  g.layoutMode = 'match'; g.types = [...r.types];
  g.restart();
  r.matchId++; r.seq = 0; r.phase = 'playing'; r.result = null; r.rematch = [false, false];
  if (r.matchId % 2 === 0) { g.player = 1; }      // 판마다 선공을 바꾼다
  r.turnAt = now(); r.lastTurnNo = g.turnNo; r.evq = []; r.loops = 0; r.overAt = 0;
  cast(r, { t: 'match', matchId: r.matchId, types: g.types, settings: { perchHold: g.applied.perchHold, gaugePeriod: g.applied.gaugePeriod, stableHold: g.applied.stableHold }, names: r.seats.map((p) => p.name) });
  castRoom(r);
  pushState(r, true);
}
function endMatch(r, winner, reason) {
  if (r.phase !== 'playing') return;
  r.phase = 'over'; r.result = { winner, reason }; r.overAt = now();
  if (r.game && r.game.phase !== PHASE.RESULT) { r.game.result = r.result; r.game.phase = PHASE.RESULT; }
  pushState(r, true); castRoom(r);
}
function stateOf(r, keepEvents = false) {
  const g = r.game;
  const b = g.curr.map((c, i) => [...c.p, c.q.x, c.q.y, c.q.z, c.q.w, ...c.lv, g.sim.fallen[i] ? 1 : 0].map((v) => Math.round(v * 1e4) / 1e4));
  const ev = keepEvents ? [] : r.evq; if (!keepEvents) r.evq = [];
  return { t: 'state', m: r.matchId, n: ++r.seq, st: now(), turn: g.turnNo, ph: g.phase, pl: g.player, aim: g.aim, hit: g.hit, gt: g.gauge.t, sp: g.shotPower ?? 0,
    b, perch: g.timers.perch, up: g.info.upper, ev, res: r.result, left: Math.max(0, LIMITS.turnMs - (now() - r.turnAt)) };
}
function pushState(r) { if (r.game) cast(r, stateOf(r)); }

// ---------- 경기 진행: 물리는 고정 간격, 전송은 그보다 드물게 ----------
let lastLoop = now();
setInterval(() => {
  const t = now(), dt = Math.min(0.1, (t - lastLoop) / 1000); lastLoop = t;
  for (const r of rooms.values()) {
    const g = r.game; if (!g || r.phase === 'lobby') continue;
    const before = g.phase;
    g.advance(dt);
    for (const e of g.events) r.evq.push({ type: e.type, i: e.i, p: e.p.map((v) => Math.round(v * 1e3) / 1e3), strength: e.strength, power: e.power, other: e.other });
    g.events.length = 0;
    if (r.phase === 'playing') {
      if (g.phase === PHASE.RESULT && g.result) endMatch(r, g.result.winner, g.result.reason);
      else if (g.turnNo !== r.lastTurnNo) { r.lastTurnNo = g.turnNo; r.turnAt = t; pushState(r); }
      else if ((g.phase === PHASE.AIM || g.phase === PHASE.POWER) && t - r.turnAt > LIMITS.turnMs && r.seats[g.player] && r.seats[g.player].ws) endMatch(r, 1 - g.player, 'forfeit-idle');
      else if (g.stuck) { g.retryTurn(); r.turnAt = t; pushState(r); }
    }
    r.loops++;
    const moving = g.phase === PHASE.PHYSICS || g.phase === PHASE.POWER || (r.phase === 'over' && t - r.overAt < 4000);
    if (g.phase !== before || (moving && r.loops % 2 === 0) || r.loops % 12 === 0) pushState(r);
  }
}, 1000 / 60);

// 끊긴 사람 유예, 방치된 방 정리, 지연 측정
setInterval(() => {
  const t = now();
  for (const p of players.values()) {
    if (p.ws) { send(p, { t: 'sping', s: t }); continue; }
    if (p.dcAt && t - p.dcAt > LIMITS.graceMs) { leaveRoom(p, 'timeout'); players.delete(p.token); }
    else if (!p.room && t - p.seen > 60000) players.delete(p.token);
  }
  for (const r of rooms.values()) {
    const any = r.seats.some((p) => p && p.ws);
    if (!r.seats[0] && !r.seats[1]) destroyRoom(r);
    else if (!any && t - r.active > 60000 && r.phase !== 'playing') { r.seats.forEach((p) => { if (p) { p.room = null; } }); destroyRoom(r); }
    else if (t - r.active > LIMITS.idleRoomMs && r.phase !== 'playing') { cast(r, { t: 'closed', why: 'idle' }); r.seats.forEach((p) => { if (p) p.room = null; }); destroyRoom(r); }
    else if (r.phase !== 'playing') castRoom(r);          // 유예 시간 표시 갱신
  }
}, 2000);

// ---------- 메시지 처리 ----------
const num = (v) => typeof v === 'number' && Number.isFinite(v);
function myTurn(p, m) {            // 방의 실제 플레이어이고, 지금 차례이며, 턴 번호가 맞는가
  const r = p.room; if (!r || r.phase !== 'playing' || !r.game) return fail(p, 'not-playing', '진행 중인 경기가 없습니다.'), null;
  const seat = r.seats.indexOf(p); if (seat < 0) return fail(p, 'not-member', '이 방의 플레이어가 아닙니다.'), null;
  if (r.game.player !== seat) return fail(p, 'not-your-turn', '상대 차례입니다.'), null;
  if (m.turn !== r.game.turnNo) return fail(p, 'stale-turn', '이미 지난 차례의 요청입니다.'), null;
  return { r, g: r.game, seat };
}
const handlers = {
  list(p) { send(p, { t: 'rooms', rooms: publicList() }); },
  create(p, m) {
    if (p.room) return fail(p, 'in-room', '이미 방에 들어가 있습니다.');
    if (rooms.size >= LIMITS.maxRooms) return fail(p, 'busy', '방이 너무 많습니다. 잠시 뒤에 다시 해 주세요.');
    const code = code4();
    const r = { code, name: clean(m.name, 20) || `${p.name}의 방`, public: !!m.public, seats: [p, null], ready: [false, false], types: ['normal', 'normal'], rematch: [false, false], phase: 'lobby', matchId: 0, game: null, active: now(), evq: [] };
    rooms.set(code, r); p.room = r; castRoom(r);
  },
  join(p, m) {
    if (p.room) return fail(p, 'in-room', '이미 방에 들어가 있습니다.');
    const r = rooms.get(clean(m.code, 8).toUpperCase());
    if (!r) return fail(p, 'no-room', '없는 방이거나 이미 끝난 방입니다.');
    if (r.phase !== 'lobby') return fail(p, 'in-progress', '이미 경기를 시작한 방입니다.');
    const seat = r.seats.indexOf(null);
    if (seat < 0) return fail(p, 'full', '방이 가득 찼습니다(2명).');
    r.seats[seat] = p; r.ready[seat] = false; p.room = r; r.active = now(); castRoom(r);
  },
  leave(p) { leaveRoom(p, 'left'); send(p, { t: 'left' }); },
  ready(p, m) {
    const r = p.room; if (!r || r.phase !== 'lobby') return fail(p, 'bad-phase', '대기 중인 방이 아닙니다.');
    const seat = r.seats.indexOf(p); r.ready[seat] = !!m.ready; r.active = now();
    if (r.seats[0] && r.seats[1] && r.ready[0] && r.ready[1] && r.seats[0].ws && r.seats[1].ws) startMatch(r); else castRoom(r);
  },
  type(p, m) {
    const r = p.room; if (!r || r.phase !== 'lobby') return fail(p, 'bad-phase', '대기 중일 때만 지우개를 바꿀 수 있습니다.');
    if (!Object.hasOwn(TYPES, m.type)) return fail(p, 'bad-type', '없는 지우개입니다.');
    const seat = r.seats.indexOf(p); r.types[seat] = m.type; r.ready[seat] = false; castRoom(r);
  },
  aim(p, m) {
    const c = myTurn(p, m); if (!c) return;
    if (c.g.phase !== PHASE.AIM) return;                                    // 게이지가 움직이면 방향은 고정
    if (!num(m.a) || Math.abs(m.a) > 1e4 || !Number.isInteger(m.h) || m.h < 0 || m.h > 2) return fail(p, 'bad-value', '방향 값이 올바르지 않습니다.');
    c.g.aim[c.seat] = m.a; c.g.setHit(m.h);
  },
  gaugeStart(p, m) {
    const c = myTurn(p, m); if (!c) return;
    if (!Number.isInteger(m.id) || m.id <= p.lastId) return fail(p, 'duplicate', '이미 처리한 요청입니다.');
    if (c.g.phase !== PHASE.AIM) return fail(p, 'bad-phase', '지금은 게이지를 시작할 수 없습니다.');
    p.lastId = m.id; c.g.press(); c.r.active = now(); pushState(c.r);
  },
  gaugeStop(p, m) {
    const c = myTurn(p, m); if (!c) return;
    if (!Number.isInteger(m.id) || m.id <= p.lastId) return fail(p, 'duplicate', '이미 처리한 요청입니다.');
    if (c.g.phase !== PHASE.POWER) return fail(p, 'bad-phase', '게이지가 움직이고 있지 않습니다.');
    // 파워는 서버의 게이지 시간으로 정한다. 다만 누른 순간과 도착 사이의 지연만큼은(측정한 왕복 시간의 절반 + 여유, 최대 0.25초) 되돌려 준다.
    const gt = c.g.gauge.t, win = Math.min(LIMITS.maxComp, Math.max(0.06, (p.rtt || 0) / 2000 + 0.06));
    const t = num(m.gt) ? Math.min(gt, Math.max(gt - win, m.gt)) : gt;
    if (t < MIN_GAUGE) return fail(p, 'too-early', '게이지를 시작하자마자는 튕길 수 없습니다.');
    p.lastId = m.id;
    c.g.fire(c.g.aim[c.seat], c.g.gaugeAt(t), c.g.hit);
    c.r.active = now(); pushState(c.r);
  },
  rematch(p, m) {
    const r = p.room; if (!r || r.phase !== 'over') return fail(p, 'bad-phase', '끝난 경기가 없습니다.');
    const seat = r.seats.indexOf(p); r.rematch[seat] = !!m.yes; r.active = now();
    if (r.seats[0] && r.seats[1] && r.rematch[0] && r.rematch[1]) startMatch(r); else castRoom(r);
  },
  spong(p, m) { if (num(m.s)) { const v = now() - m.s; if (v >= 0 && v < 5000) p.rtt = p.rtt ? p.rtt * 0.7 + v * 0.3 : v; } },
  ping(p, m) { send(p, { t: 'pong', c: m.c, st: now() }); },
};

// ---------- HTTP와 WebSocket ----------
async function page() {
  if (process.env.DEV || !fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    const { spawnSync } = await import('child_process');
    spawnSync(process.execPath, ['build.mjs'], { cwd: ROOT, stdio: 'ignore' });
  }
  return fs.readFileSync(path.join(ROOT, 'dist', 'index.html'));
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, uptime: Math.round(process.uptime()), rooms: rooms.size, playing: [...rooms.values()].filter((r) => r.phase === 'playing').length, players: [...players.values()].filter((p) => p.ws).length }));
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    try { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return res.end(await page()); }
    catch (e) { res.writeHead(500); return res.end('build failed: ' + e.message); }
  }
  res.writeHead(404); res.end('not found');
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (req, sock, head) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/ws' || (ORIGINS.length && !ORIGINS.includes(req.headers.origin))) { sock.destroy(); return; }
  wss.handleUpgrade(req, sock, head, (ws) => wss.emit('connection', ws));
});
wss.on('connection', (ws) => {
  let p = null, count = 0, windowAt = now();
  ws.on('message', (raw) => {
    const t = now(); if (t - windowAt > 1000) { windowAt = t; count = 0; }
    if (++count > 80) return;                                    // 초당 80개까지만 받는다
    let m; try { m = JSON.parse(raw.toString()); } catch { return; }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    if (m.t === 'hello') {
      if (p) return;
      const old = typeof m.token === 'string' ? players.get(m.token) : null;     // 재접속은 처음 받은 비밀 토큰으로만
      if (old) { if (old.ws && old.ws !== ws) { try { old.ws.close(4000, 'replaced'); } catch { /* 무시 */ } } p = old; }
      else { p = { token: crypto.randomBytes(16).toString('hex'), name: '', room: null, lastId: 0, rtt: 0 }; players.set(p.token, p); }
      p.ws = ws; p.dcAt = 0; p.seen = t;
      if (!old || !p.room) p.name = clean(m.name, 12) || '손님';
      send(p, { t: 'welcome', token: p.token, name: p.name, resumed: !!(old && old.room), st: t });
      if (p.room) { const r = p.room; castRoom(r); if (r.game && r.phase !== 'lobby') { send(p, { t: 'match', matchId: r.matchId, types: r.game.types, settings: { perchHold: r.game.applied.perchHold, gaugePeriod: r.game.applied.gaugePeriod, stableHold: r.game.applied.stableHold }, names: r.seats.map((q) => (q ? q.name : '')), resumed: true }); send(p, stateOf(r, true)); } }
      else send(p, { t: 'rooms', rooms: publicList() });
      return;
    }
    if (!p) return;
    p.seen = t;
    if (m.t === 'name') { if (!p.room) p.name = clean(m.name, 12) || '손님'; return; }
    const h = handlers[m.t];
    if (h) { try { h(p, m); } catch (e) { console.error('handler', m.t, e); fail(p, 'server', '서버에서 문제가 생겼습니다.'); } }
  });
  ws.on('close', () => {
    if (!p || p.ws !== ws) return;
    p.ws = null; p.dcAt = now();                                 // 자리는 유예 시간 동안 남겨 둔다
    if (p.room) castRoom(p.room); else players.delete(p.token);
  });
  ws.on('error', () => {});
});
function shutdown() {
  for (const p of players.values()) send(p, { t: 'closed', why: 'server' });
  wss.clients.forEach((c) => c.close(1001, 'server closing'));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
server.listen(PORT, HOST, () => {
  console.log(`지우개 따먹기 서버: http://localhost:${PORT}  (상태 확인 /health)`);
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`  같은 공유기 안의 다른 기기: http://${a.address}:${PORT}`);
});
