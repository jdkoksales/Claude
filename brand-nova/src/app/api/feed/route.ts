import { NextRequest, NextResponse } from "next/server";
import { getActivityFeed, getBriefingStats } from "@/lib/stats";

/**
 * Live feed endpoint, polled by the dashboard. Returns new activity entries
 * after the given id plus fresh counters, so one request keeps the whole
 * control room current.
 */
export async function GET(request: NextRequest) {
  const afterParam = request.nextUrl.searchParams.get("after");
  const afterId = afterParam !== null ? Number(afterParam) : null;
  const [entries, stats] = await Promise.all([
    getActivityFeed(Number.isFinite(afterId as number) ? afterId : null),
    getBriefingStats(),
  ]);
  return NextResponse.json({ entries, stats });
}
