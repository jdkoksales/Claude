// Rendert de hero-scène (producten op een balie) in drie formaten.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

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

// Desktop-hero: cluster rechts, lege balie links voor de tekst.
const items = [
  { key: 'google-wit', x: 2.5, z: 0.35, yawDeg: -14 },
  { key: 'google-zwart', x: 4.7, z: -1.15, yawDeg: 24 },
  { key: 'instagram', x: 1.15, z: -1.05, yawDeg: 22 },
];

const shots = [
  { name: 'hero-desktop.png', items, w: 2400, h: 1350,
    cam: { px: -1.8, py: 1.85, pz: 8.4, lx: 1.15, ly: 1.02 } },
  { name: 'hero-mobile.png', items: [
      { key: 'google-wit', x: 0.35, z: 0.3, yawDeg: -12 },
      { key: 'google-zwart', x: 1.6, z: -0.75, yawDeg: 16 },
      { key: 'instagram', x: -0.95, z: -0.95, yawDeg: 22 },
    ], w: 1200, h: 1400,
    cam: { px: -0.7, py: 1.75, pz: 7.6, lx: 0.35, ly: 1.25 } },
  { name: 'hero-duo.png', items: [
      { key: 'google-wit', x: 0.45, z: 0.2, yawDeg: -12 },
      { key: 'google-zwart', x: 1.75, z: -0.6, yawDeg: 14 },
    ], w: 1600, h: 1600,
    cam: { px: -0.6, py: 1.7, pz: 6.8, lx: 1.05, ly: 1.15 } },
];

for (const s of shots) {
  const dataUrl = await page.evaluate(
    ([items, w, h, cam]) => window.renderHero(items, w, h, cam),
    [s.items, s.w, s.h, s.cam]
  );
  writeFileSync('dist/' + s.name, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('ok', s.name);
}
await browser.close();
