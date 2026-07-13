import { db } from "./supabase";
import { getSettings } from "./settings";
import { startOfLocalDayUtc } from "./sendWindow";
import { WARM_STATUSES, type ActivityEntry } from "./types";

export interface BriefingStats {
  userName: string;
  analyzedLast24h: number;
  sentLast24h: number;
  warmLeadsLast24h: number;
  warmLeadsToday: number;
  meetingsLast24h: number;
  checksCompletedLast24h: number;
  dailyGoal: number;
  warmLeadsTotal: number;
  companiesTotal: number;
  inQueue: number;
  needsAttention: number;
  currentTask: string | null;
  paused: boolean;
  deliverability: {
    sentLast7d: number;
    bouncedLast7d: number;
    complaintsLast7d: number;
    /** Complaint rate as a percentage of sent, e.g. 0.3 = 0.3%. */
    complaintRatePct: number;
  };
}

/**
 * Everything the morning briefing and live counters need, computed straight
 * from the database. Deterministic template data — the numbers the employee
 * "says" are always the numbers that are true.
 */
export async function getBriefingStats(): Promise<BriefingStats> {
  const settings = await getSettings();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dayStart = startOfLocalDayUtc(settings.sending_hours.tz);
  const client = db();

  const [
    analyzed,
    sent,
    warm24,
    warmToday,
    meetings,
    checks,
    warmTotal,
    companies,
    queue,
    attention,
    lastActivity,
    sent7d,
    bounced7d,
    complaints7d,
  ] = await Promise.all([
    client
      .from("bn_website_analyses")
      .select("id", { count: "exact", head: true })
      .gte("fetched_at", since24h),
    client
      .from("bn_email_sequences")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", since24h),
    client
      .from("bn_leads")
      .select("id", { count: "exact", head: true })
      .gte("warm_since", since24h),
    client
      .from("bn_leads")
      .select("id", { count: "exact", head: true })
      .gte("warm_since", dayStart),
    client
      .from("bn_leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "meeting_request")
      .gte("warm_since", since24h),
    client
      .from("bn_leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "website_check_completed")
      .gte("warm_since", since24h),
    client
      .from("bn_leads")
      .select("id", { count: "exact", head: true })
      .in("status", WARM_STATUSES),
    client.from("bn_companies").select("id", { count: "exact", head: true }),
    client
      .from("bn_leads")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "queued"]),
    client
      .from("bn_replies")
      .select("id", { count: "exact", head: true })
      .eq("needs_human", true),
    client
      .from("bn_activity_log")
      .select("message, occurred_at")
      .in("type", ["analyzing", "writing", "sending", "reading", "learning", "followup"])
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("bn_email_sequences")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", since7d),
    client
      .from("bn_leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "bounced"),
    client
      .from("bn_unsubscribes")
      .select("email", { count: "exact", head: true })
      .eq("reason", "complaint")
      .gte("unsubscribed_at", since7d),
  ]);

  const sentLast7d = sent7d.count ?? 0;
  const complaintsLast7d = complaints7d.count ?? 0;

  // Only present a task as "currently doing" if it's actually fresh —
  // the employee must never appear busy with something from hours ago.
  const freshCutoff = Date.now() - 15 * 60 * 1000;
  const currentTask =
    lastActivity.data &&
    new Date(lastActivity.data.occurred_at as string).getTime() > freshCutoff
      ? (lastActivity.data.message as string)
      : null;

  return {
    userName: settings.user_name,
    analyzedLast24h: analyzed.count ?? 0,
    sentLast24h: sent.count ?? 0,
    warmLeadsLast24h: warm24.count ?? 0,
    warmLeadsToday: warmToday.count ?? 0,
    meetingsLast24h: meetings.count ?? 0,
    checksCompletedLast24h: checks.count ?? 0,
    dailyGoal: settings.daily_warm_lead_goal,
    warmLeadsTotal: warmTotal.count ?? 0,
    companiesTotal: companies.count ?? 0,
    inQueue: queue.count ?? 0,
    needsAttention: attention.count ?? 0,
    currentTask,
    paused: settings.paused,
    deliverability: {
      sentLast7d,
      bouncedLast7d: bounced7d.count ?? 0,
      complaintsLast7d,
      complaintRatePct:
        sentLast7d > 0 ? (complaintsLast7d / sentLast7d) * 100 : 0,
    },
  };
}

export async function getActivityFeed(
  afterId: number | null,
  limit = 40
): Promise<ActivityEntry[]> {
  let query = db()
    .from("bn_activity_log")
    .select("*")
    .order("id", { ascending: false })
    .limit(limit);
  if (afterId !== null) {
    query = query.gt("id", afterId);
  }
  const { data } = await query;
  return ((data ?? []) as ActivityEntry[]).reverse();
}
