import { db } from "./supabase";
import { logActivity } from "./activity";
import { WARM_STATUSES } from "./types";

interface SentEmailRow {
  lead_id: string;
  strategy_tags: Record<string, string>;
  bn_leads: {
    status: string;
    bn_companies: { industry: string | null };
  };
}

function subjectLengthBucket(subject: string): string {
  if (subject.length <= 30) return "short";
  if (subject.length <= 50) return "medium";
  return "long";
}

/**
 * Daily learning aggregation: warm-lead rate per strategy dimension, computed
 * from what was actually sent and what actually converted. Pure SQL + counting
 * — no AI call. The writer reads the resulting bn_insights rows as steering
 * context, which closes the "gets better every day" loop.
 */
export async function aggregateInsights(): Promise<number> {
  const stats = new Map<string, { warm: number; total: number }>();
  const bump = (dimension: string, key: string, warm: boolean) => {
    if (!key) return;
    const mapKey = `${dimension}|${key}`;
    const entry = stats.get(mapKey) ?? { warm: 0, total: 0 };
    entry.total++;
    if (warm) entry.warm++;
    stats.set(mapKey, entry);
  };

  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await db()
      .from("bn_email_sequences")
      .select(
        "lead_id, subject, strategy_tags, bn_leads(status, bn_companies(industry))"
      )
      .eq("status", "sent")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`insight aggregation query failed: ${error.message}`);
    const rows = (data ?? []) as unknown as Array<SentEmailRow & { subject: string }>;
    if (rows.length === 0) break;

    for (const row of rows) {
      const warm = WARM_STATUSES.includes(
        row.bn_leads.status as (typeof WARM_STATUSES)[number]
      );
      const tags = row.strategy_tags ?? {};
      bump("opener", tags.opener_style ?? "", warm);
      bump("length_bucket", tags.length_bucket ?? "", warm);
      bump("observation_type", tags.observation_type ?? "", warm);
      bump("send_hour", tags.send_hour ?? "", warm);
      bump("step", tags.step ?? "", warm);
      bump("subject_length", subjectLengthBucket(row.subject), warm);
      bump("industry", row.bn_leads.bn_companies?.industry ?? "", warm);
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  const upserts = Array.from(stats.entries()).map(([mapKey, entry]) => {
    const sep = mapKey.indexOf("|");
    const dimension = mapKey.slice(0, sep);
    const key = mapKey.slice(sep + 1);
    return {
      dimension,
      key,
      warm_lead_rate: entry.total > 0 ? entry.warm / entry.total : 0,
      sample_size: entry.total,
      updated_at: new Date().toISOString(),
    };
  });

  for (let i = 0; i < upserts.length; i += 200) {
    const chunk = upserts.slice(i, i + 200);
    const { error } = await db()
      .from("bn_insights")
      .upsert(chunk, { onConflict: "dimension,key" });
    if (error) throw new Error(`insight upsert failed: ${error.message}`);
  }

  if (upserts.length > 0) {
    await logActivity(
      "learning",
      `Geleerd van ${upserts.length} strategiesignalen uit eerdere campagnes — nieuwe mails gebruiken wat werkte.`
    );
  }
  return upserts.length;
}
