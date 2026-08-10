import 'dotenv/config';

/**
 * Alle instellingen op één plek. De app start altijd; ontbrekende optionele
 * onderdelen (zoals push) worden gewoon uitgeschakeld in plaats van te crashen.
 */

function bool(value, fallback) {
  if (value == null || value === '') return fallback;
  return /^(1|true|ja|yes|on)$/i.test(value);
}

export const config = {
  app: {
    port: Number(process.env.PORT || 3000),
    // Geheim voor het ondertekenen van sessiecookies. Zonder eigen waarde
    // wordt er per start een willekeurige gebruikt (= uitgelogd na herstart).
    sessionSecret: process.env.SESSION_SECRET || '',
    // Sessieduur in dagen: hoe lang je ingelogd blijft op je telefoon.
    sessionDays: Number(process.env.SESSION_DAYS || 90),
    // Achter een https-proxy (Render/Fly/Vercel) staat dit aan.
    secureCookies: bool(process.env.SECURE_COOKIES, process.env.NODE_ENV === 'production'),
    timezone: process.env.TIMEZONE || 'Europe/Amsterdam',
  },
  db: {
    file: process.env.DB_FILE || 'data/samen.json',
  },
  push: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    contact: process.env.VAPID_CONTACT || 'mailto:noreply@example.com',
    // Tijd van de dagelijkse herinnering voor niet-afgevinkte doelen (HH:MM).
    dailyDigestAt: process.env.DAILY_DIGEST_AT || '20:00',
    enabled: bool(process.env.PUSH_ENABLED, true),
  },
};

export const pushConfigured = () =>
  config.push.enabled && Boolean(config.push.publicKey && config.push.privateKey);
