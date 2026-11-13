// 주요 화면 스크린샷(영상 없음).  실행: node test/shots.cjs
const { chromium } = require('playwright');
const path = require('path');
const out = path.join(__dirname, '..', 'shots');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html'));
  await p.waitForFunction(() => window.__game); await p.waitForTimeout(500);
  await p.click('#startBtn'); await p.waitForTimeout(400);
  await p.click('#cards0 .card:has-text("곰")'); await p.click('#cards1 .card:has-text("레슬러")'); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(out, '30_shape_pick.png') });
  await p.click('#goBtn'); await p.waitForTimeout(2600);
  await p.screenshot({ path: path.join(out, '31_shape_aim.png') });
  let i = 0; for (const [a, c] of [['거북이', '토끼'], ['육각', '삼각'], ['덩치', '점보']]) {
    await p.evaluate(() => __game.ui.showPick('versus')); await p.click(`#cards0 .card:has-text("${a}")`); await p.click(`#cards1 .card:has-text("${c}")`); await p.click('#goBtn'); await p.waitForTimeout(2400); i++;
    await p.screenshot({ path: path.join(out, `32_shape_${i}.png`) });
  }
  console.log(errs.slice(0, 5));
  await b.close();
})();
