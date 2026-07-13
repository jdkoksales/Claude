import { db } from "./supabase";
import { logActivity } from "./activity";
import { processAnalysisBatch } from "./analyzer";
import { processSendQueue, recoverStuckLeads } from "./outreach";
import { getSettings } from "./settings";
import {
  isWithinSendingWindow,
  sendBudgetForTick,
  startOfLocalDayUtc,
} from "./sendWindow";
import type { Settings } from "./types";

/** How often Vercel Cron calls the tick, in minutes (see vercel.json). */
export const TICK_MINUTES = 5;

/** Websites analyzed per tick — bounds both runtime and OpenAI spend. */
const ANALYZE_BATCH = 6;

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

  const analyzed = await processAnalysisBatch(ANALYZE_BATCH);

  const dayStart = startOfLocalDayUtc(settings.sending_hours.tz);
  const { count } = await db()
    .from("bn_email_sequences")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", dayStart);
  const sentToday = count ?? 0;

  const withinWindow = isWithinSendingWindow(settings);
  let sent = 0;
  if (withinWindow && settings.from_email && settings.website_check_url) {
    const budget = await sendBudget(settings, sentToday);
    if (budget > 0) sent = await processSendQueue(budget, settings);
  } else if (withinWindow && (!settings.from_email || !settings.website_check_url)) {
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
  const { data: last } = await db()
    .from("bn_email_sequences")
    .select("sent_at")
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastMs = last?.sent_at ? new Date(last.sent_at as string).getTime() : 0;
  const minutesSince = lastMs ? (Date.now() - lastMs) / 60000 : Infinity;
  // A small slack absorbs tick jitter so e.g. a 5-min interval fires on a
  // tick that lands at 4m55s rather than waiting a whole extra cycle.
  return minutesSince >= settings.send_interval_minutes - 0.5 ? 1 : 0;
}
