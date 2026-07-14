import { db } from "./supabase";
import { logActivity } from "./activity";
import type { Campaign, CampaignStatus } from "./types";

export async function listCampaigns(): Promise<Campaign[]> {
  const { data } = await db()
    .from("bn_campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Campaign[];
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const { data } = await db()
    .from("bn_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Campaign) ?? null;
}

export async function createCampaign(input: {
  name: string;
  description?: string;
  trackingEnabled?: boolean;
}): Promise<Campaign> {
  const { data, error } = await db()
    .from("bn_campaigns")
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      tracking_enabled: input.trackingEnabled ?? true,
      status: "active",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "campaign insert failed");
  await logActivity("system", `Nieuwe campagne aangemaakt: ${data.name}.`);
  return data as Campaign;
}

export async function updateCampaign(
  id: string,
  patch: Partial<{ name: string; description: string; status: CampaignStatus; tracking_enabled: boolean }>
): Promise<Campaign | null> {
  const { data } = await db()
    .from("bn_campaigns")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  return (data as Campaign) ?? null;
}

/**
 * Moves up to `count` leads from the shared pool (unassigned, still mailable)
 * into a campaign, oldest first. Returns how many were actually assigned.
 * Leads already in a campaign are never stolen; the rest stay in the pool.
 */
export async function assignLeadsToCampaign(
  campaignId: string,
  count: number
): Promise<number> {
  const take = Math.max(0, Math.min(count, 100000));
  if (take === 0) return 0;

  const { data: rows } = await db()
    .from("bn_leads")
    .select("id")
    .is("campaign_id", null)
    .in("status", ["new", "queued"])
    .order("created_at", { ascending: true })
    .limit(take);

  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length === 0) return 0;

  // Update in chunks so a very large assignment stays within safe query sizes.
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { error } = await db()
      .from("bn_leads")
      .update({ campaign_id: campaignId })
      .in("id", slice);
    if (error) throw new Error(error.message);
  }

  const campaign = await getCampaign(campaignId);
  await logActivity(
    "system",
    `${ids.length} leads toegewezen aan campagne ${campaign?.name ?? ""}.`.trim()
  );
  return ids.length;
}
