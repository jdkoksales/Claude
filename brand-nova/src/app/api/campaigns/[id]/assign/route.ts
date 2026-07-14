import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assignLeadsToCampaign } from "@/lib/campaigns";
import { getCampaign } from "@/lib/campaigns";
import { getPoolCount } from "@/lib/analytics";

const schema = z.object({ count: z.number().int().min(1).max(100000) });

/** Assigns N leads from the pool to this campaign. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "geef een aantal op" }, { status: 400 });
  }

  const assigned = await assignLeadsToCampaign(id, parsed.data.count);
  const pool = await getPoolCount();
  return NextResponse.json({ assigned, pool });
}
