// Bundelt de configurator naar één thema-asset.
import { build } from 'esbuild';

const out = '../theme3/assets/tk3-configurator.js';
const result = await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  outfile: out,
  metafile: true,
  legalComments: 'none',
});
const bytes = Object.values(result.metafile.outputs)[0].bytes;
console.log('gebouwd:', out, Math.round(bytes / 1024) + ' KB');
