import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import {
  db, dropPhoto, find, getPhoto, newId, putPhoto, remove, replaceStore,
  storeKind, touch, withStore,
} from './db.js';
import {
  currentUser, hashPin, isValidPinFormat, login, logout, requireAuth, verifyPin,
} from './auth.js';
import { addDays, todayKey, weekStart } from './lib/dates.js';
import { albumDate, describeRepeat, expandEvents } from './lib/recurrence.js';
import { BOTH, goalStats, openToday } from './lib/goals.js';
import {
  CATEGORIES, FUN, InputError, REMINDER_CHOICES, commentInput, entryInput,
  eventInput, goalInput, photoInput, taskInput,
} from './lib/validate.js';
import {
  addSubscription, notify, publicKey, pushReady, removeSubscription,
} from './push.js';
import { startScheduler, tick } from './scheduler.js';

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));

/**
 * Elk API-verzoek draait binnen een geladen opslag. Het antwoord gaat pas de
 * deur uit als de wijziging is weggeschreven — bij een hostingdienst kan het
 * proces vlak na het antwoord bevriezen, en dan zou het opslaan halverwege
 * blijven steken.
 */
app.use('/api', (req, res, next) => {
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const realEnd = res.end.bind(res);
  let endArgs = null;
  let settle;
  const responded = new Promise((resolve) => { settle = resolve; });

  res.end = (...args) => {
    if (endArgs === null) {
      endArgs = args;
      settle();
      return res;
    }
    return realEnd(...args);
  };

  withStore(mutating, async () => {
    next();
    await responded;
  }).then(
    () => realEnd(...(endArgs || [])),
    (err) => {
      console.error('[opslag]', err);
      if (res.headersSent) return realEnd(...(endArgs || []));
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return realEnd(JSON.stringify({
        error: 'De opslag is even niet bereikbaar. Probeer het zo opnieuw.',
      }));
    },
  );
});

// Bewust ver uit elkaar liggende kleuren: in de weekagenda moet je in één
// oogopslag zien van wie een afspraak is.
const PALETTE = ['#3a7ca5', '#e26d5c', '#c9852b', '#4c8577', '#a05195', '#6c7ae0'];
const today = () => todayKey(config.app.timezone);
const userIds = () => db().users.map((u) => u.id);
const publicUser = (u) => ({ id: u.id, name: u.name, color: u.color });

// ── Openbaar: wie zijn we, en is de app al ingericht ────────────────────────

/** Voor de gezondheidscheck van de hostingdienst. */
app.get('/api/health', (req, res) => res.json({ ok: true, users: db().users.length }));

app.get('/api/bootstrap', (req, res) => {
  const store = db();
  res.json({
    setupNeeded: store.users.length === 0,
    users: store.users.map(publicUser),
    me: currentUser(req)?.id || null,
    push: { available: pushReady(), key: publicKey() },
    timezone: config.app.timezone,
    today: today(),
    reminderChoices: REMINDER_CHOICES,
    categories: CATEGORIES,
  });
});

