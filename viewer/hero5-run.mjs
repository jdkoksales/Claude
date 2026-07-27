// Rendert per platform één panoramische hero-scène: één standaard op de balie,
// breed uitgesneden zodat de hele hero binnen het scherm past.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const js = (
  await build({
    entryPoints: ['src/export.js'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020'],
    write: false,
  })
).outputFiles[0].text;

writeFileSync(
  'export-page.html',
  `<!doctype html><meta charset="utf-8"><body><script>${js.replace(/<\/script/gi, '<\\/script')}</script>`
);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto('file://' + process.cwd() + '/export-page.html');
await page.waitForFunction('window.EXPORT_READY === true');

// Breed kader, product klein in het midden — zoals de referentie.
const W = 2400;
const H = 880;
const CAM = { px: 0, py: 1.45, pz: 8.6, lx: 0, ly: 1.38 };
const OPTS = { backdrop: false, plinth: 0xe9e2d6 };

const variants = ['google-wit', 'google-zwart', 'instagram', 'facebook', 'sticker'];

mkdirSync('dist/hero', { recursive: true });
for (const key of variants) {
  const items = [{ key, x: 0, z: 0, yawDeg: -9 }];
  const dataUrl = await page.evaluate(
    ([items, w, h, cam, opts]) => window.renderHero(items, w, h, cam, opts),
    [items, W, H, CAM, OPTS]
  );
  const out = `dist/hero/hero-${key}.png`;
  writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('ok', out);
}

await browser.close();
