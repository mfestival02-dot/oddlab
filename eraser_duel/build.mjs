// src를 HTML 한 파일(dist/index.html)로 묶는다.  --serve 를 붙이면 http://localhost:5173 에서 연다.
import * as esbuild from 'esbuild';
import fs from 'fs';
import http from 'http';
async function build() {
  const r = await esbuild.build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none', loader: { '.json': 'json' } });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  // 글꼴은 파일 안에 넣어 한 파일로도 열리게 한다
  const face = (file, weight) => `@font-face{font-family:"Gaegu";font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(file).toString('base64')}) format("woff2");}`;
  const fonts = face('assets/gaegu-regular.woff2', 400) + face('assets/gaegu-bold.woff2', 700);
  const html = fs.readFileSync('src/index.html', 'utf8').replace('/*FONTS*/', () => fonts).replace('/*BUNDLE*/', () => js);
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/index.html', html);
  console.log('dist/index.html', (html.length / 1024 / 1024).toFixed(1) + 'MB');
}
await build();
if (process.argv.includes('--serve')) {
  const port = 5173;
  http.createServer(async (req, res) => {
    try { await build(); } catch (e) { console.error(e.message); }      // 새로 고침할 때마다 다시 묶는다
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(fs.readFileSync('dist/index.html'));
  }).listen(port, () => console.log(`http://localhost:${port} 에서 실행 중 (끝내려면 Ctrl+C)`));
}
