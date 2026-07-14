import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { env } from "@/lib/env";
import { db } from "@/lib/supabase";
import { recordEmailEvent } from "@/lib/events";
import { processBounce, processComplaint, processInboundEmail } from "@/lib/replies";

export const maxDuration = 60;

interface ResendWebhookEvent {
  type: string;
  created_at?: string;
  data: {
    email_id?: string;
    from?: string | { email?: string };
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    headers?: Array<{ name: string; value: string }> | Record<string, string>;
    email?: { to?: string | string[] };
  };
}

/**
 * Resolves the send row (and its lead/campaign) from Resend's email_id so a
 * provider event can be attributed to the right lead and campaign in the
 * analytics timeline. Returns null for events we can't map (e.g. test sends).
 */
async function sequenceForMessage(
  emailId: string | undefined
): Promise<{ id: string; lead_id: string; campaign_id: string | null } | null> {
  if (!emailId) return null;
  const { data } = await db()
    .from("bn_email_sequences")
    .select("id, lead_id, campaign_id")
    .eq("provider_message_id", emailId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    lead_id: data.lead_id as string,
    campaign_id: (data.campaign_id as string) ?? null,
  };
}

function extractEmailAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
}

function headerValue(
  headers: ResendWebhookEvent["data"]["headers"],
  name: string
): string | null {
  if (!headers) return null;
  const lower = name.toLowerCase();
  if (Array.isArray(headers)) {
    return headers.find((h) => h.name.toLowerCase() === lower)?.value ?? null;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value;
  }
  return null;
}

function firstAddress(value: string | string[] | undefined): string {
  if (!value) return "";
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? extractEmailAddress(raw) : "";
}

/**
 * Resend webhook: inbound replies drive the Reply AI; bounce/complaint
 * events stop outreach to dead or unwilling addresses. Signature-verified
 * with svix — unauthenticated payloads are rejected.
 */
export async function POST(request: NextRequest) {
  const payload = await request.text();
  const webhook = new Webhook(env.resendWebhookSecret);
  let event: ResendWebhookEvent;
  try {
    event = webhook.verify(payload, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    }) as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Stable per-event id (constant across Resend's retries) → used to dedup
  // analytics events so a redelivered webhook never double-counts.
  const svixId = request.headers.get("svix-id");
  const at = event.created_at ?? null;

  switch (event.type) {
    case "email.received": {
      const fromRaw = event.data.from;
      const fromEmail =
        typeof fromRaw === "string"
          ? extractEmailAddress(fromRaw)
          : fromRaw?.email?.toLowerCase() ?? "";
      const text =
        event.data.text ??
        (event.data.html ? event.data.html.replace(/<[^>]+>/g, " ") : "");
      if (fromEmail && text) {
        await processInboundEmail({
          fromEmail,
          toEmail: firstAddress(event.data.to),
          subject: event.data.subject ?? "",
          text,
          inReplyTo: headerValue(event.data.headers, "in-reply-to"),
        });
      }
      break;
    }
    case "email.delivered": {
      const seq = await sequenceForMessage(event.data.email_id);
      if (seq) {
        await recordEmailEvent({
          sequenceId: seq.id,
          leadId: seq.lead_id,
          campaignId: seq.campaign_id,
          type: "delivered",
          providerEventId: svixId,
          at,
        });
      }
      break;
    }
    case "email.bounced": {
      const to = firstAddress(event.data.to ?? event.data.email?.to);
      if (to) await processBounce(to);
      const seq = await sequenceForMessage(event.data.email_id);
      if (seq) {
        await recordEmailEvent({
          sequenceId: seq.id,
          leadId: seq.lead_id,
          campaignId: seq.campaign_id,
          type: "bounced",
          providerEventId: svixId,
          at,
        });
      }
      break;
    }
    case "email.complained": {
      const to = firstAddress(event.data.to ?? event.data.email?.to);
      if (to) await processComplaint(to);
      const seq = await sequenceForMessage(event.data.email_id);
      if (seq) {
        await recordEmailEvent({
          sequenceId: seq.id,
          leadId: seq.lead_id,
          campaignId: seq.campaign_id,
          type: "complained",
          providerEventId: svixId,
          at,
        });
      }
      break;
    }
    default:
      break; // opened/clicked handled by our own pixel/redirect, not Resend
  }

  return NextResponse.json({ ok: true });
}
