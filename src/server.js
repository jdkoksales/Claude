import express from 'express';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config, assertEnv } from './config.js';
import { runAgent } from './claude.js';
import { tasks, goals, journal, chat, subs, sessions } from './db.js';
import { publicKey } from './push.js';
import { startCoach, runCheckIn } from './coach.js';

assertEnv(['ANTHROPIC_API_KEY', 'APP_PIN']);

if (!/^\d{4,6}$/.test(config.app.pin)) {
  throw new Error('APP_PIN moet 4 tot 6 cijfers zijn (bv. APP_PIN=4821).');
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// ---------- PIN login with brute-force protection ----------

const attempts = new Map(); // ip -> { count, lockedUntil }
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
    return res.status(429).json({
      error: `Te vaak geprobeerd. Probeer het over ${mins} minuten opnieuw.`,
    });
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
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Niet ingelogd.' });
  }
  next();
}

// ---------- App state ----------

function stateSnapshot() {
  return {
    userName: config.app.userName,
    tasks: {
      open: tasks.list('open'),
      doneToday: tasks.doneToday(),
    },
    goals: goals.list('active').map((g) => {
      const serie = goals.series(g.id);
      const latest = serie.points.at(-1)?.value ?? null;
      let pct = null;
      if (g.target_value && serie.mode === 'value' && latest != null) {
        pct = Math.max(0, Math.min(100, Math.round((latest / g.target_value) * 100)));
      }
      return {
        ...g,
        streak: goals.streak(g.id),
        latest,
        pct,
        series: serie,
        recent: goals.recentProgress(g.id, 3),
      };
    }),
    feed: journal.recent(20),
    chat: chat.all(200),
  };
}

app.get('/api/state', auth, (req, res) => res.json(stateSnapshot()));

// ---------- Chat with the coach ----------

let chatBusy = false;
app.post('/api/chat', auth, async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Leeg bericht.' });
  if (chatBusy) {
    return res.status(429).json({ error: 'Nog bezig met je vorige bericht — momentje.' });
  }
  chatBusy = true;
  try {
    chat.append('user', message);
    const reply = await runAgent(chat.forModel(40));
    chat.append('assistant', reply);
    res.json({ reply, state: stateSnapshot() });
  } catch (err) {
    console.error('[chat] fout:', err);
    res.status(502).json({
      error:
        'Ik kon even geen antwoord ophalen. Check je internet en je API-tegoed, en probeer het opnieuw.',
    });
  } finally {
    chatBusy = false;
  }
});

// ---------- Task buttons ----------

app.post('/api/tasks', auth, (req, res) => {
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Geef een taak op.' });
  const due = String(req.body?.due || '').trim() || null;
  tasks.add(title, due);
  res.json({ state: stateSnapshot() });
});

app.post('/api/tasks/:id/toggle', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!tasks.complete(id)) tasks.reopen(id);
  res.json({ state: stateSnapshot() });
});

// ---------- Push notifications ----------

app.get('/api/push/key', auth, (req, res) => res.json({ key: publicKey() }));

app.post('/api/push/subscribe', auth, (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint) return res.status(400).json({ error: 'Ongeldige subscription.' });
  subs.add(sub);
  res.json({ ok: true });
});

// Handig om te testen: laat de coach nú een check-in schrijven.
app.post('/api/checkin/:kind', auth, async (req, res) => {
  const kind = ['morning', 'evening', 'weekly'].includes(req.params.kind)
    ? req.params.kind
    : 'morning';
  try {
    const text = await runCheckIn(kind);
    res.json({ text, state: stateSnapshot() });
  } catch (err) {
    console.error('[checkin] fout:', err);
    res.status(502).json({ error: 'Check-in genereren mislukte. Probeer het zo opnieuw.' });
  }
});

// ---------- Static app shell ----------

app.use(express.static(join(__dirname, '..', 'public')));

const server = app.listen(config.app.port, '0.0.0.0', () => {
  console.log('');
  console.log('  🧡 Je coach-app draait!');
  console.log(`     Op deze PC:   http://localhost:${config.app.port}`);
  console.log('     Op je telefoon (thuis-WiFi): http://<ip-van-je-pc>:' + config.app.port);
  console.log('');
  startCoach();
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
