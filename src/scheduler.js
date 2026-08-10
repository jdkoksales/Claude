import { config } from './config.js';
import { db, markSent, withStore } from './db.js';
import { addDays, minutesOfDay, nowTime, todayKey, zonedToInstant } from './lib/dates.js';
import { expandEvents } from './lib/recurrence.js';
import { BOTH, openToday } from './lib/goals.js';
import { notify, pushReady } from './push.js';

/**
 * Elke minuut kijken of er iets verstuurd moet worden. Twee soorten
 * herinneringen:
 *
 *   1. vóór een afspraak (per afspraak in te stellen);
 *   2. één keer per dag een overzicht van doelen die nog openstaan.
 *
 * Elke melding krijgt een sleutel die wordt opgeslagen, zodat een herstart van
 * de server nooit dezelfde melding twee keer stuurt. Meldingen die meer dan
 * tien minuten te laat zijn worden overgeslagen — dan is de app kennelijk
 * even uit geweest en is het bericht niet meer nuttig.
 */

const TICK_MS = 60 * 1000;
const LATE_LIMIT_MS = 10 * 60 * 1000;

let timer = null;

export function startScheduler() {
  if (timer) return;
  const run = () => withStore(true, () => tick())
    .catch((err) => console.error('[herinneringen] fout:', err.message));
  timer = setInterval(run, TICK_MS);
  timer.unref?.();
  run();
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function tick(now = new Date()) {
  if (!pushReady()) return { events: 0, digests: 0 };
  const tz = config.app.timezone;
  const today = todayKey(tz, now);
  let events = 0;
  let digests = 0;

  events += await eventReminders(now, today, tz);
  digests += await dailyDigest(now, today, tz);

  return { events, digests };
}

async function eventReminders(now, today, tz) {
  const store = db();
  const withReminder = store.events.filter((e) => Number.isFinite(e.reminderMin) && !e.allDay);
  if (withReminder.length === 0) return 0;

  // Vandaag én morgen, zodat een herinnering van 12 uur vooraf ook aankomt.
  const occurrences = expandEvents(withReminder, today, addDays(today, 1));
  let sent = 0;

  for (const occ of occurrences) {
    if (!occ.start) continue;
    const at = zonedToInstant(occ.date, occ.start, tz).getTime() - occ.reminderMin * 60000;
    const delta = now.getTime() - at;
    if (delta < 0 || delta > LATE_LIMIT_MS) continue;
    if (!markSent(`event:${occ.occurrenceId}:${occ.reminderMin}`)) continue;

    const targets = occ.ownerId === BOTH
      ? store.users.map((u) => u.id)
      : [occ.ownerId];
    const owner = store.users.find((u) => u.id === occ.ownerId);
    const label = occ.ownerId === BOTH ? 'Samen' : owner?.name || 'Agenda';

    for (const userId of targets) {
      sent += await notify(userId, {
        title: `${occ.start} — ${occ.title}`,
        body: occ.location ? `${label} · ${occ.location}` : label,
        tag: `event-${occ.occurrenceId}`,
        url: `/?tab=agenda&date=${occ.date}`,
      });
    }
  }
  return sent;
}

async function dailyDigest(now, today, tz) {
  const target = config.push.dailyDigestAt;
  const current = nowTime(tz, now);
  const diff = minutesOfDay(current) - minutesOfDay(target);
  if (diff < 0 || diff > 10) return 0;

  const store = db();
  let sent = 0;

  for (const user of store.users) {
    if (!markSent(`digest:${today}:${user.id}`)) continue;
    const mine = store.goals.filter(
      (g) => !g.archived && (g.ownerId === user.id || g.ownerId === BOTH),
    );
    const open = openToday(mine, today);
    const tasks = store.tasks.filter(
      (t) => !t.done && t.dueDate === today
        && (t.assigneeId === user.id || t.assigneeId === BOTH || t.assigneeId == null),
    );
    if (open.length === 0 && tasks.length === 0) continue;

    const bits = [];
    if (open.length) {
      bits.push(open.map(({ goal }) => goal.title).join(', '));
    }
    if (tasks.length) {
      bits.push(`${tasks.length} taak${tasks.length === 1 ? '' : 'en'} voor vandaag`);
    }
    sent += await notify(user.id, {
      title: open.length ? 'Nog open vandaag' : 'Taken voor vandaag',
      body: bits.join(' · '),
      tag: `digest-${today}`,
      url: '/?tab=vandaag',
    });
  }
  return sent;
}
