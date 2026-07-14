import { db } from "./supabase";
import { logActivity } from "./activity";
import { analyzeWebsiteText } from "./ai";
import { fetchHomepage } from "./fetchHomepage";
import { groundingScore, MIN_GROUNDING_SCORE } from "./textGuards";

/** Bump to force re-analysis after prompt/model upgrades. */
export const ANALYSIS_VERSION = 3;

interface PendingCompany {
  id: string;
  name: string;
  website_url: string;
}

/** Ids of campaigns that are currently sending. */
export async function activeCampaignIds(): Promise<string[]> {
  const { data } = await db().from("bn_campaigns").select("id").eq("status", "active");
  return (data ?? []).map((r) => r.id as string);
}

/**
 * Companies still to analyze for the given active campaigns — i.e. leads that
 * are assigned to one of those campaigns and haven't been analyzed yet
 * (status 'new'). A 'new' lead is by definition one that hasn't been through
 * analysis, so this is exactly the work-to-do set. Sending only happens from
 * campaigns, so we never spend analysis on unassigned pool leads.
 */
async function analysisCandidates(
  limit: number,
  activeIds: string[]
): Promise<PendingCompany[]> {
  if (limit <= 0 || activeIds.length === 0) return [];
  const { data, error } = await db()
    .from("bn_leads")
    .select("bn_companies(id, name, website_url)")
    .in("campaign_id", activeIds)
    .eq("status", "new")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`analysis candidates query failed: ${error.message}`);
  const out: PendingCompany[] = [];
  for (const row of data ?? []) {
    const c = row.bn_companies as unknown as PendingCompany | null;
    if (c) out.push(c);
  }
  return out;
}

/** Leads analyzed and ready to send within the active campaigns. */
async function queuedLeadCount(activeIds: string[]): Promise<number> {
  if (activeIds.length === 0) return 0;
  const { count } = await db()
    .from("bn_leads")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued")
    .in("campaign_id", activeIds);
  return count ?? 0;
}

/**
 * Just-in-time analysis, scoped to active campaigns. Analyzes companies ONE AT
 * A TIME, only until there are `target` leads ready to send (status `queued`)
 * inside an active campaign, then stops — so the AI prepares exactly the
 * lead(s) the next send needs instead of building a huge backlog, and never
 * touches the unassigned pool. Because many sites yield no usable observation,
 * it may analyze several companies to surface one good lead; `maxToAnalyze`
 * bounds the work (and OpenAI spend) per tick, continuing next tick.
 *
 * Guardrails (hard, not prompt-based):
 * - unreachable/thin sites → status `unreachable`, no email ever drafted
 * - model returns observation=null → status `no_observation`, lead skipped
 * - observation fails the grounding check against the real page text →
 *   discarded, treated as `no_observation`.
 */
export async function ensureQueuedLeads(
  target: number,
  maxToAnalyze: number
): Promise<number> {
  if (target <= 0 || maxToAnalyze <= 0) return 0;

  const activeIds = await activeCampaignIds();
  if (activeIds.length === 0) return 0;

  let ready = await queuedLeadCount(activeIds);
  if (ready >= target) return 0;

  const candidates = await analysisCandidates(maxToAnalyze, activeIds);
  let analyzed = 0;
  for (const company of candidates) {
    if (ready >= target) break;
    const usable = await analyzeCompany(company);
    analyzed++;
    if (usable) ready++;
  }
  return analyzed;
}

/**
 * Ensures a company has a current analysis, running one on the spot if
 * needed. Used by the preview flow; returns true when the lead ended up
 * with a usable observation (status queued).
 */
export async function ensureAnalysisForCompany(companyId: string): Promise<boolean> {
  const { data: existing } = await db()
    .from("bn_website_analyses")
    .select("status, improvement_observation, analysis_version")
    .eq("company_id", companyId)
    .maybeSingle();
  if (
    existing &&
    existing.status === "done" &&
    existing.improvement_observation &&
    existing.analysis_version === ANALYSIS_VERSION
  ) {
    return true;
  }
  if (existing && ["unreachable", "no_observation"].includes(existing.status as string)) {
    return false; // deliberate skip — don't retry in a preview
  }
  const { data: company } = await db()
    .from("bn_companies")
    .select("id, name, website_url")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return false;
  await analyzeCompany(company as unknown as PendingCompany);
  const { data: after } = await db()
    .from("bn_website_analyses")
    .select("status, improvement_observation")
    .eq("company_id", companyId)
    .maybeSingle();
  return after?.status === "done" && !!after.improvement_observation;
}

async function analyzeCompany(company: PendingCompany): Promise<boolean> {
  await logActivity("analyzing", `Website van ${company.name} analyseren…`, {
    companyId: company.id,
  });

  const upsertBase = { company_id: company.id, analysis_version: ANALYSIS_VERSION };

  const page = await fetchHomepage(company.website_url);
  if (!page.ok) {
    await db()
      .from("bn_website_analyses")
      .upsert(
        { ...upsertBase, status: "unreachable", fetched_at: new Date().toISOString() },
        { onConflict: "company_id" }
      );
    await markLeadSkipped(company.id, `website onbereikbaar (${page.error})`);
    return false;
  }

  let analysis;
  try {
    analysis = await analyzeWebsiteText(company.name, page.text);
  } catch (err) {
    await db()
      .from("bn_website_analyses")
      .upsert(
        { ...upsertBase, status: "failed", fetched_at: new Date().toISOString() },
        { onConflict: "company_id" }
      );
    console.error(`analysis failed for ${company.name}:`, err);
    return false; // stays retryable: `failed` rows are not treated as cached
  }

  // Grounding guard: the observation must be traceable to the real page text.
  let observation = analysis.observation;
  if (observation && groundingScore(observation, page.text) < MIN_GROUNDING_SCORE) {
    observation = null;
  }

  await db()
    .from("bn_website_analyses")
    .upsert(
      {
        ...upsertBase,
        raw_homepage_text: page.text,
        fetched_at: new Date().toISOString(),
        what_they_do: analysis.what_they_do,
        target_audience: analysis.target_audience,
        services: analysis.services,
        usp: analysis.usp,
        trust_signals: analysis.trust_signals,
        ctas: analysis.ctas,
        tone: analysis.tone,
        improvement_observation: observation,
        positive: analysis.positive,
        contact_first_name: analysis.contact_first_name,
        status: observation ? "done" : "no_observation",
      },
      { onConflict: "company_id" }
    );

  if (analysis.industry) {
    await db()
      .from("bn_companies")
      .update({ industry: analysis.industry })
      .eq("id", company.id);
  }

  if (observation) {
    // Ready for outreach.
    await db()
      .from("bn_leads")
      .update({ status: "queued" })
      .eq("company_id", company.id)
      .eq("status", "new");
    await logActivity(
      "analyzing",
      `Analyse van ${company.name} afgerond — concrete invalshoek voor outreach gevonden.`,
      { companyId: company.id }
    );
    return true;
  }

  await markLeadSkipped(
    company.id,
    "geen specifieke, verifieerbare website-observatie — ik weiger een generieke mail te sturen"
  );
  return false;
}

async function markLeadSkipped(companyId: string, reason: string): Promise<void> {
  await db()
    .from("bn_leads")
    .update({ status: "skipped" })
    .eq("company_id", companyId)
    .in("status", ["new", "queued"]);
  await logActivity("system", `Bedrijf overgeslagen: ${reason}.`, {
    companyId,
    metadata: { reason },
  });
}
