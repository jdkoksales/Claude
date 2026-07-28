import type { CartTotals } from '../types';
import { formatMoney } from '../utils/format';
import { pulse } from '../utils/animate';

export interface CartSummaryHandle {
  el: HTMLElement;
  update: (totals: CartTotals) => void;
}

/**
 * De prijsregel boven de knop: wat het eenmalig kost. De oude prijs staat
 * doorgestreept, de nieuwe in rood. Alle bedragen zijn exclusief btw — we
 * verkopen aan bedrijven, die rekenen zo.
 */
export function CartSummary(): CartSummaryHandle {
  const el = document.createElement('div');
  el.className = 'cfg-prijs';
  el.innerHTML = `
    <div class="cfg-prijs-kop">
      <span>Eenmalige investering van</span>
      <span class="cfg-staffelchip" data-chip hidden></span>
    </div>
    <div class="cfg-prijs-rij">
      <s class="cfg-prijs-oud" data-oud hidden></s>
      <span class="cfg-prijs-nieuw" data-nieuw>—</span>
      <span class="cfg-prijs-btw">excl. btw</span>
    </div>
    <p class="cfg-prijs-regel" data-regel>Kies hierboven minimaal één TapKaart.</p>`;

  const chip = el.querySelector('[data-chip]') as HTMLElement;
  const oud = el.querySelector('[data-oud]') as HTMLElement;
  const nieuw = el.querySelector('[data-nieuw]') as HTMLElement;
  const regel = el.querySelector('[data-regel]') as HTMLElement;
  let chipStand = '';

  return {
    el,
    update(totals) {
      if (totals.lines.length === 0) {
        oud.hidden = true;
        nieuw.textContent = '—';
        chip.hidden = true;
        chipStand = '';
        regel.textContent = 'Kies hierboven minimaal één TapKaart.';
        return;
      }

      const heeftOud = totals.totalOriginal > totals.total;
      oud.textContent = formatMoney(totals.totalOriginal);
      oud.hidden = !heeftOud;
      nieuw.textContent = formatMoney(totals.total);

      const pct = Math.round(totals.tierPercentage * 100);
      const chipTekst = pct > 0 ? `−${pct}% staffelkorting` : '';
      chip.textContent = chipTekst;
      chip.hidden = chipTekst === '';
      if (chipTekst && chipTekst !== chipStand) pulse(chip);
      chipStand = chipTekst;

      const stuks = `${totals.itemCount} ${totals.itemCount === 1 ? 'kaart' : 'kaarten'}`;
      const wat = totals.lines
        .map((l) => `${l.quantity} × ${l.product.title}${l.optionLabel ? ` (${l.optionLabel.toLowerCase()})` : ''}`)
        .join(' · ');
      const volgende = totals.nextTier
        ? ` — nog ${totals.nextTier.itemsNeeded} ${totals.nextTier.itemsNeeded === 1 ? 'kaart' : 'kaarten'} erbij geeft ${Math.round(totals.nextTier.percentage * 100)}%`
        : '';
      regel.textContent = `${stuks} · ${wat}${volgende}`;
    },
  };
}
