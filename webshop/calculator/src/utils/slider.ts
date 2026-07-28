import { SLIDER } from '../config/calculatorConfig';

/**
 * De schuifbalk werkt met standen (0 … SLIDER.positions), niet met bezoekers.
 * Onderweg naar bezoekers gaat er een macht overheen, zodat de eerste helft
 * van de balk over de kleine aantallen gaat en je 30 net zo makkelijk raakt
 * als 300.
 */
const SPAN = SLIDER.max - SLIDER.min;

/** Afronden op een getal dat je ook echt zou noemen. */
export function roundVisitors(value: number): number {
  if (value <= 50) return Math.round(value);
  if (value <= 200) return Math.round(value / 5) * 5;
  if (value <= 500) return Math.round(value / 10) * 10;
  return Math.round(value / 25) * 25;
}

export function positionToVisitors(position: number): number {
  const t = Math.min(1, Math.max(0, position / SLIDER.positions));
  const raw = SLIDER.min + SPAN * Math.pow(t, SLIDER.curve);
  return Math.min(SLIDER.max, Math.max(SLIDER.min, roundVisitors(raw)));
}

export function visitorsToPosition(visitors: number): number {
  const clamped = Math.min(SLIDER.max, Math.max(SLIDER.min, visitors));
  const t = Math.pow((clamped - SLIDER.min) / SPAN, 1 / SLIDER.curve);
  return Math.round(t * SLIDER.positions);
}
