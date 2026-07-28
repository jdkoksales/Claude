import type { CartLine } from '../types';
import { addToCartAndCheckout, kassaUrl } from '../utils/cart';

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
    <p class="cfg-noodlink" data-noodlink hidden>
      Blijft de kassa uit? <a href="#" data-naar-kassa>Ga rechtstreeks naar afrekenen</a>.
    </p>
    <p class="cfg-gerust">${reassurance}</p>`;

  const button = el.querySelector('[data-go]') as HTMLButtonElement;
  const tekst = button.querySelector('span') as HTMLElement;
  const error = el.querySelector('[data-error]') as HTMLElement;
  const noodlink = el.querySelector('[data-noodlink]') as HTMLElement;
  (el.querySelector('[data-naar-kassa]') as HTMLAnchorElement).href = kassaUrl();

  button.addEventListener('click', async () => {
    error.hidden = true;
    noodlink.hidden = true;
    button.disabled = true;
    button.classList.add('is-busy');
    tekst.textContent = 'Bezig…';
    // Springt de browser om wat voor reden dan ook niet door, dan moet er een
    // gewone link staan waar je zelf op kunt klikken.
    const vangnet = window.setTimeout(() => {
      noodlink.hidden = false;
      button.disabled = false;
      button.classList.remove('is-busy');
      tekst.textContent = label;
    }, 4000);
    try {
      await addToCartAndCheckout(getLines());
    } catch (err) {
      window.clearTimeout(vangnet);
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
