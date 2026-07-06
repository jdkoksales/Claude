/**
 * Central, validated access to environment variables. Server-only — never
 * import this from a client component.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  get supabaseUrl() {
    return required("SUPABASE_URL");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get openaiApiKey() {
    return required("OPENAI_API_KEY");
  },
  get resendApiKey() {
    return required("RESEND_API_KEY");
  },
  /** Svix signing secret for the Resend inbound/events webhook. */
  get resendWebhookSecret() {
    return required("RESEND_WEBHOOK_SECRET");
  },
  /** Secret that authenticates Vercel Cron invocations. */
  get cronSecret() {
    return required("CRON_SECRET");
  },
  /** Password for the single-user login. */
  get appPassword() {
    return required("APP_PASSWORD");
  },
  /** Secret used to sign the session cookie and unsubscribe tokens. */
  get appSecret() {
    return required("APP_SECRET");
  },
  /** Public base URL of the deployed app (for unsubscribe links). */
  get appUrl() {
    return required("APP_URL");
  },
  get modelLight() {
    return optional("OPENAI_MODEL_LIGHT", "gpt-4o-mini");
  },
  get modelWriter() {
    return optional("OPENAI_MODEL_WRITER", "gpt-4.1");
  },
};
