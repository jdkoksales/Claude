import { SLIDER } from '../config/calculatorConfig';
import { formatNumber } from '../utils/format';
import { countTo } from '../utils/animate';

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
    <input type="range" min="${SLIDER.min}" max="${SLIDER.max}" step="${SLIDER.step}"
      value="${value}" aria-label="${label}">
    <div class="cfg-ends"><span>${formatNumber(SLIDER.min)}</span><span>${formatNumber(SLIDER.max)}+</span></div>`;

  const input = el.querySelector('input') as HTMLInputElement;
  const count = el.querySelector('[data-count]') as HTMLElement;
  let shown = value;
  let cancel: (() => void) | null = null;

  input.addEventListener('input', () => {
    const next = parseInt(input.value, 10);
    if (cancel) cancel();
    cancel = countTo(count, shown, next, formatNumber);
    shown = next;
    onChange(next);
  });

  return el;
}
