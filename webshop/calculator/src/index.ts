/**
 * TapKaarten-configurator: bezoekersaantal + productkeuze → geschatte opbrengst
 * per maand, met de bijbehorende samenstelling en één klik naar de kassa.
 *
 * Liquid levert de echte Shopify-gegevens aan in een JSON-blok; alle aannames
 * en producten staan in config/calculatorConfig.ts.
 */
import type { CartLine, CartTotals, Product, Quantities, ShopifyProduct } from './types';
import { PRODUCTS, SLIDER, VAT_RATE } from './config/calculatorConfig';
import { calculate, marginalGain } from './utils/calc';
import { setCurrency } from './utils/format';
import { VisitorSlider } from './components/VisitorSlider';
import { ProductSelector } from './components/ProductSelector';
import { Results } from './components/Results';
import { CartSummary } from './components/CartSummary';
import { CheckoutButton } from './components/CheckoutButton';

interface Mount {
  currency: string;
  pricesIncludeVat: boolean;
  products: ShopifyProduct[];
  labels: {
    slider: string;
    selector: string;
    resultsIntro: string;
    ctaHeading: string;
    ctaText: string;
    ctaButton: string;
  };
}

function readMount(root: HTMLElement): Mount | null {
  const script = root.querySelector('script[type="application/json"]');
  if (!script || !script.textContent) return null;
  try {
    return JSON.parse(script.textContent) as Mount;
  } catch {
    return null;
  }
}

function totalsFor(products: Product[], quantities: Quantities, pricesIncludeVat: boolean): CartTotals {
  const lines: CartLine[] = products
    .filter((p) => (quantities[p.id] || 0) > 0)
    .map((p) => ({ product: p, quantity: quantities[p.id] }));

  const total = lines.reduce((sum, l) => sum + (l.product.shop?.price || 0) * l.quantity, 0);
  const excludingVat = pricesIncludeVat ? Math.round(total / (1 + VAT_RATE)) : total;
  return {
    lines,
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    total: pricesIncludeVat ? total : Math.round(total * (1 + VAT_RATE)),
    vat: pricesIncludeVat ? total - excludingVat : Math.round(total * VAT_RATE),
    excludingVat,
  };
}

function mount(root: HTMLElement): void {
  if (root.dataset.cfgReady) return;
  const data = readMount(root);
  if (!data) return;
  root.dataset.cfgReady = '1';
  setCurrency(data.currency);

  const byHandle = new Map(data.products.map((p) => [p.handle, p]));
  const products: Product[] = PRODUCTS.map((config) => ({
    ...config,
    shop: byHandle.get(config.handle) || null,
  })).filter((p) => p.shop !== null);

  if (products.length === 0) {
    root.innerHTML = '<p class="cfg-warn">Koppel de producten in de theme-editor om de calculator te tonen.</p>';
    return;
  }

  let visitors: number = SLIDER.default;
  const quantities: Quantities = {};
  for (const p of products) quantities[p.id] = 0;
  const first = products.find((p) => p.id === 'google-standaard') || products[0];
  quantities[first.id] = 1;

  const slider = VisitorSlider({
    label: data.labels.slider,
    value: visitors,
    onChange: (value) => {
      visitors = value;
      render(false);
    },
  });

  const selector = ProductSelector({
    label: data.labels.selector,
    products,
    quantities,
    onChange: (id, delta) => {
      quantities[id] = Math.max(0, Math.min(20, (quantities[id] || 0) + delta));
      render(true);
    },
    onPreset: (next) => {
      for (const p of products) quantities[p.id] = next[p.id] || 0;
      render(true);
    },
  });

  const results = Results(data.labels.resultsIntro);
  const summary = CartSummary(data.pricesIncludeVat);
  const checkout = CheckoutButton({
    heading: data.labels.ctaHeading,
    text: data.labels.ctaText,
    label: data.labels.ctaButton,
    getLines: () => totalsFor(products, quantities, data.pricesIncludeVat).lines,
  });

  const layout = document.createElement('div');
  layout.className = 'cfg-layout';
  const main = document.createElement('div');
  main.className = 'cfg-main';
  const side = document.createElement('div');
  side.className = 'cfg-side';

  main.append(slider, selector.el);
  side.append(results.el, checkout.el, summary.el);
  layout.append(main, side);
  root.append(layout);

  function render(animate: boolean): void {
    const result = calculate(visitors, products, quantities);
    results.update(result);

    // Laat zien wat de eerstvolgende kaart nog toevoegt — eerlijk, ook als dat weinig is.
    const hints: Record<string, string> = {};
    for (const p of products) {
      const qty = quantities[p.id] || 0;
      if (qty >= 1) {
        const gain = marginalGain(p, quantities, products);
        hints[p.id] = gain > 0 ? `Nog één erbij: +${gain}% bereik` : '';
      }
    }
    selector.update(quantities, hints, animate);

    const totals = totalsFor(products, quantities, data!.pricesIncludeVat);
    summary.update(totals);
    checkout.setEnabled(totals.itemCount > 0);
  }

  render(false);
}

function init(): void {
  document.querySelectorAll<HTMLElement>('[data-tk3-configurator]').forEach(mount);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
document.addEventListener('shopify:section:load', init);
