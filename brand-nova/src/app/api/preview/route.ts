import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { env } from "@/lib/env";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { ensureAnalysisForCompany } from "@/lib/analyzer";
import { previewFirstEmail, type EmailPreview } from "@/lib/outreach";

export const maxDuration = 300;

function keyMatches(key: string): boolean {
  const a = Buffer.from(key);
  const b = Buffer.from(env.cronSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Test mode: generates the exact emails the AI would send for a few real
 * leads from the queue — full pipeline (fetch homepage → analyze → write),
 * but nothing is sent and lead statuses only move the way normal analysis
 * would (new → queued/skipped). Works while the employee is paused.
 *
 * Auth: dashboard session cookie, or ?key=<CRON_SECRET> for operator use.
 */
export async function GET(request: NextRequest) {
  const sessionOk = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!sessionOk && !(key && keyMatches(key))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const countParam = Number(request.nextUrl.searchParams.get("count") ?? 3);
  const count = Math.min(5, Math.max(1, Number.isFinite(countParam) ? countParam : 3));

  // Prefer leads that already have an analysis; top up with fresh ones.
  const leadIds: string[] = [];
  const { data: queued } = await db()
    .from("bn_leads")
    .select("id")
    .eq("status", "queued")
    .limit(count);
  for (const row of queued ?? []) leadIds.push(row.id as string);

  if (leadIds.length < count) {
    const { data: fresh } = await db()
      .from("bn_leads")
      .select("id, company_id")
      .eq("status", "new")
      .limit((count - leadIds.length) * 3); // extra candidates: some will be skipped
    for (const row of fresh ?? []) {
      if (leadIds.length >= count) break;
      const ok = await ensureAnalysisForCompany(row.company_id as string);
      if (ok) leadIds.push(row.id as string);
    }
  }

  const previews: EmailPreview[] = [];
  for (const leadId of leadIds) {
    const preview = await previewFirstEmail(leadId);
    if (preview) previews.push(preview);
  }

  return NextResponse.json({
    testMode: true,
    note: "Er is niets verstuurd. Dit zijn de mails zoals de AI ze zou versturen.",
    previews,
  });
}
