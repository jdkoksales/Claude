import bolt from '@slack/bolt';
import { config } from './config.js';
import { askClaude } from './claude.js';

const { App } = bolt;

const app = new App({
  token: config.slack.botToken,
  appToken: config.slack.appToken,
  socketMode: true,
});

let botUserId = null;

/**
 * Strip a leading "<@BOTID>" mention from a message so Claude doesn't see it.
 */
function stripMention(text) {
  if (!text) return '';
  return text.replace(/<@[^>]+>/g, '').trim();
}

/**
 * Build a Claude-friendly message list from a Slack thread.
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
    console.error('Could not load thread history:', err.message);
    return null;
  }
}

/**
 * Shared handler: figure out what was said, ask Claude, reply in-thread.
 */
async function handleMessage({ event, client, say }) {
  const text = stripMention(event.text);
  if (!text) return;

  const threadTs = event.thread_ts || event.ts;

  try {
    // Show a typing-style placeholder by reacting; ignore failures.
    await client.reactions
      .add({ channel: event.channel, timestamp: event.ts, name: 'eyes' })
      .catch(() => {});

    const history = await buildHistory(client, event.channel, threadTs);
    const messages = history && history.length
      ? history
      : [{ role: 'user', content: text }];

    const reply = await askClaude(messages);
    await say({ text: reply || 'Sorry, ik wist even geen antwoord.', thread_ts: threadTs });
  } catch (err) {
    console.error('Error handling message:', err);
    await say({
      text: 'Oeps, er ging iets mis bij het ophalen van een antwoord.',
      thread_ts: threadTs,
    });
  }
}

// Respond when someone @-mentions the bot in a channel.
app.event('app_mention', handleMessage);

// Respond to direct messages (DMs) to the bot.
app.message(async (args) => {
  const { event } = args;
  // Only handle direct messages here; channel mentions are handled above.
  if (event.channel_type === 'im' && !event.bot_id && event.subtype === undefined) {
    await handleMessage(args);
  }
});

(async () => {
  const auth = await app.client.auth.test({ token: config.slack.botToken });
  botUserId = auth.user_id;
  await app.start();
  console.log(`⚡️ Claude-werknemer draait in Slack als @${auth.user} (${botUserId})`);
  console.log(`   Model: ${config.anthropic.model}`);
})();
