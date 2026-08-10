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
    // Geheim voor het ondertekenen van sessiecookies. Laat je dit leeg, dan
    // maakt de app er zelf een aan en bewaart die in de opslag.
    sessionSecret: process.env.SESSION_SECRET || '',
    // Sessieduur in dagen: hoe lang je ingelogd blijft op je telefoon.
    sessionDays: Number(process.env.SESSION_DAYS || 90),
    // Achter een https-proxy (Render/Fly/Vercel) staat dit aan.
    secureCookies: bool(process.env.SECURE_COOKIES, process.env.NODE_ENV === 'production'),
    timezone: process.env.TIMEZONE || 'Europe/Amsterdam',
  },
  db: {
    // Staat er een Postgres-verbinding ingesteld, dan gaat alles daarheen;
    // anders naar een bestand op schijf.
    url: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
    file: process.env.DB_FILE || 'data/samen.json',
  },
  push: {
    // Ook deze sleutels maakt de app zelf aan als ze niet zijn ingevuld.
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    contact: process.env.VAPID_CONTACT || 'mailto:noreply@example.com',
    // Tijd van de dagelijkse herinnering voor niet-afgevinkte doelen (HH:MM).
    dailyDigestAt: process.env.DAILY_DIGEST_AT || '20:00',
    enabled: bool(process.env.PUSH_ENABLED, true),
  },
};
