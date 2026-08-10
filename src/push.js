import webpush from 'web-push';
import { config, pushConfigured } from './config.js';
import { db, saveSoon } from './db.js';

/**
 * Push-meldingen via de Web Push-standaard. Werkt zonder app-store: je zet de
 * app op je beginscherm en geeft één keer toestemming. Zonder VAPID-sleutels
 * in .env doet dit onderdeel simpelweg niets.
 */

let ready = false;

export function initPush() {
  if (!pushConfigured()) {
    console.log('[push] Geen VAPID-sleutels gevonden — herinneringen staan uit.');
    return false;
  }
  webpush.setVapidDetails(config.push.contact, config.push.publicKey, config.push.privateKey);
  ready = true;
  return true;
}

export const pushReady = () => ready;

export function publicKey() {
  return pushConfigured() ? config.push.publicKey : null;
}

export function addSubscription(userId, subscription) {
  const store = db();
  const existing = store.pushSubs.find(
    (s) => s.endpoint === subscription.endpoint && s.userId === userId,
  );
  if (existing) {
    existing.keys = subscription.keys;
    saveSoon();
    return existing;
  }
  const row = {
    id: `${userId}:${Buffer.from(subscription.endpoint).toString('base64url').slice(-24)}`,
    userId,
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    createdAt: new Date().toISOString(),
  };
  store.pushSubs.push(row);
  saveSoon();
  return row;
}

export function removeSubscription(endpoint) {
  const store = db();
  const before = store.pushSubs.length;
  store.pushSubs = store.pushSubs.filter((s) => s.endpoint !== endpoint);
  if (store.pushSubs.length !== before) saveSoon();
}

/**
 * Stuurt een melding naar alle apparaten van een persoon. Abonnementen die de
 * browser afwijst (uitgelogd, app verwijderd) worden meteen opgeruimd.
 */
export async function notify(userId, payload) {
  if (!ready) return 0;
  const store = db();
  const subs = store.pushSubs.filter((s) => s.userId === userId);
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        removeSubscription(sub.endpoint);
      } else {
        console.warn(`[push] versturen mislukt (${err.statusCode || '?'}): ${err.message}`);
      }
    }
  }
  return sent;
}

export async function notifyAll(userIds, payload) {
  let sent = 0;
  for (const id of userIds) sent += await notify(id, payload);
  return sent;
}
