import type { CartTotals } from '../types';
import { formatMoney } from '../utils/format';
import { VAT_RATE } from '../config/calculatorConfig';

export interface CartSummaryHandle {
  el: HTMLElement;
  update: (totals: CartTotals) => void;
}

export function CartSummary(pricesIncludeVat: boolean): CartSummaryHandle {
  const el = document.createElement('aside');
  el.className = 'cfg-summary';
  el.innerHTML = `
    <div class="cfg-summary-head">Jouw pakket</div>
    <ul class="cfg-lines" data-lines></ul>
    <p class="cfg-empty" data-empty>Nog niets gekozen. Voeg hierboven een TapKaart toe.</p>
    <dl class="cfg-totals" data-totals hidden>
      <div><dt>Subtotaal</dt><dd data-sub>—</dd></div>
      <div><dt>Btw ${Math.round(VAT_RATE * 100)}%</dt><dd data-vat>—</dd></div>
      <div class="cfg-grand"><dt>Totaal</dt><dd data-total>—</dd></div>
    </dl>
    <p class="cfg-vatnote">${pricesIncludeVat ? 'Prijzen zijn inclusief btw.' : 'Btw wordt bij het afrekenen berekend.'}</p>`;

  const list = el.querySelector('[data-lines]') as HTMLElement;
  const empty = el.querySelector('[data-empty]') as HTMLElement;
  const totalsEl = el.querySelector('[data-totals]') as HTMLElement;
  const subEl = el.querySelector('[data-sub]') as HTMLElement;
  const vatEl = el.querySelector('[data-vat]') as HTMLElement;
  const totalEl = el.querySelector('[data-total]') as HTMLElement;

  return {
    el,
    update(totals) {
      list.innerHTML = '';
      for (const line of totals.lines) {
        const li = document.createElement('li');
        li.innerHTML = `<span class="cfg-line-q">${line.quantity} &times;</span>
          <span class="cfg-line-n">${line.product.shop?.title || line.product.title}</span>
          <span class="cfg-line-p">${line.product.shop ? formatMoney(line.product.shop.price * line.quantity) : ''}</span>`;
        list.appendChild(li);
      }
      const has = totals.lines.length > 0;
      empty.hidden = has;
      totalsEl.hidden = !has;
      subEl.textContent = formatMoney(totals.excludingVat);
      vatEl.textContent = formatMoney(totals.vat);
      totalEl.textContent = formatMoney(totals.total);
    },
  };
}
