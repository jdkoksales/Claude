import type { CartTotals } from '../types';
import { formatMoney } from '../utils/format';

export interface CartSummaryHandle {
  el: HTMLElement;
  update: (totals: CartTotals) => void;
}

/**
 * Eén regel onder de knop: wat je meeneemt en wat het kost. Bewust klein —
 * de prijs mag de uitkomst niet overschreeuwen.
 */
export function CartSummary(pricesIncludeVat: boolean): CartSummaryHandle {
  const el = document.createElement('div');
  el.className = 'cfg-summary';
  el.innerHTML = `
    <p class="cfg-summary-line" data-line>Nog niets gekozen.</p>
    <p class="cfg-summary-total" data-total hidden></p>`;

  const line = el.querySelector('[data-line]') as HTMLElement;
  const total = el.querySelector('[data-total]') as HTMLElement;
  const vatNote = pricesIncludeVat ? 'incl. btw' : 'excl. btw';

  return {
    el,
    update(totals) {
      if (totals.lines.length === 0) {
        line.textContent = 'Kies hierboven minimaal één TapKaart.';
        total.hidden = true;
        return;
      }
      line.textContent = totals.lines
        .map((l) => `${l.quantity} × ${l.product.title}`)
        .join(' · ');
      total.textContent = `${totals.itemCount} ${totals.itemCount === 1 ? 'kaart' : 'kaarten'} — ${formatMoney(totals.total)} ${vatNote}`;
      total.hidden = false;
    },
  };
}
