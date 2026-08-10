import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { emptyStore, openStore, SCHEMA_VERSION, storeKind } from './store.js';

/**
 * Elke aanvraag krijgt zijn eigen kijk op de opslag. Dat lijkt omslachtig voor
 * een app voor twee mensen, maar bij een hostingdienst zonder blijvende schijf
 * draait er niet één proces met alles in het geheugen: er kunnen meerdere
 * exemplaren tegelijk lopen. Door de gegevens per aanvraag te laden en aan het
 * eind weg te schrijven, kan de een niet de wijziging van de ander overschrijven.
 *
 * `AsyncLocalStorage` zorgt dat `db()` binnen een aanvraag altijd de juiste
 * gegevens teruggeeft, zonder dat elke functie een extra parameter nodig heeft.
 */

const context = new AsyncLocalStorage();

/** Draait `fn` met een geladen opslag; schrijft aan het eind weg als er iets veranderd is. */
export async function withStore(mutating, fn) {
  const backend = await openStore();
  const session = await backend.begin(mutating);
  const scope = { data: session.data, dirty: false };
  try {
    const result = await context.run(scope, fn);
    await session.done(scope.dirty);
    return result;
  } catch (err) {
    await session.done(false).catch(() => {});
    throw err;
  }
}

/** De gegevens van de huidige aanvraag. */
export function db() {
  const scope = context.getStore();
  if (!scope) {
    throw new Error('db() buiten een aanvraag gebruikt — gebruik withStore().');
  }
  return scope.data;
}

/** Markeert dat er iets gewijzigd is, zodat het aan het eind wordt opgeslagen. */
export function touch() {
  const scope = context.getStore();
  if (scope) scope.dirty = true;
}

export const newId = () => randomUUID();

/** Zoekt een record op id in een van de lijsten. */
export function find(collection, id) {
  return db()[collection].find((row) => row.id === id) || null;
}

export function remove(collection, id) {
  const list = db()[collection];
  const idx = list.findIndex((row) => row.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  touch();
  return true;
}

/** Vervangt de inhoud; gebruikt door de import-knop. */
export function replaceStore(next) {
  const scope = context.getStore();
  scope.data = { ...emptyStore(), ...next, schemaVersion: SCHEMA_VERSION };
  scope.dirty = true;
  return scope.data;
}

/**
 * Markeert een herinnering als verstuurd. Geeft false terug als hij al eerder
 * de deur uit ging, zodat een herstart nooit dubbel stuurt.
 */
export function markSent(key) {
  const store = db();
  if (store.sent[key]) return false;
  store.sent[key] = Date.now();
  // Oude sleutels opruimen zodat de opslag niet eindeloos groeit.
  const cutoff = Date.now() - 30 * 86400000;
  for (const [k, when] of Object.entries(store.sent)) {
    if (when < cutoff) delete store.sent[k];
  }
  touch();
  return true;
}

export { SCHEMA_VERSION, storeKind };
