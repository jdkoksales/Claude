import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

const PAGE_SIZE = 25;

/**
 * Chronological archive of every email the AI sent, newest first. This is
 * the operator's "Sent" folder — outgoing mail goes via Resend, so it never
 * appears in their own mailbox.
 */
export async function GET(request: NextRequest) {
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") ?? 0));
  const { data, count, error } = await db()
    .from("bn_email_sequences")
    .select(
      "id, step, subject, body, sent_at, bn_leads(id, status, bn_companies(name, domain, email))",
      { count: "exact" }
    )
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ emails: data ?? [], total: count ?? 0, pageSize: PAGE_SIZE });
}
