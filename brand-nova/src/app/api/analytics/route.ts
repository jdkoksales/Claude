import { NextRequest, NextResponse } from "next/server";
import {
  getAnalytics,
  getDailyTrend,
  getPoolCount,
  listCampaignStats,
} from "@/lib/analytics";

/**
 * Dashboard analytics payload: overall KPIs, the daily trend, the lead-pool
 * size and every campaign's rolled-up stats. Scope to one campaign with
 * ?campaign=<id> to get that campaign's overall + trend only.
 */
export async function GET(request: NextRequest) {
  const campaign = request.nextUrl.searchParams.get("campaign");
  const days = Number(request.nextUrl.searchParams.get("days") ?? 14) || 14;

  if (campaign) {
    const [overall, trend] = await Promise.all([
      getAnalytics(campaign),
      getDailyTrend(days, campaign),
    ]);
    return NextResponse.json({ overall, trend });
  }

  const [overall, trend, pool, campaigns] = await Promise.all([
    getAnalytics(null),
    getDailyTrend(days, null),
    getPoolCount(),
    listCampaignStats(),
  ]);
  return NextResponse.json({ overall, trend, pool, campaigns });
}
