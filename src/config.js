import 'dotenv/config';

/**
 * Throw a clear error if any of the given env vars are missing. Called at
 * startup by whatever actually needs them (the Slack app needs Slack tokens;
 * the terminal CLI only needs the Anthropic key), instead of at import time —
 * so `npm run chat` works without Slack tokens.
 */
export function assertEnv(names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    throw new Error(
      `Ontbrekende variabele(n) in .env: ${missing.join(', ')}.\n` +
        'Kopieer .env.example naar .env en vul ze in (zie README).',
    );
  }
}

export const config = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    appToken: process.env.SLACK_APP_TOKEN || '',
    // The channel/DM where the coach posts proactive check-ins.
    // Use your DM channel id (starts with D) or any channel id the bot is in.
    coachChannel: process.env.SLACK_COACH_CHANNEL || '',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    // Default model for everyday chat/tasks (cheap + fast).
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    // A more capable model used for the deeper coaching moments.
    coachModel: process.env.CLAUDE_COACH_MODEL || 'claude-opus-4-8',
    maxTokens: Number(process.env.CLAUDE_MAX_TOKENS || 1500),
    // Allow Claude to search the web (Anthropic server-side tool).
    webSearch: (process.env.CLAUDE_WEB_SEARCH || 'true') === 'true',
  },
  db: {
    file: process.env.DB_FILE || 'data/assistant.db',
  },
  coach: {
    // IANA timezone for scheduling, e.g. Europe/Amsterdam.
    timezone: process.env.COACH_TIMEZONE || 'Europe/Amsterdam',
    // Cron expressions; defaults: 08:00 morning, 20:00 evening, Sun 19:00 weekly.
    morningCron: process.env.COACH_MORNING_CRON || '0 8 * * *',
    eveningCron: process.env.COACH_EVENING_CRON || '0 20 * * *',
    weeklyCron: process.env.COACH_WEEKLY_CRON || '0 19 * * 0',
    enabled: (process.env.COACH_ENABLED || 'true') === 'true',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
    get enabled() {
      return Boolean(this.clientId && this.clientSecret && this.refreshToken);
    },
  },
};

export const ASSISTANT_PERSONA = process.env.CLAUDE_PERSONA ||
  [
    'Je bent de persoonlijke assistent én coach van de gebruiker in Slack.',
    'Als assistent: je voert taken uit, plant, schrijft teksten en zoekt dingen op.',
    'Als coach: je helpt de gebruiker met zijn doelen en voortgang, stelt scherpe',
    'vragen, houdt hem verantwoordelijk en viert vooruitgang — warm maar eerlijk.',
    'Gebruik je tools om taken, doelen en voortgang écht op te slaan en bij te werken;',
    'verzin geen data. Wees kort en concreet. Antwoord in de taal van de gebruiker.',
  ].join(' ');
