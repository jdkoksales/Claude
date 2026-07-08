import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { logActivity } from "@/lib/activity";
import { WARM_STATUSES, type LeadStatus } from "@/lib/types";

/**
 * Full conversation for one lead: the company, every email the AI sent
 * (subject + body + when), and every reply. This is where the operator reads
 * back exactly what went out — the emails aren't in their own mailbox because
 * the AI sends via Resend, so the app is the record.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: lead } = await db()
    .from("bn_leads")
    .select("id, status, followups_sent, warm_since, bn_companies(name, domain, email, website_url, industry)")
    .eq("id", id)
    .maybeSingle();
  if (!lead) {
    return NextResponse.json({ error: "lead not found" }, { status: 404 });
  }
  const [{ data: emails }, { data: replies }] = await Promise.all([
    db()
      .from("bn_email_sequences")
      .select("step, subject, body, sent_at, status")
      .eq("lead_id", id)
      .order("step", { ascending: true }),
    db()
      .from("bn_replies")
      .select("from_email, subject, raw_body, received_at, classification, classification_confidence, auto_replied, auto_reply_body, needs_human")
      .eq("lead_id", id)
      .order("received_at", { ascending: true }),
  ]);
  return NextResponse.json({
    lead: { ...lead, company: lead.bn_companies },
    emails: emails ?? [],
    replies: replies ?? [],
  });
}

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
