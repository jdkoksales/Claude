#!/usr/bin/env node
/**
 * Eenmalige voorbereiding: maakt een .env met een sessiegeheim en de sleutels
 * die nodig zijn voor push-meldingen. Bestaande waarden blijven staan, dus je
 * kunt dit script gerust nog eens draaien.
 *
 *   npm run setup
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import webpush from 'web-push';

const FILE = '.env';
const lines = existsSync(FILE) ? readFileSync(FILE, 'utf8').split('\n') : [];
const values = new Map();
for (const line of lines) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) values.set(m[1], m[2]);
}

const added = [];
function ensure(key, make, comment) {
  if (values.get(key)) return;
  values.set(key, make());
  added.push({ key, comment });
}

ensure('SESSION_SECRET', () => randomBytes(32).toString('hex'));

if (!values.get('VAPID_PUBLIC_KEY') || !values.get('VAPID_PRIVATE_KEY')) {
  const keys = webpush.generateVAPIDKeys();
  values.set('VAPID_PUBLIC_KEY', keys.publicKey);
  values.set('VAPID_PRIVATE_KEY', keys.privateKey);
  added.push({ key: 'VAPID_PUBLIC_KEY' }, { key: 'VAPID_PRIVATE_KEY' });
}

if (!values.get('VAPID_CONTACT')) values.set('VAPID_CONTACT', 'mailto:jij@example.com');
if (!values.get('TIMEZONE')) values.set('TIMEZONE', 'Europe/Amsterdam');
if (!values.get('DAILY_DIGEST_AT')) values.set('DAILY_DIGEST_AT', '20:00');

const out = [
  '# Instellingen voor Samen. Deel dit bestand met niemand.',
  ...[...values.entries()].map(([k, v]) => `${k}=${v}`),
  '',
].join('\n');

writeFileSync(FILE, out);

console.log(`${FILE} bijgewerkt.`);
if (added.length) {
  console.log('Nieuw aangemaakt:', added.map((a) => a.key).join(', '));
} else {
  console.log('Alles stond al ingevuld.');
}
console.log('\nZet bij online hosten deze waarden ook in de omgeving van je hostingdienst:');
for (const key of ['SESSION_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_CONTACT', 'TIMEZONE']) {
  console.log(`  ${key}=${values.get(key)}`);
}
console.log('\nStart daarna met: npm start');
