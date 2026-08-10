import { addDays, daysBetween, eachDay, isDateKey, weekday } from './dates.js';

/**
 * Herhalingen worden niet als losse rijen opgeslagen maar uitgerekend wanneer
 * je een periode opvraagt. Eén afspraak met `repeat` levert dus meerdere
 * "voorkomens" op, elk met een eigen datum en een stabiel occurrenceId.
 */

export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

/** Valt deze herhaling op deze dag? */
export function occursOn(event, dateKey) {
  const start = event.date;
  if (dateKey < start) return false;
  const repeat = event.repeat;
  if (!repeat) return dateKey === start;
  if (repeat.until && dateKey > repeat.until) return false;

  const interval = Math.max(1, Number(repeat.interval) || 1);
  const [sy, sm, sd] = start.split('-').map(Number);
  const [dy, dm, dd] = dateKey.split('-').map(Number);

  switch (repeat.freq) {
    case 'daily':
      return daysBetween(start, dateKey) % interval === 0;
    case 'weekly': {
      const diff = daysBetween(start, dateKey);
      if (diff % 7 !== 0) return false;
      return (diff / 7) % interval === 0;
    }
    case 'monthly': {
      const months = (dy - sy) * 12 + (dm - sm);
      if (months < 0 || months % interval !== 0) return false;
      // Een afspraak op de 31e slaan we over in maanden zonder 31e dag,
      // in plaats van hem stilletjes te verschuiven.
      return dd === sd;
    }
    case 'yearly': {
      const years = dy - sy;
      return years >= 0 && years % interval === 0 && dm === sm && dd === sd;
    }
    default:
      return dateKey === start;
  }
}

/** Loopt deze afspraak over meerdere dagen? Zo ja: t/m welke dag. */
export function spanEnd(event) {
  return event.endDate && event.endDate > event.date ? event.endDate : null;
}

/**
 * Alle voorkomens van één afspraak binnen [from, to].
 *
 * Een vakantie beslaat meerdere dagen en verschijnt dus op elke dag ertussen,
 * met daarbij welke dag van hoeveel het is. Herhalen én meerdaags tegelijk kan
 * niet — dat wordt in de invoercontrole al tegengehouden.
 */
export function expandEvent(event, from, to) {
  const until = spanEnd(event);
  if (!event.repeat) {
    const first = event.date;
    const last = until || event.date;
    if (last < from || first > to) return [];
    const total = daysBetween(first, last) + 1;
    const out = [];
    for (const day of eachDay(first > from ? first : from, last < to ? last : to)) {
      out.push(occurrence(event, day, daysBetween(first, day) + 1, total));
    }
    return out;
  }
  const out = [];
  const first = event.date > from ? event.date : from;
  const last = event.repeat.until && event.repeat.until < to ? event.repeat.until : to;
  if (first > last) return out;
  for (const day of eachDay(first, last)) {
    if (occursOn(event, day)) out.push(occurrence(event, day));
  }
  return out;
}

function occurrence(event, dateKey, dayIndex = 1, dayCount = 1) {
  return {
    ...event,
    date: dateKey,
    occurrenceId: `${event.id}@${dateKey}`,
    isRepeat: Boolean(event.repeat),
    dayIndex,
    dayCount,
  };
}

/**
 * Onder welke sleutel horen de foto's en opmerkingen van dit voorkomen?
 *
 * Bij een vakantie van tien dagen wil je één album, niet tien; bij een
 * afspraak die zich herhaalt juist een album per keer. Vandaar: herhalingen
 * krijgen de dag zelf, al het andere de begindatum van de afspraak.
 */
export function albumDate(event, occurrenceDate) {
  return event.repeat ? (occurrenceDate || event.date) : event.date;
}

/** Alle voorkomens van een lijst afspraken, gesorteerd op datum en tijd. */
export function expandEvents(events, from, to) {
  const out = [];
  for (const event of events) out.push(...expandEvent(event, from, to));
  out.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const at = a.allDay ? '' : a.start || '';
    const bt = b.allDay ? '' : b.start || '';
    if (at !== bt) return at < bt ? -1 : 1;
    return a.title.localeCompare(b.title, 'nl');
  });
  return out;
}

/** Controleert een herhaling uit de invoer; geeft null terug als er geen is. */
export function normalizeRepeat(input) {
  if (input == null || input === '' || input === 'none') return null;
  if (typeof input !== 'object') throw new Error('Ongeldige herhaling.');
  if (!FREQUENCIES.includes(input.freq)) {
    throw new Error(`Herhaling moet een van ${FREQUENCIES.join(', ')} zijn.`);
  }
  const interval = Number(input.interval ?? 1);
  if (!Number.isInteger(interval) || interval < 1 || interval > 52) {
    throw new Error('Interval moet een geheel getal tussen 1 en 52 zijn.');
  }
  let until = null;
  if (input.until) {
    if (!isDateKey(input.until)) throw new Error('Einddatum van de herhaling is ongeldig.');
    until = input.until;
  }
  return { freq: input.freq, interval, until };
}

const UNITS = {
  daily: ['dag', 'dagen'],
  weekly: ['week', 'weken'],
  monthly: ['maand', 'maanden'],
  yearly: ['jaar', 'jaar'],
};

/** Korte omschrijving voor in de interface, bijv. "elke 2 weken". */
export function describeRepeat(repeat) {
  if (!repeat) return '';
  const n = repeat.interval;
  const [one, many] = UNITS[repeat.freq] || ['keer', 'keer'];
  const base = n === 1 ? `elke ${one}` : `elke ${n} ${many}`;
  return repeat.until ? `${base}, t/m ${repeat.until}` : base;
}

/** Volgende dag vanaf `fromDate` waarop deze afspraak valt (of null). */
export function nextOccurrence(event, fromDate, horizonDays = 400) {
  for (let i = 0; i <= horizonDays; i += 1) {
    const day = addDays(fromDate, i);
    if (occursOn(event, day)) return day;
  }
  return null;
}

export { weekday };
