import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { aggregateInsights } from "@/lib/learning";
import { logActivity } from "@/lib/activity";
import { getSettings } from "@/lib/settings";

export const maxDuration = 300;

/**
 * Daily job (early morning): run the learning aggregation so today's emails
 * are steered by everything that worked before, and set the day's goal in
 * the feed.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await logActivity("learning", "Leren van de campagne van gisteren…");
    const signals = await aggregateInsights();
    const settings = await getSettings();
    await logActivity(
      "system",
      `Doel van vandaag: ${settings.daily_warm_lead_goal} nieuwe warme leads. Aan de slag.`
    );
    return NextResponse.json({ ok: true, signals });
  } catch (err) {
    console.error("daily job failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "daily job failed" },
      { status: 500 }
    );
  }
}
