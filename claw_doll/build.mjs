// src/main.js와 assets를 HTML 한 파일(dist/claw_doll.html)로 묶는다.
import * as esbuild from 'esbuild';
import fs from 'fs';
const r = await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020',
  legalComments: 'none', loader: { '.glb': 'binary' },
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync('src/index.html', 'utf8').replace('/*BUNDLE*/', () => js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/claw_doll.html', html);
console.log('dist/claw_doll.html', (html.length / 1024 / 1024).toFixed(1) + 'MB');
