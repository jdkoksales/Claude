import { dayKey } from './dates.js';

/**
 * Migratie van store v1 (chat/streak-tijdperk) naar schema v2.
 * Puur: krijgt het oude object, geeft het nieuwe terug. Niets gaat verloren:
 * alles wat geen plek meer heeft in de UI verhuist naar `archive`.
 */

export const SCHEMA_VERSION = 2;

export function emptyStoreV2() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { reviewDay: 0 }, // 0 = zondag
    tasks: [],
    goals: [],
    dayLogs: [],
    reviews: [],
    coachLog: [],
    sessions: [],
    archive: { chat: [], journal: [], progress: [], subs: [] },
    seq: { tasks: 0, goals: 0, dayLogs: 0, reviews: 0, coachLog: 0 },
  };
}

/** Redelijk, bewust klein minimum op basis van de doeltitel. */
export function suggestMinimum(title = '') {
  const t = title.toLowerCase();
  if (/(sport|hardloop|fitness|train|beweeg|zwem|fiets)/.test(t)) {
    return '2 minuten bewegen (rek & strek of een blokje om)';
  }
  if (/(lez|boek|lees)/.test(t)) return '1 bladzijde lezen';
  if (/(afval|kilo|gewicht|eten|dieet)/.test(t)) return '1 glas water bij het ontbijt';
  if (/(schrijf|blog|studie|leren|studeer)/.test(t)) return '2 minuten: document openen en 1 zin schrijven';
  if (/(mediteer|adem|rust|slaap)/.test(t)) return '3 rustige ademhalingen';
  return `2 minuten bezig zijn met: ${title}`.slice(0, 120);
}

function migrateGoal(old) {
  const targetFromLegacy =
    old.target_value != null
      ? `${old.target_value}${old.unit ? ' ' + old.unit : ''}`
      : null;
  return {
    id: old.id,
    anchor: null, // intentievelden waren er nog niet; app nodigt uit ze in te vullen
    action: old.title,
    place: null,
    minimum: suggestMinimum(old.title),
    target: targetFromLegacy || `Volledige sessie: ${old.title}`,
    stake: null,
    status: old.status === 'active' ? 'active' : 'archived',
    paused_until: null,
    created_at: old.created_at,
    legacy: {
      title: old.title,
      description: old.description ?? null,
      target_value: old.target_value ?? null,
      unit: old.unit ?? null,
      target_date: old.target_date ?? null,
    },
  };
}

/**
 * v1 → v2. Retourneert { store, notes[] } zodat de aanroeper kan loggen wat
 * er is omgezet.
 */
export function migrateV1toV2(v1) {
  const notes = [];
  const out = emptyStoreV2();

  out.tasks = (v1.tasks || []).map((t) => ({ ...t }));
  out.sessions = (v1.sessions || []).map((s) => ({ ...s }));
  out.archive = {
    chat: v1.chat || [],
    journal: v1.journal || [],
    progress: v1.progress || [],
    subs: v1.subs || [],
  };

  // Doelen: intentie-format + minimum/target; max 3 actief.
  out.goals = (v1.goals || []).map(migrateGoal);
  const active = out.goals.filter((g) => g.status === 'active');
  if (active.length > 3) {
    const keep = new Set(
      [...active].sort((a, b) => b.id - a.id).slice(0, 3).map((g) => g.id),
    );
    for (const g of active) {
      if (!keep.has(g.id)) {
        g.status = 'paused';
        notes.push(`Doel #${g.id} "${g.action}" op gepauzeerd gezet (max 3 actief).`);
      }
    }
  }

  // Progress → dayLogs: per doel+dag één log, level 'target'
  // (er is die dag aantoonbaar iets gedaan). Historie blijft zo meetellen
  // voor "dagen actief" en "comebacks".
  const seen = new Set();
  let logId = 0;
  for (const p of v1.progress || []) {
    const day = dayKey(new Date(String(p.created_at).replace(' ', 'T')));
    const key = `${p.goal_id}:${day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.dayLogs.push({
      id: ++logId,
      goal_id: p.goal_id,
      day,
      level: 'target',
      logged_at: p.created_at,
    });
  }
  if (out.dayLogs.length) {
    notes.push(`${out.dayLogs.length} historische dag(en) uit voortgang overgenomen als dayLogs.`);
  }

  out.seq = {
    tasks: v1.seq?.tasks ?? Math.max(0, ...out.tasks.map((t) => t.id)),
    goals: v1.seq?.goals ?? Math.max(0, ...out.goals.map((g) => g.id)),
    dayLogs: logId,
    reviews: 0,
    coachLog: 0,
  };

  return { store: out, notes };
}

/**
 * Zorg dat een geladen object schema v2 heeft. Accepteert: leeg, v1, v2.
 * Retourneert { store, migrated, notes }.
 */
export function ensureV2(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { store: emptyStoreV2(), migrated: false, notes: [] };
  }
  if (raw.schemaVersion === SCHEMA_VERSION) {
    // Vul eventueel ontbrekende collecties defensief aan.
    const base = emptyStoreV2();
    return {
      store: {
        ...base,
        ...raw,
        settings: { ...base.settings, ...(raw.settings || {}) },
        archive: { ...base.archive, ...(raw.archive || {}) },
        seq: { ...base.seq, ...(raw.seq || {}) },
      },
      migrated: false,
      notes: [],
    };
  }
  if (raw.schemaVersion != null) {
    throw new Error(
      `Onbekende schemaversie ${raw.schemaVersion} — import/geladen bestand geweigerd om dataverlies te voorkomen.`,
    );
  }
  const { store, notes } = migrateV1toV2(raw);
  return { store, migrated: true, notes };
}
