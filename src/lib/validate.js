import { isDateKey, isTime, minutesOfDay } from './dates.js';
import { normalizeRepeat } from './recurrence.js';
import { BOTH } from './goals.js';

/**
 * Invoer die van de browser komt controleren voordat er iets wordt opgeslagen.
 * Elke functie geeft een schoongemaakt object terug of gooit een fout met een
 * uitlegbare Nederlandse melding die we rechtstreeks aan de gebruiker tonen.
 */

export class InputError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const fail = (message) => {
  throw new InputError(message);
};

export function text(value, field, { max = 200, required = true } = {}) {
  const str = typeof value === 'string' ? value.trim() : '';
  if (!str) {
    if (required) fail(`${field} mag niet leeg zijn.`);
    return '';
  }
  if (str.length > max) fail(`${field} mag maximaal ${max} tekens zijn.`);
  return str;
}

export function ownerId(value, userIds, { allowBoth = true } = {}) {
  if (allowBoth && value === BOTH) return BOTH;
  if (userIds.includes(value)) return value;
  fail('Onbekende eigenaar voor dit item.');
  return null;
}

export function dateKey(value, field) {
  if (!isDateKey(value)) fail(`${field} moet een datum zijn (JJJJ-MM-DD).`);
  return value;
}

const REMINDER_CHOICES = [0, 5, 10, 15, 30, 60, 120, 720, 1440];

/**
 * Waar hoort deze afspraak thuis?
 *
 *  - gewoon   — tandarts, werk, alles wat gewoon in de agenda moet
 *  - leuk     — uitjes en dingen om naar uit te kijken
 *  - vakantie — meerdaags, met een t/m-datum
 *
 * Alleen 'leuk' en 'vakantie' komen op het Momenten-scherm terecht.
 */
export const CATEGORIES = ['gewoon', 'leuk', 'vakantie'];
export const FUN = ['leuk', 'vakantie'];

/**
 * De plek op de kaart. Allebei of geen van beide: aan één helft van een
 * coördinaat heb je niets, en een speld midden in de oceaan is erger dan geen
 * speld. Afgerond op zes decimalen — dat is ruim een tiende meter, en scheelt
 * ruimte in de ene rij waar alles in staat.
 */
export function place(lat, lon) {
  const leeg = (v) => v == null || v === '';
  if (leeg(lat) && leeg(lon)) return { lat: null, lon: null };
  if (leeg(lat) || leeg(lon)) fail('Een plek heeft zowel een breedte- als een lengtegraad nodig.');
  const a = Number(lat);
  const o = Number(lon);
  if (!Number.isFinite(a) || !Number.isFinite(o)) fail('Die plek op de kaart klopt niet.');
  if (a < -90 || a > 90 || o < -180 || o > 180) fail('Die plek ligt buiten de kaart.');
  const round = (n) => Math.round(n * 1e6) / 1e6;
  return { lat: round(a), lon: round(o) };
}

export function eventInput(body, userIds) {
  const allDay = Boolean(body.allDay);
  const category = CATEGORIES.includes(body.category) ? body.category : 'gewoon';
  const out = {
    title: text(body.title, 'Titel', { max: 120 }),
    ownerId: ownerId(body.ownerId, userIds),
    date: dateKey(body.date, 'Datum'),
    category,
    endDate: null,
    allDay,
    start: null,
    end: null,
    location: text(body.location, 'Locatie', { max: 120, required: false }),
    ...place(body.lat, body.lon),
    notes: text(body.notes, 'Notitie', { max: 2000, required: false }),
    repeat: normalizeRepeat(body.repeat),
    reminderMin: null,
  };

  if (!allDay) {
    if (!isTime(body.start)) fail('Begintijd moet als UU:MM worden ingevuld.');
    out.start = body.start;
    if (body.end) {
      if (!isTime(body.end)) fail('Eindtijd moet als UU:MM worden ingevuld.');
      if (minutesOfDay(body.end) < minutesOfDay(body.start)) {
        fail('De eindtijd ligt vóór de begintijd.');
      }
      out.end = body.end;
    }
    if (body.reminderMin != null && body.reminderMin !== '') {
      const n = Number(body.reminderMin);
      if (!REMINDER_CHOICES.includes(n)) fail('Die herinneringstijd kan niet.');
      out.reminderMin = n;
    }
  }

  if (body.endDate) {
    out.endDate = dateKey(body.endDate, 'Einddatum');
    if (out.endDate < out.date) fail('De einddatum ligt vóór de begindatum.');
    // Een reeks die zich óók nog herhaalt levert overlappende voorkomens op;
    // dat is niet uit te leggen en niet te tonen.
    if (out.repeat) fail('Iets dat meerdere dagen duurt kan zich niet ook herhalen.');
    if (out.endDate === out.date) out.endDate = null;
  }

  if (out.repeat?.until && out.repeat.until < out.date) {
    fail('De herhaling eindigt vóór de eerste datum.');
  }
  return out;
}

