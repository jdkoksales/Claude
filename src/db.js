import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

/**
 * Simple pure-JavaScript storage in a single JSON file. No native modules, so
 * `npm install` never needs a compiler/build tools — it just works on any
 * machine. Plenty fast for a personal assistant's amount of data.
 */

const FILE = config.db.file;
mkdirSync(dirname(FILE), { recursive: true });

const empty = {
  tasks: [],
  goals: [],
  progress: [],
  journal: [],
  seq: { tasks: 0, goals: 0, progress: 0, journal: 0 },
};

let store;
try {
  store = existsSync(FILE)
    ? { ...empty, ...JSON.parse(readFileSync(FILE, 'utf8')) }
    : { ...empty };
} catch {
  store = { ...empty };
}

function save() {
  writeFileSync(FILE, JSON.stringify(store, null, 2));
}

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
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
  findByTitle(title) {
    return store.tasks
      .filter((t) => t.status === 'open' && includesCI(t.title, title))
      .sort(byNewest)[0];
  },
};

// --- Goals & progress ---
export const goals = {
  add(title, description = null, targetDate = null) {
    const row = {
      id: ++store.seq.goals,
      title,
      description,
      target_date: targetDate,
      status: 'active',
      created_at: now(),
    };
    store.goals.push(row);
    save();
    return { id: row.id, title, description, targetDate };
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
      value,
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
    lines.push(
      `- [#${g.id}] ${g.title}${g.target_date ? ` → ${g.target_date}` : ''}` +
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
