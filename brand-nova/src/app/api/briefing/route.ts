import { NextRequest, NextResponse } from "next/server";
import { getBriefing } from "@/lib/briefing";

/** The AI morning briefing. ?force=1 regenerates it immediately. */
export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force") === "1";
  const briefing = await getBriefing(force);
  return NextResponse.json(briefing);
}
