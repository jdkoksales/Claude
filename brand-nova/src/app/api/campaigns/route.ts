import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCampaign } from "@/lib/campaigns";
import { getPoolCount, listCampaignStats } from "@/lib/analytics";

export async function GET() {
  const [campaigns, pool] = await Promise.all([listCampaignStats(), getPoolCount()]);
  return NextResponse.json({ campaigns, pool });
}

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  trackingEnabled: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "geef minimaal een naam op" }, { status: 400 });
  }
  const campaign = await createCampaign(parsed.data);
  return NextResponse.json({ campaign }, { status: 201 });
}
