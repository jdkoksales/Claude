/** Types voor de TapKaarten-configurator. */

export type Category = 'google' | 'instagram' | 'facebook';

/** Aflopende opbrengst per extra exemplaar van hetzelfde product. */
export interface ExposureCurve {
  /** Waarde van het 1e, 2e, 3e exemplaar. */
  steps: number[];
  /** Waarde van elk exemplaar daarna. */
  tail: number;
}

/** Een kleurkeuze binnen één kaart: zelfde product, ander Shopify-artikel. */
export interface ProductOption {
  /** Wat er op het knopje staat, bijvoorbeeld "Wit". */
  label: string;
  handle: string;
}

/** Statische productdefinitie — staat in calculatorConfig.ts. */
export interface ProductConfig {
  id: string;
  /** Shopify-handle van de standaardkeuze. */
  handle: string;
  /** Laat staan als er niets te kiezen valt; anders de kleuren. */
  options?: ProductOption[];
  title: string;
  blurb: string;
  category: Category;
  exposure: ExposureCurve;
  accent: string;
  /** Optioneel label op de kaart, bijvoorbeeld "Meest gekozen". */
  badge?: string;
}

/** Wat Liquid server-side meegeeft: echte prijzen en variant-ID's. */
export interface ShopifyProduct {
  handle: string;
  title: string;
  variantId: number;
  /** In centen, zoals Shopify het levert. */
  price: number;
  available: boolean;
  url: string;
  image: string | null;
}

/** Definitie plus live winkelgegevens. */
export interface Product extends ProductConfig {
  shop: ShopifyProduct | null;
  /** Alleen gevuld bij een kleurkeuze; per keuze de winkelgegevens. */
  shopOptions?: { label: string; handle: string; shop: ShopifyProduct }[];
}

export interface CategoryResult {
  category: Category;
  exposure: number;
  effectiveness: number;
  perMonth: number;
}

export interface CalculationResult {
  visitorsPerDay: number;
  visitorsPerMonth: number;
  checkoutVisitors: number;
  byCategory: Record<Category, CategoryResult>;
}

export interface CartLine {
  product: Product;
  quantity: number;
  /** De gekozen kleurvariant; hiermee gaat de regel naar de winkelwagen. */
  shop: ShopifyProduct;
  /** "Wit" of "Zwart" als er iets te kiezen viel. */
  optionLabel?: string;
}

/** Welke kleur er per product gekozen is, op Shopify-handle. */
export type Selection = Record<string, string>;

export interface CartTotals {
  lines: CartLine[];
  itemCount: number;
  /** Alles in centen. */
  total: number;
  vat: number;
  excludingVat: number;
  /** Totaal vóór staffelkorting, in centen. */
  totalBeforeDiscount: number;
  /** Bedrag dat de staffelkorting scheelt, in centen. */
  discount: number;
  /** Actief staffelpercentage (0 = geen). */
  tierPercentage: number;
  /** Volgende staffel als die binnen bereik is. */
  nextTier: { itemsNeeded: number; percentage: number } | null;
}

export type Quantities = Record<string, number>;
