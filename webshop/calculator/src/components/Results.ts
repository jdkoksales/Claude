import type { CalculationResult, Category } from '../types';
import { CATEGORY_LABELS } from '../config/calculatorConfig';
import { formatNumber } from '../utils/format';
import { countTo, pulse } from '../utils/animate';

const ICONS: Record<Category, string> = {
  google:
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z"/><path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3a11.5 11.5 0 0 0 10.2 6.3z"/><path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3z"/><path fill="#EA4335" d="M12 5.1c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 6.8l3.8 3c.9-2.7 3.4-4.7 6.4-4.7z"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><defs><linearGradient id="cfgig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FEDA75"/><stop offset=".28" stop-color="#FA7E1E"/><stop offset=".6" stop-color="#D62976"/><stop offset=".85" stop-color="#962FBF"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient></defs><rect x="2" y="2" width="20" height="20" rx="6" fill="url(#cfgig)"/><circle cx="12" cy="12" r="4.4" fill="none" stroke="#fff" stroke-width="1.9"/><circle cx="17.4" cy="6.6" r="1.25" fill="#fff"/></svg>',
  facebook:
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#1877F2"/><path fill="#fff" d="M15.6 15.1 16 12h-3v-2c0-.9.4-1.7 1.8-1.7H16V5.6s-1.2-.2-2.3-.2c-2.4 0-3.9 1.4-3.9 4V12H7v3.1h2.8V22a10 10 0 0 0 3.2 0v-6.9h2.6z"/></svg>',
};

const SHORT: Record<Category, string> = {
  google: 'nieuwe Google Reviews',
  instagram: 'nieuwe Instagram-volgers',
  facebook: 'nieuwe Facebook-volgers',
};

export interface ResultsHandle {
  el: HTMLElement;
  update: (result: CalculationResult) => void;
}

/**
 * De Google-regel krijgt de kleuren van het logo: het plusje in een verloop
 * over alle vier, en daarna elk cijfer een eigen kleur. Zo is hij in één
 * oogopslag te onderscheiden van de blauwe Facebook-regel eronder.
 */
const GOOGLE_KLEUREN = ['g-rood', 'g-geel', 'g-groen', 'g-blauw'];

function googleGetal(waarde: number): string {
  const cijfers = formatNumber(waarde)
    .split('')
    .map((teken, i) =>
      /\d/.test(teken)
        ? `<i class="${GOOGLE_KLEUREN[i % GOOGLE_KLEUREN.length]}">${teken}</i>`
        : `<i class="g-punt">${teken}</i>`
    )
    .join('');
  return `<i class="g-plus">+</i>${cijfers}`;
}

const TEKEN: Record<Category, (waarde: number) => string> = {
  google: googleGetal,
  instagram: (v) => `+${formatNumber(v)}`,
  facebook: (v) => `+${formatNumber(v)}`,
};

/**
 * Het uitkomstpaneel. Dit is waar de bezoeker naar kijkt, dus de getallen
 * krijgen alle ruimte en de rest is ondergeschikt.
 */
export function Results(intro: string): ResultsHandle {
  const el = document.createElement('div');
  el.className = 'cfg-out-boven';
  el.innerHTML = `
    <div class="cfg-out-gloed" aria-hidden="true"></div>
    <div class="cfg-out-inhoud">
      <p class="cfg-out-kap">Wat het oplevert</p>
      <p class="cfg-out-intro">${intro}</p>
      <div class="cfg-out-rows"></div>
    </div>`;
  const rows = el.querySelector('.cfg-out-rows') as HTMLElement;

  const entries = new Map<
    Category,
    { node: HTMLElement; row: HTMLElement; shown: number; cancel: (() => void) | null }
  >();

  (Object.keys(CATEGORY_LABELS) as Category[]).forEach((category) => {
    const row = document.createElement('div');
    row.className = 'cfg-out-row';
    row.style.setProperty('--card-accent', CATEGORY_LABELS[category].accent);
    row.innerHTML = `
      <span class="cfg-out-val" data-val>+0</span>
      <span class="cfg-out-ico">${ICONS[category]}</span>
      <span class="cfg-out-lbl">${SHORT[category]}<em>per maand</em></span>`;
    rows.appendChild(row);
    entries.set(category, {
      node: row.querySelector('[data-val]') as HTMLElement,
      row,
      shown: 0,
      cancel: null,
    });
  });

  return {
    el,
    update(result) {
      entries.forEach((entry, category) => {
        const next = result.byCategory[category].perMonth;
        if (next !== entry.shown) pulse(entry.node);
        if (entry.cancel) entry.cancel();
        entry.cancel = countTo(entry.node, entry.shown, next, (v) => TEKEN[category](v));
        entry.shown = next;
        entry.row.classList.toggle('is-empty', next === 0);
      });
    },
  };
}
