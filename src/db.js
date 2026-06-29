import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

mkdirSync(dirname(config.db.file), { recursive: true });

const db = new Database(config.db.file);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    due TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    target_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL,
    note TEXT NOT NULL,
    value REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (goal_id) REFERENCES goals (id)
  );

  CREATE TABLE IF NOT EXISTS journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// --- Tasks ---
export const tasks = {
  add(title, due = null) {
    const info = db
      .prepare('INSERT INTO tasks (title, due) VALUES (?, ?)')
      .run(title, due);
    return { id: info.lastInsertRowid, title, due, status: 'open' };
  },
  list(status = 'open') {
    if (status === 'all') {
      return db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
    }
    return db
      .prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC')
      .all(status);
  },
  complete(id) {
    const info = db
      .prepare(
        "UPDATE tasks SET status = 'done', completed_at = datetime('now') WHERE id = ? AND status != 'done'",
      )
      .run(id);
    return info.changes > 0;
  },
  findByTitle(title) {
    return db
      .prepare(
        "SELECT * FROM tasks WHERE status = 'open' AND title LIKE ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(`%${title}%`);
  },
};

// --- Goals & progress ---
export const goals = {
  add(title, description = null, targetDate = null) {
    const info = db
      .prepare(
        'INSERT INTO goals (title, description, target_date) VALUES (?, ?, ?)',
      )
      .run(title, description, targetDate);
    return { id: info.lastInsertRowid, title, description, targetDate };
  },
  list(status = 'active') {
    if (status === 'all') {
      return db.prepare('SELECT * FROM goals ORDER BY created_at DESC').all();
    }
    return db
      .prepare('SELECT * FROM goals WHERE status = ? ORDER BY created_at DESC')
      .all(status);
  },
  findByTitle(title) {
    return db
      .prepare(
        "SELECT * FROM goals WHERE status = 'active' AND title LIKE ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(`%${title}%`);
  },
  setStatus(id, status) {
    return (
      db.prepare('UPDATE goals SET status = ? WHERE id = ?').run(status, id)
        .changes > 0
    );
  },
  logProgress(goalId, note, value = null) {
    const info = db
      .prepare('INSERT INTO progress (goal_id, note, value) VALUES (?, ?, ?)')
      .run(goalId, note, value);
    return { id: info.lastInsertRowid };
  },
  recentProgress(goalId, limit = 5) {
    return db
      .prepare(
        'SELECT * FROM progress WHERE goal_id = ? ORDER BY created_at DESC LIMIT ?',
      )
      .all(goalId, limit);
  },
};

// --- Journal (check-ins & reflections) ---
export const journal = {
  add(kind, content) {
    db.prepare('INSERT INTO journal (kind, content) VALUES (?, ?)').run(
      kind,
      content,
    );
  },
  recent(limit = 5) {
    return db
      .prepare('SELECT * FROM journal ORDER BY created_at DESC LIMIT ?')
      .all(limit);
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

export default db;
