import test from 'node:test';
import assert from 'node:assert/strict';
import { QUOTES, quoteOfDay } from '../public/quotes.js';

test('dezelfde dag geeft altijd hetzelfde zinnetje', () => {
  assert.equal(quoteOfDay('2026-08-11'), quoteOfDay('2026-08-11'));
  assert.ok(QUOTES.includes(quoteOfDay('2026-08-11')));
});

test('twee dagen na elkaar geven nooit hetzelfde zinnetje', () => {
  // Anders lijkt het alsof hij blijft hangen, en dat is precies wat je niet wilt.
  const day = (n) => new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString().slice(0, 10);
  for (let i = 0; i < 400; i += 1) {
    assert.notEqual(quoteOfDay(day(i)), quoteOfDay(day(i + 1)), `dag ${day(i)} en ${day(i + 1)}`);
  }
});

test('over een jaar komen ze allemaal een keer langs', () => {
  const day = (n) => new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString().slice(0, 10);
  const seen = new Set();
  for (let i = 0; i < 365; i += 1) seen.add(quoteOfDay(day(i)));
  assert.equal(seen.size, QUOTES.length);
});

test('zonder zinnetjes valt hij netjes stil in plaats van stuk te gaan', () => {
  assert.equal(quoteOfDay('2026-08-11', []), '');
});
