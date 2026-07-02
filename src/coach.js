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
    'Het is ochtend. Schrijf een korte, energieke ochtend-check-in voor de feed ' +
    'in de app: noem de belangrijkste open taken en doelen, stel 1 scherpe ' +
    'focusvraag voor vandaag, en stel max 3 prioriteiten voor. Houd het kort.',
  evening:
    'Het is avond. Schrijf een korte avond-review voor de feed in de app: vraag ' +
    'hoe de dag ging t.o.v. de doelen, benoem wat er is afgevinkt, en stel 1 ' +
    'reflectievraag. Kort en warm.',
  weekly:
    'Het is het wekelijkse coachmoment. Schrijf een weekreview voor de feed: ' +
    'blik terug op de week t.o.v. de doelen (gebruik list_goals), benoem ' +
    'voortgang en wat bleef liggen, en help 2-3 concrete prioriteiten voor de ' +
    'komende week kiezen.',
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
