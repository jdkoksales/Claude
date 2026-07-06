import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

/** Replies flagged needs_human, newest first, with company context. */
export async function GET() {
  const { data, error } = await db()
    .from("bn_replies")
    .select(
      "id, subject, raw_body, received_at, classification, classification_confidence, bn_leads(id, status, bn_companies(id, name, email))"
    )
    .eq("needs_human", true)
    .order("received_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ replies: data ?? [] });
}
