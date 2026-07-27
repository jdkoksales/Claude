// Draait op de GitHub-runner (open internet). Opent de referentiesite met een
// echte browser en legt vast wat nodig is om het ontwerp na te bouwen:
// screenshots, DOM-structuur en computed styles van de belangrijkste elementen.
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';

const url = readFileSync('ref-target.txt', 'utf8').trim().split('\n')[0];

const browser = await chromium.launch();

async function capture(name, viewport, isMobile) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    isMobile,
    hasTouch: isMobile,
    userAgent: isMobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    locale: 'en-US',
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(3500);
  // Lazy content laden door langzaam te scrollen
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0;
      const t = setInterval(() => {
        window.scrollBy(0, 600);
        y += 600;
        if (y > document.body.scrollHeight + 2000) {
          clearInterval(t);
          window.scrollTo(0, 0);
          res();
        }
      }, 120);
    });
  });
  await page.waitForTimeout(2500);

  await page.screenshot({ path: `ref/${name}-fold.png` });
  await page.screenshot({ path: `ref/${name}-full.png`, fullPage: true });

  const data = await page.evaluate(() => {
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const pick = (el) => {
      if (!el) return null;
      const s = cs(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 120),
        text: (el.innerText || '').trim().slice(0, 300),
        font: s.fontFamily,
        size: s.fontSize,
        weight: s.fontWeight,
        lh: s.lineHeight,
        ls: s.letterSpacing,
        transform: s.textTransform,
        color: s.color,
        bg: s.backgroundColor,
        radius: s.borderRadius,
        pad: s.padding,
        box: { w: Math.round(r.width), h: Math.round(r.height) },
      };
    };

    // Secties op het hoogste niveau, met hun teksten
    const sections = [...document.querySelectorAll('body section, body > div > section, main > *')]
      .slice(0, 40)
      .map((el) => {
        const s = cs(el);
        const r = el.getBoundingClientRect();
        return {
          cls: (el.className || '').toString().slice(0, 160),
          bg: s.backgroundColor,
          padding: s.padding,
          h: Math.round(r.height),
          headings: [...el.querySelectorAll('h1,h2,h3')].slice(0, 6).map((h) => ({
            tag: h.tagName.toLowerCase(),
            text: (h.innerText || '').trim().slice(0, 160),
            ...pick(h),
          })),
          paras: [...el.querySelectorAll('p')].slice(0, 5).map((p) => (p.innerText || '').trim().slice(0, 200)),
          buttons: [...el.querySelectorAll('a,button')]
            .slice(0, 8)
            .map((b) => ({ text: (b.innerText || '').trim().slice(0, 60), ...pick(b) }))
            .filter((b) => b.text),
          images: [...el.querySelectorAll('img')].slice(0, 8).map((i) => ({
            src: i.currentSrc || i.src,
            alt: i.alt,
            w: i.naturalWidth,
            h: i.naturalHeight,
          })),
        };
      });

    const fonts = [...new Set([...document.querySelectorAll('body *')]
      .slice(0, 4000)
      .map((el) => cs(el).fontFamily))].slice(0, 20);

    const fontFiles = [...document.styleSheets]
      .flatMap((ss) => {
        try { return [...ss.cssRules]; } catch { return []; }
      })
      .filter((r) => r.constructor.name === 'CSSFontFaceRule')
      .map((r) => ({ family: r.style.fontFamily, src: (r.style.src || '').slice(0, 400), weight: r.style.fontWeight }));

    const nav = [...document.querySelectorAll('header a, nav a')]
      .slice(0, 30)
      .map((a) => ({ text: (a.innerText || '').trim(), href: a.getAttribute('href') }))
      .filter((a) => a.text);

    return {
      title: document.title,
      bodyStyle: pick(document.body),
      h1: pick(document.querySelector('h1')),
      fonts,
      fontFiles,
      nav,
      sections,
      cssLinks: [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href),
      scrollHeight: document.body.scrollHeight,
    };
  });

  writeFileSync(`ref/${name}.json`, JSON.stringify(data, null, 2));
  if (!isMobile) writeFileSync('ref/page.html', await page.content());
  await ctx.close();
  console.log('ok', name, 'sections:', data.sections.length);
}

await capture('desktop', { width: 1440, height: 900 }, false);
await capture('mobile', { width: 390, height: 844 }, true);
await browser.close();
