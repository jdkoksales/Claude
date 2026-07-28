import { SLIDER } from '../config/calculatorConfig';
import { formatNumber } from '../utils/format';
import { countTo } from '../utils/animate';
import { positionToVisitors, visitorsToPosition } from '../utils/slider';

export interface VisitorSliderOptions {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export function VisitorSlider({ label, value, onChange }: VisitorSliderOptions): HTMLElement {
  const el = document.createElement('div');
  el.className = 'cfg-block';
  el.innerHTML = `
    <div class="cfg-step">Stap 1</div>
    <div class="cfg-q">${label}</div>
    <div class="cfg-bignum"><span data-count>${formatNumber(value)}</span><small>bezoekers per dag</small></div>
    <input type="range" min="0" max="${SLIDER.positions}" step="1"
      value="${visitorsToPosition(value)}"
      aria-label="${label}"
      aria-valuemin="${SLIDER.min}" aria-valuemax="${SLIDER.max}"
      aria-valuenow="${value}" aria-valuetext="${value} bezoekers per dag">
    <div class="cfg-ends"><span>${formatNumber(SLIDER.min)}</span><span>${formatNumber(SLIDER.max)}+</span></div>`;

  const input = el.querySelector('input') as HTMLInputElement;
  const count = el.querySelector('[data-count]') as HTMLElement;
  let shown = value;
  let cancel: (() => void) | null = null;

  input.addEventListener('input', () => {
    const next = positionToVisitors(parseInt(input.value, 10));
    // Meerdere standen kunnen op hetzelfde afgeronde aantal uitkomen; dan is er
    // niets te tellen en hoeft de rest van de calculator niet te rekenen.
    if (next === shown) return;
    input.setAttribute('aria-valuenow', String(next));
    input.setAttribute('aria-valuetext', `${next} bezoekers per dag`);
    if (cancel) cancel();
    cancel = countTo(count, shown, next, formatNumber);
    shown = next;
    onChange(next);
  });

  return el;
}
