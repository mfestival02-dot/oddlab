// node render.js <style.html> <out.mp4>   — 프레임 캡처(toDataURL) + OfflineAudio WAV → ffmpeg 합성
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const [, , htmlFile, outMp4, onlyFrame] = process.argv;
const FPS = 30; let DUR = 17;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dgi-'));

(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto('file:///' + encodeURI(path.resolve(htmlFile).split(path.sep).join('/')).replace(/#/g, '%23'));
  await page.evaluate(() => window.READY);
  DUR = await page.evaluate(() => window.DUR);
  const loaded = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family));
  console.log('fonts loaded:', loaded.join(', '));

  if (onlyFrame !== undefined) { // 단일 프레임 PNG (검수용)
    const frames = onlyFrame.split(',').map(Number);
    for (const n of frames) {
      const data = await page.evaluate(n => { window.render(n / 30); return document.getElementById('c').toDataURL('image/png'); }, n);
      const p = outMp4.replace(/\.(mp4|png)$/, '') + `_f${String(n).padStart(3, '0')}.png`;
      fs.writeFileSync(p, Buffer.from(data.split(',')[1], 'base64')); console.log('wrote', p);
    }
    await browser.close(); return;
  }

  // 오디오
  const wav = path.join(tmp, 'a.wav');
  const b64 = await page.evaluate(() => window.renderAudio());
  fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
  console.log('audio ok', (fs.statSync(wav).size / 1e6).toFixed(1), 'MB');

  // 비디오: PNG 파이프 → ffmpeg
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', 'pipe:0', '-i', wav,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', outMp4], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = FPS * DUR;
  for (let n = 0; n < total; n++) {
    const data = await page.evaluate(n => { window.render(n / 30); return document.getElementById('c').toDataURL('image/png'); }, n);
    const buf = Buffer.from(data.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (n % 90 === 0) console.log('frame', n, '/', total);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('done', outMp4);
})();
