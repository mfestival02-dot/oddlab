import RAPIER from '@dimforge/rapier3d-compat';
import { Game, PHASE } from './game.js';
import { View } from './view.js';
import { UI } from './ui.js';

async function main() {
  await RAPIER.init();
  const game = new Game(RAPIER);
  const view = new View(document.getElementById('app'));

  // ---------- 입력: 길게 눌러도 한 번, 차례가 바뀌면 눌린 상태를 버린다 ----------
  const input = {
    hold: 0, left: false, right: false, spaceDown: false, launches: 0,
    clear() { this.hold = 0; this.left = this.right = false; },
    press() { const r = game.press(); if (r === 'fire') this.launches++; return r; },
    restart() { game.restart(); this.clear(); view.resetCamera(); },
  };
  game.onEvent = (type) => { if (type === 'turn' || type === 'restart' || type === 'restore' || type === 'result') input.clear(); };
  const typing = (e) => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); };
  addEventListener('keydown', (e) => {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;       // 패널에 값을 넣는 동안에는 단축키를 쓰지 않는다
    if (e.code === 'Space') {
      e.preventDefault();
      if (e.repeat || input.spaceDown) return;                          // 길게 눌러 생기는 반복 입력은 무시
      input.spaceDown = true;
      input.press();
    } else if (!e.repeat) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { input.left = true; e.preventDefault(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { input.right = true; e.preventDefault(); }
      else if (e.code === 'KeyR') input.restart();
    }
  });
  addEventListener('keyup', (e) => {
    if (e.code === 'Space') input.spaceDown = false;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  });
  addEventListener('blur', () => { input.clear(); input.spaceDown = false; });

  const ui = new UI(game, view, input);

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
    const dir = input.hold || (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) game.turn(dir, dt);
    const alpha = game.advance(dt);
    const bodies = game.curr.map((c, i) => {
      const p = game.prev[i];
      return { p: [lerp(p.p[0], c.p[0], alpha), lerp(p.p[1], c.p[1], alpha), lerp(p.p[2], c.p[2], alpha)], q: slerp(p.q, c.q, alpha) };
    });
    view.update(game, bodies, dt);
    ui.update();
    requestAnimationFrame(frame);
  }
  document.getElementById('loading').remove();
  window.__game = { game, input, view, ui, PHASE };
  requestAnimationFrame(frame);
}
main().catch((e) => { console.error(e); document.getElementById('loading').textContent = '불러오지 못했습니다: ' + e.message; });
