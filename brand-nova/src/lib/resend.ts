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
 * outreach. Opt-out is provided via List-Unsubscribe headers only (Julian's
 * call: no visible footer line in the body). The headers keep us compliant
 * and give unhappy recipients a one-click alternative to hitting "spam".
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
  const text = input.body.trimEnd();
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
