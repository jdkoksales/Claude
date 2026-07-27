import type { CartLine } from '../types';
import { addToCartAndCheckout } from '../utils/cart';

export interface CheckoutButtonOptions {
  heading: string;
  text: string;
  label: string;
  getLines: () => CartLine[];
}

export interface CheckoutButtonHandle {
  el: HTMLElement;
  setEnabled: (enabled: boolean) => void;
}

export function CheckoutButton({ heading, text, label, getLines }: CheckoutButtonOptions): CheckoutButtonHandle {
  const el = document.createElement('div');
  el.className = 'cfg-cta';
  el.innerHTML = `
    <h3>${heading}</h3>
    <p>${text}</p>
    <button type="button" class="btn-primary cfg-checkout" data-go>${label}</button>
    <p class="cfg-error" role="alert" data-error hidden></p>`;

  const button = el.querySelector('[data-go]') as HTMLButtonElement;
  const error = el.querySelector('[data-error]') as HTMLElement;

  button.addEventListener('click', async () => {
    error.hidden = true;
    button.disabled = true;
    button.classList.add('is-busy');
    button.textContent = 'Bezig…';
    try {
      await addToCartAndCheckout(getLines());
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : 'Er ging iets mis.';
      error.hidden = false;
      button.disabled = false;
      button.classList.remove('is-busy');
      button.textContent = label;
    }
  });

  return {
    el,
    setEnabled(enabled) {
      button.disabled = !enabled;
      button.classList.toggle('is-off', !enabled);
    },
  };
}
