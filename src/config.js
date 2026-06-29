import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export const config = {
  slack: {
    botToken: required('SLACK_BOT_TOKEN'),
    appToken: required('SLACK_APP_TOKEN'),
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
  },
  anthropic: {
    apiKey: required('ANTHROPIC_API_KEY'),
    // claude-sonnet-4-6 is a good speed/cost balance for chat.
    // Switch to claude-opus-4-8 for the most capable answers.
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    maxTokens: Number(process.env.CLAUDE_MAX_TOKENS || 1024),
  },
  // The persona that defines how the "employee" behaves.
  persona:
    process.env.CLAUDE_PERSONA ||
    [
      'Je bent een behulpzame, vriendelijke virtuele teamgenoot in Slack.',
      'Je praat zoals een collega: kort, duidelijk en to the point.',
      'Geef eerlijke antwoorden en zeg het als je iets niet zeker weet.',
      'Antwoord in dezelfde taal als waarin de vraag gesteld wordt.',
    ].join(' '),
};
