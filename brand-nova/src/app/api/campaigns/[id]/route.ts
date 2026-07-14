import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCampaign, updateCampaign } from "@/lib/campaigns";
import { getAnalytics, getDailyTrend } from "@/lib/analytics";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [analytics, trend] = await Promise.all([
    getAnalytics(id),
    getDailyTrend(14, id),
  ]);
  return NextResponse.json({ campaign, analytics, trend });
}

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  tracking_enabled: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid patch" }, { status: 400 });
  }
  const campaign = await updateCampaign(id, parsed.data);
  if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}
