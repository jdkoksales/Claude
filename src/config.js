import 'dotenv/config';

/**
 * Throw a clear error if any of the given env vars are missing. Called at
 * startup by whatever actually needs them.
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
  app: {
    port: Number(process.env.PORT || 3000),
    // 4-6 digit PIN that unlocks the app.
    pin: process.env.APP_PIN || '',
    // Optional: your first name, used in greetings.
    userName: process.env.USER_NAME || '',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
  },
  db: {
    file: process.env.DB_FILE || 'data/coach.json',
  },
};
