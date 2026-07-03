/**
 * Datumlogica. Een "dag" loopt tot 03:00 lokale tijd: wie om 01:30 nog logt,
 * logt voor de avond ervoor. Alle functies zijn puur en unit-getest.
 */

export const DAY_BOUNDARY_HOUR = 3;
const DAY_MS = 86400000;

/** Kalenderdag (YYYY-MM-DD, lokale tijd) waar dit tijdstip bij hoort. */
export function dayKey(date = new Date()) {
  const shifted = new Date(date.getTime() - DAY_BOUNDARY_HOUR * 3600000);
  const off = shifted.getTimezoneOffset() * 60000;
  return new Date(shifted.getTime() - off).toISOString().slice(0, 10);
}

export function todayKey(now = new Date()) {
  return dayKey(now);
}

export function yesterdayKey(now = new Date()) {
  return dayKey(new Date(now.getTime() - DAY_MS));
}

/** Alleen vandaag en gisteren mogen gelogd worden. */
export function canLogDay(key, now = new Date()) {
  return key === todayKey(now) || key === yesterdayKey(now);
}

/** YYYY-MM-DD → Date op 12:00 lokale tijd (DST-veilig rekenanker). */
export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function addDays(key, n) {
  const noon = new Date(keyToDate(key).getTime() + n * DAY_MS);
  const off = noon.getTimezoneOffset() * 60000;
  return new Date(noon.getTime() - off).toISOString().slice(0, 10);
}

/** Hele dagen tussen twee keys (b − a). */
export function diffDays(a, b) {
  return Math.round((keyToDate(b) - keyToDate(a)) / DAY_MS);
}

/** "maandag 6 juli" voor in de UI. */
export function labelFor(key, opts = {}) {
  return keyToDate(key).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...opts,
  });
}

/** 0=zondag … 6=zaterdag van een dag-key. */
export function weekdayOf(key) {
  return keyToDate(key).getDay();
}

/** ISO-weeknummer als "2026-W27" (voor weekreviews). */
export function isoWeek(key) {
  const d = keyToDate(key);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / DAY_MS + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Raster voor de maand-heatmap van de maand waarin `key` valt. */
export function monthGrid(key) {
  const d = keyToDate(key);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-11
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // maandag als eerste kolom (0=ma … 6=zo)
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const keys = [];
  for (let i = 1; i <= daysInMonth; i++) {
    keys.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
  }
  return { year, month, daysInMonth, firstWeekday, keys };
}
