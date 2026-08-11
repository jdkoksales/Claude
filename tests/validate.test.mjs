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

// ── Uitjes, vakanties en foto's ────────────────────────────────────────────

test('de soort van een afspraak valt terug op gewoon', async () => {
  const { eventInput: ev } = await import('../src/lib/validate.js');
  assert.equal(ev({ ...ok }, USERS).category, 'gewoon');
  assert.equal(ev({ ...ok, category: 'leuk' }, USERS).category, 'leuk');
  assert.equal(ev({ ...ok, category: 'onzin' }, USERS).category, 'gewoon');
});

test('een einddatum vóór de begindatum wordt geweigerd', async () => {
  const { eventInput: ev } = await import('../src/lib/validate.js');
  assert.throws(() => ev({ ...ok, endDate: '2026-08-01' }, USERS), /vóór de begindatum/);
});

test('meerdaags én herhalend tegelijk kan niet', async () => {
  const { eventInput: ev } = await import('../src/lib/validate.js');
  assert.throws(
    () => ev({ ...ok, endDate: '2026-08-20', repeat: { freq: 'weekly' } }, USERS),
    /niet ook herhalen/,
  );
});

test('een foto moet een echte afbeelding zijn en niet te groot', async () => {
  const { photoInput } = await import('../src/lib/validate.js');
  const tiny = Buffer.from([0xff, 0xd8, 0xff, 0xdb]).toString('base64');
  const out = photoInput({ dataUrl: `data:image/jpeg;base64,${tiny}`, caption: ' Op het strand ' });
  assert.equal(out.mime, 'image/jpeg');
  assert.equal(out.caption, 'Op het strand');
  assert.equal(out.bytes.length, 4);

  assert.throws(() => photoInput({ dataUrl: 'gewoon wat tekst' }), /geen afbeelding|niet uit/);
  assert.throws(
    () => photoInput({ dataUrl: `data:application/pdf;base64,${tiny}` }),
    /JPEG, PNG of WebP/,
  );
  const huge = `data:image/jpeg;base64,${'A'.repeat(5 * 1024 * 1024)}`;
  assert.throws(() => photoInput({ dataUrl: huge }), /te groot/);
});

test('een opmerking mag niet leeg zijn', async () => {
  const { commentInput } = await import('../src/lib/validate.js');
  assert.equal(commentInput({ text: '  Wat een dag  ' }).text, 'Wat een dag');
  assert.throws(() => commentInput({ text: '   ' }), /mag niet leeg/);
});

test('een afspraak zonder plek houdt lege coördinaten', () => {
  const out = eventInput({ ...ok }, USERS);
  assert.equal(out.lat, null);
  assert.equal(out.lon, null);
});

test('een plek op de kaart wordt afgerond bewaard', () => {
  const out = eventInput({ ...ok, lat: '52.37403123456', lon: 4.88969987654 }, USERS);
  assert.equal(out.lat, 52.374031);
  assert.equal(out.lon, 4.8897);
});

test('een halve coördinaat wordt geweigerd', () => {
  assert.throws(() => eventInput({ ...ok, lat: '52.1' }, USERS), /lengtegraad/);
  assert.throws(() => eventInput({ ...ok, lon: '4.9' }, USERS), /lengtegraad/);
});

test('een plek buiten de kaart wordt geweigerd', () => {
  assert.throws(() => eventInput({ ...ok, lat: 91, lon: 0 }, USERS), /buiten de kaart/);
  assert.throws(() => eventInput({ ...ok, lat: 0, lon: -181 }, USERS), /buiten de kaart/);
  assert.throws(() => eventInput({ ...ok, lat: 'ergens', lon: 'daar' }, USERS), /klopt niet/);
});
