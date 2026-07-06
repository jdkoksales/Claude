import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Single-user session auth: an HMAC-signed, expiring token in an httpOnly
 * cookie. No user table needed — there is exactly one operator.
 */

export const SESSION_COOKIE = "bn_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(now = Date.now()): string {
  const expires = String(now + SESSION_TTL_MS);
  return `${expires}.${sign(`session:${expires}`, env.appSecret)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const expires = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  const expected = sign(`session:${expires}`, env.appSecret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(password: string): boolean {
  const a = Buffer.from(password);
  const b = Buffer.from(env.appPassword);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Token embedded in unsubscribe links: HMAC over the recipient email. */
export function unsubscribeToken(email: string): string {
  return sign(`unsub:${email.toLowerCase()}`, env.appSecret);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = unsubscribeToken(email);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubscribeUrl(email: string): string {
  const params = new URLSearchParams({
    e: email.toLowerCase(),
    t: unsubscribeToken(email),
  });
  return `${env.appUrl}/api/unsubscribe?${params}`;
}
