import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/resend";
import { logActivity } from "@/lib/activity";

function keyMatches(key: string): boolean {
  const a = Buffer.from(key);
  const b = Buffer.from(env.cronSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * One-off end-to-end verification: sends a single fixed test email through
 * the exact same Resend path outreach uses (from-address, unsubscribe
 * headers, plain text). Proves domain verification + deliverability before
 * unpausing the employee. Auth: session cookie or ?key=<CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  const sessionOk = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!sessionOk && !(key && keyMatches(key))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const to = z
    .string()
    .email()
    .safeParse(request.nextUrl.searchParams.get("to"));
  if (!to.success) {
    return NextResponse.json({ error: "geef ?to=<emailadres> mee" }, { status: 400 });
  }

  const settings = await getSettings();
  if (!settings.from_email) {
    return NextResponse.json({ error: "from_email is niet ingesteld" }, { status: 400 });
  }

  const result = await sendEmail({
    to: to.data,
    subject: "Testmail van je Brand Nova AI-medewerker ✅",
    body:
      "Hoi Julian,\n\nDit is een eenmalige testmail om te bevestigen dat het " +
      "verzenddomein werkt. Als je dit leest, staat alles goed en kan ik aan " +
      "de slag.\n\nGroet,\nJe AI-medewerker",
    fromName: settings.from_name,
    fromEmail: settings.from_email,
  });

  if (result.ok) {
    await logActivity("system", `Testmail verstuurd aan ${to.data} — verzendpad werkt.`);
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
