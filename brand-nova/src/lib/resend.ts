import { Resend } from "resend";
import { env } from "./env";
import { unsubscribeUrl } from "./auth";

let client: Resend | null = null;

function resend(): Resend {
  if (!client) client = new Resend(env.resendApiKey);
  return client;
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends one outreach email via Resend. Always includes a plain-text part
 * (best for deliverability and text-only clients); when `html` is provided it
 * is sent as the multipart alternative, which carries the branded signature.
 * Opt-out is via List-Unsubscribe headers only (no visible footer line) — they
 * keep us compliant and give unhappy recipients a one-click alternative to
 * hitting "spam".
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
  html?: string;
  fromName: string;
  fromEmail: string;
  inReplyTo?: string;
}): Promise<SendResult> {
  const optOut = unsubscribeUrl(input.to);
  const text = input.body.trimEnd();
  try {
    const { data, error } = await resend().emails.send({
      from: `${input.fromName} <${input.fromEmail}>`,
      to: input.to,
      subject: input.subject,
      text,
      ...(input.html ? { html: input.html } : {}),
      headers: {
        "List-Unsubscribe": `<${optOut}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        ...(input.inReplyTo
          ? { "In-Reply-To": input.inReplyTo, References: input.inReplyTo }
          : {}),
      },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, messageId: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
