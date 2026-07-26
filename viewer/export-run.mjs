// Bouwt de exportpagina, draait hem headless en schrijft per product:
//   dist/<variant>/tapkaarten-<variant>.glb   (Shopify 3D-model + AR)
//   dist/<variant>/tapkaarten-<variant>-1.png (productfoto, frontaal 3/4)
//   dist/<variant>/tapkaarten-<variant>-2.png (productfoto, gedraaid)
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

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

const html = `<!doctype html><meta charset="utf-8"><body><script>${js.replace(/<\/script/gi, '<\\/script')}</script>`;
writeFileSync('export-page.html', html);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto('file://' + process.cwd() + '/export-page.html');
await page.waitForFunction('window.EXPORT_READY === true');

for (const variant of ['google-wit', 'google-zwart', 'facebook', 'instagram', 'sticker']) {
  const dir = `dist/${variant}`;
  mkdirSync(dir, { recursive: true });

  const glbB64 = await page.evaluate((v) => window.exportVariant(v), variant);
  writeFileSync(`${dir}/tapkaarten-${variant}.glb`, Buffer.from(glbB64, 'base64'));

  const shots = [
    [-18, `${dir}/tapkaarten-${variant}-1.png`],
    [32, `${dir}/tapkaarten-${variant}-2.png`],
  ];
  for (const [yaw, path] of shots) {
    const dataUrl = await page.evaluate(
      ([v, y]) => window.renderVariant(v, y, 2048),
      [variant, yaw]
    );
    writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  console.log('ok', variant);
}

await browser.close();
