import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, daysBetween, eachDay, isDateKey, isoWeekKey, minutesOfDay,
  nowTime, todayKey, weekStart, weekday, zonedToInstant,
} from '../src/lib/dates.js';

const AMS = 'Europe/Amsterdam';

test('vandaag wordt in de Nederlandse tijdzone bepaald, niet in UTC', () => {
  // 22:30 UTC op 3 juni is in Amsterdam al 4 juni (zomertijd, UTC+2).
  const at = new Date('2026-06-03T22:30:00Z');
  assert.equal(todayKey(AMS, at), '2026-06-04');
  assert.equal(todayKey('UTC', at), '2026-06-03');
});

test('de klok leest goed rond middernacht', () => {
  assert.equal(nowTime(AMS, new Date('2026-06-03T22:00:00Z')), '00:00');
  assert.equal(nowTime(AMS, new Date('2026-01-03T22:00:00Z')), '23:00');
});

test('een lokale tijd wordt het juiste moment, ook in de winter', () => {
  // Zomertijd: 09:00 in Amsterdam is 07:00 UTC.
  assert.equal(zonedToInstant('2026-06-04', '09:00', AMS).toISOString(), '2026-06-04T07:00:00.000Z');
  // Wintertijd: 09:00 is 08:00 UTC.
  assert.equal(zonedToInstant('2026-01-04', '09:00', AMS).toISOString(), '2026-01-04T08:00:00.000Z');
});

test('dagen optellen springt correct over maand- en jaargrenzen', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
});

test('de dag waarop de zomertijd ingaat telt gewoon als één dag', () => {
  // In 2026 gaat de zomertijd in op 29 maart; die dag heeft 23 uur.
  assert.equal(addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
});

test('weken beginnen op maandag', () => {
  assert.equal(weekday('2026-08-10'), 1);
  assert.equal(weekday('2026-08-16'), 7);
  assert.equal(weekStart('2026-08-16'), '2026-08-10');
  assert.equal(weekStart('2026-08-10'), '2026-08-10');
});

test('isoWeekKey groepeert dezelfde week onder dezelfde sleutel', () => {
  assert.equal(isoWeekKey('2026-08-10'), isoWeekKey('2026-08-16'));
  assert.notEqual(isoWeekKey('2026-08-16'), isoWeekKey('2026-08-17'));
});

test('eachDay levert een aaneengesloten reeks inclusief begin en eind', () => {
  const days = eachDay('2026-08-10', '2026-08-16');
  assert.equal(days.length, 7);
  assert.equal(days[0], '2026-08-10');
  assert.equal(days.at(-1), '2026-08-16');
});

test('onmogelijke datums worden afgewezen', () => {
  assert.ok(isDateKey('2024-02-29'));
  assert.ok(!isDateKey('2026-02-30'));
  assert.ok(!isDateKey('10-08-2026'));
  assert.ok(!isDateKey(''));
});

test('minutesOfDay maakt tijden vergelijkbaar', () => {
  assert.equal(minutesOfDay('00:00'), 0);
  assert.ok(minutesOfDay('09:30') < minutesOfDay('10:00'));
});
