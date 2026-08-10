/**
 * Datumhulp. De server draait vaak in UTC terwijl wij in Nederland leven, dus
 * "vandaag" wordt altijd in een expliciete tijdzone bepaald. Datums zijn
 * overal strings in de vorm YYYY-MM-DD en tijden HH:MM — nooit Date-objecten
 * in de opslag, dat voorkomt zomertijd-verrassingen.
 */

const DAY_MS = 86400000;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Onderdelen van een moment in een bepaalde tijdzone. */
export function zonedParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const out = {};
  for (const { type, value } of fmt.formatToParts(date)) out[type] = value;
  // 'en-CA' geeft 24 uur, maar middernacht kan als '24' terugkomen.
  const hour = out.hour === '24' ? '00' : out.hour;
  return {
    date: `${out.year}-${out.month}-${out.day}`,
    time: `${hour}:${out.minute}`,
  };
}

/** De datum van vandaag (YYYY-MM-DD) in de gegeven tijdzone. */
export function todayKey(timeZone, now = new Date()) {
  return zonedParts(now, timeZone).date;
}

/** De klok van dit moment (HH:MM) in de gegeven tijdzone. */
export function nowTime(timeZone, now = new Date()) {
  return zonedParts(now, timeZone).time;
}

/** De offset van een tijdzone op een bepaald moment, in minuten t.o.v. UTC. */
export function offsetMinutes(timeZone, at) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  });
  const part = fmt.formatToParts(at).find((p) => p.type === 'timeZoneName');
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part?.value || '');
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * Zet een lokale datum+tijd om naar een echt moment (Date). Twee rondes,
 * omdat de offset zelf van het moment afhangt (zomer-/wintertijd).
 */
export function zonedToInstant(dateKey, time, timeZone) {
  const [y, mo, d] = dateKey.split('-').map(Number);
  const [h, mi] = (time || '00:00').split(':').map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let guess = new Date(naive - offsetMinutes(timeZone, new Date(naive)) * 60000);
  guess = new Date(naive - offsetMinutes(timeZone, guess) * 60000);
  return guess;
}

/** Datumsleutel n dagen verder (n mag negatief zijn). */
export function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + n * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** Aantal hele dagen tussen twee datumsleutels (b - a). */
export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

/** 1 = maandag … 7 = zondag. */
export function weekday(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** De maandag van de week waarin deze datum valt. */
export function weekStart(dateKey) {
  return addDays(dateKey, -(weekday(dateKey) - 1));
}

/** ISO-weeksleutel, bijv. "2026-W33". Handig als groepeersleutel. */
export function isoWeekKey(dateKey) {
  const thursday = addDays(weekStart(dateKey), 3);
  const [y] = thursday.split('-').map(Number);
  const jan4 = `${y}-01-04`;
  const week = Math.floor(daysBetween(weekStart(jan4), thursday) / 7) + 1;
  return `${y}-W${String(week).padStart(2, '0')}`;
}

/** Alle datumsleutels van `from` t/m `to` (inclusief). */
export function eachDay(from, to) {
  const out = [];
  const n = daysBetween(from, to);
  for (let i = 0; i <= n; i += 1) out.push(addDays(from, i));
  return out;
}

/** Geldige datumsleutel? Ook echt bestaande dagen (31 februari valt af). */
export function isDateKey(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

export function isTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

/** Minuten sinds middernacht, voor het sorteren en vergelijken van tijden. */
export function minutesOfDay(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
