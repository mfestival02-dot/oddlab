// 실제 브라우저에서 일반 조작으로 확인하고 녹화한다.  실행: node test/browser.cjs  (먼저 npm run build)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const out = path.join(__dirname, '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } }, acceptDownloads: true });
  ctx.setDefaultTimeout(60000);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html'));
  await p.waitForFunction(() => window.__game);
  const st = () => p.evaluate(() => { const { game, input } = __game; return { phase: game.phase, player: game.player, aim: game.aim.slice(), gauge: game.gauge.value, launches: input.launches, result: game.result, y0: game.curr[0].p[1] }; });
  // 게이지가 원하는 구간에 들어온 바로 그 프레임에 화면 버튼을 누른다(느린 환경에서도 같은 조작이 되도록)
  const clickAt = (lo, hi) => p.evaluate(([lo, hi]) => new Promise((res) => { const f = () => { const v = __game.game.gauge.value; if (__game.game.phase === 'power' && v > lo && v < hi) { document.getElementById('fire').click(); res(v); } else requestAnimationFrame(f); }; f(); }), [lo, hi]);
  const log = (n, ok, d = '') => console.log(`${ok ? '통과' : '실패'}  ${n}${d ? '  — ' + d : ''}`);
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(out, '00_start.png') });
  await p.keyboard.press('Space'); await p.waitForTimeout(150);
  let s0 = await st();
  log('B0. 시작 표지에서 Space는 게임을 시작만 하고 게이지를 건드리지 않는다', s0.phase === 'aim' && (await p.isHidden('#start')));
  await p.waitForTimeout(1700);
  // 프레임률 측정
  const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 1500 ? requestAnimationFrame(f) : res(n / 1.5); }; requestAnimationFrame(f); }));
  console.log(`      이 환경의 그리기 속도: 약 ${fps.toFixed(0)}fps`);
  await p.screenshot({ path: path.join(out, '01_aim.png') });

  // 방향 조절
  let a = await st();
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(500); await p.keyboard.up('ArrowRight');
  let c = await st();
  log('B1. 방향키로 발사 방향이 바뀐다', c.aim[0] > a.aim[0] + 0.1 && c.phase === 'aim', `${(a.aim[0] * 57.3).toFixed(1)}도 → ${(c.aim[0] * 57.3).toFixed(1)}도`);
  await p.keyboard.down('KeyA'); await p.waitForFunction((t) => __game.game.aim[0] <= t, 0.02); await p.keyboard.up('KeyA');
  await p.evaluate(() => { __game.game.aim[0] = 0; });           // 프리셋과 같은 0도로 맞춘다
  // 스페이스를 길게 눌러도(반복 입력) 게이지만 시작된다
  await p.keyboard.down('Space'); for (let i = 0; i < 6; i++) { await p.keyboard.down('Space'); await p.waitForTimeout(60); }
  c = await st();
  log('B2. 스페이스를 길게 눌러도 게이지 시작과 발사가 동시에 일어나지 않는다', c.phase === 'power' && c.launches === 0);
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(200); await p.keyboard.up('ArrowRight');
  log('B3. 게이지가 움직이는 동안 방향은 고정된다', (await st()).aim[0] === 0);
  await p.keyboard.up('Space');
  await p.screenshot({ path: path.join(out, '02_gauge.png') });
  // 왕복 게이지를 보고 55% 근처에서 튕긴다(일반 조작)
  await p.waitForFunction(() => { const v = __game.game.gauge.value; return v > 0.5 && v < 0.58; }, null, { polling: 'raf' });
  await p.keyboard.press('Space');
  c = await st();
  const usedPower = await p.evaluate(() => __game.game.shotPower);
  log('B4. 게이지를 보고 튕기면 한 번만 발사된다', c.phase === 'physics' && c.launches === 1, `파워 ${(usedPower * 100).toFixed(0)}%`);
  await p.keyboard.press('Space'); await p.keyboard.press('Space');
  log('B5. 물리 진행 중 입력은 무시된다', (await st()).launches === 1);
  await p.waitForTimeout(350); await p.screenshot({ path: path.join(out, '03_flying.png') });
  await p.waitForFunction(() => __game.game.phase !== 'physics');
  await p.waitForTimeout(700);
  c = await st();
  log('B6. 일반 조작으로 상대 위에 올라타 승리한다', c.phase === 'result' && c.result.reason === 'perch' && c.result.winner === 0, JSON.stringify(c.result));
  const title = await p.textContent('#resultTitle'), why = await p.textContent('#resultWhy');
  log('B7. 결과와 이유가 화면에 표시된다', /1P 승리/.test(title) && /올라탔습니다/.test(why), `${title} / ${why}`);
  await p.screenshot({ path: path.join(out, '04_perch_win.png') });

  // 다시 시작 → 2인 턴 진행
  await p.click('#again'); await p.waitForTimeout(900);
  c = await st();
  log('B8. 다시 시작하면 1P 조준 상태로 돌아간다', c.phase === 'aim' && c.player === 0 && c.result === null && c.launches === 1);
  await p.click('#fire'); await clickAt(0.2, 0.34);
  await p.waitForFunction(() => __game.game.phase !== 'physics'); await p.waitForTimeout(1200);
  c = await st();
  log('B9. 약하게 튕기면 승패 없이 2P 차례로 넘어간다(화면 버튼 조작)', c.phase === 'aim' && c.player === 1, `파워 ${((await p.evaluate(() => __game.game.shotPower)) * 100).toFixed(0)}%`);
  await p.screenshot({ path: path.join(out, '05_p2_turn.png') });
  // 2P가 빈 쪽으로 방향을 돌려 아주 세게 → 책상 밖으로
  await p.keyboard.down('KeyD'); await p.waitForFunction((t) => __game.game.aim[1] >= t, (await st()).aim[1] + 0.9); await p.keyboard.up('KeyD');
  await p.keyboard.press('Space'); await clickAt(0.9, 1.01);
  await p.waitForFunction(() => __game.game.phase !== 'physics'); await p.waitForTimeout(600);
  c = await st();
  log('B10. 2P가 너무 세게 튕기면 떨어져서 1P가 이긴다', c.phase === 'result' && c.result.reason === 'fell' && c.result.winner === 0, `${await p.textContent('#resultTitle')} / ${await p.textContent('#resultWhy')}`);
  await p.screenshot({ path: path.join(out, '06_fell.png') });

  // 개발자 패널: 설정 내보내기·가져오기, 입력 중 단축키 차단, 프리셋
  await p.keyboard.press('KeyR'); await p.waitForTimeout(500);
  await p.click('#devBtn');
  await p.fill('#set_friction', '0.77');
  await p.focus('#set_friction'); await p.keyboard.press('Space'); await p.keyboard.type('r');
  c = await st();
  log('B11. 패널에 값을 넣는 동안 게임 단축키가 실행되지 않는다', c.phase === 'aim' && c.launches === 3 && (await p.inputValue('#set_friction')).includes('0.77'), `발사 횟수 그대로 ${c.launches}`);
  await p.click('text=JSON 복사');
  const json = await p.inputValue('#jsonBox');
  const exported = JSON.parse(json);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=JSON 내려받기')]);
  const dlPath = path.join(out, 'downloaded-settings.json'); await dl.saveAs(dlPath);
  const dlOk = JSON.parse(fs.readFileSync(dlPath, 'utf8')).friction === 0.77; fs.unlinkSync(dlPath);
  await p.click('text=기본값으로');
  const afterReset = await p.evaluate(() => __game.game.pending.friction);
  await p.fill('#jsonBox', json); await p.click('button:text-is("가져오기")');
  const afterImport = await p.evaluate(() => __game.game.pending.friction);
  log('B12. 설정 JSON 복사·내려받기·기본값·가져오기가 동작한다', exported.friction === 0.77 && exported.version === 1 && dlOk && afterReset === 0.6 && afterImport === 0.77, `내보낸 값 0.77 → 기본값 ${afterReset} → 가져온 값 ${afterImport}`);
  await p.fill('#jsonBox', '{"version":1,"friction":99}'); await p.click('button:text-is("가져오기")');
  const errText = await p.textContent('#dev .err');
  log('B13. 잘못된 설정은 이유를 보여 주고 거부한다', /가져오지 못했습니다/.test(errText) && (await p.evaluate(() => __game.game.pending.friction)) === 0.77, errText.split('\n').slice(0, 2).join(' '));
  // 프리셋 3회 반복
  const finals = [];
  for (let i = 0; i < 3; i++) {
    await p.click(i === 0 ? '#dbgPresetFire' : '#dbgReplay');
    await p.waitForFunction(() => __game.game.phase === 'result');
    finals.push(await p.evaluate(() => ({ r: __game.game.result, p: __game.game.lastShot && __game.game.curr[0].p, ticks: Math.round(__game.game.timers.phys * 120) })));
    if (i === 0) { await p.waitForTimeout(500); await p.screenshot({ path: path.join(out, '07_dev_panel_preset.png') }); }
  }
  log('B14. 프리셋 발사와 "같은 조건으로 다시 발사"가 브라우저에서 같은 결과를 낸다', finals.every((f) => f.r.reason === 'perch' && f.r.winner === 0 && f.ticks === finals[0].ticks), `승리 확정까지 걸음 수 ${finals.map((f) => f.ticks).join(' / ')}`);
  // 저장·복원
  await p.keyboard.press('Escape'); await p.evaluate(() => __game.input.restart());
  await p.fill('#dbgAngle', '5'); await p.fill('#dbgPower', '30');
  await p.click('#dbgSave'); await p.click('#dbgFire'); await p.waitForFunction(() => __game.game.phase !== 'physics');
  const moved = await p.evaluate(() => __game.game.curr[0].p[0]);
  await p.click('#dbgRestore');
  c = await p.evaluate(() => ({ x: __game.game.curr[0].p[0], phase: __game.game.phase, player: __game.game.player, t: __game.game.timers, a: __game.game.aim[0] }));
  log('B15. 발사 전 상태 저장·복원이 동작한다', moved > -0.7 && Math.abs(c.x + 0.75) < 1e-6 && c.phase === 'aim' && c.player === 0 && c.t.phys === 0 && Math.abs(c.a - 5 * Math.PI / 180) < 1e-6, `발사 후 x=${moved.toFixed(2)} → 복원 x=${c.x.toFixed(2)}`);
  // 좁은 화면
  await p.click('#devBtn');
  await p.setViewportSize({ width: 420, height: 760 }); await p.waitForTimeout(900);
  const fit = await p.evaluate(() => ['tag0', 'tag1', 'bar', 'devBtn', 'mute'].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; }));
  log('B16. 좁은 화면에서도 조작 버튼과 정보가 화면 안에 있다', fit);
  await p.screenshot({ path: path.join(out, '08_narrow.png') });
  log('B17. 브라우저 오류가 없다', errs.length === 0, errs.slice(0, 3).join(' | '));
  const video = p.video();
  await ctx.close(); await b.close();
  const vp = await video.path(); fs.renameSync(vp, path.join(out, 'play_session.webm'));
  console.log('녹화:', path.join(out, 'play_session.webm'), (fs.statSync(path.join(out, 'play_session.webm')).size / 1024).toFixed(0) + 'KB');
})();
