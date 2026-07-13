import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { env } from "@/lib/env";
import { processBounce, processComplaint, processInboundEmail } from "@/lib/replies";

export const maxDuration = 60;

interface ResendWebhookEvent {
  type: string;
  data: {
    from?: string | { email?: string };
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    headers?: Array<{ name: string; value: string }> | Record<string, string>;
    email?: { to?: string | string[] };
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
    case "email.bounced": {
      const to = firstAddress(event.data.to ?? event.data.email?.to);
      if (to) await processBounce(to);
      break;
    }
    case "email.complained": {
      const to = firstAddress(event.data.to ?? event.data.email?.to);
      if (to) await processComplaint(to);
      break;
    }
    default:
      break; // delivered/opened etc. — not signals we act on
  }

  return NextResponse.json({ ok: true });
}
