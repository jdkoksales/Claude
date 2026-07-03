import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dayKey, todayKey, yesterdayKey, canLogDay, addDays, diffDays,
  isoWeek, monthGrid, weekdayOf,
} from '../src/lib/dates.js';

test('03:00-grens: 02:59 hoort bij de vorige dag', () => {
  assert.equal(dayKey(new Date(2026, 6, 15, 2, 59)), '2026-07-14');
});

test('03:00-grens: 03:00 hoort bij de nieuwe dag', () => {
  assert.equal(dayKey(new Date(2026, 6, 15, 3, 0)), '2026-07-15');
});

test('03:00-grens: middag is gewoon dezelfde dag', () => {
  assert.equal(dayKey(new Date(2026, 6, 15, 14, 0)), '2026-07-15');
});

test('03:00-grens over maand- en jaargrens heen', () => {
  assert.equal(dayKey(new Date(2026, 0, 1, 1, 30)), '2025-12-31');
});

test('vandaag/gisteren loggen mag, eergisteren niet', () => {
  const now = new Date(2026, 6, 15, 12, 0);
  assert.equal(todayKey(now), '2026-07-15');
  assert.equal(yesterdayKey(now), '2026-07-14');
  assert.ok(canLogDay('2026-07-15', now));
  assert.ok(canLogDay('2026-07-14', now));
  assert.ok(!canLogDay('2026-07-13', now));
  assert.ok(!canLogDay('2026-07-16', now));
});

test('om 01:00 is "vandaag" nog de dag ervoor, en "gisteren" die daarvoor', () => {
  const night = new Date(2026, 6, 15, 1, 0);
  assert.equal(todayKey(night), '2026-07-14');
  assert.ok(canLogDay('2026-07-13', night)); // gisteren vanuit 03:00-perspectief
  assert.ok(!canLogDay('2026-07-15', night)); // kalender-vandaag is nog niet begonnen
});

test('addDays en diffDays', () => {
  assert.equal(addDays('2026-07-15', -1), '2026-07-14');
  assert.equal(addDays('2026-07-31', 1), '2026-08-01');
  assert.equal(diffDays('2026-07-10', '2026-07-15'), 5);
});

test('isoWeek is stabiel', () => {
  assert.equal(isoWeek('2026-01-01'), isoWeek('2026-01-01'));
  assert.match(isoWeek('2026-07-15'), /^2026-W\d{2}$/);
  assert.notEqual(isoWeek('2026-07-15'), isoWeek('2026-07-22'));
});

test('monthGrid geeft juiste maandstructuur (juli 2026)', () => {
  const g = monthGrid('2026-07-15');
  assert.equal(g.daysInMonth, 31);
  assert.equal(g.keys[0], '2026-07-01');
  assert.equal(g.keys.at(-1), '2026-07-31');
  // 1 juli 2026 is een woensdag → index 2 (ma=0)
  assert.equal(g.firstWeekday, 2);
});

test('weekdayOf: 2026-07-15 is een woensdag (3)', () => {
  assert.equal(weekdayOf('2026-07-15'), 3);
});