/** Een opmerking bij een uitje of vakantie. */
export function commentInput(body) {
  return { text: text(body.text, 'Opmerking', { max: 1000 }) };
}

// Foto's worden in de browser al verkleind; dit is de vangrail voor het geval
// dat mislukt of iemand rechtstreeks naar de API stuurt.
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Pelt een data-URL uit de browser af tot mimetype en ruwe bytes. */
export function photoInput(body) {
  const url = typeof body?.dataUrl === 'string' ? body.dataUrl : '';
  const m = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(url);
  if (!m) fail('Dit ziet er niet uit als een afbeelding.');
  const [, mime, base64] = m;
  if (!PHOTO_TYPES.includes(mime)) {
    fail('Alleen JPEG, PNG of WebP kunnen we opslaan.');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0) fail('Deze afbeelding is leeg.');
  if (bytes.length > MAX_PHOTO_BYTES) {
    fail('Deze foto is te groot. Probeer er een die kleiner is dan 3 MB.');
  }
  return {
    mime,
    bytes,
    caption: text(body.caption, 'Bijschrift', { max: 200, required: false }),
  };
}

export function goalInput(body, userIds) {
  const kind = body.kind === 'project' ? 'project' : 'habit';
  const base = {
    kind,
    title: text(body.title, 'Titel', { max: 120 }),
    note: text(body.note, 'Toelichting', { max: 500, required: false }),
    ownerId: ownerId(body.ownerId, userIds),
    archived: Boolean(body.archived),
  };

  if (kind === 'habit') {
    const type = body.cadence?.type === 'weekly' ? 'weekly' : 'daily';
    if (type === 'weekly') {
      const n = Number(body.cadence?.timesPerWeek);
      if (!Number.isInteger(n) || n < 1 || n > 7) {
        fail('Kies hoe vaak per week: een geheel getal van 1 tot en met 7.');
      }
      base.cadence = { type: 'weekly', timesPerWeek: n };
    } else {
      base.cadence = { type: 'daily' };
    }
    return base;
  }

  const targetRaw = Number(body.target);
  if (!Number.isFinite(targetRaw) || targetRaw <= 0) {
    fail('Vul een streefgetal groter dan 0 in.');
  }
  base.target = Math.round(targetRaw * 100) / 100;
  base.unit = text(body.unit, 'Eenheid', { max: 20, required: false }) || 'x';
  base.deadline = body.deadline ? dateKey(body.deadline, 'Streefdatum') : null;
  base.startDate = body.startDate ? dateKey(body.startDate, 'Startdatum') : null;
  if (base.deadline && base.startDate && base.deadline < base.startDate) {
    fail('De streefdatum ligt vóór de startdatum.');
  }
  return base;
}

export function entryInput(body, userIds) {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    fail('Vul een bedrag of aantal in dat niet 0 is.');
  }
  return {
    amount: Math.round(amount * 100) / 100,
    date: body.date ? dateKey(body.date, 'Datum') : null,
    note: text(body.note, 'Notitie', { max: 200, required: false }),
    userId: body.userId && userIds.includes(body.userId) ? body.userId : null,
  };
}

export function taskInput(body, userIds) {
  let assignee = null;
  if (body.assigneeId != null && body.assigneeId !== '') {
    assignee = ownerId(body.assigneeId, userIds);
  }
  return {
    title: text(body.title, 'Titel', { max: 140 }),
    assigneeId: assignee,
    dueDate: body.dueDate ? dateKey(body.dueDate, 'Datum') : null,
    note: text(body.note, 'Notitie', { max: 500, required: false }),
  };
}

export { MAX_PHOTO_BYTES, REMINDER_CHOICES };
