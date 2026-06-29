import bolt from '@slack/bolt';
import { config, assertEnv } from './config.js';
import { runAgent } from './claude.js';
import { startCoach } from './coach.js';

assertEnv(['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'ANTHROPIC_API_KEY']);

const { App } = bolt;

const app = new App({
  token: config.slack.botToken,
  appToken: config.slack.appToken,
  socketMode: true,
});

let botUserId = null;

function stripMention(text) {
  if (!text) return '';
  return text.replace(/<@[^>]+>/g, '').trim();
}

/**
 * Rebuild the conversation from a Slack thread so Claude has context.
 * The bot's own messages become "assistant" turns, everyone else "user".
 */
async function buildHistory(client, channel, threadTs) {
  if (!threadTs) return null;
  try {
    const { messages } = await client.conversations.replies({
      channel,
      ts: threadTs,
      limit: 30,
    });
    return messages
      .map((m) => {
        const text = stripMention(m.text);
        if (!text) return null;
        return {
          role: m.user === botUserId || m.bot_id ? 'assistant' : 'user',
          content: text,
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error('Kon thread-historie niet laden:', err.message);
    return null;
  }
}

async function handleMessage({ event, client, say }) {
  const text = stripMention(event.text);
  if (!text) return;
  const threadTs = event.thread_ts || event.ts;

  try {
    await client.reactions
      .add({ channel: event.channel, timestamp: event.ts, name: 'eyes' })
      .catch(() => {});

    const history = await buildHistory(client, event.channel, threadTs);
    const messages =
      history && history.length ? history : [{ role: 'user', content: text }];

    const reply = await runAgent(messages);
    await say({
      text: reply || 'Sorry, ik wist even geen antwoord.',
      thread_ts: threadTs,
    });
  } catch (err) {
    console.error('Fout bij verwerken bericht:', err);
    await say({
      text: 'Oeps, er ging iets mis. Probeer het zo nog eens.',
      thread_ts: threadTs,
    });
  }
}

app.event('app_mention', handleMessage);

app.message(async (args) => {
  const { event } = args;
  if (event.channel_type === 'im' && !event.bot_id && event.subtype === undefined) {
    await handleMessage(args);
  }
});

(async () => {
  const auth = await app.client.auth.test({ token: config.slack.botToken });
  botUserId = auth.user_id;
  await app.start();
  console.log(`⚡️ Persoonlijke assistent draait in Slack als @${auth.user}`);
  console.log(`   Model: ${config.anthropic.model} | Coach: ${config.anthropic.coachModel}`);
  console.log(`   Web search: ${config.anthropic.webSearch} | Google: ${config.google.enabled}`);
  startCoach(app.client);
})();
