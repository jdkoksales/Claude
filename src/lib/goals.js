import { addDays, daysBetween, eachDay, weekStart } from './dates.js';


/**
 * Twee soorten doelen:
 *
 *  - gewoonte ('habit')  — afvinken per dag. Dagelijks, of een aantal keer per
 *                          week. Levert een reeks (streak) en een heatmap op.
 *  - project ('project') — optellen naar een streefgetal, met een deadline.
 *
 * Een doel hoort bij één persoon of bij jullie samen (ownerId === 'both'). Bij
 * een samen-doel telt een dag mee zodra één van jullie tweeën heeft afgevinkt;
 * zo telt dezelfde avond koken niet dubbel.
 */

export const BOTH = 'both';

/** Heeft dit doel op deze dag een afvinking die meetelt? */
export function isDayDone(goal, dateKey) {
  const who = goal.checkins?.[dateKey];
  if (!Array.isArray(who) || who.length === 0) return false;
  if (goal.ownerId === BOTH) return true;
  return who.includes(goal.ownerId);
}

/** Wie heeft er op deze dag afgevinkt? */
export function checkedBy(goal, dateKey) {
  const who = goal.checkins?.[dateKey];
  return Array.isArray(who) ? [...who] : [];
}

function weeklyTarget(goal) {
  if (goal.cadence?.type === 'weekly') {
    return Math.max(1, Number(goal.cadence.timesPerWeek) || 1);
  }
  return 7;
}

/** Aantal meetellende dagen in de week waarin `dateKey` valt. */
export function weekCount(goal, dateKey) {
  const start = weekStart(dateKey);
  let n = 0;
  for (const day of eachDay(start, addDays(start, 6))) {
    if (isDayDone(goal, day)) n += 1;
  }
  return n;
}

/**
 * Reeks van een dagelijkse gewoonte: hoeveel aaneengesloten dagen tot en met
 * vandaag. Een nog niet afgevinkte dag van vandaag breekt de reeks niet — die
 * dag is immers nog bezig.
 */
function dailyStreak(goal, today) {
  let streak = 0;
  let cursor = isDayDone(goal, today) ? today : addDays(today, -1);
  // Maximaal ~5 jaar terugkijken; genoeg, en het loopt nooit oneindig door.
  for (let i = 0; i < 1830; i += 1) {
    if (!isDayDone(goal, cursor)) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Reeks van een weekdoel: aaneengesloten weken waarin het aantal is gehaald. */
function weeklyStreak(goal, today) {
  const target = weeklyTarget(goal);
  let streak = 0;
  let cursor = weekStart(today);
  if (weekCount(goal, cursor) < target) cursor = addDays(cursor, -7);
  for (let i = 0; i < 260; i += 1) {
    if (weekCount(goal, cursor) < target) break;
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

/** Langste reeks aaneengesloten afgevinkte dagen die ooit is gehaald. */
export function longestDailyStreak(goal) {
  const days = Object.keys(goal.checkins || {})
    .filter((d) => isDayDone(goal, d))
    .sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    run = prev && daysBetween(prev, day) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = day;
  }
  return best;
}

/** Samenvatting van een gewoonte, klaar om naar de interface te sturen. */
export function habitStats(goal, today, historyWeeks = 13) {
  const daily = goal.cadence?.type !== 'weekly';
  const target = weeklyTarget(goal);
  // De geschiedenis begint altijd op een maandag en eindigt op een zondag, zo
  // vormt de heatmap nette kolommen van precies één week.
  const thisWeek = weekStart(today);
  const first = addDays(thisWeek, -(historyWeeks - 1) * 7);
  const last = addDays(thisWeek, 6);
  const history = eachDay(first, last).map((date) => ({
    date,
    done: isDayDone(goal, date),
    by: checkedBy(goal, date),
  }));
  return {
    kind: 'habit',
    daily,
    doneToday: isDayDone(goal, today),
    checkedToday: checkedBy(goal, today),
    streak: daily ? dailyStreak(goal, today) : weeklyStreak(goal, today),
    streakUnit: daily ? 'dagen' : 'weken',
    longest: longestDailyStreak(goal),
    weekDone: weekCount(goal, today),
    weekTarget: daily ? 7 : target,
    history,
    totalDone: history.filter((d) => d.done).length,
  };
}

/** Totaal van alle bijdragen aan een projectdoel. */
export function projectTotal(goal) {
  return (goal.entries || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

/** Samenvatting van een projectdoel, inclusief of je op schema ligt. */
export function projectStats(goal, today) {
  const target = Number(goal.target) || 0;
  const total = projectTotal(goal);
  const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const remaining = Math.max(0, target - total);
  const daysLeft = goal.deadline ? daysBetween(today, goal.deadline) : null;

  let onTrack = null;
  let perDayNeeded = null;
  if (goal.deadline && target > 0) {
    if (daysLeft > 0) {
      perDayNeeded = remaining / daysLeft;
      // Verwacht op basis van verstreken tijd sinds de start van het doel.
      const span = daysBetween(goal.startDate || goal.createdDate || today, goal.deadline);
      const elapsed = daysBetween(goal.startDate || goal.createdDate || today, today);
      const expected = span > 0 ? (target * Math.max(0, elapsed)) / span : 0;
      onTrack = total >= expected;
    } else {
      onTrack = total >= target;
      perDayNeeded = remaining > 0 ? remaining : 0;
    }
  }

  const perPerson = {};
  for (const entry of goal.entries || []) {
    perPerson[entry.userId] = (perPerson[entry.userId] || 0) + (Number(entry.amount) || 0);
  }

  return {
    kind: 'project',
    total,
    target,
    pct,
    remaining,
    daysLeft,
    perDayNeeded,
    onTrack,
    perPerson,
    lastEntry: (goal.entries || []).slice(-1)[0] || null,
  };
}

/** Kiest automatisch de juiste samenvatting voor een doel. */
export function goalStats(goal, today) {
  return goal.kind === 'project' ? projectStats(goal, today) : habitStats(goal, today);
}

/**
 * Doelen die vandaag nog aandacht vragen: dagelijkse gewoontes die nog niet
 * zijn afgevinkt, en weekdoelen die hun aantal deze week nog niet halen terwijl
 * er niet genoeg dagen over zijn om het rustig aan te doen.
 */
export function openToday(goals, today) {
  const out = [];
  for (const goal of goals) {
    if (goal.archived || goal.kind !== 'habit') continue;
    if (isDayDone(goal, today)) continue;
    if (goal.cadence?.type === 'weekly') {
      const target = weeklyTarget(goal);
      const done = weekCount(goal, today);
      if (done >= target) continue;
      const daysLeftInWeek = 7 - daysBetween(weekStart(today), today);
      out.push({ goal, urgent: target - done >= daysLeftInWeek });
    } else {
      out.push({ goal, urgent: true });
    }
  }
  return out;
}
