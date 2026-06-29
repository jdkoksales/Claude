import { google } from 'googleapis';
import { config } from './config.js';

/**
 * Optional Google Calendar + Gmail integration.
 *
 * This only works once you provide GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and
 * GOOGLE_REFRESH_TOKEN in .env (see README for how to obtain them). Until then,
 * every function returns a friendly "not configured" message so the assistant
 * can tell you what to do instead of crashing.
 */

function client() {
  const oauth2 = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
  );
  oauth2.setCredentials({ refresh_token: config.google.refreshToken });
  return oauth2;
}

const NOT_CONFIGURED =
  'Google-koppeling is nog niet geconfigureerd. Vul GOOGLE_CLIENT_ID, ' +
  'GOOGLE_CLIENT_SECRET en GOOGLE_REFRESH_TOKEN in (zie README).';

export async function listEvents({ timeMin, timeMax, maxResults = 10 } = {}) {
  if (!config.google.enabled) return { ok: false, message: NOT_CONFIGURED };
  const calendar = google.calendar({ version: 'v3', auth: client() });
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin || new Date().toISOString(),
    timeMax,
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = (res.data.items || []).map((e) => ({
    summary: e.summary,
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    location: e.location,
  }));
  return { ok: true, events };
}

export async function createEvent({ summary, start, end, description }) {
  if (!config.google.enabled) return { ok: false, message: NOT_CONFIGURED };
  const calendar = google.calendar({ version: 'v3', auth: client() });
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary,
      description,
      start: { dateTime: start },
      end: { dateTime: end },
    },
  });
  return { ok: true, link: res.data.htmlLink, id: res.data.id };
}

export async function draftEmail({ to, subject, body }) {
  if (!config.google.enabled) return { ok: false, message: NOT_CONFIGURED };
  const gmail = google.gmail({ version: 'v1', auth: client() });
  const raw = Buffer.from(
    [`To: ${to}`, `Subject: ${subject}`, '', body].join('\n'),
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const res = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: { message: { raw } },
  });
  return { ok: true, draftId: res.data.id };
}
