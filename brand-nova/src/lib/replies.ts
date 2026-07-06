import { db } from "./supabase";
import { logActivity } from "./activity";
import { classifyReply, writeAutoReply } from "./ai";
import { sendEmail } from "./resend";
import { getSettings } from "./settings";
import {
  WARM_CLASSIFICATIONS,
  type Lead,
  type LeadStatus,
  type ReplyClassification,
} from "./types";

export interface InboundEmail {
  fromEmail: string;
  toEmail: string;
  subject: string;
  text: string;
  inReplyTo: string | null;
}

const CLASSIFICATION_TO_STATUS: Record<ReplyClassification, LeadStatus> = {
  interested: "positive_reply",
  question: "question",
  warm_lead: "warm_lead",
  meeting_request: "meeting_request",
  website_check_completed: "website_check_completed",
  not_interested: "not_interested",
  spam: "spam",
  out_of_office: "out_of_office",
};

interface MatchedLead {
  lead: Lead;
  companyId: string;
  companyName: string;
  sequenceId: string | null;
  originalEmail: string;
}

/**
 * Matches an inbound email to a lead: first via the In-Reply-To header
 * against our stored provider message ids, then via the sender address.
 */
async function matchLead(inbound: InboundEmail): Promise<MatchedLead | null> {
  // 1. Thread headers.
  if (inbound.inReplyTo) {
    const cleaned = inbound.inReplyTo.replace(/[<>]/g, "");
    const { data: seq } = await db()
      .from("bn_email_sequences")
      .select("id, lead_id, subject, body")
      .eq("provider_message_id", cleaned)
      .maybeSingle();
    if (seq) {
      const found = await leadWithCompany(seq.lead_id as string);
      if (found) {
        return {
          ...found,
          sequenceId: seq.id as string,
          originalEmail: `${seq.subject}\n\n${seq.body}`,
        };
      }
    }
  }

  // 2. Sender address → company email.
  const from = inbound.fromEmail.toLowerCase();
  const { data: company } = await db()
    .from("bn_companies")
    .select("id")
    .eq("email", from)
    .maybeSingle();
  if (!company) return null;
  const { data: leadRow } = await db()
    .from("bn_leads")
    .select("*")
    .eq("company_id", company.id as string)
    .maybeSingle();
  if (!leadRow) return null;
  const found = await leadWithCompany(leadRow.id as string);
  if (!found) return null;
  const { data: lastSeq } = await db()
    .from("bn_email_sequences")
    .select("id, subject, body")
    .eq("lead_id", found.lead.id)
    .eq("status", "sent")
    .order("step", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    ...found,
    sequenceId: (lastSeq?.id as string) ?? null,
    originalEmail: lastSeq ? `${lastSeq.subject}\n\n${lastSeq.body}` : "",
  };
}

async function leadWithCompany(
  leadId: string
): Promise<Omit<MatchedLead, "sequenceId" | "originalEmail"> | null> {
  const { data } = await db()
    .from("bn_leads")
    .select("*, bn_companies(id, name)")
    .eq("id", leadId)
    .maybeSingle();
  if (!data) return null;
  const company = data.bn_companies as unknown as { id: string; name: string };
  return {
    lead: data as unknown as Lead,
    companyId: company.id,
    companyName: company.name,
  };
}

/**
 * Full inbound pipeline: match → store → classify → update lead status
 * (follow-ups stop immediately because status leaves the outreach set) →
 * auto-reply simple questions when confidence allows, otherwise flag for
 * the human.
 */
