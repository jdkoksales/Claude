import type { CalculationResult, Category, CategoryResult, Product, Quantities } from '../types';
import { ASSUMPTIONS, BASE_CONVERSION } from '../config/calculatorConfig';

const CATEGORIES: Category[] = ['google', 'instagram', 'facebook'];

/**
 * Exposure van één product bij een aantal exemplaren.
 * Het eerste exemplaar telt volledig, elk volgende steeds minder.
 */
export function exposureFor(product: Product, quantity: number): number {
  const { steps, tail } = product.exposure;
  let total = 0;
  for (let i = 0; i < quantity; i++) {
    total += i < steps.length ? steps[i] : tail;
  }
  return total;
}

/**
 * Van exposure naar effectiviteit. `1 - e^(-x)` loopt vanzelf af: elke extra
 * kaart voegt minder toe dan de vorige. Genormaliseerd telt de eerste
 * standaard voor 100%.
 */
export function effectiveness(totalExposure: number): number {
  if (totalExposure <= 0) return 0;
  const raw = 1 - Math.exp(-totalExposure);
  if (!ASSUMPTIONS.normaliseEffectiveness) return raw;
  return raw / (1 - Math.exp(-1));
}

export function calculate(
  visitorsPerDay: number,
  products: Product[],
  quantities: Quantities
): CalculationResult {
  const visitorsPerMonth = visitorsPerDay * ASSUMPTIONS.daysPerMonth;
  const checkoutVisitors = visitorsPerMonth * ASSUMPTIONS.checkoutShare;

  const byCategory = {} as Record<Category, CategoryResult>;
  for (const category of CATEGORIES) {
    const exposure = products
      .filter((p) => p.category === category)
      .reduce((sum, p) => sum + exposureFor(p, quantities[p.id] || 0), 0);
    const eff = effectiveness(exposure);
    byCategory[category] = {
      category,
      exposure,
      effectiveness: eff,
      perMonth: Math.round(checkoutVisitors * BASE_CONVERSION[category] * eff),
    };
  }

  return { visitorsPerDay, visitorsPerMonth, checkoutVisitors, byCategory };
}

/** Hoeveel de eerstvolgende van dit product nog toevoegt, in procenten. */
export function marginalGain(product: Product, quantities: Quantities, products: Product[]): number {
  const current = products
    .filter((p) => p.category === product.category)
    .reduce((sum, p) => sum + exposureFor(p, quantities[p.id] || 0), 0);
  const next = current + exposureFor(product, (quantities[product.id] || 0) + 1) - exposureFor(product, quantities[product.id] || 0);
  const before = effectiveness(current);
  const after = effectiveness(next);
  if (after <= 0) return 0;
  return before === 0 ? 100 : Math.round(((after - before) / before) * 100);
}
