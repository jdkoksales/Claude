import { addDays, diffDays } from './dates.js';

/**
 * Deterministische inzichten over dayLogs. Puur en unit-getest: de code
 * beslist wanneer de coach afgaat, nooit de AI zelf.
 *
 * Een dayLog is { goal_id, day: 'YYYY-MM-DD', level: 'minimum'|'target'|'skip' }.
 * "Actief" = minimum of target. Een skip ("vandaag niet") is een bewuste
 * keuze: telt niet als actief, maar breekt ook niets.
 */

export const ACTIVE_LEVELS = new Set(['minimum', 'target']);

/** Gesorteerde unieke actieve dagen uit een set logs. */
export function activeDays(logs) {
  return [...new Set(logs.filter((l) => ACTIVE_LEVELS.has(l.level)).map((l) => l.day))].sort();
}

/**
 * Comebacks: actieve dagen waarvóór ≥2 dagen volledig gemist zijn
 * (gat van ≥3 kalenderdagen t.o.v. de vorige actieve dag).
 * De allereerste actieve dag telt niet als comeback.
 */
export function comebackDays(logs) {
  const days = activeDays(logs);
  const result = [];
  for (let i = 1; i < days.length; i++) {
    if (diffDays(days[i - 1], days[i]) >= 3) result.push(days[i]);
  }
  return result;
}

export function stats(logs) {
  return { daysActive: activeDays(logs).length, comebacks: comebackDays(logs).length };
}

/** Logs binnen [from, to] (keys, inclusief). */
function inWindow(logs, from, to) {
  return logs.filter((l) => l.day >= from && l.day <= to);
}

const count = (logs, level) => logs.filter((l) => l.level === level).length;

/**
 * Triggerdetectie over de laatste 14 dagen. Retourneert de hoogst-prioritaire
 * trigger of null. Prioriteit: comeback > gap > drift > skips > weekly.
 *
 * @param {Array} logs        alle dayLogs (alle doelen samen)
 * @param {Array} goals       actieve doelen [{id, ...}]
 * @param {string} today      dag-key van vandaag
 * @param {boolean} weeklyDue is het reviewdag (en review nog niet gedaan)?
 */
export function detectTrigger(logs, goals, today, weeklyDue = false) {
  const yesterday = addDays(today, -1);
  const win14 = inWindow(logs, addDays(today, -13), today);
  const days = activeDays(logs);

  // 1. Comeback vandaag of gisteren → vieren.
  const comebacks = new Set(comebackDays(logs));
  if (comebacks.has(today)) return { type: 'comeback', day: today };
  if (comebacks.has(yesterday) && !days.includes(today)) {
    return { type: 'comeback', day: yesterday };
  }

  // 2. Gat: 3+ dagen niets gelogd (skip telt hier ook als "iets": bewust).
  const touchedDays = [...new Set(logs.map((l) => l.day))].sort();
  const lastTouched = touchedDays.at(-1);
  if (lastTouched && diffDays(lastTouched, today) >= 3) {
    return { type: 'gap', missedDays: diffDays(lastTouched, today) };
  }
  if (!lastTouched && goals.length > 0) return null; // gloednieuw: niets forceren

  // 3. Target→minimum-drift per doel (laatste 7 vs de 7 daarvoor).
  const prevFrom = addDays(today, -13);
  const prevTo = addDays(today, -7);
  const curFrom = addDays(today, -6);
  for (const g of goals) {
    const gl = win14.filter((l) => l.goal_id === g.id);
    const prev = gl.filter((l) => l.day >= prevFrom && l.day <= prevTo);
    const cur = gl.filter((l) => l.day >= curFrom && l.day <= today);
    const targetsDown = count(cur, 'target') < count(prev, 'target');
    const minimumsUp = count(cur, 'minimum') > count(prev, 'minimum');
    if (targetsDown && minimumsUp && count(prev, 'target') >= 2) {
      return { type: 'drift', goalId: g.id };
    }
    // 4. Oplopende skips per doel.
    if (count(cur, 'skip') >= 3 && count(cur, 'skip') > count(prev, 'skip')) {
      return { type: 'skips', goalId: g.id };
    }
  }

  // 5. Wekelijkse review.
  if (weeklyDue) return { type: 'weekly' };

  return null;
}

/**
 * Compacte JSON-samenvatting voor de coach-call. Alleen data, geen proza —
 * de systeemprompt bepaalt de toon.
 */
export function buildCoachPayload({ trigger, goals, logs, today, lastReview }) {
  const from = addDays(today, -13);
  return {
    vandaag: today,
    trigger,
    doelen: goals.map((g) => {
      const gl = logs.filter((l) => l.goal_id === g.id);
      return {
        id: g.id,
        actie: g.action,
        minimum: g.minimum,
        target: g.target,
        dagen_actief: activeDays(gl).length,
        comebacks: comebackDays(gl).length,
        laatste_14_dagen: inWindow(gl, from, today).map((l) => ({
          dag: l.day,
          niveau: l.level,
        })),
      };
    }),
    laatste_weekreview: lastReview
      ? { week: lastReview.week, overgeslagen: !!lastReview.skipped, antwoorden: lastReview.answers }
      : null,
  };
}
