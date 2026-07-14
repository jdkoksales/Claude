import { randomUUID } from "node:crypto";
import { db } from "./supabase";
import { logActivity } from "./activity";
import { recordEmailEvent } from "./events";
import { activeCampaignIds } from "./analyzer";
import { writeIntro } from "./ai";
import { getSettings } from "./settings";
import { sendEmail } from "./resend";
import { assembleFirstEmail, assembleFollowUp } from "./emailTemplate";
import {
  MAX_FOLLOWUP_OVERLAP,
  textOverlap,
  validateEmailStyle,
} from "./textGuards";
import type { Insight, LeadStatus, Settings } from "./types";

interface OutreachLead {
  id: string;
  status: LeadStatus;
  followups_sent: number;
  campaign_id: string | null;
  tracking_enabled: boolean;
  company: {
    id: string;
    name: string;
    email: string;
    industry: string | null;
  };
  analysis: {
    what_they_do: string | null;
    tone: string | null;
    improvement_observation: string | null;
    positive: string | null;
    contact_first_name: string | null;
    target_audience: string | null;
    services: string[] | null;
    usp: string[] | null;
  };
}

interface BuiltEmail {
  subject: string;
  body: string;
  html: string;
  intro: string;
  strategy_tags: Record<string, string>;
}

const FOLLOWUP_STATUS: Record<number, LeadStatus> = {
  1: "followup_1",
  2: "followup_2",
  3: "followup_3",
};

async function loadInsights(): Promise<Insight[]> {
  const { data } = await db()
    .from("bn_insights")
    .select("dimension, key, warm_lead_rate, sample_size")
    .gte("sample_size", 5)
    .order("warm_lead_rate", { ascending: false })
    .limit(12);
  return (data ?? []) as Insight[];
}

async function loadLead(leadId: string): Promise<OutreachLead | null> {
  const { data } = await db()
    .from("bn_leads")
    .select(
      `id, status, followups_sent, campaign_id,
       campaign:bn_campaigns(tracking_enabled),
       company:bn_companies(id, name, email, industry),
       analysis:bn_companies(bn_website_analyses(what_they_do, tone, improvement_observation, positive, contact_first_name, target_audience, services, usp))`
    )
    .eq("id", leadId)
    .single();
  if (!data) return null;
  const company = data.company as unknown as OutreachLead["company"];
  const campaign = data.campaign as unknown as { tracking_enabled: boolean } | null;
  const analysisWrap = data.analysis as unknown as {
    bn_website_analyses: OutreachLead["analysis"] | null;
  } | null;
  return {
    id: data.id as string,
    status: data.status as LeadStatus,
    followups_sent: data.followups_sent as number,
    campaign_id: (data.campaign_id as string) ?? null,
    tracking_enabled: campaign?.tracking_enabled ?? false,
    company,
    analysis: analysisWrap?.bn_website_analyses ?? {
      what_they_do: null,
      tone: null,
      improvement_observation: null,
      positive: null,
      contact_first_name: null,
      target_audience: null,
      services: null,
      usp: null,
    },
  };
}

/**
 * Atomically claims a lead for sending. Returns true only for the caller that
 * actually flipped the status — this is the race-condition lock from the plan.
 */
async function claimLead(leadId: string, fromStatus: LeadStatus): Promise<boolean> {
  const { data, error } = await db()
    .from("bn_leads")
    .update({ status: "sending" })
    .eq("id", leadId)
    .eq("status", fromStatus)
    .select("id");
  if (error) return false;
  return (data ?? []).length > 0;
}

async function releaseLead(leadId: string, toStatus: LeadStatus): Promise<void> {
  await db().from("bn_leads").update({ status: toStatus }).eq("id", leadId);
}

/** Intro paragraphs from earlier emails in this sequence, oldest first. */
async function previousIntros(leadId: string): Promise<string[]> {
  const { data } = await db()
    .from("bn_email_sequences")
    .select("strategy_tags")
    .eq("lead_id", leadId)
    .eq("status", "sent")
    .order("step", { ascending: true });
  return (data ?? [])
    .map((r) => (r.strategy_tags as Record<string, unknown>)?.intro)
    .filter((t): t is string => typeof t === "string");
}

