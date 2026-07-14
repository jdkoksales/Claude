import { NextRequest, NextResponse } from "next/server";
import { leadsForMetric, type DrillMetric } from "@/lib/analytics";

const METRICS: DrillMetric[] = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
];

/** Drill-down list behind a clickable KPI: which leads opened / clicked / … */
export async function GET(request: NextRequest) {
  const metric = request.nextUrl.searchParams.get("metric") as DrillMetric | null;
  if (!metric || !METRICS.includes(metric)) {
    return NextResponse.json({ error: "unknown metric" }, { status: 400 });
  }
  const campaign = request.nextUrl.searchParams.get("campaign");
  const leads = await leadsForMetric(metric, campaign);
  return NextResponse.json({ metric, campaign: campaign ?? null, leads });
}
