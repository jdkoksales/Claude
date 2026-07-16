import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getSettings } from "@/lib/settings";
import { recordEmailEvent } from "@/lib/events";
import { logActivity } from "@/lib/activity";
import { maybeSendHotAlert } from "@/lib/hotAlert";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Click-tracking redirect. Records a `clicked` event (and an implied `opened`
 * if the pixel never fired, since images are often blocked but the click is
 * real) and 302-redirects to the Website Check. The destination is always the
 * configured Website Check URL — never a value from the request — so this is
 * not an open redirect.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const settings = await getSettings();
  const destination = settings.website_check_url || "https://www.brand-nova.nl";

  const { token } = await params;
  if (!UUID_RE.test(token)) return NextResponse.redirect(destination, 302);

  const { data: seq } = await db()
    .from("bn_email_sequences")
    .select("id, lead_id, campaign_id, open_count, click_count, bn_leads(bn_companies(name))")
    .eq("track_token", token)
    .maybeSingle();
  if (!seq) return NextResponse.redirect(destination, 302);

  const ua = request.headers.get("user-agent");
  // A click implies an open — backfill it if the pixel was blocked.
  if ((seq.open_count as number) === 0) {
    await recordEmailEvent({
      sequenceId: seq.id as string,
      leadId: seq.lead_id as string,
      campaignId: (seq.campaign_id as string) ?? null,
      type: "opened",
      userAgent: ua,
    });
  }

  const inserted = await recordEmailEvent({
    sequenceId: seq.id as string,
    leadId: seq.lead_id as string,
    campaignId: (seq.campaign_id as string) ?? null,
    type: "clicked",
    url: destination,
    userAgent: ua,
  });

  if (inserted) {
    const company = (
      seq.bn_leads as unknown as { bn_companies: { name: string } | null } | null
    )?.bn_companies;
    const name = company?.name ?? "Een bedrijf";
    await logActivity("clicked", `${name} klikte door naar de Website Check.`, {
      metadata: { kind: "click" },
    });
    // A click is the hottest possible signal — ping the operator right away.
    await maybeSendHotAlert(seq.lead_id as string, "clicked");
  }

  return NextResponse.redirect(destination, 302);
}