/**
 * Generates an email: the AI writes only the personal intro (positive + one
 * improvement), which is assembled with the fixed proven copy. Guards run on
 * the AI-written intro — style validation always, uniqueness-vs-previous for
 * follow-ups. One retry, then null; a bad email is never sent.
 */
async function generateGuardedEmail(
  lead: OutreachLead,
  step: number,
  previousIntroTexts: string[],
  settings: Settings,
  insights: Insight[],
  trackToken: string | null
): Promise<BuiltEmail | null> {
  const firstName = lead.analysis.contact_first_name;
  for (let attempt = 0; attempt < 2; attempt++) {
    let generated;
    try {
      generated = await writeIntro({
        companyName: lead.company.name,
        whatTheyDo: lead.analysis.what_they_do ?? "",
        tone: lead.analysis.tone ?? "",
        positive: lead.analysis.positive ?? "",
        observation: lead.analysis.improvement_observation ?? "",
        industry: lead.company.industry ?? "",
        targetAudience: lead.analysis.target_audience ?? "",
        services: lead.analysis.services ?? [],
        usp: lead.analysis.usp ?? [],
        step,
        previousIntros: previousIntroTexts,
        insights,
      });
    } catch (err) {
      console.error(`intro generation failed for ${lead.company.name}:`, err);
      return null;
    }

    const { subject, body, html } =
      step === 0
        ? assembleFirstEmail({
            firstName,
            intro: generated.intro,
            websiteCheckUrl: settings.website_check_url,
            trackToken,
          })
        : assembleFollowUp({
            firstName,
            intro: generated.intro,
            websiteCheckUrl: settings.website_check_url,
            step,
            trackToken,
          });

    // Validate the AI-written intro only — the fixed copy is trusted.
    const styleProblems = validateEmailStyle(subject, generated.intro);
    const tooSimilar = previousIntroTexts.some(
      (prev) => textOverlap(generated.intro, prev) > MAX_FOLLOWUP_OVERLAP
    );
    if (styleProblems.length === 0 && !tooSimilar) {
      return {
        subject,
        body,
        html,
        intro: generated.intro,
        strategy_tags: generated.strategy_tags,
      };
    }

    console.warn(
      `guarded email rejected (attempt ${attempt + 1}) for ${lead.company.name}:`,
      styleProblems.length > 0 ? styleProblems.join("; ") : "too similar to previous intro"
    );
  }
  return null;
}

