import { db } from "./supabase";

export interface AnalyticsCounts {
  sent: number;
  delivered: number;
  opened: number;
  openEvents: number;
  clicked: number;
  clickEvents: number;
  bounced: number;
  complained: number;
}

export interface Analytics extends AnalyticsCounts {
  /** All rates are percentages (e.g. 34.5). */
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Turns raw counts into the rate percentages the UI shows. */
export function withRates(c: AnalyticsCounts): Analytics {
  const base = c.delivered > 0 ? c.delivered : c.sent; // can't open an undelivered mail
  const pct = (n: number) => (base > 0 ? round1((n / base) * 100) : 0);
  return {
    ...c,
    deliveryRate: c.sent > 0 ? round1((c.delivered / c.sent) * 100) : 0,
    openRate: pct(c.opened),
    clickRate: pct(c.clicked),
    bounceRate: c.sent > 0 ? round1((c.bounced / c.sent) * 100) : 0,
  };
}

function coerceCounts(raw: unknown): AnalyticsCounts {
  const o = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => Number(v ?? 0) || 0;
  return {
    sent: n(o.sent),
    delivered: n(o.delivered),
    opened: n(o.opened),
    openEvents: n(o.openEvents),
    clicked: n(o.clicked),
    clickEvents: n(o.clickEvents),
    bounced: n(o.bounced),
    complained: n(o.complained),
  };
}

/** Aggregate analytics for one campaign, or everything when campaignId is null. */
export async function getAnalytics(
  campaignId: string | null = null
): Promise<Analytics> {
  const { data } = await db().rpc("bn_analytics", { p_campaign: campaignId });
  return withRates(coerceCounts(data));
}

export interface TrendPoint {
  day: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
}

/** Gap-filled daily event counts for the trend chart. */
export async function getDailyTrend(
  days = 14,
  campaignId: string | null = null
): Promise<TrendPoint[]> {
  const { data } = await db().rpc("bn_daily_trend", {
    p_days: days,
    p_campaign: campaignId,
  });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    day: String(r.day),
    sent: Number(r.sent ?? 0),
    delivered: Number(r.delivered ?? 0),
    opened: Number(r.opened ?? 0),
    clicked: Number(r.clicked ?? 0),
  }));
}

export interface CampaignStatRow extends Analytics {
  campaignId: string;
  name: string;
  description: string;
  status: string;
  trackingEnabled: boolean;
  createdAt: string;
  assigned: number;
}

/** Every campaign with its rolled-up stats, newest first — the overview table. */
export async function listCampaignStats(): Promise<CampaignStatRow[]> {
  const { data } = await db()
    .from("bn_campaign_stats")
    .select("*")
    .order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const counts = coerceCounts({
      sent: r.sent,
      delivered: r.delivered,
      opened: r.opened,
      openEvents: r.open_events,
      clicked: r.clicked,
      clickEvents: r.click_events,
      bounced: r.bounced,
      complained: r.complained,
    });
    return {
      campaignId: String(r.campaign_id),
      name: String(r.name),
      description: String(r.description ?? ""),
      status: String(r.status),
      trackingEnabled: Boolean(r.tracking_enabled),
      createdAt: String(r.created_at),
      assigned: Number(r.assigned ?? 0),
      ...withRates(counts),
    };
  });
}

/** Leads available in the pool (not yet assigned to any campaign). */
export async function getPoolCount(): Promise<number> {
  const { count } = await db()
    .from("bn_leads")
    .select("id", { count: "exact", head: true })
    .is("campaign_id", null)
    .in("status", ["new", "queued"]);
  return count ?? 0;
}

export type DrillMetric =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained";

export interface DrillLead {
  leadId: string;
  companyId: string;
  company: string;
  email: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  openCount: number;
  lastOpenAt: string | null;
  clickCount: number;
  lastClickAt: string | null;
}

/**
 * The lead list behind a clickable KPI ("who opened?", "who bounced?").
 * Deduplicated to one row per lead, most recent activity first.
 */
export async function leadsForMetric(
  metric: DrillMetric,
  campaignId: string | null = null,
  limit = 200
): Promise<DrillLead[]> {
  let q = db()
    .from("bn_email_sequences")
    .select(
      "lead_id, status, sent_at, delivered_at, open_count, last_open_at, click_count, last_click_at, complained_at, bn_leads(status, bn_companies(id, name, email))"
    );

  if (campaignId) q = q.eq("campaign_id", campaignId);

  switch (metric) {
    case "sent":
      q = q.eq("status", "sent");
      break;
    case "delivered":
      q = q.not("delivered_at", "is", null);
      break;
    case "opened":
      q = q.gt("open_count", 0);
      break;
    case "clicked":
      q = q.gt("click_count", 0);
      break;
    case "bounced":
      q = q.eq("status", "bounced");
      break;
    case "complained":
      q = q.not("complained_at", "is", null);
      break;
  }

  const orderCol =
    metric === "clicked"
      ? "last_click_at"
      : metric === "opened"
        ? "last_open_at"
        : "sent_at";
  const { data } = await q.order(orderCol, { ascending: false, nullsFirst: false }).limit(limit * 2);

  const seen = new Set<string>();
  const out: DrillLead[] = [];
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const leadId = String(r.lead_id);
    if (seen.has(leadId)) continue;
    seen.add(leadId);
    const lead = r.bn_leads as unknown as {
      status: string;
      bn_companies: { id: string; name: string; email: string } | null;
    } | null;
    const company = lead?.bn_companies;
    out.push({
      leadId,
      companyId: company?.id ?? "",
      company: company?.name ?? "Onbekend bedrijf",
      email: company?.email ?? "",
      status: lead?.status ?? String(r.status),
      sentAt: (r.sent_at as string) ?? null,
      deliveredAt: (r.delivered_at as string) ?? null,
      openCount: Number(r.open_count ?? 0),
      lastOpenAt: (r.last_open_at as string) ?? null,
      clickCount: Number(r.click_count ?? 0),
      lastClickAt: (r.last_click_at as string) ?? null,
    });
    if (out.length >= limit) break;
  }
  return out;
}
