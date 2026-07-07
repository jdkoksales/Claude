import { db } from "./supabase";
import { logActivity } from "./activity";
import { analyzeWebsiteText } from "./ai";
import { fetchHomepage } from "./fetchHomepage";
import { groundingScore, MIN_GROUNDING_SCORE } from "./textGuards";

/** Bump to force re-analysis after prompt/model upgrades. */
export const ANALYSIS_VERSION = 2;

/** Cache TTL: an analysis older than this may be refreshed. */
const ANALYSIS_TTL_DAYS = 90;

interface PendingCompany {
  id: string;
  name: string;
  website_url: string;
}

/**
 * Analyzes up to `limit` companies that don't have a current cached analysis.
 * Cache-first: a company with a `done` analysis at the current version inside
 * the TTL is never re-fetched and never costs another AI call.
 *
 * Guardrails (hard, not prompt-based):
 * - unreachable/thin sites → status `unreachable`, no email ever drafted
 * - model returns observation=null → status `no_observation`, lead skipped
 * - observation fails the grounding check against the real page text →
 *   discarded, treated as `no_observation` (we never "retry until it
 *   hallucinates something better")
 */
export async function processAnalysisBatch(limit: number): Promise<number> {
  // Companies with no analysis row yet.
  const { data: companies, error } = await db()
    .from("bn_companies")
    .select("id, name, website_url, bn_website_analyses(id)")
    .is("bn_website_analyses", null)
    .limit(limit);
  if (error) throw new Error(`analysis candidates query failed: ${error.message}`);

  const candidates: PendingCompany[] = (companies ?? []) as unknown as PendingCompany[];

  // Retry failed analyses (transient AI/JSON errors) with remaining budget.
  if (candidates.length < limit) {
    const { data: failed } = await db()
      .from("bn_website_analyses")
      .select("company_id, bn_companies(id, name, website_url)")
      .eq("status", "failed")
      .limit(limit - candidates.length);
    for (const row of failed ?? []) {
      const c = row.bn_companies as unknown as PendingCompany | null;
      if (c) candidates.push(c);
    }
  }

  // Also refresh stale analyses if there is budget left in this batch.
  if (candidates.length < limit) {
    const staleBefore = new Date(
      Date.now() - ANALYSIS_TTL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data: stale } = await db()
      .from("bn_website_analyses")
      .select("company_id, bn_companies(id, name, website_url)")
      .or(`analysis_version.lt.${ANALYSIS_VERSION},fetched_at.lt.${staleBefore}`)
      .eq("status", "done")
      .limit(limit - candidates.length);
    for (const row of stale ?? []) {
      const c = row.bn_companies as unknown as PendingCompany | null;
      if (c) candidates.push(c);
    }
  }

  let processed = 0;
  for (const company of candidates) {
    await analyzeCompany(company);
    processed++;
  }
  return processed;
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

async function analyzeCompany(company: PendingCompany): Promise<void> {
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
    return;
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
    return; // stays retryable: `failed` rows are not treated as cached
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
  } else {
    await markLeadSkipped(
      company.id,
      "geen specifieke, verifieerbare website-observatie — ik weiger een generieke mail te sturen"
    );
  }
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
