// Rendert per uitvoering alleen het bordje op een doorzichtige achtergrond,
// zodat het in de bestaande balie-foto gemonteerd kan worden.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const js = (await build({ entryPoints: ['src/export.js'], bundle: true, minify: true,
  format: 'iife', target: ['es2020'], write: false })).outputFiles[0].text;
writeFileSync('export-page.html',
  `<!doctype html><meta charset="utf-8"><body><script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto('file://' + process.cwd() + '/export-page.html');
await page.waitForFunction('window.EXPORT_READY === true');

const YAW = Number(process.argv[2] ?? 8);
const W = 900, H = 1500;
const CAM = { px: 0, py: 1.25, pz: 6.0, lx: 0, ly: 1.25 };
const OPTS = { backdrop: false, counter: false };

mkdirSync('dist/bord', { recursive: true });
for (const key of ['google-wit', 'google-zwart', 'instagram', 'facebook', 'sticker']) {
  const dataUrl = await page.evaluate(
    ([items, w, h, cam, opts]) => window.renderHero(items, w, h, cam, opts),
    [[{ key, x: 0, z: 0, yawDeg: YAW }], W, H, CAM, OPTS]);
  writeFileSync(`dist/bord/${key}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('ok', key);
}
await browser.close();
