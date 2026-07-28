import type { CalculationResult, CartTotals, Category } from '../types';
import { CATEGORY_LABELS } from '../config/calculatorConfig';
import { formatMoney, formatNumber } from '../utils/format';
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
  update: (result: CalculationResult, totals: CartTotals) => void;
}

/** "1,5×" — hoeveel meer dan met één losse kaart. Onder de 1,05 zeggen we niets. */
function boostLabel(effectiveness: number): string {
  if (effectiveness < 1.05) return '';
  return `${effectiveness.toFixed(1).replace('.', ',')}×`;
}

/**
 * Het uitkomstpaneel. Dit is waar de bezoeker naar kijkt, dus de getallen
 * krijgen alle ruimte en de rest is ondergeschikt.
 */
export function Results(intro: string): ResultsHandle {
  const el = document.createElement('div');
  el.className = 'cfg-out';
  el.innerHTML = `
    <div class="cfg-out-flag">🔥 Dit levert het op</div>
    <p class="cfg-out-intro">${intro}</p>
    <div class="cfg-out-rows"></div>
    <div class="cfg-out-staffel" data-staffel hidden></div>`;
  const rows = el.querySelector('.cfg-out-rows') as HTMLElement;
  const staffel = el.querySelector('[data-staffel]') as HTMLElement;
  let staffelStand = '';

  const entries = new Map<
    Category,
    { node: HTMLElement; boost: HTMLElement; row: HTMLElement; shown: number; cancel: (() => void) | null }
  >();

  (Object.keys(CATEGORY_LABELS) as Category[]).forEach((category) => {
    const row = document.createElement('div');
    row.className = 'cfg-out-row';
    row.style.setProperty('--card-accent', CATEGORY_LABELS[category].accent);
    row.innerHTML = `
      <div class="cfg-out-top">
        <span class="cfg-out-val" data-val>+0</span>
        <span class="cfg-out-boost" data-boost hidden></span>
      </div>
      <div class="cfg-out-meta">
        <span class="cfg-out-ico">${ICONS[category]}</span>
        <span class="cfg-out-lbl">${SHORT[category]}<em>per maand</em></span>
      </div>`;
    rows.appendChild(row);
    entries.set(category, {
      node: row.querySelector('[data-val]') as HTMLElement,
      boost: row.querySelector('[data-boost]') as HTMLElement,
      row,
      shown: 0,
      cancel: null,
    });
  });

  return {
    el,
    update(result, totals) {
      entries.forEach((entry, category) => {
        const vak = result.byCategory[category];
        const next = vak.perMonth;
        if (next !== entry.shown) pulse(entry.node);
        if (entry.cancel) entry.cancel();
        entry.cancel = countTo(entry.node, entry.shown, next, (v) => '+' + formatNumber(v));
        entry.shown = next;
        entry.row.classList.toggle('is-empty', next === 0);

        const label = next > 0 ? boostLabel(vak.effectiveness) : '';
        entry.boost.textContent = label ? `▲ ${label}` : '';
        entry.boost.title = label ? 'meer dan met één losse kaart' : '';
        entry.boost.hidden = label === '';
      });

      // Waar sta je in de staffel? Alleen echte bedragen, geen verzonnen urgentie.
      let tekst = '';
      let soort = '';
      if (totals.itemCount > 0 && totals.discount > 0) {
        tekst = `💥 Je pakt nu ${Math.round(totals.tierPercentage * 100)}% staffelkorting — dat scheelt ${formatMoney(totals.discount)}`;
        soort = 'is-actief';
      } else if (totals.itemCount > 0 && totals.nextTier) {
        const { itemsNeeded, percentage } = totals.nextTier;
        tekst = `Nog ${itemsNeeded} ${itemsNeeded === 1 ? 'kaart' : 'kaarten'} erbij → ${Math.round(percentage * 100)}% staffelkorting`;
        soort = 'is-volgende';
      }
      staffel.textContent = tekst;
      staffel.hidden = tekst === '';
      staffel.className = `cfg-out-staffel ${soort}`.trim();
      if (tekst && tekst !== staffelStand) pulse(staffel);
      staffelStand = tekst;
    },
  };
}
