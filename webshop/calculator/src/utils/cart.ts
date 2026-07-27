import type { CartLine } from '../types';

interface AddItem {
  id: number;
  quantity: number;
}

/**
 * Legt de samenstelling in de Shopify-winkelwagen en gaat door naar de kassa.
 * Gooit een fout met een leesbare melding zodat de knop die kan tonen.
 */
export async function addToCartAndCheckout(lines: CartLine[]): Promise<void> {
  const items: AddItem[] = lines
    .filter((line) => line.product.shop && line.quantity > 0)
    .map((line) => ({ id: line.product.shop!.variantId, quantity: line.quantity }));

  if (items.length === 0) throw new Error('Kies eerst minimaal één TapKaart.');

  const response = await fetch('/cart/add.js', {
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

  window.location.href = '/checkout';
}
