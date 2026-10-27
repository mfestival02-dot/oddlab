// node audio.js <style.html> <in.mp4>  — 오디오만 다시 합성해 MP4에 교체 (영상 재인코딩 없음)
const { chromium } = require('playwright'); const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const [, , htmlFile, mp4] = process.argv;
(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.goto('file:///' + encodeURI(path.resolve(htmlFile).split(path.sep).join('/')).replace(/#/g, '%23'));
  await page.evaluate(() => window.READY);
  const b64 = await page.evaluate(() => window.renderAudio()); await browser.close();
  const wav = path.join(os.tmpdir(), 'dgi_' + Date.now() + '.wav'); fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
  const tmp = mp4 + '.tmp.mp4';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', tmp]);
  fs.renameSync(tmp, mp4); fs.unlinkSync(wav); console.log('audio replaced', mp4);
})();
