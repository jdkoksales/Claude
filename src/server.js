import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import { db, find, newId, remove, replaceStore, save, saveSoon } from './db.js';
import {
  currentUser, hashPin, isValidPinFormat, login, logout, requireAuth, verifyPin,
} from './auth.js';
import { addDays, todayKey, weekStart } from './lib/dates.js';
import { describeRepeat, expandEvents } from './lib/recurrence.js';
import { BOTH, goalStats, openToday } from './lib/goals.js';
import {
  InputError, REMINDER_CHOICES, entryInput, eventInput, goalInput, taskInput,
} from './lib/validate.js';
import {
  addSubscription, initPush, notify, publicKey, pushReady, removeSubscription,
} from './push.js';
import { startScheduler } from './scheduler.js';

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));

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
    save();
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
    saveSoon();
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
    save();
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
    saveSoon();
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
    saveSoon();
    return res.json({ event });
  } catch (err) {
    return next(err);
  }
});

api.delete('/events/:id', (req, res) => {
  const ok = remove('events', req.params.id);
  res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: 'Afspraak niet gevonden.' });
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
    saveSoon();
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
    saveSoon();
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
    saveSoon();
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
    saveSoon();
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
  saveSoon();
  return res.json({ goal: { ...goal, stats: goalStats(goal, today()) } });
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
    saveSoon();
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
    saveSoon();
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
  saveSoon();
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
  initPush();
  startScheduler();
  app.listen(config.app.port, () => {
    console.log(`Samen draait op http://localhost:${config.app.port}`);
    if (db().users.length === 0) console.log('Open de app om hem in te richten.');
  });
}

export default app;
