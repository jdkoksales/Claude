import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';

/**
 * Opslag: één JSON-bestand. Voor twee mensen met afspraken, doelen en taken is
 * dat ruim voldoende, en het maakt back-uppen (en de export-knop) triviaal.
 * Schrijven gaat via een tijdelijk bestand en een rename, zodat er nooit een
 * half weggeschreven bestand achterblijft als het proces omvalt.
 */

export const SCHEMA_VERSION = 1;

export function emptyStore() {
  return {
    schemaVersion: SCHEMA_VERSION,
    users: [],
    events: [],
    goals: [],
    tasks: [],
    pushSubs: [],
    sent: {},
    settings: { createdAt: new Date().toISOString() },
  };
}

const FILE = config.db.file;
mkdirSync(dirname(FILE), { recursive: true });

let store = load();

function load() {
  if (!existsSync(FILE)) return emptyStore();
  let raw;
  try {
    raw = JSON.parse(readFileSync(FILE, 'utf8'));
  } catch (err) {
    // Nooit stilzwijgend overschrijven: liever niet starten dan data kwijt.
    throw new Error(
      `Kon ${FILE} niet lezen (${err.message}). Herstel het bestand of zet een backup terug.`,
    );
  }
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Onbekende schemaversie ${raw.schemaVersion} in ${FILE}; verwacht ${SCHEMA_VERSION}.`,
    );
  }
  return { ...emptyStore(), ...raw };
}

let writeQueued = false;

export function save() {
  const tmp = join(dirname(FILE), `.${Date.now()}-${randomUUID().slice(0, 8)}.tmp`);
  writeFileSync(tmp, JSON.stringify(store, null, 2));
  renameSync(tmp, FILE);
}

/** Schrijft samengevoegd weg, zodat een reeks wijzigingen niet 10x schrijft. */
export function saveSoon() {
  if (writeQueued) return;
  writeQueued = true;
  setTimeout(() => {
    writeQueued = false;
    save();
  }, 50).unref?.();
}

export function db() {
  return store;
}

/** Alleen voor tests en voor de import-knop. */
export function replaceStore(next) {
  store = { ...emptyStore(), ...next, schemaVersion: SCHEMA_VERSION };
  save();
  return store;
}

export const newId = () => randomUUID();

/** Zoekt een record op id in een van de lijsten. */
export function find(collection, id) {
  return store[collection].find((row) => row.id === id) || null;
}

export function remove(collection, id) {
  const idx = store[collection].findIndex((row) => row.id === id);
  if (idx === -1) return false;
  store[collection].splice(idx, 1);
  saveSoon();
  return true;
}

/** Markeert een herinnering als verstuurd, zodat hij niet nog eens komt. */
export function markSent(key) {
  if (store.sent[key]) return false;
  store.sent[key] = Date.now();
  // Oude sleutels opruimen zodat het bestand niet eindeloos groeit.
  const cutoff = Date.now() - 30 * 86400000;
  for (const [k, when] of Object.entries(store.sent)) {
    if (when < cutoff) delete store.sent[k];
  }
  saveSoon();
  return true;
}
