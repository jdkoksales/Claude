import type { CartTotals } from '../types';
import { formatMoney } from '../utils/format';

export interface CartSummaryHandle {
  el: HTMLElement;
  update: (totals: CartTotals) => void;
}

/**
 * Eén regel onder de knop: wat je meeneemt en wat het kost. Bewust klein —
 * de prijs mag de uitkomst niet overschreeuwen. De staffelkorting krijgt wel
 * nadruk, want dat is de reden om er nog een kaart bij te nemen.
 */
export function CartSummary(pricesIncludeVat: boolean): CartSummaryHandle {
  const el = document.createElement('div');
  el.className = 'cfg-summary';
  el.innerHTML = `
    <p class="cfg-summary-line" data-line>Nog niets gekozen.</p>
    <p class="cfg-summary-total" data-total hidden></p>
    <p class="cfg-summary-nudge" data-nudge hidden></p>`;

  const line = el.querySelector('[data-line]') as HTMLElement;
  const total = el.querySelector('[data-total]') as HTMLElement;
  const nudge = el.querySelector('[data-nudge]') as HTMLElement;
  const vatNote = pricesIncludeVat ? 'incl. btw' : 'excl. btw';

  return {
    el,
    update(totals) {
      if (totals.lines.length === 0) {
        line.textContent = 'Kies hierboven minimaal één TapKaart.';
        total.hidden = true;
        nudge.hidden = true;
        return;
      }

      line.textContent = totals.lines
        .map((l) => `${l.quantity} × ${l.product.title}${l.optionLabel ? ` (${l.optionLabel.toLowerCase()})` : ''}`)
        .join(' · ');

      const stuks = `${totals.itemCount} ${totals.itemCount === 1 ? 'kaart' : 'kaarten'}`;
      if (totals.discount > 0) {
        const pct = Math.round(totals.tierPercentage * 100);
        total.innerHTML =
          `${stuks} — <s>${formatMoney(totals.totalBeforeDiscount)}</s> ` +
          `<strong>${formatMoney(totals.total)}</strong> ${vatNote} ` +
          `<span class="cfg-tier-badge">−${pct}% staffelkorting</span>`;
      } else {
        total.textContent = `${stuks} — ${formatMoney(totals.total)} ${vatNote}`;
      }
      total.hidden = false;

      if (totals.nextTier) {
        const { itemsNeeded, percentage } = totals.nextTier;
        nudge.textContent =
          `Nog ${itemsNeeded} ${itemsNeeded === 1 ? 'kaart' : 'kaarten'} erbij en je krijgt ` +
          `${Math.round(percentage * 100)}% staffelkorting.`;
        nudge.hidden = false;
      } else {
        nudge.hidden = true;
      }
    },
  };
}
