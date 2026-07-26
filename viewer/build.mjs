import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const out = process.argv[2] || 'tapkaarten-3d-viewer.html';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
  legalComments: 'none',
});

// Voorkom dat een letterlijke </script> in de bundle het inline-script afbreekt.
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const html = readFileSync('template.html', 'utf8').replace('__BUNDLE__', () => js);
writeFileSync(out, html);
console.log(`${out} — ${(Buffer.byteLength(html) / 1024).toFixed(0)} kB`);
