import { db } from "./supabase";
import { env } from "./env";
import type { EmailEventType } from "./types";

/**
 * Records one email analytics event through the atomic DB function, which
 * deduplicates provider webhook retries (on provider_event_id) and updates the
 * denormalized counters on bn_email_sequences in the same transaction.
 * Returns true when a NEW event was recorded (false = duplicate / no-op),
 * so callers can avoid double-logging retried webhooks.
 */
export async function recordEmailEvent(input: {
  sequenceId?: string | null;
  leadId?: string | null;
  campaignId?: string | null;
  type: EmailEventType;
  url?: string | null;
  userAgent?: string | null;
  providerEventId?: string | null;
  at?: string | null;
}): Promise<boolean> {
  const { data, error } = await db().rpc("bn_record_email_event", {
    p_seq: input.sequenceId ?? null,
    p_lead: input.leadId ?? null,
    p_campaign: input.campaignId ?? null,
    p_type: input.type,
    p_url: input.url ?? null,
    p_ua: input.userAgent ?? null,
    p_provider_event_id: input.providerEventId ?? null,
    p_at: input.at ?? null,
  });
  if (error) {
    console.error("recordEmailEvent failed:", error.message);
    return false;
  }
  return data === true;
}

/** 1×1 open-tracking pixel URL for a given per-send token (self-hosted). */
export function openPixelUrl(token: string): string {
  return `${env.appUrl}/api/t/o/${token}`;
}

/** Click-tracking redirect URL that lands on the Website Check. */
export function clickRedirectUrl(token: string): string {
  return `${env.appUrl}/api/t/c/${token}`;
}
