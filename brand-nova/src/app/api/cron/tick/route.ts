import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { runTick } from "@/lib/tick";

export const maxDuration = 300;

/**
 * The employee's heartbeat, invoked every 5 minutes by a GitHub Actions
 * schedule (Vercel Hobby only allows daily crons). The endpoint is publicly
 * reachable but harmless: an atomic database claim lets at most one tick
 * through per ~4 minutes, so unauthenticated calls can never make the
 * employee do more than its normal cadence — they just get "throttled".
 */
export async function GET() {
  const { data: claimed, error } = await db().rpc("bn_claim_tick", {
    min_interval_seconds: 55,
  });
  if (error) {
    console.error("tick claim failed:", error.message);
    return NextResponse.json({ error: "claim failed" }, { status: 500 });
  }
  if (!claimed) {
    return NextResponse.json({ throttled: true });
  }
  try {
    const summary = await runTick();
    return NextResponse.json(summary);
  } catch (err) {
    console.error("tick failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "tick failed" },
      { status: 500 }
    );
  }
}
