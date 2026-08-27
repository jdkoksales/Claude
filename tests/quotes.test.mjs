import test from 'node:test';
import assert from 'node:assert/strict';
import { QUOTES, quoteOfDay } from '../public/quotes.js';

const day = (n) => new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString().slice(0, 10);

test('dezelfde dag geeft altijd hetzelfde zinnetje', () => {
  assert.deepEqual(quoteOfDay('2026-08-11'), quoteOfDay('2026-08-11'));
  assert.ok(QUOTES.includes(quoteOfDay('2026-08-11')));
});

test('twee dagen na elkaar geven nooit hetzelfde zinnetje', () => {
  // Anders lijkt het alsof hij blijft hangen, en dat is precies wat je niet wilt.
  for (let i = 0; i < 400; i += 1) {
    assert.notEqual(quoteOfDay(day(i)).text, quoteOfDay(day(i + 1)).text, `dag ${day(i)} en ${day(i + 1)}`);
  }
});

test('over een jaar komen ze allemaal een keer langs', () => {
  const seen = new Set();
  for (let i = 0; i < 365; i += 1) seen.add(quoteOfDay(day(i)).text);
  assert.equal(seen.size, QUOTES.length);
});

test('elk zinnetje heeft tekst, en een bron of bewust geen', () => {
  for (const q of QUOTES) {
    assert.equal(typeof q.text, 'string', JSON.stringify(q));
    assert.ok(q.text.trim().length > 15, `te kort: ${q.text}`);
    // null betekent: dit is een vraag om over na te denken, geen citaat van
    // iemand anders. Undefined zou betekenen dat de bron vergeten is.
    assert.ok(q.source === null || (typeof q.source === 'string' && q.source.trim()),
      `bron ontbreekt of is leeg bij: ${q.text}`);
  }
});

test('een citaat zonder bron bestaat niet: alles zonder bron is een vraag', () => {
  for (const q of QUOTES.filter((x) => x.source === null)) {
    assert.ok(q.text.trim().endsWith('?'), `geen bron én geen vraag: ${q.text}`);
  }
});

test('geen dubbele zinnetjes', () => {
  assert.equal(new Set(QUOTES.map((q) => q.text)).size, QUOTES.length);
});

test('zonder zinnetjes valt hij netjes stil in plaats van stuk te gaan', () => {
  assert.equal(quoteOfDay('2026-08-11', []), null);
});
