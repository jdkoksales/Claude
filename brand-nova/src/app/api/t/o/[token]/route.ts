import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { recordEmailEvent } from "@/lib/events";
import { logActivity } from "@/lib/activity";
import { maybeSendHotAlert } from "@/lib/hotAlert";

// A 1×1 transparent GIF — the classic open-tracking pixel.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pixel(): NextResponse {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "content-type": "image/gif",
      "content-length": String(PIXEL.length),
      "cache-control": "no-store, no-cache, must-revalidate, private",
      pragma: "no-cache",
      expires: "0",
    },
  });
}

/**
 * Open-tracking pixel. Always returns the 1×1 GIF (never leaks whether a token
 * is valid); when the token maps to a real send it records an `opened` event
 * and drops a line in the live feed. First open vs. re-open is distinguished
 * from the cached open_count so the feed can say "opened again".
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!UUID_RE.test(token)) return pixel();

  const { data: seq } = await db()
    .from("bn_email_sequences")
    .select("id, lead_id, campaign_id, open_count, bn_leads(bn_companies(name))")
    .eq("track_token", token)
    .maybeSingle();
  if (!seq) return pixel();

  const inserted = await recordEmailEvent({
    sequenceId: seq.id as string,
    leadId: seq.lead_id as string,
    campaignId: (seq.campaign_id as string) ?? null,
    type: "opened",
    userAgent: _request.headers.get("user-agent"),
  });

  if (inserted) {
    const company = (
      seq.bn_leads as unknown as { bn_companies: { name: string } | null } | null
    )?.bn_companies;
    const name = company?.name ?? "Een bedrijf";
    const again = (seq.open_count as number) > 0;
    await logActivity(
      "opened",
      again ? `${name} opende je e-mail opnieuw.` : `${name} opende je e-mail.`,
      { metadata: { kind: "open" } }
    );
    // Bel-nu-signaal: ping the operator while the prospect is reading.
    await maybeSendHotAlert(seq.lead_id as string, "opened");
  }

  return pixel();
}
