const reduced = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Laat een getal naar zijn nieuwe waarde toe lopen in plaats van springen.
 * Geeft een functie terug waarmee je een lopende animatie afbreekt.
 */
export function countTo(
  element: HTMLElement,
  from: number,
  to: number,
  render: (value: number) => string
): () => void {
  if (from === to) {
    element.textContent = render(to);
    return () => {};
  }
  if (reduced()) {
    element.textContent = render(to);
    return () => {};
  }

  const start = performance.now();
  const duration = Math.min(700, 200 + Math.abs(to - from) * 1.4);
  let frame = 0;

  const tick = (now: number): void => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    element.textContent = render(Math.round(from + (to - from) * eased));
    if (t < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return () => cancelAnimationFrame(frame);
}

/** Korte puls, bijvoorbeeld wanneer een product wordt toegevoegd. */
export function pulse(element: HTMLElement): void {
  if (reduced()) return;
  element.classList.remove('is-pulse');
  void element.offsetWidth;
  element.classList.add('is-pulse');
}
