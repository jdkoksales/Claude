import {
  mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import { ensureV2, emptyStoreV2 } from './lib/migrate.js';
import { todayKey, canLogDay, isoWeek } from './lib/dates.js';

/**
 * Opslag: één JSON-bestand, schema v2. Bij het laden van een v1-bestand wordt
 * eerst een backup weggeschreven en daarna automatisch gemigreerd.
 */

const FILE = config.db.file;
mkdirSync(dirname(FILE), { recursive: true });

let store;
try {
  const raw = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : null;
  const needsBackup = raw && raw.schemaVersion == null;
  if (needsBackup) {
    const backup = join(
      dirname(FILE),
      `backup-v1-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    );
    copyFileSync(FILE, backup);
    console.log(`[db] v1-data gevonden — backup gemaakt: ${backup}`);
  }
  const { store: migrated, migrated: didMigrate, notes } = ensureV2(raw);
  store = migrated;
  if (didMigrate) {
    for (const n of notes) console.log(`[db] migratie: ${n}`);
    save();
    console.log('[db] migratie naar schema v2 voltooid.');
  }
} catch (err) {
  if (existsSync(FILE)) {
    // Nooit stilletjes overschrijven bij een kapot/onbekend bestand.
    throw new Error(`Kon ${FILE} niet laden: ${err.message}`);
  }
  store = emptyStoreV2();
}

function save() {
  writeFileSync(FILE, JSON.stringify(store, null, 2));
}

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

const byNewest = (a, b) => b.id - a.id;

/** Volledige store (voor export en inzichten). Niet muteren van buitenaf. */
export function raw() {
  return store;
}

/** Vervang de hele store (import). Caller heeft al gevalideerd/gemigreerd. */
export function replaceStore(newStore) {
  if (existsSync(FILE)) {
    const backup = join(
      dirname(FILE),
      `backup-pre-import-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    );
    copyFileSync(FILE, backup);
  }
  store = newStore;
  save();
}

// ─── Doelen ─────────────────────────────────────────────
export const goals = {
  /** Actieve doelen; verlopen pauzes worden automatisch weer actief. */
  active() {
    let changed = false;
    for (const g of store.goals) {
      if (g.status === 'paused' && g.paused_until && g.paused_until < todayKey()) {
        g.status = 'active';
        g.paused_until = null;
        changed = true;
      }
    }
    if (changed) save();
    return store.goals.filter((g) => g.status === 'active').sort(byNewest);
  },
  all() {
    return [...store.goals].sort(byNewest);
  },
  byId(id) {
    return store.goals.find((g) => g.id === Number(id));
  },
  /** Nieuw doel in intentie-format. Max 3 actief — hard afgedwongen. */
  addIntention({ anchor, action, place, minimum, target, stake }) {
    if (this.active().length >= 3) {
      throw Object.assign(new Error('Maximaal 3 actieve doelen. Pauzeer of archiveer er eerst één.'), { status: 400 });
    }
    const g = {
      id: ++store.seq.goals,
      anchor, action, place, minimum, target,
      stake: stake || null,
      status: 'active',
      paused_until: null,
      created_at: now(),
      legacy: null,
    };
    store.goals.push(g);
    save();
    return g;
  },
  update(id, fields) {
    const g = this.byId(id);
    if (!g) return null;
    for (const k of ['anchor', 'action', 'place', 'minimum', 'target', 'stake']) {
      if (fields[k] !== undefined) g[k] = fields[k] === '' ? null : fields[k];
    }
    if (fields.status === 'archived') { g.status = 'archived'; g.paused_until = null; }
    if (fields.status === 'active') {
      if (g.status !== 'active' && this.active().length >= 3) {
        throw Object.assign(new Error('Maximaal 3 actieve doelen.'), { status: 400 });
      }
      g.status = 'active'; g.paused_until = null;
    }
    if (fields.pause_days) {
      g.status = 'paused';
      const until = new Date();
      until.setDate(until.getDate() + Number(fields.pause_days));
      g.paused_until = until.toISOString().slice(0, 10);
    }
    save();
    return g;
  },
};

// ─── Dag-logs ───────────────────────────────────────────
export const dayLogs = {
  all() {
    return store.dayLogs;
  },
  forGoal(goalId) {
    return store.dayLogs.filter((l) => l.goal_id === Number(goalId));
  },
  get(goalId, day) {
    return store.dayLogs.find((l) => l.goal_id === Number(goalId) && l.day === day);
  },
  /**
   * Zet of wis het niveau voor een dag. Alleen vandaag/gisteren (03:00-grens),
   * server-side afgedwongen. level null = wissen (undo).
   */
  set(goalId, day, level) {
    if (!canLogDay(day)) {
      throw Object.assign(new Error('Loggen kan alleen voor vandaag of gisteren.'), { status: 400 });
    }
    if (level !== null && !['minimum', 'target', 'skip'].includes(level)) {
      throw Object.assign(new Error('Ongeldig niveau.'), { status: 400 });
    }
    const existing = this.get(goalId, day);
    if (level === null) {
      if (existing) {
        store.dayLogs = store.dayLogs.filter((l) => l !== existing);
        save();
      }
      return null;
    }
    if (existing) {
      existing.level = level;
      existing.logged_at = now();
    } else {
      store.dayLogs.push({
        id: ++store.seq.dayLogs,
        goal_id: Number(goalId),
        day,
        level,
        logged_at: now(),
      });
    }
    save();
    return this.get(goalId, day);
  },
};

// ─── Taken (ongewijzigd gedrag) ─────────────────────────
export const tasks = {
  add(title, due = null) {
    const row = {
      id: ++store.seq.tasks,
      title, due,
      status: 'open',
      created_at: now(),
      completed_at: null,
    };
    store.tasks.push(row);
    save();
    return row;
  },
  list(status = 'open') {
    const rows = status === 'all' ? [...store.tasks] : store.tasks.filter((t) => t.status === status);
    return rows.sort(byNewest);
  },
  complete(id) {
    const t = store.tasks.find((x) => x.id === Number(id) && x.status !== 'done');
    if (!t) return false;
    t.status = 'done';
    t.completed_at = now();
    save();
    return true;
  },
  reopen(id) {
    const t = store.tasks.find((x) => x.id === Number(id) && x.status === 'done');
    if (!t) return false;
    t.status = 'open';
    t.completed_at = null;
    save();
    return true;
  },
  doneToday() {
    const today = todayKey();
    return store.tasks
      .filter((t) => t.status === 'done' && t.completed_at &&
        todayKeyOf(t.completed_at) === today)
      .sort(byNewest);
  },
};

function todayKeyOf(ts) {
  return todayKey(new Date(String(ts).replace(' ', 'T')));
}

// ─── Weekreview ─────────────────────────────────────────
export const reviews = {
  latest() {
    return [...store.reviews].sort(byNewest)[0] || null;
  },
  forWeek(week) {
    return store.reviews.find((r) => r.week === week) || null;
  },
  submit(week, answers, skipped = false) {
    const existing = this.forWeek(week);
    if (existing) return existing;
    const r = {
      id: ++store.seq.reviews,
      week,
      answers: skipped ? null : answers,
      skipped,
      created_at: now(),
    };
    store.reviews.push(r);
    save();
    return r;
  },
  dueFor(today, reviewDay) {
    const week = isoWeek(today);
    return !this.forWeek(week) && new Date(today + 'T12:00').getDay() === reviewDay;
  },
};

// ─── Coach-log (max 1 interventie per dag) ──────────────
export const coachLog = {
  forDay(day) {
    return store.coachLog.find((c) => c.day === day) || null;
  },
  add(day, trigger, goalId, card) {
    const entry = {
      id: ++store.seq.coachLog,
      day,
      trigger,
      goal_id: goalId ?? null,
      bericht: card.bericht,
      acties: card.acties,
      fallback: !!card.fallback,
      dismissed: false,
      created_at: now(),
    };
    store.coachLog.push(entry);
    save();
    return entry;
  },
  dismiss(day) {
    const c = this.forDay(day);
    if (c) {
      c.dismissed = true;
      save();
    }
  },
};

// ─── Instellingen & sessies ─────────────────────────────
export const settings = {
  get() {
    return { ...store.settings };
  },
  set(fields) {
    if (fields.reviewDay !== undefined) {
      const d = Number(fields.reviewDay);
      if (!Number.isInteger(d) || d < 0 || d > 6) {
        throw Object.assign(new Error('reviewDay moet 0-6 zijn.'), { status: 400 });
      }
      store.settings.reviewDay = d;
    }
    save();
    return this.get();
  },
};

export const sessions = {
  add(token) {
    store.sessions.push({ token, created_at: now() });
    if (store.sessions.length > 20) store.sessions = store.sessions.slice(-20);
    save();
  },
  has(token) {
    return store.sessions.some((s) => s.token === token);
  },
};
