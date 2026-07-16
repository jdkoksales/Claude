import { db } from "./supabase";
import { getSettings } from "./settings";
import { sendEmail } from "./resend";
import { logActivity } from "./activity";
import { env } from "./env";
import { isWithinSendingWindow } from "./sendWindow";

/**
 * Bel-nu-signaal: the moment a prospect opens or clicks, alert the operator so
 * the call happens while the mail is literally on the prospect's screen. The
 * MIT/InsideSales lead-response study (15k+ leads): contacting within 5 minutes
 * makes qualification ~21x more likely than after 30 minutes — timing is the
 * whole game, and the open pixel gives us the timing for free.
 *
 * Guards keep it useful instead of noisy:
 * - only during calling hours (the configured sending window ≈ office hours)
 * - only for leads still worth calling (call_status todo/callback, lead not
 *   bounced/unsubscribed/spam)
 * - at most one alert per lead per 20 hours (a re-open minutes later should
 *   not double-ping)
 * - fully fire-and-forget: an alert failure must never break the pixel.
 */

const ALERT_COOLDOWN_MS = 20 * 60 * 60 * 1000;

const DEAD_LEAD_STATUSES = ["bounced", "unsubscribed", "spam", "not_interested"];

export async function maybeSendHotAlert(
  leadId: string,
  kind: "opened" | "clicked"
): Promise<void> {
  try {
    const settings = await getSettings();
    if (!settings.hot_alert_email || !settings.from_email) return;
    // Office hours only — a 23:00 open makes a fine morning call, not a ping.
    if (!isWithinSendingWindow(settings)) return;

    const { data: lead } = await db()
      .from("bn_leads")
      .select(
        "id, status, call_status, last_hot_alert_at, bn_companies(name, domain, website_url, email)"
      )
      .eq("id", leadId)
      .maybeSingle();
    if (!lead) return;
    if (DEAD_LEAD_STATUSES.includes(lead.status as string)) return;
    const callStatus = (lead.call_status as string) ?? "todo";
    if (callStatus !== "todo" && callStatus !== "callback") return;
    const last = lead.last_hot_alert_at
      ? new Date(lead.last_hot_alert_at as string).getTime()
      : 0;
    if (Date.now() - last < ALERT_COOLDOWN_MS) return;

    // Claim the alert slot atomically-ish before sending, so a burst of pixel
    // hits (multi-device open) can't produce duplicate alerts.
    const { data: claimed } = await db()
      .from("bn_leads")
      .update({ last_hot_alert_at: new Date().toISOString() })
      .eq("id", leadId)
      .or(
        lead.last_hot_alert_at
          ? `last_hot_alert_at.eq.${lead.last_hot_alert_at}`
          : "last_hot_alert_at.is.null"
      )
      .select("id");
    if (!claimed || claimed.length === 0) return;

    const company = lead.bn_companies as unknown as {
      name: string;
      domain: string;
      website_url: string;
      email: string;
    } | null;
    const name = company?.name ?? "Een bedrijf";
    const action =
      kind === "clicked"
        ? "klikte ZOJUIST door naar je Website Check"
        : "leest ZOJUIST je e-mail";

    const bellijstUrl = `${env.appUrl}/bellen`;
    const body = [
      `🔥 ${name} ${action}.`,
      "",
      `Bedrijf: ${name}`,
      company?.domain ? `Website: https://${company.domain}` : "",
      company?.email ? `E-mail: ${company.email}` : "",
      "",
      "Nu bellen werkt het best: binnen 5 minuten contact maakt kwalificatie ~21x waarschijnlijker dan na een half uur.",
      "",
      `Openen: ${bellijstUrl}`,
    ]
      .filter((l) => l !== "")
      .join("\n");

    await sendEmail({
      to: settings.from_email,
      subject: `🔥 Bel nu: ${name} ${kind === "clicked" ? "klikte op je Website Check" : "leest je mail"}`,
      body,
      fromName: "Je AI-medewerker",
      fromEmail: settings.from_email,
    });

    await logActivity(
      "system",
      `🔥 Bel-nu-signaal verstuurd: ${name} ${kind === "clicked" ? "klikte zojuist" : "leest je mail"}.`
    );
  } catch (err) {
    // Observability only — the pixel/redirect must never fail on this.
    console.error("hot alert failed:", err);
  }
}
