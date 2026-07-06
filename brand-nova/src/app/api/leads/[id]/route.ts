import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { logActivity } from "@/lib/activity";
import { WARM_STATUSES, type LeadStatus } from "@/lib/types";

const patchSchema = z.object({
  status: z.enum([
    "queued",
    "positive_reply",
    "question",
    "warm_lead",
    "meeting_request",
    "website_check_completed",
    "not_interested",
    "stopped",
  ]),
});

/**
 * Manual status override — the safety valve for things the automation can't
 * see (e.g. the user hears by phone that a company completed the Website
 * Check). Setting a warm status stamps warm_since; any change stops
 * scheduled follow-ups.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const status = parsed.data.status as LeadStatus;
  const isWarm = WARM_STATUSES.includes(status);

  const { data: existing } = await db()
    .from("bn_leads")
    .select("id, warm_since, bn_companies(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "lead not found" }, { status: 404 });
  }

  const { error } = await db()
    .from("bn_leads")
    .update({
      status,
      next_action_at: status === "queued" ? null : null,
      ...(isWarm && !existing.warm_since
        ? { warm_since: new Date().toISOString() }
        : {}),
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const company = existing.bn_companies as unknown as { id: string; name: string };
  if (isWarm) {
    await logActivity(
      "warm_lead",
      `🔥 ${company.name} handmatig gemarkeerd als warme lead (${status.replace(/_/g, " ")}).`,
      { companyId: company.id }
    );
  }
  return NextResponse.json({ ok: true });
}
