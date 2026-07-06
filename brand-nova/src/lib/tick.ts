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
    const budget = sendBudgetForTick(settings, sentToday, TICK_MINUTES);
    sent = await processSendQueue(budget, settings);
  } else if (withinWindow && (!settings.from_email || !settings.website_check_url)) {
    await logActivity(
      "waiting",
      "Klaar om te versturen, maar het afzendadres of de Website Check-link is nog niet ingesteld — ik wacht op de configuratie."
    );
  }

  return { paused: false, analyzed, sent, sentToday: sentToday + sent, withinWindow };
}
