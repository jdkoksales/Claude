import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { config } from './config.js';

/**
 * De opslag heeft twee gedaantes:
 *
 *  - een JSON-bestand, voor draaien op je eigen computer;
 *  - Postgres, voor draaien bij een hostingdienst zonder blijvende schijf
 *    (Vercel bijvoorbeeld draait per verzoek een nieuw proces).
 *
 * Beide leveren dezelfde vorm op, zodat de rest van de app het verschil niet
 * merkt. In Postgres staat alles in één rij als JSONB; voor twee mensen met
 * afspraken, doelen en taken is dat ruim voldoende, en het scheelt een
 * schemamigratie bij elke nieuwe soort gegevens. Schrijvende verzoeken pakken
 * eerst een rijvergrendeling, zodat jullie elkaars wijziging nooit overschrijven.
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
    settings: {},
  };
}

/**
 * Sleutels die de app nodig heeft maar die niemand hoeft in te vullen: ze
 * worden één keer aangemaakt en daarna in de opslag bewaard. Dat scheelt een
 * rij omgevingsvariabelen bij het uitrollen, en het houdt ze bij elkaar met de
 * gegevens waar ze bij horen.
 */
export function ensureSecrets(store) {
  const s = store.settings ||= {};
  let changed = false;
  if (!s.sessionSecret) {
    s.sessionSecret = randomBytes(32).toString('hex');
    changed = true;
  }
  if (!s.cronSecret) {
    s.cronSecret = randomBytes(24).toString('base64url');
    changed = true;
  }
  if (!s.createdAt) {
    s.createdAt = new Date().toISOString();
    changed = true;
  }
  return changed;
}

const normalize = (raw) => ({ ...emptyStore(), ...(raw || {}), schemaVersion: SCHEMA_VERSION });

// ── Bestand ────────────────────────────────────────────────────────────────

function fileBackend() {
  const file = config.db.file;
  mkdirSync(dirname(file), { recursive: true });

  let store;
  if (existsSync(file)) {
    let raw;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      // Nooit stilzwijgend overschrijven: liever niet starten dan data kwijt.
      throw new Error(
        `Kon ${file} niet lezen (${err.message}). Herstel het bestand of zet een backup terug.`,
      );
    }
    if (raw.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(
        `Onbekende schemaversie ${raw.schemaVersion} in ${file}; verwacht ${SCHEMA_VERSION}.`,
      );
    }
    store = normalize(raw);
  } else {
    store = emptyStore();
  }

  function write() {
    const tmp = join(dirname(file), `.${Date.now()}-${randomUUID().slice(0, 8)}.tmp`);
    writeFileSync(tmp, JSON.stringify(store, null, 2));
    renameSync(tmp, file);
  }

  if (ensureSecrets(store)) write();

  return {
    kind: 'file',
    async begin() {
      return {
        data: store,
        async done(dirty) {
          if (dirty) write();
        },
      };
    },
    async close() {},
  };
}

// ── Postgres ───────────────────────────────────────────────────────────────

async function postgresBackend() {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: config.db.url,
    // Serverless: veel korte processen, elk met hooguit een paar verbindingen.
    max: Number(process.env.PGPOOL_MAX || 2),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false },
  });

  const TABLE = 'samen.store';

  async function readRow(client) {
    const { rows } = await client.query(`select data from ${TABLE} where id = 1`);
    return rows[0] ? normalize(rows[0].data) : null;
  }

  return {
    kind: 'postgres',
    async begin(mutating) {
      const client = await pool.connect();
      let open = false;
      try {
        if (mutating) {
          await client.query('begin');
          open = true;
          // Wachten op elkaar mag, maar niet eindeloos.
          await client.query("set local lock_timeout = '5s'");
          const { rows } = await client.query(
            `select data from ${TABLE} where id = 1 for update`,
          );
          let data = rows[0] ? normalize(rows[0].data) : null;
          let fresh = false;
          if (!data) {
            data = emptyStore();
            fresh = true;
          }
          const madeSecrets = ensureSecrets(data);
          return {
            data,
            async done(dirty) {
              try {
                if (dirty || fresh || madeSecrets) {
                  await client.query(
                    `insert into ${TABLE} (id, data, updated_at) values (1, $1, now())
                     on conflict (id) do update set data = excluded.data, updated_at = now()`,
                    [JSON.stringify(data)],
                  );
                }
                await client.query('commit');
                open = false;
              } finally {
                if (open) await client.query('rollback').catch(() => {});
                client.release();
              }
            },
          };
        }

        let data = await readRow(client);
        if (!data) data = emptyStore();
        ensureSecrets(data);
        client.release();
        return { data, async done() {} };
      } catch (err) {
        if (open) await client.query('rollback').catch(() => {});
        client.release();
        throw err;
      }
    },
    async close() {
      await pool.end();
    },
  };
}

let backend = null;

/** Kiest de opslag op basis van de instellingen en start hem één keer op. */
export async function openStore() {
  if (backend) return backend;
  backend = config.db.url ? await postgresBackend() : fileBackend();
  return backend;
}

export const storeKind = () => backend?.kind || (config.db.url ? 'postgres' : 'file');

/** Alleen voor tests: gooit de gekozen opslag weg. */
export async function resetStore() {
  await backend?.close();
  backend = null;
}
