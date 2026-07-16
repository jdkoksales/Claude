import { db } from "./supabase";
import { logActivity } from "./activity";

/** A phone attempt's result, logged from the Bellijst. */
export type CallOutcome =
  | "answered"
  | "no_answer"
  | "voicemail"
  | "callback"
  | "interested"
  | "not_interested"
  | "converted"
  | "wrong_number";

/** The lead's working status in the calling workflow. */
export type CallStatus = "todo" | "callback" | "reached" | "done" | "skip";

export const CALL_OUTCOMES: CallOutcome[] = [
  "answered",
  "no_answer",
  "voicemail",
  "callback",
  "interested",
  "not_interested",
  "converted",
  "wrong_number",
];

export const CALL_STATUSES: CallStatus[] = ["todo", "callback", "reached", "done", "skip"];

/**
 * How an outcome moves the lead's working status. Deliberately conservative:
 * a no-answer/voicemail keeps the lead on the list ("todo"), everything the
 * operator can act on maps to the matching bucket. Manual override always wins
 * afterwards via setCallStatus.
 */
const OUTCOME_TO_STATUS: Record<CallOutcome, CallStatus> = {
  answered: "reached",
  interested: "reached",
  converted: "done",
  callback: "callback",
  no_answer: "todo",
  voicemail: "todo",
  not_interested: "done",
  wrong_number: "skip",
};

export interface CallLogEntry {
  id: number;
  outcome: CallOutcome;
  note: string;
  called_at: string;
}

export interface CallLead {
  leadId: string;
  company: string;
  websiteUrl: string;
  domain: string;
  email: string;
  campaign: string | null;
  leadStatus: string;
  callStatus: CallStatus;
  openCount: number;
  lastOpenAt: string | null;
  clickCount: number;
  lastClickAt: string | null;
  callCount: number;
  lastCallAt: string | null;
  lastOutcome: CallOutcome | null;
  logs: CallLogEntry[];
}

/**
 * The calling list: every lead that opened or clicked a tracked email, with
 * engagement + call history, hottest first (clicked, then most/most-recent
 * opens). This is the hand-off from email to phone.
 */
export async function listCallLeads(): Promise<CallLead[]> {
  const { data: seqs } = await db()
    .from("bn_email_sequences")
    .select(
      `lead_id, open_count, last_open_at, click_count, last_click_at,
       bn_leads(id, status, call_status, campaign_id,
         bn_companies(name, website_url, domain, email),
         bn_campaigns(name))`
    )
    .eq("tracked", true)
    .or("open_count.gt.0,click_count.gt.0");

  // Aggregate per lead (a lead can have multiple sends over time).
  const byLead = new Map<string, CallLead>();
  for (const row of (seqs ?? []) as Record<string, unknown>[]) {
    const lead = row.bn_leads as unknown as {
      id: string;
      status: string;
      call_status: CallStatus;
      bn_companies: {
        name: string;
        website_url: string;
        domain: string;
        email: string;
      } | null;
      bn_campaigns: { name: string } | null;
    } | null;
    if (!lead?.bn_companies) continue;

    const existing = byLead.get(lead.id);
    const opens = Number(row.open_count ?? 0);
    const clicks = Number(row.click_count ?? 0);
    const lastOpen = (row.last_open_at as string) ?? null;
    const lastClick = (row.last_click_at as string) ?? null;

    if (!existing) {
      byLead.set(lead.id, {
        leadId: lead.id,
        company: lead.bn_companies.name,
        websiteUrl: lead.bn_companies.website_url,
        domain: lead.bn_companies.domain,
        email: lead.bn_companies.email,
        campaign: lead.bn_campaigns?.name ?? null,
        leadStatus: lead.status,
        callStatus: lead.call_status ?? "todo",
        openCount: opens,
        lastOpenAt: lastOpen,
        clickCount: clicks,
        lastClickAt: lastClick,
        callCount: 0,
        lastCallAt: null,
        lastOutcome: null,
        logs: [],
      });
    } else {
      existing.openCount += opens;
      existing.clickCount += clicks;
      if (lastOpen && (!existing.lastOpenAt || lastOpen > existing.lastOpenAt)) {
        existing.lastOpenAt = lastOpen;
      }
      if (lastClick && (!existing.lastClickAt || lastClick > existing.lastClickAt)) {
        existing.lastClickAt = lastClick;
      }
    }
  }

  if (byLead.size === 0) return [];

  // Attach call history.
  const { data: logs } = await db()
    .from("bn_call_logs")
    .select("id, lead_id, outcome, note, called_at")
    .in("lead_id", [...byLead.keys()])
    .order("called_at", { ascending: false });
  for (const log of (logs ?? []) as Record<string, unknown>[]) {
    const lead = byLead.get(log.lead_id as string);
    if (!lead) continue;
    lead.callCount++;
    if (!lead.lastCallAt) {
      lead.lastCallAt = log.called_at as string;
      lead.lastOutcome = log.outcome as CallOutcome;
    }
    if (lead.logs.length < 8) {
      lead.logs.push({
        id: log.id as number,
        outcome: log.outcome as CallOutcome,
        note: (log.note as string) ?? "",
        called_at: log.called_at as string,
      });
    }
  }

  // Hottest first: clicks beat opens, then engagement volume, then recency.
  return [...byLead.values()].sort((a, b) => {
    if ((b.clickCount > 0 ? 1 : 0) !== (a.clickCount > 0 ? 1 : 0)) {
      return (b.clickCount > 0 ? 1 : 0) - (a.clickCount > 0 ? 1 : 0);
    }
    if (b.openCount !== a.openCount) return b.openCount - a.openCount;
    const aT = a.lastClickAt ?? a.lastOpenAt ?? "";
    const bT = b.lastClickAt ?? b.lastOpenAt ?? "";
    return bT.localeCompare(aT);
  });
}

/** Logs one phone attempt and nudges the lead's working status along. */
export async function logCall(
  leadId: string,
  outcome: CallOutcome,
  note: string
): Promise<{ ok: boolean; callStatus: CallStatus }> {
  const { error } = await db()
    .from("bn_call_logs")
    .insert({ lead_id: leadId, outcome, note: note.slice(0, 2000) });
  if (error) return { ok: false, callStatus: "todo" };

  const callStatus = OUTCOME_TO_STATUS[outcome];
  await db().from("bn_leads").update({ call_status: callStatus }).eq("id", leadId);

  const { data: company } = await db()
    .from("bn_leads")
    .select("bn_companies(id, name)")
    .eq("id", leadId)
    .maybeSingle();
  const c = company?.bn_companies as unknown as { id: string; name: string } | null;
  if (c) {
    await logActivity("system", `Gebeld met ${c.name}: ${outcome.replace(/_/g, " ")}.`, {
      companyId: c.id,
    });
  }
  return { ok: true, callStatus };
}

/** Manual working-status override from the list. */
export async function setCallStatus(leadId: string, status: CallStatus): Promise<boolean> {
  const { error } = await db()
    .from("bn_leads")
    .update({ call_status: status })
    .eq("id", leadId);
  return !error;
}
