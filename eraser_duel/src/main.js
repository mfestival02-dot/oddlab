import RAPIER from '@dimforge/rapier3d-compat';
import { Game, PHASE } from './game.js';
import { View, PLAYER } from './view.js';
import { UI } from './ui.js';
import { Sfx } from './sound.js';
import { Planner } from './ai.js';
import { TYPES } from './config.js';

async function main() {
  await RAPIER.init();
  const game = new Game(RAPIER);
  const view = new View(document.getElementById('app'));
  const sfx = new Sfx();
  const fx = view.fx;
  let ui = null;
  const cpuTurn = () => ui.mode === 'solo' && game.player === 1;

  // ---------- 입력: 길게 눌러도 한 번, 차례가 바뀌면 눌린 상태를 버린다 ----------
  const input = {
    hold: 0, left: false, right: false, spaceDown: false, launches: 0,
    clear() { this.hold = 0; this.left = this.right = false; },
    locked() { return !ui.started || cpuTurn(); },                 // 메뉴 중이거나 컴퓨터 차례면 조작을 받지 않는다
    press() {
      if (this.locked()) return null;
      sfx.init();
      const r = game.press();
      if (r === 'fire') this.launches++;
      if (r === 'gauge') sfx.click();
      return r;
    },
    restart() { if (!ui.started) return; game.restart(); this.clear(); view.resetCamera(); },
  };
  const slow = { t: 0, used: false, scale: 1 };
  const cpu = { state: 'idle', t: 0, planner: null, shot: null, prevGauge: 0 };
  let popAt = 0, heartAt = 0;

  game.onEvent = (type) => {
    if (type === 'turn' || type === 'restart' || type === 'restore' || type === 'result') input.clear();
    if (type === 'restart' || type === 'restore') { slow.t = 0; slow.used = false; cpu.state = 'idle'; view.hop = null; view.cine.fall = null; }
    if (!ui || !ui.started) return;
    if (type === 'turn') { ui.banner(cpuTurn() ? '컴퓨터 차례!' : `${PLAYER[game.player].name} 차례!`); sfx.scratch(); }
    if (type === 'restart') { ui.banner('1P 차례!', '한 판 더'); sfx.scratch(); }
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
      if (e.repeat || input.spaceDown) return;                          // 길게 눌러 생기는 반복 입력은 무시
      input.spaceDown = true;
      input.press();
    } else if (!e.repeat) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { input.left = true; e.preventDefault(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { input.right = true; e.preventDefault(); }
      else if ((e.code === 'ArrowUp' || e.code === 'KeyW') && !input.locked()) { game.setHit(game.hit + 1); sfx.click(); e.preventDefault(); }
      else if ((e.code === 'ArrowDown' || e.code === 'KeyS') && !input.locked()) { game.setHit(game.hit - 1); sfx.click(); e.preventDefault(); }
      else if (e.code === 'KeyR') ui.rematch();
    }
  });
  addEventListener('keyup', (e) => {
    if (e.code === 'Space') input.spaceDown = false;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  });
  addEventListener('blur', () => { input.clear(); input.spaceDown = false; });

  ui = new UI(game, view, input, sfx);

  // ---------- 컴퓨터 차례: 방향을 재고 → 게이지를 보다가 → 튕긴다 ----------
  function turnToward(target, maxStep) {
    const d = ((target - game.aim[1] + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    game.aim[1] += Math.sign(d) * Math.min(Math.abs(d), maxStep);
    return Math.abs(d) < 0.01;
  }
  function driveCpu(dt) {
    if (!ui.started || !cpuTurn()) { cpu.state = 'idle'; return; }
    if (game.phase === PHASE.AIM) {
      if (cpu.state === 'idle') { cpu.planner = new Planner(RAPIER, game, 0.72); cpu.state = 'think'; cpu.t = 0; }
      cpu.t += dt;
      if (cpu.state === 'think') {
        const done = cpu.planner.step(5);
        turnToward(cpu.planner.best.angle + Math.sin(cpu.t * 5) * 0.12, dt * 0.9);       // 갸웃거리며 잰다
        if (done && cpu.t > 1.2) { cpu.shot = cpu.planner.shot; game.setHit(cpu.shot.hit); cpu.state = 'aim'; }
      } else if (cpu.state === 'aim') {
        if (turnToward(cpu.shot.angle, dt * 1.5)) { cpu.state = 'gauge'; cpu.prevGauge = 0; game.press(); sfx.click(); }
      }
    } else if (game.phase === PHASE.POWER && cpu.state === 'gauge') {
      const v = game.gauge.value, t = cpu.shot.power;
      if (game.gauge.t > 0.25 && (v - t) * (cpu.prevGauge - t) <= 0) { game.fire(cpu.shot.angle, t, cpu.shot.hit); cpu.state = 'idle'; }
      cpu.prevGauge = v;
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
    if (!input.locked()) {
      const dir = input.hold || (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (dir) game.turn(dir, dt);
    }
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

    const alpha = game.advance(dt * slow.scale);
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
  window.__game = { game, input, view, ui, sfx, slow, cpu, PHASE };
  requestAnimationFrame(frame);
}
main().catch((e) => { console.error(e); document.getElementById('loading').textContent = '불러오지 못했습니다: ' + e.message; });
