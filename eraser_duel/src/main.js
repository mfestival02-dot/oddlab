import RAPIER from '@dimforge/rapier3d-compat';
import { Game, PHASE } from './game.js';
import { View, PLAYER } from './view.js';
import { UI } from './ui.js';
import { Sfx } from './sound.js';
import { Planner } from './ai.js';
import { TYPES } from './config.js';
import { Net, NetGame } from './net.js';
import { Lobby } from './lobby.js';
import { loadModels } from './models.js';

async function main() {
  await RAPIER.init();
  await loadModels();
  try { await Promise.all([document.fonts.load('700 40px Gaegu', '지우개'), document.fonts.load('400 40px Gaegu', '지우개')]); } catch (e) { /* 글꼴이 없으면 기본 글꼴로 그린다 */ }
  const localGame = new Game(RAPIER);
  localGame.layoutMode = 'match';          // 일반 경기는 멀리 떨어져 시작한다(개발자 패널의 프리셋은 가까운 검증 배치)
  let game = localGame;
  const view = new View(document.getElementById('app'));
  const sfx = new Sfx();
  const fx = view.fx;
  let ui = null;
  const cpuTurn = () => (ui.mode === 'solo' && game.player === 1) || (game.online && !game.canAct());

  // ---------- 입력: 길게 눌러도 한 번, 차례가 바뀌면 눌린 상태를 버린다 ----------
  const input = {
    holding: false, spaceDown: false, launches: 0,
    clear() { this.holding = false; },
    locked() { return !ui.started || cpuTurn(); },                 // 메뉴 중이거나 컴퓨터 차례면 조작을 받지 않는다
    down() {                                   // 꾹 누르기 시작
      if (this.locked()) return false;
      sfx.init();
      const ok = game.pressDown();
      if (ok) { sfx.click(); this.holding = true; }
      return ok;
    },
    up() {                                     // 떼면 튕긴다
      if (!this.holding) return false;
      this.holding = false;
      if (!ui.started) return false;
      const ok = game.pressUp();
      if (ok) this.launches++;
      return ok;
    },
    cycle(dir) { if (!this.locked() && game.phase === PHASE.AIM) { game.cycleSpot(dir); sfx.click(); } },
    cycleTo(i) { if (!this.locked() && game.phase === PHASE.AIM) game.selectSpot(i); },
    restart() { if (!ui.started || game.online) return; game.restart(); this.clear(); view.resetCamera(); },
  };
  const slow = { t: 0, used: false, scale: 1 };
  const cpu = { state: 'idle', t: 0, planner: null, shot: null, prevGauge: 0 };
  let popAt = 0, heartAt = 0;

  const onGameEvent = (type) => {
    if (type === 'turn' || type === 'restart' || type === 'restore' || type === 'result') input.clear();
    if (type === 'restart' || type === 'restore') { slow.t = 0; slow.used = false; cpu.state = 'idle'; view.hop = null; view.cine.fall = null; }
    if (!ui || !ui.started) return;
    const turnText = () => (game.online ? (game.canAct() ? '내 차례!' : `${game.names[game.player] || '상대'} 차례!`) : cpuTurn() ? '컴퓨터 차례!' : `${PLAYER[game.player].name} 차례!`);
    if (type === 'turn') { ui.banner(turnText()); sfx.scratch(); }
    if (type === 'restart') { if (game.online) setTimeout(() => ui.banner(turnText(), '온라인 한 판'), 60); else ui.banner('1P 차례!', '한 판 더'); sfx.scratch(); }
    if (type === 'result') {
      const { winner, reason } = game.result;
      if (winner !== null) {
        view.hop = { i: winner, t: 0 };
        const p = game.curr[winner].p;
        setTimeout(() => { fx.confetti([p[0], Math.max(0, p[1]), p[2]], reason === 'perch' ? 110 : 60); sfx.pop(); }, 260);
      }
      if (reason === 'perch') { slow.t = 0.5; view.zoomIn(1.3); view.shake(0.35); }
    }
  };

  const typing = (e) => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); };
  addEventListener('keydown', (e) => {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;       // 패널에 값을 넣는 동안에는 단축키를 쓰지 않는다
    if (!ui.started) {                                                  // 표지·지우개 고르기 화면
      if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); input.spaceDown = true; ui.advanceMenu(); }
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (e.repeat || input.spaceDown) return;                          // 길게 누르면 한 번의 '꾹'이다
      input.spaceDown = true;
      input.down();
    } else if (!e.repeat) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { input.cycle(-1); e.preventDefault(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { input.cycle(1); e.preventDefault(); }
      else if (e.code === 'KeyR') ui.rematch();
    }
  });
  addEventListener('keyup', (e) => { if (e.code === 'Space') { if (!typing(e)) e.preventDefault(); input.spaceDown = false; input.up(); } });
  // 버튼을 마우스로 누른 뒤 초점이 남아 Space가 그 버튼을 다시 누르는 일을 막는다
  addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b && !b.closest('#dev')) b.blur(); });
  addEventListener('blur', () => { input.spaceDown = false; input.up(); });

  localGame.onEvent = onGameEvent;
  ui = new UI(game, view, input, sfx);
  // 온라인: 서버가 보내는 상태를 받아 그리는 대리 게임으로 바꿔 끼운다
  const net = new Net(), netGame = new NetGame(net);
  netGame.onEvent = onGameEvent;
  const useGame = (g) => { game = g; ui.game = g; view.resetCamera(); input.clear(); slow.t = 0; };
  ui.lobby = new Lobby(net, netGame, sfx, {
    start(m, seat) { ui.mode = 'online'; ui.started = true; useGame(netGame); netGame.onMatch(m, seat); document.getElementById('pick').hidden = true; document.getElementById('start').hidden = true; },
    exit() { ui.started = false; ui.mode = 'versus'; useGame(localGame); },
    view,
    notice(t) { ui.banner('알림', t); },
  });
  if (new URLSearchParams(location.search).get('room')) ui.lobby.open();          // 초대 링크로 들어온 경우

  // ---------- 컴퓨터 차례: 방향을 재고 → 게이지를 보다가 → 튕긴다 ----------
  function driveCpu(dt) {
    if (!ui.started || game.online || !cpuTurn()) { cpu.state = 'idle'; return; }
    if (game.phase === PHASE.AIM) {
      if (cpu.state === 'idle') { cpu.planner = new Planner(RAPIER, game, 0.4); cpu.state = 'think'; cpu.t = 0; cpu.look = 0; }
      cpu.t += dt;
      if (cpu.state === 'think') {
        const done = cpu.planner.step(5);
        if (cpu.t > cpu.look) { cpu.look = cpu.t + 0.35; game.selectSpot(done ? cpu.planner.shot.spot : game.spot + 1); }     // 이 자리 저 자리 재 본다
        if (done && cpu.t > 1.4) { cpu.shot = cpu.planner.shot; game.selectSpot(cpu.shot.spot); cpu.state = 'press'; cpu.t = 0; }
      } else if (cpu.state === 'press' && cpu.t > 0.35) { game.pressDown(); sfx.click(); cpu.state = 'hold'; }
    } else if (game.phase === PHASE.POWER && cpu.state === 'hold') {
      if (game.gauge.value >= cpu.shot.power) { game.fireSpot(cpu.shot.spot, cpu.shot.power); cpu.state = 'idle'; }
    }
  }

  // ---------- 사건별 연출(그리기와 소리만. 물리 결과에는 손대지 않는다) ----------
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function playEvents(now) {
    for (const e of game.events) {
      if (!ui.started) break;
      if (e.type === 'launch') {
        const a = game.aim[e.i];
        view.kick(e.i, 0.55); view.shake(0.1 + e.power * 0.22);
        fx.dust(e.p, 6 + Math.round(e.power * 6), 0.7 + e.power, [Math.cos(a), 0, Math.sin(a)]);
        sfx.flick(e.power);
        slow.used = false;
      } else if (e.type === 'impact') {
        const s = e.strength, onDesk = e.p[1] > -0.3;
        view.kick(e.i, Math.min(0.5, s * 0.05));
        if (s > 1.8) { sfx.thud(Math.min(1, s / 9)); view.shake(Math.min(0.42, s * 0.032)); fx.dust(e.p, Math.min(8, 2 + Math.floor(s)), Math.min(1.4, s * 0.16)); }
        if (s > 3.2) fx.crumbs(e.p, Math.min(7, Math.floor(s)), PLAYER[e.i].rubber);
        if (e.other && s > 2.6 && onDesk && now - popAt > 450) { popAt = now; fx.stars(e.p, 6); ui.pop(pick(['쾅!', '퍽!', '탁!']), e.p, '#d9402f'); }
      } else if (e.type === 'perch-start') {
        ui.pop('올라탔다?!', e.p, PLAYER[e.i].css);
      } else if (e.type === 'perch-lost') {
        ui.pop('아깝다!', e.p, '#45413d');
      } else if (e.type === 'fall') {
        ui.pop('앗!!', [e.p[0] * 0.92, 0.1, e.p[2] * 0.92], '#d9402f');
        sfx.fall(); view.cine.fall = { i: e.i, t: 0 }; slow.t = Math.max(slow.t, 0.35);
      }
    }
    game.events.length = 0;
  }

  // ---------- 루프: 물리는 고정 간격, 그리기는 그 사이를 보간 ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  function slerp(a, b, t) {
    let d = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w, s = 1;
    if (d < 0) { d = -d; s = -1; }
    let ka = 1 - t, kb = t * s;
    if (d < 0.9995) { const th = Math.acos(d), sn = Math.sin(th); ka = Math.sin((1 - t) * th) / sn; kb = (Math.sin(t * th) / sn) * s; }
    const q = { x: a.x * ka + b.x * kb, y: a.y * ka + b.y * kb, z: a.z * ka + b.z * kb, w: a.w * ka + b.w * kb };
    const n = Math.hypot(q.x, q.y, q.z, q.w) || 1;
    return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
  }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    driveCpu(dt);

    // 느린 화면: 상대 위로 날아드는 순간, 걸침 확정, 낙하. 계산은 그대로 두고 흐르는 속도만 늦춘다.
    if (ui.started && game.phase === PHASE.PHYSICS && !slow.used && game.lastShot) {
      const i = game.lastShot.player, a = game.curr[i], b = game.curr[1 - i];
      const gap = Math.hypot(a.p[0] - b.p[0], a.p[2] - b.p[2]), reach = TYPES[game.types[i]].dims[0] + TYPES[game.types[1 - i]].dims[0];
      if (a.p[1] > TYPES[game.types[i]].dims[1] * 2.4 && b.p[1] > -0.2 && gap < reach * 0.95 + 0.12 && Math.hypot(a.lv[0], a.lv[2]) > 1.2) {
        slow.used = true; slow.t = 0.6; view.zoomIn(0.85); sfx.whoosh();
      }
    }
    slow.t = Math.max(0, slow.t - dt);
    slow.scale += ((slow.t > 0 ? 0.2 : 1) - slow.scale) * (1 - Math.exp(-16 * dt));
    document.body.classList.toggle('slow', slow.t > 0);

    const alpha = game.advance(game.online ? dt : dt * slow.scale);       // 온라인은 서버 시간에 맞춰야 하므로 느리게 흘리지 않는다
    playEvents(now);
    const bodies = game.curr.map((c, i) => {
      const p = game.prev[i];
      return { p: [lerp(p.p[0], c.p[0], alpha), lerp(p.p[1], c.p[1], alpha), lerp(p.p[2], c.p[2], alpha)], q: slerp(p.q, c.q, alpha) };
    });
    // 빠르게 날 때 꼬리, 걸침 확인 중 두근거림
    if (ui.started && game.phase === PHASE.PHYSICS) {
      game.curr.forEach((c, i) => { if (Math.hypot(...c.lv) > 4.2 && c.p[1] > -0.3) fx.trail(bodies[i].p, PLAYER[i].rubber); });
    }
    if (ui.perching) {
      view.cine.pulse = Math.max(0, Math.sin(now / 1000 * 11)) ** 3;
      if (now - heartAt > 560) { heartAt = now; sfx.heart(); }
    } else view.cine.pulse *= 0.8;

    view.update(game, bodies, dt);
    ui.update(bodies);
    requestAnimationFrame(frame);
  }
  document.getElementById('loading').remove();
  window.__game = { get game() { return game; }, localGame, netGame, net, input, view, ui, sfx, slow, cpu, PHASE };
  requestAnimationFrame(frame);
}
main().catch((e) => { console.error(e); document.getElementById('loading').textContent = '불러오지 못했습니다: ' + e.message; });
