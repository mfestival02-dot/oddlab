// 지우개 겉모습 확대 사진(검토용).  실행: node test/closeup.cjs 보통 미술 ...
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const names = process.argv.slice(2); const out = path.join(__dirname, '..', 'shots');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html')); await p.waitForFunction(() => window.__game); await p.click('#startBtn');
  for (let i = 0; i < names.length; i += 2) {
    await p.evaluate(() => __game.ui.showPick('versus')); await p.click(`#cards0 .card:has-text("${names[i]}")`); await p.click(`#cards1 .card:has-text("${names[i + 1] || names[i]}")`); await p.click('#goBtn'); await p.waitForTimeout(2600);
    await p.addStyleTag({ content: '#spots,.spot{opacity:0!important}' });
    await p.screenshot({ path: path.join(out, `c_${i / 2}.png`), clip: { x: 440, y: 400, width: 400, height: 240 } });
  }
  await b.close();
})();
