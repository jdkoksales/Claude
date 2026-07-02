import webpush from 'web-push';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';
import { subs } from './db.js';

/**
 * Web-push notifications for check-ins. VAPID keys are generated once and
 * stored next to the data file, so subscriptions survive restarts.
 */

const KEY_FILE = dirname(config.db.file) + '/vapid.json';

function loadKeys() {
  mkdirSync(dirname(KEY_FILE), { recursive: true });
  if (existsSync(KEY_FILE)) {
    try {
      const keys = JSON.parse(readFileSync(KEY_FILE, 'utf8'));
      if (keys.publicKey && keys.privateKey) return keys;
    } catch {
      /* regenerate below */
    }
  }
  const keys = webpush.generateVAPIDKeys();
  writeFileSync(KEY_FILE, JSON.stringify(keys, null, 2));
  return keys;
}

const keys = loadKeys();
webpush.setVapidDetails('mailto:coach@localhost', keys.publicKey, keys.privateKey);

export function publicKey() {
  return keys.publicKey;
}

/**
 * Send a notification to every subscribed device. Dead subscriptions
 * (uninstalled app, cleared browser) are pruned automatically.
 */
export async function sendToAll({ title, body }) {
  const payload = JSON.stringify({ title, body });
  let sent = 0;
  for (const sub of subs.all()) {
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        subs.remove(sub.endpoint);
      } else {
        console.error('[push] versturen mislukt:', err.message);
      }
    }
  }
  return sent;
}