function nextActionAt(settings: Settings, followupIndex: number): string | null {
  const delays = settings.followup_delay_days;
  if (followupIndex >= Math.min(settings.max_followups, delays.length)) return null;
  const days = delays[followupIndex];
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function isUnsubscribed(email: string): Promise<boolean> {
  const { data } = await db()
    .from("bn_unsubscribes")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return !!data;
}

/**
 * Sends one email (first touch or follow-up) for a claimed lead. Returns
 * true if a mail actually went out.
 */
async function sendForLead(
  lead: OutreachLead,
  step: number,
  claimedFrom: LeadStatus,
  settings: Settings,
  insights: Insight[]
): Promise<boolean> {
  if (await isUnsubscribed(lead.company.email)) {
    await releaseLead(lead.id, "unsubscribed");
    return false;
  }

  // Idempotency: if this exact step was already sent (crash after send but
  // before the status update), never send it twice — just repair the status.
  const { data: alreadySent } = await db()
    .from("bn_email_sequences")
    .select("id")
    .eq("lead_id", lead.id)
    .eq("step", step)
    .eq("status", "sent")
    .maybeSingle();
  if (alreadySent) {
    await db()
      .from("bn_leads")
      .update({
        status: step === 0 ? "emailed" : FOLLOWUP_STATUS[step],
        followups_sent: step,
        next_action_at: nextActionAt(settings, step),
      })
      .eq("id", lead.id);
    return false;
  }

  const previous = step === 0 ? [] : await previousIntros(lead.id);

  await logActivity(
    "writing",
    step === 0
      ? `Persoonlijke e-mail schrijven aan ${lead.company.name}…`
      : `Follow-up ${step} schrijven voor ${lead.company.name}…`,
    { companyId: lead.company.id }
  );

  // Tracking is per-campaign: pool leads (no campaign) send untracked, exactly
  // as before, so warmup stays clean. A campaign with tracking on gets a pixel
  // + click redirect keyed to this per-send token.
  const tracked = !!lead.campaign_id && lead.tracking_enabled;
  const trackToken = tracked ? randomUUID() : null;

  const email = await generateGuardedEmail(
    lead,
    step,
    previous,
    settings,
    insights,
    trackToken
  );
  if (!email) {
    if (step === 0) {
      // Retryable next tick; generation hiccups shouldn't burn a lead.
      await releaseLead(lead.id, claimedFrom);
    } else {
      // Spec: after one retry, skip the follow-up rather than send a bad one.
      await releaseLead(lead.id, "stopped");
      await logActivity(
        "system",
        `Reeks gestopt voor ${lead.company.name}: kreeg geen follow-up geschreven die aan de kwaliteitslat voldoet.`,
        { companyId: lead.company.id }
      );
    }
    return false;
  }

  const { data: seqRow, error: seqErr } = await db()
    .from("bn_email_sequences")
    .insert({
      lead_id: lead.id,
      campaign_id: lead.campaign_id,
      step,
      subject: email.subject,
      body: email.body,
      observation_used: lead.analysis.improvement_observation,
      // Keep the intro in strategy_tags so follow-ups can avoid repeating it.
      strategy_tags: { ...email.strategy_tags, intro: email.intro },
      tracked,
      ...(trackToken ? { track_token: trackToken } : {}),
      status: "draft",
    })
    .select("id")
    .single();
  if (seqErr || !seqRow) {
    await releaseLead(lead.id, claimedFrom);
    return false;
  }

  await logActivity("sending", `E-mail versturen aan ${lead.company.name}…`, {
    companyId: lead.company.id,
  });

  const result = await sendEmail({
    to: lead.company.email,
    subject: email.subject,
    body: email.body,
    html: email.html,
    fromName: settings.from_name,
    fromEmail: settings.from_email,
  });

  if (!result.ok) {
    await db()
      .from("bn_email_sequences")
      .update({ status: "failed" })
      .eq("id", seqRow.id);
    await releaseLead(lead.id, claimedFrom);
    console.error(`send failed for ${lead.company.name}: ${result.error}`);
    return false;
  }

  const sentAt = new Date().toISOString();
  await db()
    .from("bn_email_sequences")
    .update({
      status: "sent",
      sent_at: sentAt,
      provider_message_id: result.messageId ?? null,
      strategy_tags: {
        ...email.strategy_tags,
        intro: email.intro,
        send_hour: sendHourTag(settings, sentAt),
        step: String(step),
      },
    })
    .eq("id", seqRow.id);

  // Analytics timeline: the first event for this send.
  await recordEmailEvent({
    sequenceId: seqRow.id as string,
    leadId: lead.id,
    campaignId: lead.campaign_id,
    type: "sent",
    at: sentAt,
  });

  const newStatus: LeadStatus = step === 0 ? "emailed" : FOLLOWUP_STATUS[step];
  await db()
    .from("bn_leads")
    .update({
      status: newStatus,
      followups_sent: step,
      next_action_at: nextActionAt(settings, step),
    })
    .eq("id", lead.id);

  await logActivity(
    step === 0 ? "sending" : "followup",
    step === 0
      ? `Persoonlijke e-mail verstuurd aan ${lead.company.name}.`
      : `Follow-up ${step} verstuurd aan ${lead.company.name}.`,
    { companyId: lead.company.id }
  );
  return true;
}

function sendHourTag(settings: Settings, isoTime: string): string {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: settings.sending_hours.tz,
    hour: "2-digit",
    hour12: false,
  }).format(new Date(isoTime));
  return `${hour}h`;
}

export interface EmailPreview {
  company: string;
  toEmail: string;
  observation: string;
  subject: string;
  body: string;
}

/**
 * Test mode: writes the exact first email the AI would send for this lead —
 * same analysis, same insights, same guards — but sends nothing and leaves
 * the lead untouched. Used to judge quality before going live.
 */
