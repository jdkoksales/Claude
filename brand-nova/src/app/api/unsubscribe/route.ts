import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { logActivity } from "@/lib/activity";

async function unsubscribe(email: string): Promise<void> {
  await db()
    .from("bn_unsubscribes")
    .upsert({ email }, { onConflict: "email" });
  const { data: company } = await db()
    .from("bn_companies")
    .select("id, name")
    .eq("email", email)
    .maybeSingle();
  if (company) {
    await db()
      .from("bn_leads")
      .update({ status: "unsubscribed", next_action_at: null })
      .eq("company_id", company.id as string);
    await logActivity(
      "system",
      `${company.name as string} heeft zich uitgeschreven — permanent uit de outreach gehaald.`,
      { companyId: company.id as string }
    );
  }
}

function validParams(request: NextRequest): string | null {
  const email = request.nextUrl.searchParams.get("e")?.toLowerCase() ?? "";
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (!email || !token || !verifyUnsubscribeToken(email, token)) return null;
  return email;
}

/** Human clicking the link in the email footer. */
export async function GET(request: NextRequest) {
  const email = validParams(request);
  if (!email) {
    return new NextResponse("Ongeldige link.", { status: 400 });
  }
  await unsubscribe(email);
  return new NextResponse(
    `<!doctype html><html lang="nl"><meta charset="utf-8"><title>Uitgeschreven</title>
     <body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem">
     <h1 style="font-size:1.3rem">Je bent uitgeschreven</h1>
     <p>${email} ontvangt geen e-mails meer van ons. Excuus voor de storing.</p>
     </body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

/** RFC 8058 one-click unsubscribe (mail clients POST here). */
export async function POST(request: NextRequest) {
  const email = validParams(request);
  if (!email) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  await unsubscribe(email);
  return NextResponse.json({ ok: true });
}
