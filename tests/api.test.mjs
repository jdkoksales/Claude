import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Een eigen databestand per testrun, zodat echte gegevens nooit worden geraakt.
const dir = mkdtempSync(join(tmpdir(), 'samen-test-'));
process.env.DB_FILE = join(dir, 'test.json');
process.env.SESSION_SECRET = 'test-geheim-voor-de-testen';
process.env.SECURE_COOKIES = 'false';
process.env.TIMEZONE = 'Europe/Amsterdam';
process.env.PUSH_ENABLED = 'false';

const { default: app } = await import('../src/server.js');

let server;
let base;
let cookie = '';

/** Kleine client die de sessiecookie onthoudt, net als een browser. */
async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch { /* geen json, bijv. een html-pagina */ }
  return { status: res.status, body: json, text };
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  rmSync(dir, { recursive: true, force: true });
});

const ids = {};

test('een verse app vraagt eerst om ingericht te worden', async () => {
  const res = await call('/api/bootstrap');
  assert.equal(res.status, 200);
  assert.equal(res.body.setupNeeded, true);
  assert.deepEqual(res.body.users, []);
});

test('zonder inloggen kom je nergens', async () => {
  assert.equal((await call('/api/state')).status, 401);
  assert.equal((await call('/api/events', { method: 'POST', body: {} })).status, 401);
});

