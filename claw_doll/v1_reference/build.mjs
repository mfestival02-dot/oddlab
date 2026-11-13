import * as esbuild from 'esbuild';
import fs from 'fs';
const css = fs.readFileSync('src/ui.css', 'utf8');
for (const name of process.argv.slice(2)) {
  const r = await esbuild.build({ entryPoints: [`src/${name}.js`], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  let html = fs.readFileSync(`src/${name}.html`, 'utf8');
  html = html.replace('/*CSS*/', () => css).replace('/*BUNDLE*/', () => js);
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync(`dist/${name}.html`, html);
  console.log(name, (html.length / 1024).toFixed(0) + 'KB');
}
