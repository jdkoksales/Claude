import express from 'express';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config, assertEnv } from './config.js';
import {
  raw, replaceStore, goals, dayLogs, tasks, reviews, coachLog, settings, sessions,
} from './db.js';
import {
  todayKey, yesterdayKey, labelFor, monthGrid, isoWeek,
} from './lib/dates.js';
import { stats, detectTrigger, buildCoachPayload } from './lib/insights.js';
import { generateCard } from './coach.js';
import { ensureV2 } from './lib/migrate.js';

assertEnv(['ANTHROPIC_API_KEY', 'APP_PIN']);

if (!/^\d{4,6}$/.test(config.app.pin)) {
  throw new Error('APP_PIN moet 4 tot 6 cijfers zijn (bv. APP_PIN=4821).');
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' })); // import van een backup moet passen

// ─── Login (ongewijzigd gedrag) ─────────────────────────
const attempts = new Map();
const MAX_TRIES = 5;
const LOCK_MS = 15 * 60 * 1000;

function pinMatches(pin) {
  const a = Buffer.from(String(pin ?? '').padEnd(12, '#'));
  const b = Buffer.from(config.app.pin.padEnd(12, '#'));
  return crypto.timingSafeEqual(a, b);
}

app.post('/api/login', (req, res) => {
  const ip = req.ip || 'unknown';
  const entry = attempts.get(ip) || { count: 0, lockedUntil: 0 };
  if (Date.now() < entry.lockedUntil) {
    const mins = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({ error: `Te vaak geprobeerd. Probeer het over ${mins} minuten opnieuw.` });
  }
  if (!pinMatches(req.body?.pin)) {
    entry.count++;
    if (entry.count >= MAX_TRIES) {
      entry.lockedUntil = Date.now() + LOCK_MS;
      entry.count = 0;
    }
    attempts.set(ip, entry);
    return res.status(401).json({ error: 'Onjuiste pincode.' });
  }
  attempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.add(token);
  res.json({ token });
});

function auth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !sessions.has(token)) return res.status(401).json({ error: 'Niet ingelogd.' });
  next();
}

/** Nette 400's uit db-laag doorgeven, rest als 500 loggen. */
function guard(handler) {
  return (req, res) => {
    Promise.resolve()
      .then(() => handler(req, res))
      .catch((err) => {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('[server]', err);
        res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
      });
  };
}

// ─── App-state ──────────────────────────────────────────
function goalView(g, today) {
  const logs = dayLogs.forGoal(g.id);
  const grid = monthGrid(today);
  const byDay = new Map(logs.map((l) => [l.day, l.level]));
  return {
    id: g.id,
    anchor: g.anchor,
    action: g.action,
    place: g.place,
    minimum: g.minimum,
    target: g.target,
    stake: g.stake,
    status: g.status,
    paused_until: g.paused_until,
    todayLevel: dayLogs.get(g.id, today)?.level ?? null,
    yesterdayLevel: dayLogs.get(g.id, yesterdayKey())?.level ?? null,
    ...stats(logs),
    heatmap: {
      year: grid.year,
      month: grid.month,
      firstWeekday: grid.firstWeekday,
      days: grid.keys.map((k) => ({
        day: Number(k.slice(-2)),
        level: byDay.get(k) ?? null,
        isToday: k === today,
        future: k > today,
      })),
    },
  };
}

function stateSnapshot() {
  const today = todayKey();
  const active = goals.active();
  const allLogs = dayLogs.all();
  const conf = settings.get();
  return {
    userName: config.app.userName,
    today: { key: today, label: labelFor(today) },
    yesterday: { key: yesterdayKey(), label: labelFor(yesterdayKey()) },
    goals: active.map((g) => goalView(g, today)),
    pausedGoals: goals.all().filter((g) => g.status === 'paused').map((g) => ({
      id: g.id, action: g.action, paused_until: g.paused_until,
    })),
    activeCount: active.length,
    overall: stats(allLogs),
    doneTodayCount: allLogs.filter(
      (l) => l.day === today && (l.level === 'minimum' || l.level === 'target'),
    ).length,
    tasks: { open: tasks.list('open'), doneToday: tasks.doneToday() },
    review: {
      due: reviews.dueFor(today, conf.reviewDay),
      week: isoWeek(today),
    },
    settings: conf,
  };
}

app.get('/api/state', auth, guard((req, res) => res.json(stateSnapshot())));

// ─── Dag-logging (één tik) ──────────────────────────────
app.post('/api/goals/:id/log', auth, guard((req, res) => {
  const g = goals.byId(req.params.id);
  if (!g) return res.status(404).json({ error: 'Doel niet gevonden.' });
  const day = req.body?.day === 'yesterday' ? yesterdayKey() : todayKey();
  const level = req.body?.level ?? null; // null = wissen (undo)
  dayLogs.set(g.id, day, level);
  res.json({ state: stateSnapshot() });
}));

