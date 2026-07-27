let currency = 'EUR';

export function setCurrency(code: string): void {
  if (code) currency = code;
}

const number = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });

export function formatNumber(value: number): string {
  return number.format(value);
}

/** Shopify levert prijzen in centen. */
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
