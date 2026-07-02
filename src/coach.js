import cron from 'node-cron';
import { config } from './config.js';
import { runAgent } from './claude.js';
import { journal } from './db.js';
import { sendToAll } from './push.js';

/**
 * Proactive coaching: scheduled morning/evening check-ins and a weekly review.
 * Each one asks Claude (coach model + the user's stored context) to write a
 * message, saves it to the feed, and pushes a notification to all devices.
 */

const PROMPTS = {
  morning:
    'Het is ochtend. Schrijf de ochtend-briefing voor de feed, op het niveau ' +
    'van een presidentiële daily brief maar in warme, menselijke taal. Opbouw: ' +
    '(1) Situatie in één zin — waar staat hij vandaag, met een concreet cijfer ' +
    'of streak uit de context. (2) **Top 3 van vandaag** — kies zélf de drie ' +
    'belangrijkste acties uit de open taken en doelen, in volgorde, met bij #1 ' +
    'waarom die eerst moet. (3) Eén risico dat je vooruit ziet (deadline, ' +
    'streak die kan breken, taak die al dagen blijft liggen) met een als-dan-' +
    'voorstel. (4) Sluit af met één scherpe focusvraag. Maximaal ~120 woorden.',
  evening:
    'Het is avond. Schrijf de avond-debrief voor de feed, kort en warm. ' +
    'Opbouw: (1) Benoem specifiek wat er vandaag is gelukt — afgevinkte taken ' +
    'en voortgang, met cijfers/streaks uit de context; geen vaag applaus. ' +
    '(2) Benoem eerlijk wat bleef liggen, zonder oordeel, en of je er een ' +
    'patroon in ziet. (3) Stel de #1 voor morgen voor. (4) Sluit af met één ' +
    'reflectievraag die verder gaat dan "hoe was je dag". Maximaal ~100 woorden.',
  weekly:
    'Het is het wekelijkse strategiemoment. Schrijf een weekreview voor de ' +
    'feed zoals een topcoach die zou brengen. Gebruik list_goals en de context. ' +
    'Opbouw: (1) **De week in cijfers** — voortgang per doel, streaks, wat er ' +
    'is afgerond. (2) De belangrijkste trend of het patroon dat je ziet ' +
    '(positief of zorgelijk), recht voor zijn raap. (3) **De 2-3 prioriteiten ' +
    'voor komende week** — kies ze zelf en onderbouw kort. (4) Eén kleine, ' +
    'concrete gewoonte-aanpassing voor komende week (als-dan-vorm). ' +
    '(5) Sluit af met één strategische vraag. Maximaal ~180 woorden.',
};

const TITLES = {
  morning: '🌅 Ochtend-check-in',
  evening: '🌙 Avond-review',
  weekly: '📊 Weekreview',
};

export async function runCheckIn(kind) {
  const text = await runAgent([{ role: 'user', content: PROMPTS[kind] }], {
    model: config.anthropic.coachModel,
  });
  journal.add(kind, text);
  const sent = await sendToAll({
    title: TITLES[kind] || 'Je coach',
    body: text.length > 160 ? text.slice(0, 157) + '…' : text,
  });
  console.log(`[coach] ${kind}-check-in in feed gezet (${sent} melding(en) verstuurd).`);
  return text;
}

export function startCoach() {
  if (!config.coach.enabled) {
    console.log('[coach] uitgeschakeld (COACH_ENABLED=false).');
    return;
  }
  const opts = { timezone: config.coach.timezone };
  const safe = (kind) => () =>
    runCheckIn(kind).catch((err) =>
      console.error(`[coach] ${kind}-check-in mislukt:`, err.message),
    );
  cron.schedule(config.coach.morningCron, safe('morning'), opts);
  cron.schedule(config.coach.eveningCron, safe('evening'), opts);
  cron.schedule(config.coach.weeklyCron, safe('weekly'), opts);
  console.log(
    `[coach] ingepland (${config.coach.timezone}): ` +
      `ochtend "${config.coach.morningCron}", avond "${config.coach.eveningCron}", ` +
      `wekelijks "${config.coach.weeklyCron}".`,
  );
}
