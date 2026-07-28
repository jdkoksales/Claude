/**
 * TapKaarten-configurator: bezoekersaantal + productkeuze → geschatte opbrengst
 * per maand, met de bijbehorende samenstelling en één klik naar de kassa.
 *
 * Liquid levert de echte Shopify-gegevens aan in een JSON-blok; alle aannames
 * en producten staan in config/calculatorConfig.ts.
 */
import type { CartLine, CartTotals, Product, Quantities, Selection, ShopifyProduct } from './types';
import { PRODUCTS, SLIDER, VAT_RATE, VOLUME_TIERS } from './config/calculatorConfig';
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

/** Hoogste staffel die bij dit aantal hoort, plus de eerstvolgende. */
function tiersFor(itemCount: number): Pick<CartTotals, 'tierPercentage' | 'nextTier'> {
  const gesorteerd = [...VOLUME_TIERS].sort((a, b) => a.minQuantity - b.minQuantity);
  let tierPercentage = 0;
  let nextTier: CartTotals['nextTier'] = null;
  for (const tier of gesorteerd) {
    if (itemCount >= tier.minQuantity) {
      tierPercentage = tier.percentage;
    } else if (!nextTier) {
      nextTier = { itemsNeeded: tier.minQuantity - itemCount, percentage: tier.percentage };
    }
  }
  return { tierPercentage, nextTier };
}

/** De winkelgegevens van de kleur die op deze kaart gekozen is. */
function gekozenShop(product: Product, selection: Selection): { shop: ShopifyProduct; label?: string } | null {
  const handle = selection[product.id] || product.handle;
  const keuze = (product.shopOptions || []).find((k) => k.handle === handle);
  if (keuze) return { shop: keuze.shop, label: keuze.label };
  return product.shop ? { shop: product.shop } : null;
}

function totalsFor(
  products: Product[],
  quantities: Quantities,
  selection: Selection,
  pricesIncludeVat: boolean
): CartTotals {
  const lines: CartLine[] = [];
  for (const p of products) {
    const aantal = quantities[p.id] || 0;
    if (aantal <= 0) continue;
    const keuze = gekozenShop(p, selection);
    if (!keuze) continue;
    lines.push({ product: p, quantity: aantal, shop: keuze.shop, optionLabel: keuze.label });
  }

  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const bruto = lines.reduce((sum, l) => sum + l.shop.price * l.quantity, 0);
  // De doorgestreepte prijs telt vanaf de originele prijs, niet vanaf de actieprijs.
  const origineel = lines.reduce(
    (sum, l) => sum + (l.shop.compareAtPrice || l.shop.price) * l.quantity,
    0
  );
  const { tierPercentage, nextTier } = tiersFor(itemCount);
  // Shopify rekent de korting per stuk en rondt naar beneden af. Zelfde volgorde
  // aanhouden, anders wijkt dit bedrag een cent af van wat de kassa laat zien.
  const discount = lines.reduce(
    (sum, l) => sum + Math.floor(l.shop.price * tierPercentage) * l.quantity,
    0
  );
  // We verkopen aan bedrijven, dus alle bedragen staan exclusief btw. Rekent de
  // winkel met btw-inclusieve prijzen, dan halen we die er hier weer af zodat
  // wat de klant ziet klopt met wat er op de factuur komt.
  const naarExcl = (bedrag: number): number =>
    pricesIncludeVat ? Math.round(bedrag / (1 + VAT_RATE)) : bedrag;

  const total = bruto - discount;
  const exclTotal = naarExcl(total);
  return {
    lines,
    itemCount,
    total: exclTotal,
    vat: Math.round(exclTotal * VAT_RATE),
    excludingVat: exclTotal,
    totalOriginal: naarExcl(origineel),
    totalBeforeDiscount: naarExcl(bruto),
    discount: naarExcl(discount),
    tierPercentage,
    nextTier,
  };
}

function mount(root: HTMLElement): void {
  if (root.dataset.cfgReady) return;
  const data = readMount(root);
  if (!data) return;
  root.dataset.cfgReady = '1';
  setCurrency(data.currency);

  const byHandle = new Map(data.products.map((p) => [p.handle, p]));
  const products: Product[] = PRODUCTS.map((config) => {
    // Alleen kleuren tonen die de winkel ook echt levert.
    const shopOptions = (config.options || [])
      .map((o) => ({ label: o.label, handle: o.handle, shop: byHandle.get(o.handle) }))
      .filter((o): o is { label: string; handle: string; shop: ShopifyProduct } => Boolean(o.shop));
    return {
      ...config,
      shop: byHandle.get(config.handle) || shopOptions[0]?.shop || null,
      shopOptions: shopOptions.length > 1 ? shopOptions : undefined,
    };
  }).filter((p) => p.shop !== null);

  if (products.length === 0) {
    root.innerHTML = '<p class="cfg-warn">Koppel de producten in de theme-editor om de calculator te tonen.</p>';
    return;
  }

  let visitors: number = SLIDER.default;
  const quantities: Quantities = {};
  const selection: Selection = {};
  for (const p of products) {
    quantities[p.id] = 0;
    selection[p.id] = p.handle;
  }
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
    selection,
    onOption: (id, handle) => {
      selection[id] = handle;
      render(false);
    },
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
  const summary = CartSummary();
  const checkout = CheckoutButton({
    label: data.labels.ctaButton,
    reassurance: data.labels.ctaText,
    getLines: () => totalsFor(products, quantities, selection, data.pricesIncludeVat).lines,
  });

  const layout = document.createElement('div');
  layout.className = 'cfg-layout';
  const main = document.createElement('div');
  main.className = 'cfg-main';
  const side = document.createElement('div');
  side.className = 'cfg-side';

  // Resultaat en bestelknop horen in één blok: één verhaal, één knop.
  const paneel = document.createElement('div');
  paneel.className = 'cfg-out';
  const voet = document.createElement('div');
  voet.className = 'cfg-out-voet';
  voet.append(summary.el, checkout.el);
  paneel.append(results.el, voet);

  main.append(slider, selector.el);
  side.append(paneel);
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

    const totals = totalsFor(products, quantities, selection, data!.pricesIncludeVat);
    summary.update(totals);
    checkout.setEnabled(totals.itemCount > 0);
    if (animate && totals.itemCount > 0) checkout.glans();
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
