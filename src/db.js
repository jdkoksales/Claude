import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

/**
 * Pure-JavaScript storage in a single JSON file. No native modules, so
 * `npm install` never needs a compiler — it just works on any machine.
 * Plenty fast for a personal coach's amount of data.
 */

const FILE = config.db.file;
mkdirSync(dirname(FILE), { recursive: true });

const empty = {
  tasks: [],
  goals: [],
  progress: [],
  journal: [],
  chat: [],
  subs: [],
  sessions: [],
  seq: { tasks: 0, goals: 0, progress: 0, journal: 0, chat: 0 },
};

let store;
try {
  store = existsSync(FILE)
    ? { ...structuredClone(empty), ...JSON.parse(readFileSync(FILE, 'utf8')) }
    : structuredClone(empty);
} catch {
  store = structuredClone(empty);
}

function save() {
  writeFileSync(FILE, JSON.stringify(store, null, 2));
}

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/** Local calendar date (YYYY-MM-DD) for a stored timestamp or Date. */
function localDay(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(String(d).replace(' ', 'T'));
  const off = dt.getTimezoneOffset() * 60000;
  return new Date(dt.getTime() - off).toISOString().slice(0, 10);
}

const byNewest = (a, b) => b.id - a.id;
const includesCI = (haystack, needle) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

// --- Tasks ---
export const tasks = {
  add(title, due = null) {
    const row = {
      id: ++store.seq.tasks,
      title,
      due,
      status: 'open',
      created_at: now(),
      completed_at: null,
    };
    store.tasks.push(row);
    save();
    return { id: row.id, title, due, status: 'open' };
  },
  list(status = 'open') {
    const rows =
      status === 'all'
        ? [...store.tasks]
        : store.tasks.filter((t) => t.status === status);
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
  findByTitle(title) {
    return store.tasks
      .filter((t) => t.status === 'open' && includesCI(t.title, title))
      .sort(byNewest)[0];
  },
  doneToday() {
    const today = localDay();
    return store.tasks.filter(
      (t) => t.status === 'done' && t.completed_at && localDay(t.completed_at) === today,
    ).sort(byNewest);
  },
};

// --- Goals & progress ---
export const goals = {
  add(title, description = null, targetDate = null, targetValue = null, unit = null) {
    const row = {
      id: ++store.seq.goals,
      title,
      description,
      target_date: targetDate,
      target_value: targetValue,
      unit,
      status: 'active',
      created_at: now(),
    };
    store.goals.push(row);
    save();
    return { id: row.id, title };
  },
  list(status = 'active') {
    const rows =
      status === 'all'
        ? [...store.goals]
        : store.goals.filter((g) => g.status === status);
    return rows.sort(byNewest);
  },
  findByTitle(title) {
    return store.goals
      .filter((g) => g.status === 'active' && includesCI(g.title, title))
      .sort(byNewest)[0];
  },
  setStatus(id, status) {
    const g = store.goals.find((x) => x.id === Number(id));
    if (!g) return false;
    g.status = status;
    save();
    return true;
  },
  logProgress(goalId, note, value = null) {
    const row = {
      id: ++store.seq.progress,
      goal_id: Number(goalId),
      note,
      value: value == null ? null : Number(value),
      created_at: now(),
    };
    store.progress.push(row);
    save();
    return { id: row.id };
  },
  recentProgress(goalId, limit = 5) {
    return store.progress
      .filter((p) => p.goal_id === Number(goalId))
      .sort(byNewest)
      .slice(0, limit);
  },

  /**
   * Consecutive-day streak: number of days in a row (ending today, or
   * yesterday if today has no entry yet) with at least one progress entry.
   */
  streak(goalId) {
    const days = new Set(
      store.progress
        .filter((p) => p.goal_id === Number(goalId))
        .map((p) => localDay(p.created_at)),
    );
    if (days.size === 0) return 0;
    const cursor = new Date();
    if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (days.has(localDay(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  },

  /**
   * Chart series for a goal: one point per day.
   * - If entries carry numeric values → the latest value that day (a measured
   *   metric like weight or km).
   * - Otherwise → cumulative count of check-offs (habit-style goals).
   */
  series(goalId) {
    const rows = store.progress
      .filter((p) => p.goal_id === Number(goalId))
      .sort((a, b) => a.id - b.id);
    if (rows.length === 0) return { mode: 'none', points: [] };
    const numeric = rows.some((r) => r.value != null);
    const byDay = new Map();
    let cum = 0;
    for (const r of rows) {
      const day = localDay(r.created_at);
      if (numeric) {
        if (r.value != null) byDay.set(day, r.value);
      } else {
        cum++;
        byDay.set(day, cum);
      }
    }
    return {
      mode: numeric ? 'value' : 'count',
      points: [...byDay.entries()].map(([day, value]) => ({ day, value })),
    };
  },
};

// --- Journal (check-ins & reflections) ---
export const journal = {
  add(kind, content) {
    store.journal.push({
      id: ++store.seq.journal,
      kind,
      content,
      created_at: now(),
    });
    save();
  },
  recent(limit = 5) {
    return [...store.journal].sort(byNewest).slice(0, limit);
  },
};

// --- Chat history (the running conversation with the coach) ---
export const chat = {
  append(role, content) {
    store.chat.push({ id: ++store.seq.chat, role, content, created_at: now() });
    save();
  },
  /** Last `limit` messages, oldest→newest, shaped for the Claude API. */
  forModel(limit = 40) {
    return store.chat.slice(-limit).map((m) => ({ role: m.role, content: m.content }));
  },
  all(limit = 200) {
    return store.chat.slice(-limit);
  },
};

// --- Web-push subscriptions ---
export const subs = {
  add(subscription) {
    if (!store.subs.some((s) => s.endpoint === subscription.endpoint)) {
      store.subs.push(subscription);
      save();
    }
  },
  remove(endpoint) {
    store.subs = store.subs.filter((s) => s.endpoint !== endpoint);
    save();
  },
  all() {
    return [...store.subs];
  },
};

// --- Login sessions (so a restart doesn't log you out) ---
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

/**
 * A compact snapshot of the user's current state, injected into the system
 * prompt so Claude has continuity across conversations and check-ins.
 */
export function buildContextSummary() {
  const openTasks = tasks.list('open');
  const activeGoals = goals.list('active');
  const recentJournal = journal.recent(3);

  const lines = [];

  lines.push('# Huidige status van de gebruiker');

  lines.push('\n## Open taken');
  if (openTasks.length === 0) lines.push('(geen open taken)');
  for (const t of openTasks.slice(0, 15)) {
    lines.push(`- [#${t.id}] ${t.title}${t.due ? ` (deadline: ${t.due})` : ''}`);
  }

  lines.push('\n## Actieve doelen');
  if (activeGoals.length === 0) lines.push('(geen doelen ingesteld)');
  for (const g of activeGoals) {
    const prog = goals.recentProgress(g.id, 1)[0];
    const streak = goals.streak(g.id);
    lines.push(
      `- [#${g.id}] ${g.title}` +
        (g.target_value ? ` (doel: ${g.target_value}${g.unit ? ' ' + g.unit : ''})` : '') +
        (g.target_date ? ` → ${g.target_date}` : '') +
        (streak > 1 ? ` | streak: ${streak} dagen` : '') +
        (prog ? ` | laatste voortgang: ${prog.note}` : ''),
    );
  }

  if (recentJournal.length) {
    lines.push('\n## Recente check-ins');
    for (const j of recentJournal) {
      lines.push(`- (${j.created_at}, ${j.kind}) ${j.content.slice(0, 200)}`);
    }
  }

  return lines.join('\n');
}