test('inrichten maakt twee mensen met een eigen pincode', async () => {
  const res = await call('/api/setup', {
    method: 'POST',
    body: { people: [{ name: 'Jij', pin: '1234' }, { name: 'Zij', pin: '5678' }] },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.users.length, 2);
  ids.a = res.body.users[0].id;
  ids.b = res.body.users[1].id;
  // De pincodes komen nooit mee naar buiten.
  assert.ok(!JSON.stringify(res.body).includes('1234'));
  assert.ok(!('pinHash' in res.body.users[0]));
});

test('inrichten kan maar één keer', async () => {
  const res = await call('/api/setup', {
    method: 'POST',
    body: { people: [{ name: 'Indringer', pin: '9999' }] },
  });
  assert.equal(res.status, 409);
});

test('een verkeerde pincode komt er niet in', async () => {
  const res = await call('/api/login', { method: 'POST', body: { userId: ids.a, pin: '0000' } });
  assert.equal(res.status, 401);
  assert.match(res.body.error, /klopt niet/);
});

test('met de juiste pincode kom je binnen', async () => {
  const res = await call('/api/login', { method: 'POST', body: { userId: ids.a, pin: '1234' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.name, 'Jij');
  assert.equal((await call('/api/me')).body.user.id, ids.a);
});

test('een afspraak toevoegen en terugzien in de periode', async () => {
  const created = await call('/api/events', {
    method: 'POST',
    body: {
      title: 'Tandarts', ownerId: ids.a, date: '2026-08-13', start: '09:00', end: '09:30', reminderMin: 30,
    },
  });
  assert.equal(created.status, 201);
  ids.event = created.body.event.id;

  const state = await call('/api/state?from=2026-08-10&to=2026-08-16');
  assert.equal(state.status, 200);
  const found = state.body.events.find((e) => e.id === ids.event);
  assert.equal(found.title, 'Tandarts');
  assert.equal(found.occurrenceId, `${ids.event}@2026-08-13`);
});

test('een herhalende afspraak komt meerdere keren in de periode terug', async () => {
  await call('/api/events', {
    method: 'POST',
    body: {
      title: 'Sporten',
      ownerId: 'both',
      date: '2026-08-10',
      start: '18:00',
      repeat: { freq: 'weekly', interval: 1, until: '2026-09-07' },
    },
  });
  const state = await call('/api/state?from=2026-08-10&to=2026-09-07');
  const sporten = state.body.events.filter((e) => e.title === 'Sporten');
  assert.equal(sporten.length, 5);
  assert.equal(sporten[0].repeatLabel, 'elke week, t/m 2026-09-07');
});

test('onzin in een afspraak wordt met uitleg geweigerd', async () => {
  const res = await call('/api/events', {
    method: 'POST',
    body: { title: 'Fout', ownerId: ids.a, date: '2026-08-13', start: '10:00', end: '09:00' },
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /eindtijd/);
});

test('een gewoonte afvinken laat de reeks oplopen', async () => {
  const created = await call('/api/goals', {
    method: 'POST',
    body: { kind: 'habit', title: 'Lezen', ownerId: ids.a },
  });
  assert.equal(created.status, 201);
  ids.goal = created.body.goal.id;
  assert.equal(created.body.goal.stats.doneToday, false);

  const checked = await call(`/api/goals/${ids.goal}/checkin`, { method: 'POST', body: {} });
  assert.equal(checked.body.goal.stats.doneToday, true);
  assert.equal(checked.body.goal.stats.streak, 1);

  // Nog een keer drukken haalt het vinkje weer weg.
  const unchecked = await call(`/api/goals/${ids.goal}/checkin`, { method: 'POST', body: {} });
  assert.equal(unchecked.body.goal.stats.doneToday, false);
});

test('vooruit afvinken mag niet', async () => {
  const res = await call(`/api/goals/${ids.goal}/checkin`, { method: 'POST', body: { date: '2099-01-01' } });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /vooruit/);
});

test('bijdragen aan een projectdoel tellen op', async () => {
  const created = await call('/api/goals', {
    method: 'POST',
    body: { kind: 'project', title: 'Sparen', ownerId: 'both', target: 1000, unit: '€' },
  });
  ids.project = created.body.goal.id;
  await call(`/api/goals/${ids.project}/entries`, { method: 'POST', body: { amount: 250 } });
  const res = await call(`/api/goals/${ids.project}/entries`, { method: 'POST', body: { amount: 100 } });
  assert.equal(res.body.goal.stats.total, 350);
  assert.equal(res.body.goal.stats.pct, 35);
  assert.equal(res.body.goal.stats.perPerson[ids.a], 350);
});

test('afvinken kan niet bij een projectdoel', async () => {
  const res = await call(`/api/goals/${ids.project}/checkin`, { method: 'POST', body: {} });
  assert.equal(res.status, 400);
});

test('taken toevoegen, afvinken en opruimen', async () => {
  const created = await call('/api/tasks', {
    method: 'POST',
    body: { title: 'Boodschappen', assigneeId: 'both', dueDate: '2026-08-13' },
  });
  assert.equal(created.status, 201);
  const id = created.body.task.id;

  const done = await call(`/api/tasks/${id}`, { method: 'PATCH', body: { done: true } });
  assert.equal(done.body.task.done, true);
  assert.equal(done.body.task.doneBy, ids.a);

  const cleared = await call('/api/tasks/clear-done', { method: 'POST' });
  assert.equal(cleared.body.removed, 1);
  assert.equal((await call('/api/state')).body.tasks.length, 0);
});

test('de ander ziet dezelfde agenda en doelen', async () => {
  cookie = '';
  await call('/api/login', { method: 'POST', body: { userId: ids.b, pin: '5678' } });
  const state = await call('/api/state?from=2026-08-10&to=2026-08-16');
  assert.equal(state.body.events.some((e) => e.title === 'Tandarts'), true);
  assert.equal(state.body.goals.some((g) => g.title === 'Lezen'), true);
});

test('de ander kan ook in jouw agenda iets zetten', async () => {
  const res = await call('/api/events', {
    method: 'POST',
    body: { title: 'Afspraak voor jou', ownerId: ids.a, date: '2026-08-14', start: '12:00' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.event.ownerId, ids.a);
  assert.equal(res.body.event.createdBy, ids.b);
});

test('een pincode wijzigen vraagt om de huidige', async () => {
  const wrong = await call('/api/me/pin', { method: 'PATCH', body: { current: '0000', next: '4321' } });
  assert.equal(wrong.status, 401);

  const good = await call('/api/me/pin', { method: 'PATCH', body: { current: '5678', next: '87654' } });
  assert.equal(good.status, 200);

  cookie = '';
  assert.equal((await call('/api/login', { method: 'POST', body: { userId: ids.b, pin: '5678' } })).status, 401);
  assert.equal((await call('/api/login', { method: 'POST', body: { userId: ids.b, pin: '87654' } })).status, 200);
});

test('te vaak misgokken zet er een slot op', async () => {
  const other = { userId: ids.a, pin: '0000' };
  let last;
  for (let i = 0; i < 6; i += 1) {
    last = await call('/api/login', { method: 'POST', body: other });
  }
  assert.equal(last.status, 429);
  assert.match(last.body.error, /Te vaak/);
});

test('de export bevat de gegevens maar nooit de pincodes', async () => {
  const res = await call('/api/export');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.events));
  assert.ok(!res.text.includes('pinHash'));
  assert.ok(!res.text.includes('pinSalt'));
});

test('uitloggen sluit de deur weer', async () => {
  await call('/api/logout', { method: 'POST' });
  assert.equal((await call('/api/state')).status, 401);
});
