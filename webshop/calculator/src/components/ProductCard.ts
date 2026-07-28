import type { Product } from '../types';
import { pulse } from '../utils/animate';

export interface ProductCardOptions {
  product: Product;
  quantity: number;
  option: string;
  onChange: (delta: number) => void;
  onOption: (handle: string) => void;
}

export interface ProductCardHandle {
  el: HTMLElement;
  setQuantity: (quantity: number, animate: boolean) => void;
  setHint: (text: string) => void;
}

/**
 * Compacte tegel: foto, naam, teller. Bewust geen prijs en geen omschrijving —
 * in de configurator gaat het om de uitkomst, niet om het product. Heeft de
 * kaart een kleurkeuze, dan staat die als twee knopjes onder de naam.
 */
export function ProductCard({
  product,
  quantity,
  option,
  onChange,
  onOption,
}: ProductCardOptions): ProductCardHandle {
  const el = document.createElement('div');
  el.className = 'cfg-card';
  el.style.setProperty('--card-accent', product.accent);

  const keuzes = product.shopOptions || [];
  const gekozen = () => keuzes.find((k) => k.handle === option) || keuzes[0];
  const actief = keuzes.length > 1 ? gekozen() : null;
  const shop = actief ? actief.shop : product.shop;
  const unavailable = !shop || !shop.available;

  el.innerHTML = `
    <div class="cfg-thumb" data-thumb>${shop?.image ? `<img src="${shop.image}" alt="" loading="lazy" width="160" height="160">` : ''}</div>
    <div class="cfg-name">${product.title}</div>
    ${
      keuzes.length > 1
        ? `<div class="cfg-kleur" role="group" aria-label="Kleur ${product.title}">
             ${keuzes
               .map(
                 (k) =>
                   `<button type="button" data-kleur="${k.handle}" aria-pressed="${k.handle === option}">${k.label}</button>`
               )
               .join('')}
           </div>`
        : ''
    }
    <div class="cfg-stepper" role="group" aria-label="Aantal ${product.title}">
      <button type="button" data-minus aria-label="Eén ${product.title} minder">&minus;</button>
      <span class="cfg-qty" data-qty aria-live="polite">${quantity}</span>
      <button type="button" data-plus aria-label="Eén ${product.title} meer">+</button>
    </div>
    <div class="cfg-hint" data-hint hidden></div>
    ${unavailable ? '<div class="cfg-warn">Niet leverbaar</div>' : ''}`;

  const qtyEl = el.querySelector('[data-qty]') as HTMLElement;
  const hintEl = el.querySelector('[data-hint]') as HTMLElement;
  const thumbEl = el.querySelector('[data-thumb]') as HTMLElement;
  const minus = el.querySelector('[data-minus]') as HTMLButtonElement;
  const plus = el.querySelector('[data-plus]') as HTMLButtonElement;

  if (unavailable) {
    minus.disabled = true;
    plus.disabled = true;
  } else {
    minus.addEventListener('click', () => onChange(-1));
    plus.addEventListener('click', () => onChange(1));
  }

  // Kleurkeuze wisselt de foto meteen mee, zodat je ziet wat je kiest.
  el.querySelectorAll<HTMLButtonElement>('[data-kleur]').forEach((knop) => {
    knop.addEventListener('click', () => {
      const handle = knop.getAttribute('data-kleur') as string;
      el.querySelectorAll('[data-kleur]').forEach((k) =>
        k.setAttribute('aria-pressed', String(k === knop))
      );
      const keuze = keuzes.find((k) => k.handle === handle);
      if (keuze) {
        el.style.setProperty('--card-accent', keuze.label === 'Zwart' ? '#1A202C' : product.accent);
        thumbEl.innerHTML = keuze.shop.image
          ? `<img src="${keuze.shop.image}" alt="" width="160" height="160">`
          : '';
      }
      onOption(handle);
    });
  });

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
