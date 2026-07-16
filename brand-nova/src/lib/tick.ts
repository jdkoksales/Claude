import { db } from "./supabase";
import { logActivity } from "./activity";
import { ensureQueuedLeads } from "./analyzer";
import { processSendQueue, recoverStuckLeads } from "./outreach";
import { getSettings } from "./settings";
import {
  isWithinSendingWindow,
  sendBudgetForTick,
  startOfLocalDayUtc,
} from "./sendWindow";
import type { Settings } from "./types";

/** How often the heartbeat fires, in minutes (Supabase pg_cron, every minute). */
export const TICK_MINUTES = 1;

/**
 * Safety cap on how many websites a single tick may analyze while looking for
 * one usable lead. Analysis is just-in-time (only to top up the small ready
 * buffer), so this rarely binds; it just stops a tick from running dozens of
 * analyses in a row when many sites in a row yield no observation — the search
 * simply continues on the next tick.
 */
const MAX_ANALYZE_PER_TICK = 8;

export interface TickSummary {
  paused: boolean;
  analyzed: number;
  sent: number;
  sentToday: number;
  withinWindow: boolean;
}

/**
 * One heartbeat of the AI employee. Called every TICK_MINUTES by cron:
 * analyze a batch of new websites, then send within this tick's budget so
 * the daily cap spreads across the whole sending window.
 */
export async function runTick(): Promise<TickSummary> {
  const settings = await getSettings();
  if (settings.paused) {
    return { paused: true, analyzed: 0, sent: 0, sentToday: 0, withinWindow: false };
  }

  await recoverStuckLeads();

  const dayStart = startOfLocalDayUtc(settings.sending_hours.tz);
  // Count everything that actually went out today, regardless of what happened
  // to it afterwards: a mail that bounces flips to status 'bounced' but was
  // still sent — filtering on status='sent' made the cap undercount by the
  // day's bounces (observed: 106 sends on a cap of 100).
  const { count } = await db()
    .from("bn_email_sequences")
    .select("id", { count: "exact", head: true })
    .not("sent_at", "is", null)
    .gte("sent_at", dayStart);
  const sentToday = count ?? 0;

  const withinWindow = isWithinSendingWindow(settings);
  const configured = !!settings.from_email && !!settings.website_check_url;

  let analyzed = 0;
  let sent = 0;
  if (withinWindow && configured) {
    const budget = await sendBudget(settings, sentToday);
    // Just-in-time: keep only a tiny buffer of ready leads ahead of the next
    // send (one per email this tick may send, at least one), so the queue
    // never balloons. Analysis stops the moment enough leads are ready.
    analyzed = await ensureQueuedLeads(Math.max(1, budget), MAX_ANALYZE_PER_TICK);
    if (budget > 0) sent = await processSendQueue(budget, settings);
  } else if (withinWindow && !configured) {
    await logActivity(
      "waiting",
      "Klaar om te versturen, maar het afzendadres of de Website Check-link is nog niet ingesteld — ik wacht op de configuratie."
    );
  }

  return { paused: false, analyzed, sent, sentToday: sentToday + sent, withinWindow };
}

/**
 * How many emails this tick may send. In interval mode the AI sends at most
 * one email per `send_interval_minutes` (paced by the time since the last
 * email actually went out); otherwise it auto-spreads the daily cap evenly
 * across the sending window. The daily cap always wins.
 */
async function sendBudget(settings: Settings, sentToday: number): Promise<number> {
  if (settings.send_interval_minutes <= 0) {
    return sendBudgetForTick(settings, sentToday, TICK_MINUTES);
  }
  if (settings.daily_send_cap - sentToday <= 0) return 0;
  // Pace from the last mail that actually left, bounced-or-not.
  const { data: last } = await db()
    .from("bn_email_sequences")
    .select("sent_at")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastMs = last?.sent_at ? new Date(last.sent_at as string).getTime() : 0;
  const minutesSince = lastMs ? (Date.now() - lastMs) / 60000 : Infinity;
  // A small slack absorbs tick jitter so e.g. a 5-min interval fires on a
  // tick that lands at 4m55s rather than waiting a whole extra cycle.
  return minutesSince >= settings.send_interval_minutes - 0.5 ? 1 : 0;
}
