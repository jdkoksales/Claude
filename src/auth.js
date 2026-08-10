import {
  createHmac, randomBytes, scryptSync, timingSafeEqual,
} from 'node:crypto';
import { config } from './config.js';
import { db, saveSoon } from './db.js';

/**
 * Inloggen met een eigen pincode per persoon.
 *
 * Een pincode is kort, dus de beveiliging moet uit het aantal pogingen komen,
 * niet uit de lengte: pincodes staan alleen als scrypt-hash in de opslag, en
 * na een handvol misgokken gaat er per IP en per persoon een slot op.
 *
 * De sessie zit in een ondertekend cookie in plaats van in het geheugen van de
 * server; zo blijf je ingelogd als de hosting de app opnieuw opstart.
 */

const COOKIE = 'samen_session';
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

const secret = config.app.sessionSecret || randomBytes(32).toString('hex');
if (!config.app.sessionSecret) {
  console.warn(
    '[auth] Geen SESSION_SECRET ingesteld — er is een tijdelijke gemaakt. ' +
      'Bij een herstart van de server moeten jullie opnieuw inloggen.',
  );
}

const attempts = new Map(); // sleutel -> { count, until }

export function hashPin(pin) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(pin), salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPin(pin, user) {
  if (!user?.pinHash || !user?.pinSalt) return false;
  const candidate = scryptSync(String(pin), user.pinSalt, 64);
  const known = Buffer.from(user.pinHash, 'hex');
  if (candidate.length !== known.length) return false;
  return timingSafeEqual(candidate, known);
}

export function isValidPinFormat(pin) {
  return typeof pin === 'string' && /^\d{4,10}$/.test(pin);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function unsign(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(mac || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function lockKey(req, userId) {
  const ip = req.ip || req.socket?.remoteAddress || 'onbekend';
  return `${ip}|${userId}`;
}

/** Zit deze combinatie van IP en persoon nu op slot? Zo ja: hoeveel seconden. */
export function lockedFor(req, userId) {
  const rec = attempts.get(lockKey(req, userId));
  if (!rec || !rec.until || rec.until < Date.now()) return 0;
  return Math.ceil((rec.until - Date.now()) / 1000);
}

function noteFailure(req, userId) {
  const key = lockKey(req, userId);
  const rec = attempts.get(key) || { count: 0, until: 0 };
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.until = Date.now() + LOCK_MS;
    rec.count = 0;
  }
  attempts.set(key, rec);
}

function clearFailures(req, userId) {
  attempts.delete(lockKey(req, userId));
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function setCookie(res, value, maxAgeSec) {
  const bits = [
    `${COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (config.app.secureCookies) bits.push('Secure');
  res.setHeader('Set-Cookie', bits.join('; '));
}

/** Logt in en zet het sessiecookie. Geeft de gebruiker terug, of null. */
export function login(req, res, userId, pin) {
  const wait = lockedFor(req, userId);
  if (wait > 0) {
    const err = new Error(
      `Te vaak misgeraden. Probeer het over ${Math.ceil(wait / 60)} minuten opnieuw.`,
    );
    err.status = 429;
    throw err;
  }
  const user = db().users.find((u) => u.id === userId);
  if (!user || !verifyPin(pin, user)) {
    noteFailure(req, userId);
    return null;
  }
  clearFailures(req, userId);
  const days = Math.max(1, config.app.sessionDays);
  const exp = Date.now() + days * 86400000;
  setCookie(res, sign({ uid: user.id, exp }), days * 86400);
  user.lastLoginAt = new Date().toISOString();
  saveSoon();
  return user;
}

export function logout(res) {
  setCookie(res, '', 0);
}

/** Haalt de ingelogde gebruiker uit het verzoek (of null). */
export function currentUser(req) {
  const token = parseCookies(req.headers.cookie).samen_session;
  const payload = unsign(token);
  if (!payload) return null;
  return db().users.find((u) => u.id === payload.uid) || null;
}

/** Express-middleware: blokkeert als je niet ingelogd bent. */
export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Niet ingelogd.' });
  req.user = user;
  return next();
}
