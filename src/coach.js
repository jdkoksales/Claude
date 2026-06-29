import cron from 'node-cron';
import { config } from './config.js';
import { runAgent } from './claude.js';
import { journal } from './db.js';

/**
 * Proactive coaching: scheduled morning/evening check-ins and a weekly review.
 * Each one asks Claude (using the coach model + the user's stored context) to
 * generate a message, then posts it to the configured Slack channel/DM.
 */

const PROMPTS = {
  morning:
    'Het is ochtend. Geef een korte, energieke ochtend-check-in: noem de ' +
    'belangrijkste open taken en doelen, stel 1 scherpe focusvraag voor vandaag, ' +
    'en stel max 3 prioriteiten voor. Houd het kort.',
  evening:
    'Het is avond. Geef een korte avond-review: vraag hoe de dag ging t.o.v. de ' +
    'doelen, benoem wat er is afgevinkt, en stel 1 reflectievraag. Houd het kort en warm.',
  weekly:
    'Het is het wekelijkse coachmoment. Blik terug op de week t.o.v. de doelen ' +
    '(gebruik list_goals), benoem voortgang en wat bleef liggen, en help 2-3 ' +
    'concrete prioriteiten voor de komende week kiezen.',
};

async function runCheckIn(slackClient, kind) {
  if (!config.slack.coachChannel) {
    console.warn(`[coach] SLACK_COACH_CHANNEL niet gezet; ${kind} overgeslagen.`);
    return;
  }
  try {
    const text = await runAgent([{ role: 'user', content: PROMPTS[kind] }], {
      model: config.anthropic.coachModel,
    });
    journal.add(kind, text);
    await slackClient.chat.postMessage({
      channel: config.slack.coachChannel,
      text,
    });
    console.log(`[coach] ${kind}-check-in verstuurd.`);
  } catch (err) {
    console.error(`[coach] ${kind}-check-in mislukt:`, err.message);
  }
}

export function startCoach(slackClient) {
  if (!config.coach.enabled) {
    console.log('[coach] uitgeschakeld (COACH_ENABLED=false).');
    return;
  }
  const opts = { timezone: config.coach.timezone };
  cron.schedule(config.coach.morningCron, () => runCheckIn(slackClient, 'morning'), opts);
  cron.schedule(config.coach.eveningCron, () => runCheckIn(slackClient, 'evening'), opts);
  cron.schedule(config.coach.weeklyCron, () => runCheckIn(slackClient, 'weekly'), opts);
  console.log(
    `[coach] ingepland (${config.coach.timezone}): ` +
      `ochtend "${config.coach.morningCron}", avond "${config.coach.eveningCron}", ` +
      `wekelijks "${config.coach.weeklyCron}".`,
  );
}
