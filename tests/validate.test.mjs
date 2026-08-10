import test from 'node:test';
import assert from 'node:assert/strict';
import { entryInput, eventInput, goalInput, taskInput } from '../src/lib/validate.js';

const USERS = ['u1', 'u2'];
const ok = { title: 'Tandarts', ownerId: 'u1', date: '2026-08-13', start: '09:00' };

test('een geldige afspraak komt schoon terug', () => {
  const out = eventInput({ ...ok, end: '09:30', location: ' Centrum ' }, USERS);
  assert.equal(out.title, 'Tandarts');
  assert.equal(out.location, 'Centrum');
  assert.equal(out.repeat, null);
  assert.equal(out.reminderMin, null);
});

test('een afspraak zonder titel of met een onbekende eigenaar wordt geweigerd', () => {
  assert.throws(() => eventInput({ ...ok, title: '   ' }, USERS), /Titel/);
  assert.throws(() => eventInput({ ...ok, ownerId: 'iemand-anders' }, USERS), /eigenaar/);
});

test('samen is een geldige eigenaar', () => {
  assert.equal(eventInput({ ...ok, ownerId: 'both' }, USERS).ownerId, 'both');
});

test('een eindtijd vóór de begintijd wordt tegengehouden', () => {
  assert.throws(() => eventInput({ ...ok, start: '10:00', end: '09:00' }, USERS), /vóór de begintijd/);
});

test('bij een hele dag zijn tijden niet nodig en verdwijnt de herinnering', () => {
  const out = eventInput({ title: 'Verjaardag', ownerId: 'u1', date: '2026-08-13', allDay: true, reminderMin: 30 }, USERS);
  assert.equal(out.start, null);
  assert.equal(out.reminderMin, null);
});

test('alleen bekende herinneringstijden worden geaccepteerd', () => {
  assert.equal(eventInput({ ...ok, reminderMin: 30 }, USERS).reminderMin, 30);
  assert.throws(() => eventInput({ ...ok, reminderMin: 7 }, USERS), /herinneringstijd/);
});

test('een herhaling die eindigt vóór hij begint wordt geweigerd', () => {
  assert.throws(
    () => eventInput({ ...ok, repeat: { freq: 'weekly', until: '2026-08-01' } }, USERS),
    /eindigt vóór/,
  );
});

test('een gewoonte krijgt standaard het ritme dagelijks', () => {
  const out = goalInput({ title: 'Lezen', ownerId: 'u1' }, USERS);
  assert.equal(out.kind, 'habit');
  assert.deepEqual(out.cadence, { type: 'daily' });
});

test('een weekdoel eist een aantal tussen 1 en 7', () => {
  const out = goalInput({ title: 'Sporten', ownerId: 'u1', cadence: { type: 'weekly', timesPerWeek: 3 } }, USERS);
  assert.deepEqual(out.cadence, { type: 'weekly', timesPerWeek: 3 });
  assert.throws(
    () => goalInput({ title: 'Sporten', ownerId: 'u1', cadence: { type: 'weekly', timesPerWeek: 9 } }, USERS),
    /1 tot en met 7/,
  );
});

test('een project heeft een streefgetal groter dan nul nodig', () => {
  const out = goalInput({ kind: 'project', title: 'Sparen', ownerId: 'both', target: '3000', unit: '€' }, USERS);
  assert.equal(out.target, 3000);
  assert.equal(out.unit, '€');
  assert.throws(() => goalInput({ kind: 'project', title: 'Sparen', ownerId: 'u1', target: 0 }, USERS), /groter dan 0/);
  assert.throws(() => goalInput({ kind: 'project', title: 'Sparen', ownerId: 'u1', target: 'veel' }, USERS), /groter dan 0/);
});

test('een streefdatum vóór de startdatum wordt geweigerd', () => {
  assert.throws(
    () => goalInput({
      kind: 'project', title: 'Sparen', ownerId: 'u1', target: 10, startDate: '2026-08-13', deadline: '2026-01-01',
    }, USERS),
    /vóór de startdatum/,
  );
});

test('een bijdrage van niets heeft geen zin', () => {
  assert.equal(entryInput({ amount: '12,5'.replace(',', '.') }, USERS).amount, 12.5);
  assert.equal(entryInput({ amount: -20 }, USERS).amount, -20);
  assert.throws(() => entryInput({ amount: 0 }, USERS), /niet 0/);
  assert.throws(() => entryInput({ amount: 'veel' }, USERS), /niet 0/);
});

test('een taak mag zonder toegewezen persoon', () => {
  const out = taskInput({ title: 'Boodschappen' }, USERS);
  assert.equal(out.assigneeId, null);
  assert.equal(out.dueDate, null);
  assert.equal(taskInput({ title: 'Koken', assigneeId: 'both' }, USERS).assigneeId, 'both');
  assert.throws(() => taskInput({ title: 'Koken', assigneeId: 'u9' }, USERS), /eigenaar/);
});

test('een onmogelijke datum wordt afgewezen', () => {
  assert.throws(() => taskInput({ title: 'Koken', dueDate: '2026-02-30' }, USERS), /datum/);
});
