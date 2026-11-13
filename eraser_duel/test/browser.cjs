// 실제 브라우저에서 일반 조작으로 확인한다(스크린샷만, 영상 없음).  실행: node test/browser.cjs  (먼저 npm run build)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const out = path.join(__dirname, '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true }); ctx.setDefaultTimeout(60000);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  let pass = 0, fail = 0;
  const log = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '통과' : '실패'}  ${n}${d ? '  — ' + d : ''}`); };
  const st = () => p.evaluate(() => { const g = __game.game; return { phase: g.phase, player: g.player, spot: g.spot, n: g.spots().length, gauge: g.gauge.value, launches: __game.input.launches, result: g.result, x0: g.curr[0].p[0], x1: g.curr[1].p[0], yaw: g.curr[0].q.y }; });
  const hold = async (lo, hi) => { await p.keyboard.down('Space'); await p.waitForFunction(([a, c]) => { const g = __game.game; return g.phase !== 'power' || (g.gauge.value >= a && g.gauge.value <= c); }, [lo, hi], { polling: 'raf' }); await p.keyboard.up('Space'); };
  await p.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html'));
  await p.waitForFunction(() => window.__game); await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(out, '01_cover.png') });
  // 표지 → 지우개 고르기 → 놀이
  await p.click('#startBtn'); await p.waitForSelector('#pick:not([hidden])');
  const cards = await p.$$eval('#cards0 .card', (c) => c.length);
  await p.click('#cards0 .card:nth-child(2)'); await p.click('#cards1 .card:nth-child(7)'); await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(out, '02_pick.png') });
  await p.click('#goBtn'); await p.waitForTimeout(2400);
  let s = await st();
  const types = await p.evaluate(() => __game.game.types);
  log('B1. 지우개 18종 가운데 골라 시작하고, 일반 경기는 40cm 떨어져 시작한다', cards === 18 && types[0] === 'sharp' && types[1] === 'long' && Math.abs(s.x0 - s.x1) > 3.5 && s.phase === 'aim', `${types.join(' vs ')}, 거리 ${(Math.abs(s.x0 - s.x1) * 10).toFixed(0)}cm`);
  await p.screenshot({ path: path.join(out, '03_aim.png') });
  // 마우스로 시작 버튼을 누른 뒤 Space를 눌러도 다시 시작되지 않는다
  const yaw0 = s.yaw; await p.keyboard.down('Space'); await p.waitForTimeout(60); await p.keyboard.up('Space'); await p.waitForTimeout(300);
  s = await st();
  log('B2. 살짝 건드린 것(짧은 탭)은 누른 것으로 치지 않고, 판이 다시 시작되지도 않는다', s.phase === 'aim' && s.launches === 0 && s.yaw === yaw0);
  // 누름 자리 고르기
  const spot0 = s.spot; await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250);
  s = await st(); const afterKey = s.spot;
  const info1 = await p.textContent('#spotInfo');
  await p.locator('#spots .spot').nth(0).dispatchEvent('pointerdown'); await p.waitForTimeout(150);
  const viaMouse = await st(); await p.evaluate(() => __game.input.up()); await p.waitForTimeout(200);
  log('B3. 방향키와 지우개 위의 점으로 누름 자리를 고른다', afterKey === (spot0 + 1) % s.n && viaMouse.spot === 0 && info1.includes('누르는 곳'), `자리 ${s.n}개, ${spot0} → ${afterKey} → 마우스로 0 / "${info1.trim()}"`);
  // 꾹 누르기: 힘이 차는 동안 자리 고정, 떼면 한 번만 튕김
  await p.evaluate(() => { __game.input.cycleTo(__game.game.bestSpot()); });
  await p.keyboard.down('Space'); await p.waitForFunction(() => __game.game.gauge.value > 0.08, null, { polling: 'raf' });
  const g1 = (await st()).gauge; await p.keyboard.press('ArrowRight');
  await p.waitForFunction(() => __game.game.gauge.value > 0.24 || __game.game.phase !== 'power', null, { polling: 'raf' });
  const mid = await st();
  await p.keyboard.up('Space'); await p.keyboard.press('Space'); await p.waitForTimeout(150);
  s = await st();
  log('B4. 누르고 있는 동안 힘이 차오르고 자리는 고정되며, 떼는 순간 한 번만 튕긴다', mid.phase === 'power' && mid.gauge > g1 && mid.spot === (await p.evaluate(() => __game.game.lastShot.spot)) && s.phase === 'physics' && s.launches === 1, `힘 ${(g1 * 100).toFixed(0)}% → ${(mid.gauge * 100).toFixed(0)}% → 발사 ${((await p.evaluate(() => __game.game.shotPower)) * 100).toFixed(0)}%`);
  await p.waitForTimeout(300); await p.screenshot({ path: path.join(out, '05_fly.png') });
  await p.waitForFunction(() => __game.game.phase !== 'physics'); await p.waitForTimeout(1800);
  s = await st();
  log('B5. 승패가 없으면 2P 차례로 넘어간다', s.phase === 'aim' && s.player === 1, s.phase === 'result' ? JSON.stringify(s.result) : '');
  await p.screenshot({ path: path.join(out, '06_p2_turn.png') });
  // 끝까지 누르면 저절로 튕김(최대 힘)
  await p.keyboard.down('Space'); await p.waitForFunction(() => __game.game.gauge.value > 0.5); await p.screenshot({ path: path.join(out, '04_press.png') }); await p.waitForFunction(() => __game.game.phase !== 'power' && __game.game.phase !== 'aim', null, { timeout: 20000 }); await p.keyboard.up('Space');
  log('B6. 끝까지 누르고 있으면 손가락이 미끄러져 최대 힘으로 저절로 튕긴다', (await p.evaluate(() => __game.game.shotPower)) === 1);
  await p.waitForFunction(() => __game.game.phase !== 'physics'); await p.waitForTimeout(800);
  // 가까운 검증 배치에서 올라타기와 연출
  await p.evaluate(() => { const u = __game.ui, o = u.pop.bind(u); window.__pops = []; u.pop = (t, ...a) => { __pops.push(t); o(t, ...a); }; window.__slow = 0; window.__bits = 0; window.__hop = false; const f = () => { if (document.body.classList.contains('slow')) __slow++; __bits = Math.max(__bits, __game.view.fx.bitC.items.length); if (__game.view.hop) __hop = true; requestAnimationFrame(f); }; f(); });
  await p.click('#devBtn'); await p.click('#dbgPresetFire');
  await p.waitForFunction(() => __game.game.phase === 'result'); await p.waitForTimeout(900);
  const title = await p.textContent('#resultTitle'), why = await p.textContent('#resultWhy');
  const fxs = await p.evaluate(() => ({ pops: __pops, slow: __slow, bits: __bits, hop: __hop, ticks: Math.round(__game.game.timers.phys * 240) }));
  log('B7. 근거리 검증 프리셋으로 올라타 승리하고, 느린 화면·글자·꽃가루·폴짝 연출이 나온다', /1P 승리/.test(title) && /올라탔습니다/.test(why) && fxs.slow > 0 && fxs.pops.includes('올라탔다?!') && fxs.bits > 20 && fxs.hop, `${title} / ${why}`);
  await p.screenshot({ path: path.join(out, '07_win.png') });
  await p.click('#dbgReplay'); await p.waitForFunction(() => __game.game.phase === 'result' && __game.game.timers.phys > 0.2);
  log('B8. 같은 조건으로 다시 발사하면 같은 시점에 같은 결과가 난다', (await p.evaluate(() => Math.round(__game.game.timers.phys * 240))) === fxs.ticks, `물리 걸음 수 ${fxs.ticks}`);
  // 설정 내보내기·가져오기
  await p.fill('#set_friction', '0.77'); await p.focus('#set_friction'); await p.keyboard.press('Space'); await p.keyboard.type('r');
  await p.click('text=JSON 복사'); const json = await p.inputValue('#jsonBox');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=JSON 내려받기')]);
  const dlPath = path.join(out, 'dl.json'); await dl.saveAs(dlPath); const dlOk = JSON.parse(fs.readFileSync(dlPath, 'utf8')).friction === 0.77; fs.unlinkSync(dlPath);
  await p.click('text=기본값으로'); const reset = await p.evaluate(() => __game.game.pending.friction);
  await p.fill('#jsonBox', json); await p.click('button:text-is("가져오기")'); const imp = await p.evaluate(() => __game.game.pending.friction);
  await p.fill('#jsonBox', '{"version":1,"friction":99}'); await p.click('button:text-is("가져오기")');
  log('B9. 설정 복사·내려받기·기본값·가져오기와 오류 표시가 동작한다', JSON.parse(json).friction === 0.77 && dlOk && reset === 0.6 && imp === 0.77 && /가져오지 못했습니다/.test(await p.textContent('#dev .err')));
  await p.click('text=기본값으로'); await p.click('#devBtn');
  // 혼자 하기: 컴퓨터가 스스로 자리를 고르고 누른다
  await p.evaluate(() => localStorage.removeItem('eraser-duel-save-v1'));
  await p.click('#change'); await p.click('#backBtn'); await p.click('#soloBtn'); await p.waitForTimeout(200);
  const locked = await p.$$eval('#cards0 .card', (c) => c.filter((x) => x.disabled).length);
  await p.screenshot({ path: path.join(out, '08_solo_pick.png') });
  await p.click('#goBtn'); await p.waitForTimeout(400);
  await p.evaluate(() => { const g = __game.game; g.fireSpot(g.bestSpot(), 0.25); });
  await p.waitForFunction(() => __game.game.phase === 'aim' && __game.game.player === 1);
  await p.keyboard.down('Space'); await p.waitForTimeout(300); await p.keyboard.up('Space'); await p.keyboard.press('ArrowRight');
  const during = await p.evaluate(() => ({ launches: __game.input.launches, status: document.getElementById('statusText').textContent, phase: __game.game.phase }));
  await p.waitForFunction(() => __game.game.lastShot && __game.game.lastShot.player === 1 && __game.game.phase !== 'aim' && __game.game.phase !== 'power', null, { timeout: 90000 });
  const cpuShot = await p.evaluate(() => ({ power: __game.game.lastShot.power, spot: __game.game.lastShot.spot }));
  log('B10. 혼자 하기에서 컴퓨터가 스스로 자리를 고르고 눌러 튕기며, 그동안 내 입력은 받지 않는다', locked === 17 && /컴퓨터/.test(during.status) && cpuShot.power > 0.1 && cpuShot.spot >= 0, `컴퓨터: 자리 ${cpuShot.spot}, 힘 ${(cpuShot.power * 100).toFixed(0)}% / "${during.status}"`);
  await p.waitForFunction(() => __game.game.phase !== 'physics', null, { timeout: 60000 }); await p.waitForTimeout(400);
  await p.evaluate(() => { const g = __game.localGame; g.types = ['normal', 'normal']; __game.ui.picks = ['normal', 'normal']; g.layoutMode = 'near'; g.restart(); g.fire(0, 0.65, 1); });
  await p.waitForFunction(() => __game.game.phase === 'result'); await p.waitForTimeout(700);
  const save = await p.evaluate(() => ({ s: JSON.parse(localStorage.getItem('eraser-duel-save-v1')), extra: document.getElementById('resultExtra').textContent }));
  log('B11. 혼자 하기에서 이기면 상대 지우개를 따서 필통에 저장된다', save.s.wins === 1 && save.s.erasers.normal === 2 && /땄다/.test(save.extra), `${save.extra} / 보통 ×${save.s.erasers.normal}`);
  // 좁은 화면
  await p.evaluate(() => { __game.localGame.layoutMode = 'match'; __game.ui.rematch(); }); await p.waitForTimeout(600);
  await p.setViewportSize({ width: 420, height: 760 }); await p.waitForTimeout(900);
  const fit = await p.evaluate(() => ['tag0', 'tag1', 'bar', 'devBtn', 'mute', 'fire'].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; }));
  log('B12. 좁은 화면에서도 조작 버튼과 정보가 화면 안에 있다', fit);
  await p.screenshot({ path: path.join(out, '09_narrow.png') });
  log('B13. 브라우저 오류가 없다', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
