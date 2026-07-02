import { tasks, goals, journal } from './db.js';
import { config } from './config.js';
import * as gcal from './google.js';

/**
 * Tool definitions exposed to Claude (client-side tools we execute here),
 * plus a handler map. The web-search tool is added separately in claude.js
 * because it is an Anthropic server-side tool.
 */
export const toolDefs = [
  {
    name: 'add_task',
    description: 'Voeg een taak/to-do toe voor de gebruiker.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Korte omschrijving van de taak.' },
        due: { type: 'string', description: 'Optionele deadline, bv. 2026-07-01.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Toon taken. status: open (standaard), done of all.',
    input_schema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['open', 'done', 'all'] } },
    },
  },
  {
    name: 'complete_task',
    description: 'Vink een taak af. Geef het id, of een stuk van de titel.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        title: { type: 'string' },
      },
    },
  },
  {
    name: 'add_goal',
    description:
      'Leg een doel vast. Geef target_value + unit mee als het meetbaar is ' +
      '(bv. 10 kg, 100 km), zodat de app een voortgangsbalk kan tonen.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        target_date: { type: 'string', description: 'Optionele streefdatum (YYYY-MM-DD).' },
        target_value: { type: 'number', description: 'Optionele meetbare doelwaarde.' },
        unit: { type: 'string', description: 'Eenheid bij target_value, bv. kg of km.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_goals',
    description: 'Toon de doelen van de gebruiker met streaks en recente voortgang.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'log_progress',
    description:
      'Noteer voortgang op een doel. Geef goal_id of een stuk van de doeltitel. ' +
      'Geef value mee bij meetbare doelen (de huidige stand, bv. 84.5).',
    input_schema: {
      type: 'object',
      properties: {
        goal_id: { type: 'number' },
        goal_title: { type: 'string' },
        note: { type: 'string', description: 'Wat is er bereikt/gebeurd.' },
        value: { type: 'number', description: 'Optionele huidige meetwaarde.' },
      },
      required: ['note'],
    },
  },
  {
    name: 'save_reflection',
    description:
      'Sla een check-in/reflectie op (kind: morning, evening, weekly of note).',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['content'],
    },
  },
  {
    name: 'calendar_list_events',
    description: 'Toon aankomende agenda-afspraken (Google Calendar).',
    input_schema: {
      type: 'object',
      properties: {
        time_min: { type: 'string' },
        time_max: { type: 'string' },
      },
    },
  },
  {
    name: 'calendar_create_event',
    description: 'Maak een afspraak in Google Calendar (start/end als ISO-tijd).',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        start: { type: 'string' },
        end: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['summary', 'start', 'end'],
    },
  },
  {
    name: 'gmail_draft',
    description:
      'Maak een concept-e-mail in Gmail (verstuurt niet, alleen een draft).',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
];

export const handlers = {
  add_task({ title, due }) {
    const t = tasks.add(title, due || null);
    return `Taak toegevoegd: #${t.id} "${title}"${due ? ` (deadline ${due})` : ''}.`;
  },
  list_tasks({ status = 'open' }) {
    const rows = tasks.list(status);
    if (!rows.length) return `Geen taken (${status}).`;
    return rows
      .map(
        (t) =>
          `#${t.id} [${t.status}] ${t.title}${t.due ? ` (deadline ${t.due})` : ''}`,
      )
      .join('\n');
  },
  complete_task({ id, title }) {
    let taskId = id;
    if (!taskId && title) {
      const found = tasks.findByTitle(title);
      if (!found) return `Geen open taak gevonden die lijkt op "${title}".`;
      taskId = found.id;
    }
    if (!taskId) return 'Geef een id of titel op.';
    return tasks.complete(taskId)
      ? `Taak #${taskId} afgevinkt. 🎉`
      : `Taak #${taskId} niet gevonden of al afgerond.`;
  },
  add_goal({ title, description, target_date, target_value, unit }) {
    const g = goals.add(
      title,
      description || null,
      target_date || null,
      target_value ?? null,
      unit || null,
    );
    return `Doel vastgelegd: #${g.id} "${title}".`;
  },
  list_goals() {
    const rows = goals.list('active');
    if (!rows.length) return 'Nog geen doelen ingesteld.';
    return rows
      .map((g) => {
        const prog = goals.recentProgress(g.id, 2);
        const streak = goals.streak(g.id);
        const parts = [`#${g.id} ${g.title}`];
        if (g.target_value) parts.push(`doel: ${g.target_value}${g.unit ? ' ' + g.unit : ''}`);
        if (g.target_date) parts.push(`→ ${g.target_date}`);
        if (streak > 1) parts.push(`streak: ${streak} dagen`);
        const head = parts.join(' | ');
        const ph = prog.length
          ? '\n   voortgang: ' + prog.map((p) => p.note).join('; ')
          : '';
        return head + ph;
      })
      .join('\n');
  },
  log_progress({ goal_id, goal_title, note, value }) {
    let id = goal_id;
    if (!id && goal_title) {
      const found = goals.findByTitle(goal_title);
      if (!found) return `Geen actief doel gevonden dat lijkt op "${goal_title}".`;
      id = found.id;
    }
    if (!id) return 'Geef goal_id of goal_title op.';
    goals.logProgress(id, note, value ?? null);
    const streak = goals.streak(id);
    return `Voortgang genoteerd bij doel #${id}.` + (streak > 1 ? ` Streak: ${streak} dagen! 🔥` : '');
  },
  save_reflection({ kind = 'note', content }) {
    journal.add(kind, content);
    return 'Reflectie opgeslagen.';
  },
  async calendar_list_events({ time_min, time_max }) {
    const res = await gcal.listEvents({ timeMin: time_min, timeMax: time_max });
    if (!res.ok) return res.message;
    if (!res.events.length) return 'Geen afspraken gevonden.';
    return res.events
      .map((e) => `${e.start} – ${e.summary}${e.location ? ` @ ${e.location}` : ''}`)
      .join('\n');
  },
  async calendar_create_event({ summary, start, end, description }) {
    const res = await gcal.createEvent({ summary, start, end, description });
    return res.ok ? `Afspraak aangemaakt: ${res.link}` : res.message;
  },
  async gmail_draft({ to, subject, body }) {
    const res = await gcal.draftEmail({ to, subject, body });
    return res.ok
      ? `Concept-mail klaargezet in Gmail (draft ${res.draftId}).`
      : res.message;
  },
};

/**
 * Build the final tool list for the API call, dropping Google tools when the
 * integration is not configured (so Claude doesn't try to use them).
 */
export function activeToolDefs() {
  const googleTools = ['calendar_list_events', 'calendar_create_event', 'gmail_draft'];
  return toolDefs.filter(
    (t) => config.google.enabled || !googleTools.includes(t.name),
  );
}
