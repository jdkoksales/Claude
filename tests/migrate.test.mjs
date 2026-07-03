import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateV1toV2, ensureV2, suggestMinimum, SCHEMA_VERSION } from '../src/lib/migrate.js';

/** Representatieve v1-store (chat/streak-tijdperk). */
function sampleV1() {
  return {
    tasks: [
      { id: 1, title: 'Offerte sturen', due: '2026-07-03', status: 'open', created_at: '2026-06-30 10:00:00', completed_at: null },
      { id: 2, title: 'Boodschappen', due: null, status: 'done', created_at: '2026-06-30 10:00:00', completed_at: '2026-06-30 18:00:00' },
    ],
    goals: [
      { id: 1, title: '10 kg afvallen', description: null, target_date: '2026-12-31', target_value: 10, unit: 'kg', status: 'active', created_at: '2026-06-15 09:00:00' },
      { id: 2, title: '3x per week sporten', description: null, target_date: null, target_value: null, unit: null, status: 'active', created_at: '2026-06-15 09:00:00' },
    ],
    progress: [
      { id: 1, goal_id: 1, note: 'Gestart', value: 0.5, created_at: '2026-06-20 08:00:00' },
      { id: 2, goal_id: 1, note: 'Nogmaals dezelfde dag', value: 0.6, created_at: '2026-06-20 21:00:00' },
      { id: 3, goal_id: 2, note: 'Hardlopen', value: null, created_at: '2026-06-22 07:30:00' },
      { id: 4, goal_id: 2, note: 'Nachtsessie', value: null, created_at: '2026-06-25 01:30:00' }, // vóór 03:00 → 24 juni
    ],
    journal: [{ id: 1, kind: 'morning', content: 'Ochtend!', created_at: '2026-06-21 08:00:00' }],
    chat: [
      { id: 1, role: 'user', content: 'hoi', created_at: '2026-06-21 08:05:00' },
      { id: 2, role: 'assistant', content: 'Hoi!', created_at: '2026-06-21 08:05:30' },
    ],
    subs: [{ endpoint: 'https://push.example/x' }],
    sessions: [{ token: 'abc', created_at: '2026-06-21 08:00:00' }],
    seq: { tasks: 2, goals: 2, progress: 4, journal: 1, chat: 2 },
  };
}

test('migratie: niets gaat verloren', () => {
  const v1 = sampleV1();
  const { store } = migrateV1toV2(v1);

  assert.equal(store.schemaVersion, SCHEMA_VERSION);
  // Taken ongewijzigd
  assert.equal(store.tasks.length, 2);
  assert.equal(store.tasks[0].title, 'Offerte sturen');
  // Volledige historie in archive
  assert.equal(store.archive.chat.length, 2);
  assert.equal(store.archive.journal.length, 1);
  assert.equal(store.archive.progress.length, 4);
  assert.equal(store.archive.subs.length, 1);
  // Sessies blijven (niet opnieuw inloggen)
  assert.equal(store.sessions.length, 1);
});

test('migratie: doelen krijgen minimum/target, legacy blijft', () => {
  const { store } = migrateV1toV2(sampleV1());
  const afvallen = store.goals.find((g) => g.id === 1);
  assert.equal(afvallen.action, '10 kg afvallen');
  assert.equal(afvallen.target, '10 kg'); // uit target_value + unit
  assert.ok(afvallen.minimum.length > 0);
  assert.equal(afvallen.legacy.target_value, 10);
  assert.equal(afvallen.legacy.target_date, '2026-12-31');
  assert.equal(afvallen.status, 'active');
});

test('migratie: progress → dayLogs, gededupliceerd per dag, 03:00-grens toegepast', () => {
  const { store } = migrateV1toV2(sampleV1());
  const g1 = store.dayLogs.filter((l) => l.goal_id === 1);
  const g2 = store.dayLogs.filter((l) => l.goal_id === 2);
  // Twee entries op 20 juni → één dayLog
  assert.equal(g1.length, 1);
  assert.equal(g1[0].day, '2026-06-20');
  assert.equal(g1[0].level, 'target');
  // Nachtsessie 25 juni 01:30 → telt als 24 juni
  assert.deepEqual(g2.map((l) => l.day).sort(), ['2026-06-22', '2026-06-24']);
});

test('migratie: >3 actieve doelen → nieuwste 3 blijven, rest gepauzeerd', () => {
  const v1 = sampleV1();
  v1.goals.push(
    { id: 3, title: 'Doel drie', status: 'active', created_at: '2026-06-16 09:00:00' },
    { id: 4, title: 'Doel vier', status: 'active', created_at: '2026-06-17 09:00:00' },
    { id: 5, title: 'Doel vijf', status: 'active', created_at: '2026-06-18 09:00:00' },
  );
  const { store, notes } = migrateV1toV2(v1);
  const active = store.goals.filter((g) => g.status === 'active');
  const paused = store.goals.filter((g) => g.status === 'paused');
  assert.equal(active.length, 3);
  assert.equal(paused.length, 2);
  assert.deepEqual(active.map((g) => g.id).sort(), [3, 4, 5]);
  assert.ok(notes.some((n) => n.includes('gepauzeerd')));
});

test('ensureV2: v2 passeert onaangeraakt, leeg wordt vers, onbekend weigert', () => {
  const { store } = migrateV1toV2(sampleV1());
  const again = ensureV2(store);
  assert.equal(again.migrated, false);
  assert.equal(again.store.goals.length, store.goals.length);

  const fresh = ensureV2(null);
  assert.equal(fresh.store.schemaVersion, SCHEMA_VERSION);
  assert.equal(fresh.store.goals.length, 0);

  assert.throws(() => ensureV2({ schemaVersion: 99 }), /Onbekende schemaversie/);
});

test('suggestMinimum is klein en nooit leeg', () => {
  assert.match(suggestMinimum('3x per week sporten'), /2 minuten bewegen/);
  assert.match(suggestMinimum('meer lezen'), /1 bladzijde/);
  assert.ok(suggestMinimum('iets heel obscuurs').length > 0);
});
