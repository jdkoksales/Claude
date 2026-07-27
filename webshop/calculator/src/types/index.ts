/** Types voor de TapKaarten-configurator. */

export type Category = 'google' | 'instagram' | 'facebook';

/** Aflopende opbrengst per extra exemplaar van hetzelfde product. */
export interface ExposureCurve {
  /** Waarde van het 1e, 2e, 3e exemplaar. */
  steps: number[];
  /** Waarde van elk exemplaar daarna. */
  tail: number;
}

/** Statische productdefinitie — staat in calculatorConfig.ts. */
export interface ProductConfig {
  id: string;
  /** Shopify-handle; koppelt aan de gegevens die Liquid meegeeft. */
  handle: string;
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
}

export interface CartTotals {
  lines: CartLine[];
  itemCount: number;
  /** Alles in centen. */
  total: number;
  vat: number;
  excludingVat: number;
}

export type Quantities = Record<string, number>;
