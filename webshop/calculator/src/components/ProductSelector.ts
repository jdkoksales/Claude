import type { Product, Quantities, Selection } from '../types';
import { PRESETS } from '../config/calculatorConfig';
import { ProductCard, type ProductCardHandle } from './ProductCard';

export interface ProductSelectorOptions {
  label: string;
  products: Product[];
  quantities: Quantities;
  selection: Selection;
  onChange: (id: string, delta: number) => void;
  onOption: (id: string, handle: string) => void;
  onPreset: (quantities: Quantities) => void;
}

export interface ProductSelectorHandle {
  el: HTMLElement;
  update: (quantities: Quantities, hints: Record<string, string>, animate: boolean) => void;
}

export function ProductSelector({
  label,
  products,
  quantities,
  selection,
  onChange,
  onOption,
  onPreset,
}: ProductSelectorOptions): ProductSelectorHandle {
  const el = document.createElement('div');
  el.className = 'cfg-block';
  el.innerHTML = `
    <div class="cfg-step">Stap 2</div>
    <div class="cfg-q">${label}</div>
    <div class="cfg-presets" role="group" aria-label="Snelkeuze"></div>
    <div class="cfg-cards"></div>`;

  const presetRow = el.querySelector('.cfg-presets') as HTMLElement;
  for (const preset of PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cfg-preset';
    button.innerHTML = `<strong>${preset.label}</strong><span>${preset.hint}</span>`;
    button.addEventListener('click', () => onPreset({ ...preset.quantities }));
    presetRow.appendChild(button);
  }

  const grid = el.querySelector('.cfg-cards') as HTMLElement;
  const cards = new Map<string, ProductCardHandle>();

  for (const product of products) {
    const card = ProductCard({
      product,
      quantity: quantities[product.id] || 0,
      option: selection[product.id] || product.handle,
      onChange: (delta) => onChange(product.id, delta),
      onOption: (handle) => onOption(product.id, handle),
    });
    cards.set(product.id, card);
    grid.appendChild(card.el);
  }

  return {
    el,
    update(next, hints, animate) {
      cards.forEach((card, id) => {
        card.setQuantity(next[id] || 0, animate);
        card.setHint(hints[id] || '');
      });
    },
  };
}
