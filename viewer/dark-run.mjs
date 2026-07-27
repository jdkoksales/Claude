import { build } from 'esbuild';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const js=(await build({entryPoints:['src/export.js'],bundle:true,minify:true,format:'iife',target:['es2020'],write:false})).outputFiles[0].text;
writeFileSync('export-page.html',`<!doctype html><meta charset="utf-8"><body><script>${js.replace(/<\/script/gi,'<\\/script')}</script>`);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();
p.on('pageerror',e=>console.error('[err]',e.message));
await p.goto('file://'+process.cwd()+'/export-page.html');
await p.waitForFunction('window.EXPORT_READY === true');
for(const [key,yaw,name] of [['google-wit',-22,'dark-wit'],['google-zwart',22,'dark-zwart']]){
  const d=await p.evaluate(([k,y,s,bg])=>window.renderVariant(k,y,s,bg),[key,yaw,1400,0x121212]);
  writeFileSync('dist/'+name+'.png',Buffer.from(d.split(',')[1],'base64'));
  console.log('ok',name);
}
await b.close();
