import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runTick } from "@/lib/tick";

export const maxDuration = 300;

/**
 * The employee's heartbeat, invoked by Vercel Cron every 5 minutes.
 * Authenticated with CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