/** Eenmalige inrichting: twee (of meer) mensen met elk een eigen pincode. */
app.post('/api/setup', (req, res, next) => {
  try {
    const store = db();
    if (store.users.length > 0) {
      throw Object.assign(new Error('De app is al ingericht.'), { status: 409 });
    }
    const people = Array.isArray(req.body?.people) ? req.body.people : [];
    if (people.length < 1 || people.length > 6) {
      throw new InputError('Vul minstens één en hoogstens zes personen in.');
    }
    const names = new Set();
    const pins = new Set();
    for (const person of people) {
      const name = String(person?.name || '').trim();
      if (!name || name.length > 40) throw new InputError('Vul voor iedereen een naam in.');
      if (names.has(name.toLowerCase())) throw new InputError('Gebruik verschillende namen.');
      if (!isValidPinFormat(person?.pin)) {
        throw new InputError('Elke pincode is 4 tot 10 cijfers.');
      }
      if (pins.has(person.pin)) throw new InputError('Kies voor iedereen een andere pincode.');
      names.add(name.toLowerCase());
      pins.add(person.pin);
    }
    store.users = people.map((person, i) => {
      const { salt, hash } = hashPin(person.pin);
      return {
        id: newId(),
        name: person.name.trim(),
        color: PALETTE[i % PALETTE.length],
        pinSalt: salt,
        pinHash: hash,
        createdAt: new Date().toISOString(),
      };
    });
    touch();
    res.json({ ok: true, users: store.users.map(publicUser) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/login', (req, res, next) => {
  try {
    const user = login(req, res, req.body?.userId, String(req.body?.pin ?? ''));
    if (!user) return res.status(401).json({ error: 'Pincode klopt niet.' });
    return res.json({ user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
});

app.post('/api/logout', (req, res) => {
  logout(res);
  res.json({ ok: true });
});

// ── Klopje van buiten ──────────────────────────────────────────────────────

/**
 * Op een hostingdienst zonder doorlopend proces (Vercel) is er niets dat elke
 * minuut kan kijken of er een herinnering klaarstaat. Daarom kan iets van
 * buitenaf — in ons geval een taak in de database zelf — dit adres aanroepen.
 * Het geheim staat in de opslag en wordt bij de eerste start aangemaakt.
 */
app.post('/api/cron/tick', async (req, res) => {
  const expected = db().settings?.cronSecret;
  const given = req.get('x-samen-cron') || req.query.key;
  if (!expected || given !== expected) {
    return res.status(401).json({ error: 'Onbekende sleutel.' });
  }
  const result = await tick();
  return res.json({ ok: true, ...result });
});

// ── Vanaf hier moet je ingelogd zijn ────────────────────────────────────────

const api = express.Router();
api.use(requireAuth);
app.use('/api', api);

api.get('/me', (req, res) => res.json({ user: publicUser(req.user) }));

api.patch('/me', (req, res, next) => {
  try {
    const name = String(req.body?.name ?? '').trim();
    if (name) {
      if (name.length > 40) throw new InputError('Naam mag maximaal 40 tekens zijn.');
      req.user.name = name;
    }
    if (req.body?.color && PALETTE.includes(req.body.color)) req.user.color = req.body.color;
    touch();
    res.json({ user: publicUser(req.user) });
  } catch (err) {
    next(err);
  }
});

api.patch('/me/pin', (req, res, next) => {
  try {
    if (!verifyPin(String(req.body?.current ?? ''), req.user)) {
      throw Object.assign(new Error('Huidige pincode klopt niet.'), { status: 401 });
    }
    if (!isValidPinFormat(req.body?.next)) {
      throw new InputError('De nieuwe pincode is 4 tot 10 cijfers.');
    }
    const { salt, hash } = hashPin(req.body.next);
    req.user.pinSalt = salt;
    req.user.pinHash = hash;
    touch();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Alles wat een scherm nodig heeft in één verzoek. De agenda wordt voor de
 * gevraagde periode uitgerekend (herhalingen worden hier pas losse dagen), de
 * doelen krijgen hun cijfers meegestuurd zodat de browser niets hoeft te rekenen.
 */
api.get('/state', (req, res, next) => {
  try {
    const store = db();
    const now = today();
    const from = req.query.from || weekStart(now);
    const to = req.query.to || addDays(from, 41);
    if (from > to) throw new InputError('De periode loopt achteruit.');

    const goals = store.goals.map((goal) => ({
      ...goal,
      stats: goalStats(goal, now),
      repeatLabel: undefined,
    }));

    res.json({
      today: now,
      range: { from, to },
      users: store.users.map(publicUser),
      events: expandEvents(store.events, from, to).map((e) => ({
        ...e,
        repeatLabel: describeRepeat(e.repeat),
      })),
      goals,
      tasks: store.tasks,
      photos: store.photos || [],
      openToday: openToday(
        store.goals.filter((g) => g.ownerId === req.user.id || g.ownerId === BOTH),
        now,
      ).map(({ goal, urgent }) => ({ goalId: goal.id, urgent })),
    });
  } catch (err) {
    next(err);
  }
});

// ── Agenda ─────────────────────────────────────────────────────────────────

api.post('/events', (req, res, next) => {
  try {
    const data = eventInput(req.body, userIds());
    const event = {
      id: newId(),
      ...data,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db().events.push(event);
    touch();
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
});

api.patch('/events/:id', (req, res, next) => {
  try {
    const event = find('events', req.params.id);
    if (!event) return res.status(404).json({ error: 'Afspraak niet gevonden.' });
    const data = eventInput({ ...event, ...req.body }, userIds());
    Object.assign(event, data, { updatedAt: new Date().toISOString() });
    touch();
    return res.json({ event });
  } catch (err) {
    return next(err);
  }
});

api.delete('/events/:id', async (req, res, next) => {
  try {
    const store = db();
    // Anders blijven de foto's als wees achter in de opslag.
    const orphans = (store.photos || []).filter((p) => p.eventId === req.params.id);
    for (const photo of orphans) await dropPhoto(photo.id);
    if (orphans.length) {
      store.photos = store.photos.filter((p) => p.eventId !== req.params.id);
      touch();
    }
    const ok = remove('events', req.params.id);
    return res.status(ok ? 200 : 404)
      .json(ok ? { ok: true, photosRemoved: orphans.length } : { error: 'Afspraak niet gevonden.' });
  } catch (err) {
    return next(err);
  }
});

// ── Doelen ─────────────────────────────────────────────────────────────────

api.post('/goals', (req, res, next) => {
  try {
    const data = goalInput(req.body, userIds());
    const goal = {
      id: newId(),
      ...data,
      checkins: {},
      entries: [],
      createdBy: req.user.id,
      createdDate: today(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (goal.kind === 'project' && !goal.startDate) goal.startDate = goal.createdDate;
    db().goals.push(goal);
    touch();
    res.status(201).json({ goal: { ...goal, stats: goalStats(goal, today()) } });
  } catch (err) {
    next(err);
  }
});

api.patch('/goals/:id', (req, res, next) => {
  try {
    const goal = find('goals', req.params.id);
    if (!goal) return res.status(404).json({ error: 'Doel niet gevonden.' });
    // De soort ligt vast: van gewoonte naar project overstappen zou de
    // opgebouwde geschiedenis betekenisloos maken.
    const data = goalInput({ ...goal, ...req.body, kind: goal.kind }, userIds());
    Object.assign(goal, data, { updatedAt: new Date().toISOString() });
    touch();
    return res.json({ goal: { ...goal, stats: goalStats(goal, today()) } });
  } catch (err) {
    return next(err);
  }
});

api.delete('/goals/:id', (req, res) => {
  const ok = remove('goals', req.params.id);
  res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: 'Doel niet gevonden.' });
});

/** Afvinken (of ontvinken) voor een dag. Je vinkt altijd voor jezelf af. */
api.post('/goals/:id/checkin', (req, res, next) => {
  try {
    const goal = find('goals', req.params.id);
    if (!goal) return res.status(404).json({ error: 'Doel niet gevonden.' });
    if (goal.kind !== 'habit') throw new InputError('Dit doel werkt met bijdragen, niet afvinken.');
    const date = req.body?.date || today();
    if (date > today()) throw new InputError('Je kunt niet vooruit afvinken.');
    if (date < addDays(today(), -60)) throw new InputError('Zo ver terug kun je niet meer afvinken.');

    goal.checkins ||= {};
    const list = new Set(goal.checkins[date] || []);
    const wanted = req.body?.on ?? !list.has(req.user.id);
    if (wanted) list.add(req.user.id);
    else list.delete(req.user.id);
    if (list.size) goal.checkins[date] = [...list];
    else delete goal.checkins[date];
    goal.updatedAt = new Date().toISOString();
    touch();
    return res.json({ goal: { ...goal, stats: goalStats(goal, today()) } });
  } catch (err) {
    return next(err);
  }
});

/** Bijdrage aan een projectdoel, bijv. "€120 gespaard". */
api.post('/goals/:id/entries', (req, res, next) => {
  try {
    const goal = find('goals', req.params.id);
    if (!goal) return res.status(404).json({ error: 'Doel niet gevonden.' });
    if (goal.kind !== 'project') throw new InputError('Dit doel vink je af, je telt er niet bij op.');
    const data = entryInput(req.body, userIds());
    goal.entries ||= [];
    goal.entries.push({
      id: newId(),
      date: data.date || today(),
      userId: data.userId || req.user.id,
      amount: data.amount,
      note: data.note,
      createdAt: new Date().toISOString(),
    });
    goal.entries.sort((a, b) => (a.date < b.date ? -1 : 1));
    goal.updatedAt = new Date().toISOString();
    touch();
    return res.status(201).json({ goal: { ...goal, stats: goalStats(goal, today()) } });
  } catch (err) {
    return next(err);
  }
});

api.delete('/goals/:id/entries/:entryId', (req, res) => {
  const goal = find('goals', req.params.id);
  if (!goal) return res.status(404).json({ error: 'Doel niet gevonden.' });
  const before = (goal.entries || []).length;
  goal.entries = (goal.entries || []).filter((e) => e.id !== req.params.entryId);
  if (goal.entries.length === before) return res.status(404).json({ error: 'Bijdrage niet gevonden.' });
  goal.updatedAt = new Date().toISOString();
  touch();
  return res.json({ goal: { ...goal, stats: goalStats(goal, today()) } });
});

// ── Momenten: foto's en opmerkingen bij een uitje of vakantie ──────────────

/**
 * Foto's en opmerkingen hangen aan een album, niet aan de afspraak als geheel:
 * een vakantie van tien dagen krijgt één album, terwijl een afspraak die zich
 * herhaalt er een per keer krijgt. Zie albumDate().
 */
function albumFor(req) {
  const event = find('events', req.params.id);
  if (!event) {
    throw Object.assign(new Error('Afspraak niet gevonden.'), { status: 404 });
  }
  return { event, date: albumDate(event, req.body?.date || req.query.date) };
}

api.post('/events/:id/photos', async (req, res, next) => {
  try {
    const { event, date } = albumFor(req);
    const { mime, bytes, caption } = photoInput(req.body);
    const id = newId();
    await putPhoto(id, mime, bytes);
    const store = db();
    store.photos ||= [];
    const photo = {
      id,
      eventId: event.id,
      date,
      mime,
      size: bytes.length,
      caption,
      userId: req.user.id,
      createdAt: new Date().toISOString(),
    };
    store.photos.push(photo);
    touch();
    res.status(201).json({ photo });
  } catch (err) {
    next(err);
  }
});

/**
 * De afbeelding zelf. De naam is een willekeurige uuid die nooit verandert,
 * dus de browser mag hem eeuwig bewaren; dat scheelt een hoop verkeer bij het
 * terugbladeren door oude vakanties.
 */
api.get('/photos/:photoId', async (req, res, next) => {
  try {
    const meta = (db().photos || []).find((p) => p.id === req.params.photoId);
    if (!meta) return res.status(404).json({ error: 'Foto niet gevonden.' });
    const bytes = await getPhoto(meta.id);
    if (!bytes) return res.status(404).json({ error: 'Foto niet gevonden.' });
    res.setHeader('Content-Type', meta.mime);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    return res.end(Buffer.from(bytes));
  } catch (err) {
    return next(err);
  }
});

api.delete('/photos/:photoId', async (req, res, next) => {
  try {
    const store = db();
    const idx = (store.photos || []).findIndex((p) => p.id === req.params.photoId);
    if (idx === -1) return res.status(404).json({ error: 'Foto niet gevonden.' });
    await dropPhoto(req.params.photoId);
    store.photos.splice(idx, 1);
    touch();
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

api.post('/events/:id/comments', (req, res, next) => {
  try {
    const { event, date } = albumFor(req);
    const { text } = commentInput(req.body);
    event.comments ||= [];
    const comment = {
      id: newId(),
      date,
      text,
      userId: req.user.id,
      createdAt: new Date().toISOString(),
    };
    event.comments.push(comment);
    touch();
    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
});

api.delete('/events/:id/comments/:commentId', (req, res) => {
  const event = find('events', req.params.id);
  if (!event) return res.status(404).json({ error: 'Afspraak niet gevonden.' });
  const before = (event.comments || []).length;
  event.comments = (event.comments || []).filter((c) => c.id !== req.params.commentId);
  if (event.comments.length === before) {
    return res.status(404).json({ error: 'Opmerking niet gevonden.' });
  }
  touch();
  return res.json({ ok: true });
});

/**
 * Alle uitjes en vakanties op een rij, gesplitst in wat nog komt en wat
 * geweest is. Herhalende afspraken tellen hier niet mee: een wekelijkse
 * sportles is geen moment om op terug te kijken.
 */
api.get('/moments', (req, res) => {
  const store = db();
  const now = today();
  const photos = store.photos || [];

  const items = store.events
    .filter((e) => FUN.includes(e.category) && !e.repeat)
    .map((event) => {
      const end = event.endDate || event.date;
      const album = albumDate(event, event.date);
      return {
        ...event,
        endsOn: end,
        upcoming: end >= now,
        photoCount: photos.filter((p) => p.eventId === event.id && p.date === album).length,
        commentCount: (event.comments || []).filter((c) => c.date === album).length,
      };
    });

  res.json({
    today: now,
    upcoming: items.filter((i) => i.upcoming).sort((a, b) => (a.date < b.date ? -1 : 1)),
    past: items.filter((i) => !i.upcoming).sort((a, b) => (a.endsOn > b.endsOn ? -1 : 1)),
  });
});

// ── Taken ──────────────────────────────────────────────────────────────────

api.post('/tasks', (req, res, next) => {
  try {
    const data = taskInput(req.body, userIds());
    const task = {
      id: newId(),
      ...data,
      done: false,
      doneAt: null,
      doneBy: null,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
    };
    db().tasks.push(task);
    touch();
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

api.patch('/tasks/:id', (req, res, next) => {
  try {
    const task = find('tasks', req.params.id);
    if (!task) return res.status(404).json({ error: 'Taak niet gevonden.' });
    if (typeof req.body?.done === 'boolean') {
      task.done = req.body.done;
      task.doneAt = task.done ? new Date().toISOString() : null;
      task.doneBy = task.done ? req.user.id : null;
    }
    if (req.body?.title != null || req.body?.assigneeId !== undefined || req.body?.dueDate !== undefined) {
      Object.assign(task, taskInput({ ...task, ...req.body }, userIds()));
    }
    touch();
    return res.json({ task });
  } catch (err) {
    return next(err);
  }
});

api.delete('/tasks/:id', (req, res) => {
  const ok = remove('tasks', req.params.id);
  res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: 'Taak niet gevonden.' });
});

/** Alle afgeronde taken in één keer opruimen. */
api.post('/tasks/clear-done', (req, res) => {
  const store = db();
  const before = store.tasks.length;
  store.tasks = store.tasks.filter((t) => !t.done);
  touch();
  res.json({ removed: before - store.tasks.length });
});

// ── Meldingen ──────────────────────────────────────────────────────────────

api.post('/push/subscribe', (req, res, next) => {
  try {
    const sub = req.body?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      throw new InputError('Ongeldig abonnement voor meldingen.');
    }
    addSubscription(req.user.id, sub);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

api.post('/push/unsubscribe', (req, res) => {
  if (req.body?.endpoint) removeSubscription(req.body.endpoint);
  res.json({ ok: true });
});

api.post('/push/test', async (req, res) => {
  const sent = await notify(req.user.id, {
    title: 'Meldingen werken',
    body: 'Zo ziet een herinnering eruit.',
    tag: 'test',
    url: '/',
  });
  res.json({ sent });
});

// ── Back-up ────────────────────────────────────────────────────────────────

api.get('/export', (req, res) => {
  const { users, ...rest } = db();
  res.setHeader('Content-Disposition', `attachment; filename="samen-${today()}.json"`);
  res.json({
    ...rest,
    // Pincodes gaan niet mee in een back-up die je in je downloads bewaart.
    users: users.map(publicUser),
  });
});

api.post('/import', (req, res, next) => {
  try {
    const incoming = req.body?.data;
    if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.events)) {
      throw new InputError('Dit bestand ziet er niet uit als een back-up van deze app.');
    }
    const store = db();
    // De inloggegevens van nu blijven staan; alleen de inhoud wordt vervangen.
    replaceStore({
      ...incoming,
      users: store.users,
      pushSubs: store.pushSubs,
      sent: {},
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Statische bestanden en foutafhandeling ─────────────────────────────────

app.use(express.static(join(here, '..', 'public'), { maxAge: '1h', index: 'index.html' }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(join(here, '..', 'public', 'index.html'));
});

app.use((req, res) => res.status(404).json({ error: 'Onbekend adres.' }));

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[server]', err);
  res.status(status).json({ error: err.message || 'Er ging iets mis.' });
});

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  // Alleen zinvol bij een proces dat blijft draaien; op Vercel doet de
  // database dit klopje (zie /api/cron/tick).
  startScheduler();
  app.listen(config.app.port, () => {
    console.log(`Samen draait op http://localhost:${config.app.port} (opslag: ${storeKind()})`);
  });
}

export default app;
