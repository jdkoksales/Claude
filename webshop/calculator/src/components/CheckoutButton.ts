import type { CartLine } from '../types';
import { addToCartAndCheckout } from '../utils/cart';

export interface CheckoutButtonOptions {
  label: string;
  reassurance: string;
  getLines: () => CartLine[];
}

export interface CheckoutButtonHandle {
  el: HTMLElement;
  setEnabled: (enabled: boolean) => void;
  glans: () => void;
}

/**
 * De enige knop in het blok. Alles eromheen is bewust rustig gehouden zodat
 * dit het felste vlak is; daarom zit de glans hier en nergens anders.
 */
export function CheckoutButton({ label, reassurance, getLines }: CheckoutButtonOptions): CheckoutButtonHandle {
  const el = document.createElement('div');
  el.className = 'cfg-cta';
  el.innerHTML = `
    <button type="button" class="cfg-checkout" data-go>
      <span>${label}</span><span class="cfg-pijl" aria-hidden="true">→</span>
    </button>
    <p class="cfg-error" role="alert" data-error hidden></p>
    <p class="cfg-gerust">${reassurance}</p>`;

  const button = el.querySelector('[data-go]') as HTMLButtonElement;
  const tekst = button.querySelector('span') as HTMLElement;
  const error = el.querySelector('[data-error]') as HTMLElement;

  button.addEventListener('click', async () => {
    error.hidden = true;
    button.disabled = true;
    button.classList.add('is-busy');
    tekst.textContent = 'Bezig…';
    try {
      await addToCartAndCheckout(getLines());
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : 'Er ging iets mis.';
      error.hidden = false;
      button.disabled = false;
      button.classList.remove('is-busy');
      tekst.textContent = label;
    }
  });

  return {
    el,
    setEnabled(enabled) {
      button.disabled = !enabled;
      button.classList.toggle('is-off', !enabled);
    },
    glans() {
      button.classList.remove('is-glans');
      void button.offsetWidth;
      button.classList.add('is-glans');
    },
  };
}
