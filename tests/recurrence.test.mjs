import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeRepeat, expandEvent, expandEvents, nextOccurrence, normalizeRepeat, occursOn,
} from '../src/lib/recurrence.js';

const base = { id: 'e1', title: 'Sporten', ownerId: 'u1', date: '2026-08-10', start: '18:00', allDay: false };

test('een eenmalige afspraak valt alleen op de eigen dag', () => {
  assert.ok(occursOn(base, '2026-08-10'));
  assert.ok(!occursOn(base, '2026-08-11'));
  assert.equal(expandEvent(base, '2026-08-01', '2026-08-31').length, 1);
});

test('wekelijkse herhaling komt elke zeven dagen terug', () => {
  const ev = { ...base, repeat: { freq: 'weekly', interval: 1, until: null } };
  const days = expandEvent(ev, '2026-08-10', '2026-09-07').map((o) => o.date);
  assert.deepEqual(days, ['2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07']);
});

test('een interval van twee slaat de tussenliggende weken over', () => {
  const ev = { ...base, repeat: { freq: 'weekly', interval: 2, until: null } };
  const days = expandEvent(ev, '2026-08-10', '2026-09-07').map((o) => o.date);
  assert.deepEqual(days, ['2026-08-10', '2026-08-24', '2026-09-07']);
});

test('de herhaling stopt na de einddatum', () => {
  const ev = { ...base, repeat: { freq: 'daily', interval: 1, until: '2026-08-12' } };
  const days = expandEvent(ev, '2026-08-01', '2026-08-31').map((o) => o.date);
  assert.deepEqual(days, ['2026-08-10', '2026-08-11', '2026-08-12']);
});

test('niets komt terug van vóór de eerste datum', () => {
  const ev = { ...base, repeat: { freq: 'daily', interval: 1, until: null } };
  assert.equal(expandEvent(ev, '2026-08-01', '2026-08-09').length, 0);
});

test('maandelijks op de 31e slaat maanden zonder 31e over', () => {
  const ev = { ...base, date: '2026-01-31', repeat: { freq: 'monthly', interval: 1, until: null } };
  const days = expandEvent(ev, '2026-01-01', '2026-04-30').map((o) => o.date);
  assert.deepEqual(days, ['2026-01-31', '2026-03-31']);
});

test('jaarlijks komt op dezelfde dag terug', () => {
  const ev = { ...base, date: '2026-02-14', repeat: { freq: 'yearly', interval: 1, until: null } };
  const days = expandEvent(ev, '2026-01-01', '2028-12-31').map((o) => o.date);
  assert.deepEqual(days, ['2026-02-14', '2027-02-14', '2028-02-14']);
});

test('voorkomens krijgen een eigen, stabiel id', () => {
  const ev = { ...base, repeat: { freq: 'weekly', interval: 1, until: null } };
  const [first] = expandEvent(ev, '2026-08-10', '2026-08-10');
  assert.equal(first.occurrenceId, 'e1@2026-08-10');
  assert.ok(first.isRepeat);
});

test('meerdere afspraken komen op datum en tijd gesorteerd terug', () => {
  const later = { ...base, id: 'e2', title: 'Koken', start: '19:00' };
  const allDay = { ...base, id: 'e3', title: 'Verjaardag', allDay: true, start: null };
  const out = expandEvents([later, base, allDay], '2026-08-10', '2026-08-10');
  assert.deepEqual(out.map((o) => o.title), ['Verjaardag', 'Sporten', 'Koken']);
});

test('normalizeRepeat weigert onzin en accepteert het goede', () => {
  assert.equal(normalizeRepeat(null), null);
  assert.equal(normalizeRepeat('none'), null);
  assert.deepEqual(normalizeRepeat({ freq: 'weekly' }), { freq: 'weekly', interval: 1, until: null });
  assert.throws(() => normalizeRepeat({ freq: 'hourly' }), /een van/);
  assert.throws(() => normalizeRepeat({ freq: 'weekly', interval: 0 }), /Interval/);
  assert.throws(() => normalizeRepeat({ freq: 'weekly', until: '31-12-2026' }), /ongeldig/);
});

test('nextOccurrence vindt de eerstvolgende keer', () => {
  const ev = { ...base, repeat: { freq: 'weekly', interval: 1, until: null } };
  assert.equal(nextOccurrence(ev, '2026-08-11'), '2026-08-17');
  assert.equal(nextOccurrence({ ...base, repeat: { freq: 'daily', interval: 1, until: '2026-08-11' } }, '2026-08-12'), null);
});

test('describeRepeat is leesbaar', () => {
  assert.equal(describeRepeat(null), '');
  assert.equal(describeRepeat({ freq: 'weekly', interval: 1, until: null }), 'elke week');
  assert.equal(describeRepeat({ freq: 'weekly', interval: 2, until: null }), 'elke 2 weken');
});
