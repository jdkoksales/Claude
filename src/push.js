import webpush from 'web-push';
import { config } from './config.js';
import { db, touch } from './db.js';

/**
 * Push-meldingen via de Web Push-standaard. Werkt zonder app-store: je zet de
 * app op je beginscherm en geeft één keer toestemming.
 *
 * De VAPID-sleutels hoeven niet met de hand ingesteld te worden. Staan ze niet
 * in de omgeving, dan maakt de app ze bij het eerste gebruik zelf aan en
 * bewaart ze bij de rest van de gegevens. Zo is er bij het uitrollen maar één
 * ding echt nodig: waar de gegevens heen moeten.
 */

let configuredFor = null;

/** Zorgt dat er sleutels zijn en dat web-push ermee is ingesteld. */
export function ensurePush() {
  if (!config.push.enabled) return null;

  const store = db();
  const settings = store.settings ||= {};

  if (config.push.publicKey && config.push.privateKey) {
    settings.vapid = { publicKey: config.push.publicKey, privateKey: config.push.privateKey };
  } else if (!settings.vapid?.publicKey || !settings.vapid?.privateKey) {
    settings.vapid = webpush.generateVAPIDKeys();
    touch();
  }

  const { publicKey, privateKey } = settings.vapid;
  if (configuredFor !== publicKey) {
    webpush.setVapidDetails(config.push.contact, publicKey, privateKey);
    configuredFor = publicKey;
  }
  return settings.vapid;
}

export function pushReady() {
  return Boolean(ensurePush());
}

export function publicKey() {
  return ensurePush()?.publicKey || null;
}

export function addSubscription(userId, subscription) {
  const store = db();
  const existing = store.pushSubs.find(
    (s) => s.endpoint === subscription.endpoint && s.userId === userId,
  );
  if (existing) {
    existing.keys = subscription.keys;
    touch();
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
  touch();
  return row;
}

export function removeSubscription(endpoint) {
  const store = db();
  const before = store.pushSubs.length;
  store.pushSubs = store.pushSubs.filter((s) => s.endpoint !== endpoint);
  if (store.pushSubs.length !== before) touch();
}

/**
 * Stuurt een melding naar alle apparaten van een persoon. Abonnementen die de
 * browser afwijst (uitgelogd, app verwijderd) worden meteen opgeruimd.
 */
export async function notify(userId, payload) {
  if (!ensurePush()) return 0;
  const subs = db().pushSubs.filter((s) => s.userId === userId);
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
