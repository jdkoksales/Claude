import type { Product } from '../types';
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

/**
 * Compacte tegel: foto, naam, teller. Bewust geen prijs en geen omschrijving —
 * in de configurator gaat het om de uitkomst, niet om het product.
 */
export function ProductCard({ product, quantity, onChange }: ProductCardOptions): ProductCardHandle {
  const el = document.createElement('div');
  el.className = 'cfg-card';
  el.style.setProperty('--card-accent', product.accent);

  const unavailable = !product.shop || !product.shop.available;
  const image = product.shop?.image;

  el.innerHTML = `
    <div class="cfg-thumb">${image ? `<img src="${image}" alt="" loading="lazy" width="160" height="160">` : ''}</div>
    <div class="cfg-name">${product.title}</div>
    <div class="cfg-stepper" role="group" aria-label="Aantal ${product.title}">
      <button type="button" data-minus aria-label="Eén ${product.title} minder">&minus;</button>
      <span class="cfg-qty" data-qty aria-live="polite">${quantity}</span>
      <button type="button" data-plus aria-label="Eén ${product.title} meer">+</button>
    </div>
    <div class="cfg-hint" data-hint hidden></div>
    ${unavailable ? '<div class="cfg-warn">Niet leverbaar</div>' : ''}`;

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
