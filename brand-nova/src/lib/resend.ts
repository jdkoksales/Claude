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
 * Sends one outreach email via Resend. Plain text only — handwritten emails
 * don't come with HTML templates, and plain text performs better for cold
 * outreach. Every mail carries List-Unsubscribe headers plus a visible
 * opt-out line, which is both legally required and good for deliverability.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
  fromName: string;
  fromEmail: string;
  inReplyTo?: string;
}): Promise<SendResult> {
  const optOut = unsubscribeUrl(input.to);
  const text = `${input.body.trimEnd()}\n\n--\nLiever geen mail meer van ons? ${optOut}`;
  try {
    const { data, error } = await resend().emails.send({
      from: `${input.fromName} <${input.fromEmail}>`,
      to: input.to,
      subject: input.subject,
      text,
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
