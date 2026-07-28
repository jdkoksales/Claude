import type { CartLine } from '../types';

interface AddItem {
  id: number;
  quantity: number;
}

/** Shopify kan onder een submap draaien; dan moet /checkout dat voorvoegsel ook krijgen. */
function wortel(): string {
  const shopify = (window as unknown as { Shopify?: { routes?: { root?: string } } }).Shopify;
  const root = shopify?.routes?.root || '/';
  return root.endsWith('/') ? root : root + '/';
}

export function kassaUrl(): string {
  return wortel() + 'checkout';
}

/**
 * Legt de samenstelling in de Shopify-winkelwagen en gaat door naar de kassa.
 * Gooit een fout met een leesbare melding zodat de knop die kan tonen.
 */
export async function addToCartAndCheckout(lines: CartLine[]): Promise<void> {
  const items: AddItem[] = lines
    .filter((line) => line.quantity > 0)
    .map((line) => ({ id: line.shop.variantId, quantity: line.quantity }));

  if (items.length === 0) throw new Error('Kies eerst minimaal één TapKaart.');

  const response = await fetch(wortel() + 'cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    let message = 'Toevoegen aan de winkelwagen lukte niet.';
    try {
      const body = (await response.json()) as { description?: string; message?: string };
      message = body.description || body.message || message;
    } catch {
      /* geen JSON terug — houd de standaardmelding aan */
    }
    throw new Error(message);
  }

  // assign() in plaats van href: die werkt ook als de pagina in een frame staat,
  // bijvoorbeeld in de themavoorbeeldweergave van Shopify.
  window.location.assign(kassaUrl());
}