export async function previewFirstEmail(leadId: string): Promise<EmailPreview | null> {
  const lead = await loadLead(leadId);
  if (!lead?.analysis.improvement_observation) return null;
  const settings = await getSettings();
  const insights = await loadInsights();
  const email = await generateGuardedEmail(lead, 0, [], settings, insights, null);
  if (!email) return null;
  // Persist so results survive an HTTP timeout on a long preview run.
  await db().from("bn_email_previews").insert({
    company_id: lead.company.id,
    company_name: lead.company.name,
    to_email: lead.company.email,
    observation: lead.analysis.improvement_observation,
    subject: email.subject,
    body: email.body,
  });
  await logActivity(
    "writing",
    `Proefmail geschreven voor ${lead.company.name} (testmodus — niets verstuurd).`,
    { companyId: lead.company.id }
  );
  return {
    company: lead.company.name,
    toEmail: lead.company.email,
    observation: lead.analysis.improvement_observation,
    subject: email.subject,
    body: email.body,
  };
}

/**
 * Recovers leads stuck in 'sending' by a crashed invocation (>15 min old).
 * The true state is derived from what was actually sent, and the idempotency
 * check in sendForLead makes re-processing safe.
 */
export async function recoverStuckLeads(): Promise<void> {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: stuck } = await db()
    .from("bn_leads")
    .select("id")
    .eq("status", "sending")
    .lt("updated_at", cutoff)
    .limit(20);
  for (const row of stuck ?? []) {
    const leadId = row.id as string;
    const { data: lastSent } = await db()
      .from("bn_email_sequences")
      .select("step")
      .eq("lead_id", leadId)
      .eq("status", "sent")
      .order("step", { ascending: false })
      .limit(1)
      .maybeSingle();
    const restored: LeadStatus =
      lastSent == null
        ? "queued"
        : (lastSent.step as number) === 0
          ? "emailed"
          : FOLLOWUP_STATUS[lastSent.step as number];
    await releaseLead(leadId, restored);
  }
}

/**
 * Sends due follow-ups first (time-sensitive), then first-touch emails to
 * queued leads, staying within this tick's budget. Returns emails sent.
 */
export async function processSendQueue(
  budget: number,
  settings: Settings
): Promise<number> {
  if (budget <= 0) return 0;

  // Sending happens only from active campaigns — the unassigned pool is a
  // staging area and is never mailed until leads are assigned to a campaign.
  const activeIds = await activeCampaignIds();
  if (activeIds.length === 0) return 0;

  const insights = await loadInsights();
  let sent = 0;

  // 1. Follow-ups that are due.
  const { data: dueLeads } = await db()
    .from("bn_leads")
    .select("id, status, followups_sent")
    .in("campaign_id", activeIds)
    .in("status", ["emailed", "followup_1", "followup_2"])
    .lte("next_action_at", new Date().toISOString())
    .lt("followups_sent", settings.max_followups)
    .order("next_action_at", { ascending: true })
    .limit(budget);

  for (const row of dueLeads ?? []) {
    if (sent >= budget) break;
    const fromStatus = row.status as LeadStatus;
    if (!(await claimLead(row.id as string, fromStatus))) continue;
    const lead = await loadLead(row.id as string);
    if (!lead) {
      await releaseLead(row.id as string, fromStatus);
      continue;
    }
    const step = (row.followups_sent as number) + 1;
    if (await sendForLead(lead, step, fromStatus, settings, insights)) sent++;
  }

  // 2. First-touch emails for analyzed leads.
  const remaining = budget - sent;
  if (remaining > 0) {
    const { data: queued } = await db()
      .from("bn_leads")
      .select("id")
      .eq("status", "queued")
      .in("campaign_id", activeIds)
      .order("created_at", { ascending: true })
      .limit(remaining);

    for (const row of queued ?? []) {
      if (sent >= budget) break;
      if (!(await claimLead(row.id as string, "queued"))) continue;
      const lead = await loadLead(row.id as string);
      if (!lead) {
        await releaseLead(row.id as string, "queued");
        continue;
      }
      if (await sendForLead(lead, 0, "queued", settings, insights)) sent++;
    }
  }

  return sent;
}