export async function processInboundEmail(inbound: InboundEmail): Promise<void> {
  const matched = await matchLead(inbound);
  if (!matched) {
    await logActivity(
      "reading",
      `E-mail ontvangen van ${inbound.fromEmail} die bij geen enkele lead hoort — laten liggen.`,
      { metadata: { from: inbound.fromEmail, subject: inbound.subject } }
    );
    return;
  }

  await logActivity("reading", `Antwoord van ${matched.companyName} lezen…`, {
    companyId: matched.companyId,
  });

  const { data: replyRow, error } = await db()
    .from("bn_replies")
    .insert({
      lead_id: matched.lead.id,
      email_sequence_id: matched.sequenceId,
      from_email: inbound.fromEmail.toLowerCase(),
      subject: inbound.subject,
      raw_body: inbound.text.slice(0, 20_000),
    })
    .select("id")
    .single();
  if (error || !replyRow) {
    console.error("failed to store reply:", error?.message);
    return;
  }

  const settings = await getSettings();
  let classified;
  try {
    classified = await classifyReply(matched.originalEmail, inbound.text);
  } catch (err) {
    console.error("classification failed:", err);
    await db()
      .from("bn_replies")
      .update({ needs_human: true })
      .eq("id", replyRow.id);
    return;
  }

  const lowConfidence =
    classified.confidence < settings.auto_reply_confidence_threshold;

  await db()
    .from("bn_replies")
    .update({
      classification: classified.classification,
      classification_confidence: classified.confidence,
      needs_human: lowConfidence,
    })
    .eq("id", replyRow.id);

  // Out-of-office and spam don't change the lead's journey; everything else
  // ends automated outreach for this lead immediately.
  if (
    classified.classification !== "out_of_office" &&
    classified.classification !== "spam"
  ) {
    const newStatus = lowConfidence
      ? matched.lead.status // don't act on an uncertain read; human decides
      : CLASSIFICATION_TO_STATUS[classified.classification];
    const isWarm =
      !lowConfidence && WARM_CLASSIFICATIONS.includes(classified.classification);
    await db()
      .from("bn_leads")
      .update({
        status: newStatus,
        next_action_at: null, // stop all scheduled follow-ups, always
        ...(isWarm && !matched.lead.warm_since
          ? { warm_since: new Date().toISOString() }
          : {}),
      })
      .eq("id", matched.lead.id);

    if (isWarm) {
      await logActivity(
        "warm_lead",
        `🔥 ${matched.companyName} is nu een warme lead (${classified.classification.replace(/_/g, " ")}).`,
        { companyId: matched.companyId }
      );
    }
  }

  if (lowConfidence) {
    await logActivity(
      "reading",
      `Een antwoord van ${matched.companyName} heeft jouw blik nodig — ik wist niet zeker hoe ik het moest lezen.`,
      { companyId: matched.companyId }
    );
    return;
  }

  // Auto-answer simple questions, grounded strictly in the FAQ table.
  if (classified.classification === "question" && classified.questionSummary) {
    const { data: faq } = await db()
      .from("bn_faq_entries")
      .select("question, answer");
    const auto = await writeAutoReply({
      replyText: inbound.text,
      questionSummary: classified.questionSummary,
      faq: (faq ?? []) as Array<{ question: string; answer: string }>,
      websiteCheckUrl: settings.website_check_url,
      fromName: settings.from_name,
    });

    if (auto.canAnswer && auto.body) {
      const result = await sendEmail({
        to: inbound.fromEmail,
        subject: inbound.subject.startsWith("Re:")
          ? inbound.subject
          : `Re: ${inbound.subject}`,
        body: auto.body,
        fromName: settings.from_name,
        fromEmail: settings.from_email,
        inReplyTo: inbound.inReplyTo ?? undefined,
      });
      if (result.ok) {
        await db()
          .from("bn_replies")
          .update({ auto_replied: true, auto_reply_body: auto.body })
          .eq("id", replyRow.id);
        await logActivity(
          "sending",
          `Vraag van ${matched.companyName} automatisch beantwoord.`,
          { companyId: matched.companyId }
        );
        return;
      }
    }
    // Couldn't answer from the FAQ (or send failed) → human takes over.
    await db()
      .from("bn_replies")
      .update({ needs_human: true })
      .eq("id", replyRow.id);
    await logActivity(
      "reading",
      `${matched.companyName} vroeg iets buiten mijn kennis — voor jou klaargezet.`,
      { companyId: matched.companyId }
    );
  }
}

/** Handles Resend bounce/complaint events. */
export async function processBounce(toEmail: string): Promise<void> {
  const email = toEmail.toLowerCase();
  const { data: company } = await db()
    .from("bn_companies")
    .select("id, name")
    .eq("email", email)
    .maybeSingle();
  if (!company) return;
  await db()
    .from("bn_companies")
    .update({ email_valid: false })
    .eq("id", company.id as string);
  await db()
    .from("bn_leads")
    .update({ status: "bounced", next_action_at: null })
    .eq("company_id", company.id as string);
  await logActivity(
    "system",
    `E-mail aan ${company.name as string} is gebounced — contact gestopt.`,
    { companyId: company.id as string }
  );
}
