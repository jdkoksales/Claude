import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

/** Marks a flagged reply as handled by the human. */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await db()
    .from("bn_replies")
    .update({ needs_human: false })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
