import type { Product } from '../types';
import { formatMoney } from '../utils/format';
import { pulse } from '../utils/animate';

export interface ProductCardOptions {
  product: Product;
  quantity: number;
  onChange: (delta: number) => void;
}

export interface ProductCardHandle {
  el: HTMLElement;
  setQuantity: (quantity: number, animate: boolean) => void;
  setHint: (text: string) => void;
}

export function ProductCard({ product, quantity, onChange }: ProductCardOptions): ProductCardHandle {
  const el = document.createElement('div');
  el.className = 'cfg-card';
  el.style.setProperty('--card-accent', product.accent);

  const unavailable = !product.shop || !product.shop.available;
  const price = product.shop ? formatMoney(product.shop.price) : '—';
  const image = product.shop?.image;

  el.innerHTML = `
    ${product.badge ? `<span class="cfg-badge">${product.badge}</span>` : ''}
    <div class="cfg-thumb">${image ? `<img src="${image}" alt="${product.title}" loading="lazy" width="300" height="300">` : ''}</div>
    <div class="cfg-name">${product.shop?.title || product.title}</div>
    <p class="cfg-blurb">${product.blurb}</p>
    <div class="cfg-price">${price}</div>
    <div class="cfg-stepper" role="group" aria-label="Aantal ${product.title}">
      <button type="button" data-minus aria-label="Eén minder">&minus;</button>
      <span class="cfg-qty" data-qty aria-live="polite">${quantity}</span>
      <button type="button" data-plus aria-label="Eén meer">+</button>
    </div>
    <div class="cfg-hint" data-hint></div>
    ${unavailable ? '<div class="cfg-warn">Nu niet leverbaar</div>' : ''}`;

  const qtyEl = el.querySelector('[data-qty]') as HTMLElement;
  const hintEl = el.querySelector('[data-hint]') as HTMLElement;
  const minus = el.querySelector('[data-minus]') as HTMLButtonElement;
  const plus = el.querySelector('[data-plus]') as HTMLButtonElement;

  if (unavailable) {
    minus.disabled = true;
    plus.disabled = true;
  } else {
    minus.addEventListener('click', () => onChange(-1));
    plus.addEventListener('click', () => onChange(1));
  }

  const setQuantity = (next: number, animate: boolean): void => {
    qtyEl.textContent = String(next);
    minus.disabled = unavailable || next === 0;
    el.classList.toggle('is-active', next > 0);
    if (animate && next > 0) pulse(qtyEl);
  };

  setQuantity(quantity, false);

  return {
    el,
    setQuantity,
    setHint: (text: string) => {
      hintEl.textContent = text;
      hintEl.hidden = text === '';
    },
  };
}