// ─── Doelen ─────────────────────────────────────────────
app.post('/api/goals', auth, guard((req, res) => {
  const { anchor, action, place, minimum, target, stake } = req.body || {};
  for (const [name, v] of [['gewoonte (na …)', anchor], ['actie', action], ['plek', place], ['minimum', minimum], ['target', target]]) {
    if (typeof v !== 'string' || !v.trim()) {
      return res.status(400).json({ error: `Vul "${name}" in — het intentie-format is verplicht.` });
    }
  }
  const clip = (s, n = 200) => s.trim().slice(0, n);
  goals.addIntention({
    anchor: clip(anchor), action: clip(action), place: clip(place),
    minimum: clip(minimum), target: clip(target),
    stake: stake && String(stake).trim() ? clip(String(stake)) : null,
  });
  res.json({ state: stateSnapshot() });
}));

app.patch('/api/goals/:id', auth, guard((req, res) => {
  const g = goals.update(req.params.id, req.body || {});
  if (!g) return res.status(404).json({ error: 'Doel niet gevonden.' });
  res.json({ state: stateSnapshot() });
}));

// ─── Taken (ongewijzigd) ────────────────────────────────
app.post('/api/tasks', auth, guard((req, res) => {
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Geef een taak op.' });
  tasks.add(title.slice(0, 200), String(req.body?.due || '').trim() || null);
  res.json({ state: stateSnapshot() });
}));

app.post('/api/tasks/:id/toggle', auth, guard((req, res) => {
  if (!tasks.complete(req.params.id)) tasks.reopen(req.params.id);
  res.json({ state: stateSnapshot() });
}));

// ─── Coach: deterministisch getriggerd, max 1/dag ───────
app.post('/api/coach/evaluate', auth, guard(async (req, res) => {
  const today = todayKey();

  // Al een interventie vandaag? Toon die (tot hij is weggeklikt), nooit een nieuwe.
  const existing = coachLog.forDay(today);
  if (existing) {
    return res.json({ card: existing.dismissed ? null : existing });
  }

  const active = goals.active();
  const conf = settings.get();
  const trigger = detectTrigger(
    dayLogs.all(), active, today, reviews.dueFor(today, conf.reviewDay),
  );
  if (!trigger) return res.json({ card: null });

  const card = await generateCard(
    buildCoachPayload({
      trigger,
      goals: active,
      logs: dayLogs.all(),
      today,
      lastReview: reviews.latest(),
    }),
  );
  const entry = coachLog.add(today, trigger.type, trigger.goalId ?? null, card);
  res.json({ card: entry });
}));

app.post('/api/coach/action', auth, guard((req, res) => {
  const today = todayKey();
  const entry = coachLog.forDay(today);
  const type = String(req.body?.type || '');
  const goalId = entry?.goal_id ?? req.body?.goal_id ?? null;

  if (type === 'pauzeer_doel' && goalId) {
    goals.update(goalId, { pause_days: 7 });
  }
  // verklein_minimum wordt client-side afgehandeld (opent het minimumveld);
  // laat_zo doet niets. Alle drie sluiten het kaartje.
  coachLog.dismiss(today);
  res.json({ state: stateSnapshot(), focusGoal: type === 'verklein_minimum' ? goalId : null });
}));

// ─── Weekreview ─────────────────────────────────────────
app.post('/api/review', auth, guard((req, res) => {
  const week = isoWeek(todayKey());
  const skipped = !!req.body?.skipped;
  let answers = null;
  if (!skipped) {
    const a = req.body?.answers || {};
    answers = {
      makkelijker: String(a.makkelijker || '').slice(0, 500),
      zwaarste: String(a.zwaarste || '').slice(0, 500),
      minimum_gevoel: ['te licht', 'goed', 'te zwaar'].includes(a.minimum_gevoel)
        ? a.minimum_gevoel : 'goed',
      anders: String(a.anders || '').slice(0, 500),
    };
  }
  reviews.submit(week, answers, skipped);
  res.json({ state: stateSnapshot() });
}));

// ─── Export / import ────────────────────────────────────
app.get('/api/export', auth, guard((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="coach-backup-${todayKey()}.json"`,
  );
  res.send(JSON.stringify(raw(), null, 2));
}));

app.post('/api/import', auth, guard((req, res) => {
  let incoming;
  try {
    incoming = ensureV2(req.body); // accepteert v1 én v2, migreert zo nodig
  } catch (err) {
    return res.status(400).json({ error: `Import geweigerd: ${err.message}` });
  }
  const s = incoming.store;
  if (!Array.isArray(s.goals) || !Array.isArray(s.dayLogs)) {
    return res.status(400).json({ error: 'Import geweigerd: dit is geen backup van deze app.' });
  }
  // Huidige login-sessies behouden, anders word je door je eigen import uitgelogd.
  s.sessions = raw().sessions;
  replaceStore(s); // maakt eerst zelf een backup van de huidige data
  res.json({ state: stateSnapshot(), migrated: incoming.migrated });
}));

// ─── Instellingen ───────────────────────────────────────
app.patch('/api/settings', auth, guard((req, res) => {
  settings.set(req.body || {});
  res.json({ state: stateSnapshot() });
}));

// ─── Statische shell ────────────────────────────────────
app.use(express.static(join(__dirname, '..', 'public')));

const server = app.listen(config.app.port, '0.0.0.0', () => {
  console.log('');
  console.log('  🧡 Je coach-app draait!');
  console.log(`     Op deze PC:   http://localhost:${config.app.port}`);
  console.log(`     Op je telefoon (thuis-WiFi): http://<ip-van-je-pc>:${config.app.port}`);
  console.log('');
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
