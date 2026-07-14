import { db } from "./supabase";
import { getSettings } from "./settings";
import { startOfLocalDayUtc } from "./sendWindow";
import { getAnalytics, getDailyTrend } from "./analytics";
import { writeBriefing } from "./ai";

/** Regenerate at most this often, so polling doesn't re-hit the model. */
const BRIEFING_TTL_MS = 2 * 60 * 60 * 1000;

export interface BriefingFacts {
  userName: string;
  sentToday: number;
  deliveredToday: number;
  openedToday: number;
  clickedToday: number;
  bouncedToday: number;
  openRate: number;
  clickRate: number;
  trend: "up" | "down" | "flat" | "new";
  standoutOpener: { name: string; opens: number } | null;
  poolAvailable: number;
}

async function countEventsSince(type: string, sinceIso: string): Promise<number> {
  const { count } = await db()
    .from("bn_email_events")
    .select("id", { count: "exact", head: true })
    .eq("type", type)
    .gte("occurred_at", sinceIso);
  return count ?? 0;
}

async function distinctLeadsSince(type: string, sinceIso: string): Promise<number> {
  const { data } = await db()
    .from("bn_email_events")
    .select("lead_id")
    .eq("type", type)
    .gte("occurred_at", sinceIso)
    .not("lead_id", "is", null)
    .limit(5000);
  return new Set((data ?? []).map((r) => r.lead_id as string)).size;
}

/** Everything the briefing may state — computed straight from the database. */
export async function gatherBriefingFacts(): Promise<BriefingFacts> {
  const settings = await getSettings();
  const dayStart = startOfLocalDayUtc(settings.sending_hours.tz);

  const [sentToday, deliveredToday, bouncedToday, openedToday, clickedToday, overall, trend] =
    await Promise.all([
      countEventsSince("sent", dayStart),
      countEventsSince("delivered", dayStart),
      countEventsSince("bounced", dayStart),
      distinctLeadsSince("opened", dayStart),
      distinctLeadsSince("clicked", dayStart),
      getAnalytics(null),
      getDailyTrend(14, null),
    ]);

  // Trend: opens-per-delivered over the last 7 days vs the 7 before.
  const last7 = trend.slice(-7);
  const prev7 = trend.slice(-14, -7);
  const rate = (pts: typeof trend) => {
    const d = pts.reduce((s, p) => s + p.delivered, 0);
    const o = pts.reduce((s, p) => s + p.opened, 0);
    return d > 0 ? o / d : 0;
  };
  const r1 = rate(prev7);
  const r2 = rate(last7);
  let trendDir: BriefingFacts["trend"];
  if (r1 === 0 && r2 === 0) trendDir = "new";
  else if (r2 > r1 * 1.05) trendDir = "up";
  else if (r2 < r1 * 0.95) trendDir = "down";
  else trendDir = "flat";

  // Standout: someone who opened repeatedly but never clicked — a warm lead
  // sitting on the fence.
  const { data: standoutRows } = await db()
    .from("bn_email_sequences")
    .select("open_count, bn_leads(bn_companies(name))")
    .gte("open_count", 3)
    .eq("click_count", 0)
    .order("open_count", { ascending: false })
    .limit(1);
  const standoutRow = (standoutRows ?? [])[0] as unknown as
    | { open_count: number; bn_leads: { bn_companies: { name: string } | null } | null }
    | undefined;
  const standoutOpener =
    standoutRow && standoutRow.bn_leads?.bn_companies
      ? { name: standoutRow.bn_leads.bn_companies.name, opens: Number(standoutRow.open_count) }
      : null;

  const { count: poolAvailable } = await db()
    .from("bn_leads")
    .select("id", { count: "exact", head: true })
    .is("campaign_id", null)
    .in("status", ["new", "queued"]);

  return {
    userName: settings.user_name,
    sentToday,
    deliveredToday,
    openedToday,
    clickedToday,
    bouncedToday,
    openRate: overall.openRate,
    clickRate: overall.clickRate,
    trend: trendDir,
    standoutOpener,
    poolAvailable: poolAvailable ?? 0,
  };
}

function factsToText(f: BriefingFacts): string {
  const lines = [
    `Naam eigenaar: ${f.userName}`,
    `Vandaag verstuurd: ${f.sentToday} e-mails`,
    `Afgeleverd: ${f.deliveredToday}`,
    `Bedrijven die openden vandaag: ${f.openedToday}`,
    `Bedrijven die op de Website Check klikten vandaag: ${f.clickedToday}`,
    `Bounces vandaag: ${f.bouncedToday}`,
    `Huidige open rate: ${f.openRate}%`,
    `Huidige klik-rate: ${f.clickRate}%`,
  ];
  if (f.trend === "up") lines.push("Open rate-trend: hoger dan de vorige periode");
  else if (f.trend === "down") lines.push("Open rate-trend: lager dan de vorige periode");
  else if (f.trend === "flat") lines.push("Open rate-trend: stabiel");
  if (f.standoutOpener) {
    lines.push(
      `Opvallend: ${f.standoutOpener.name} opende de e-mail ${f.standoutOpener.opens} keer maar klikte nog niet.`
    );
  }
  lines.push(`Leads beschikbaar in de pool: ${f.poolAvailable}`);
  // A hint for the recommendation; the model phrases it naturally.
  if (f.clickedToday > 0)
    lines.push(
      `Aanbeveling-hint: begin met de ${f.clickedToday} bedrijven die op de Website Check klikten — die zijn het warmst.`
    );
  else if (f.openedToday > 0)
    lines.push(
      `Aanbeveling-hint: volg de ${f.openedToday} bedrijven op die openden maar nog niet klikten.`
    );
  else if (f.sentToday === 0)
    lines.push(
      "Aanbeveling-hint: er ging vandaag nog niets uit — wijs leads toe aan een campagne of laat de motor draaien."
    );
  else lines.push("Aanbeveling-hint: blijf versturen en houd de eerste opens in de gaten.");
  return lines.join("\n");
}

/** Deterministic fallback so a briefing always renders, even if the model fails. */
function fallbackBriefing(f: BriefingFacts): string {
  const hour = new Date().getHours();
  const hi =
    hour < 6 ? "Goedenacht" : hour < 12 ? "Goedemorgen" : hour < 18 ? "Goedemiddag" : "Goedenavond";
  const parts = [`${hi} ${f.userName} 👋`];
  if (f.sentToday > 0) {
    parts.push(
      `Terwijl je weg was heb ik vandaag ${f.sentToday} e-mails verstuurd, waarvan er ${f.deliveredToday} netjes zijn afgeleverd.`
    );
  } else {
    parts.push("Er ging vandaag nog niets de deur uit — ik sta klaar zodra je leads aan een campagne toewijst.");
  }
  if (f.openedToday > 0)
    parts.push(
      `${f.openedToday} ${f.openedToday === 1 ? "bedrijf" : "bedrijven"} opende je e-mail${
        f.clickedToday > 0 ? ` en ${f.clickedToday} klikte(n) door naar de Website Check` : ""
      }.`
    );
  if (f.bouncedToday > 0)
    parts.push(`${f.bouncedToday} e-mail(s) bounceden; die adressen heb ik al op ongeldig gezet.`);
  if (f.standoutOpener)
    parts.push(
      `${f.standoutOpener.name} opende je e-mail ${f.standoutOpener.opens} keer maar klikte nog niet — die twijfelt misschien nog.`
    );
  parts.push(
    f.clickedToday > 0
      ? `Mijn advies: benader vandaag eerst de ${f.clickedToday} bedrijven die doorklikten.`
      : f.openedToday > 0
        ? `Mijn advies: volg de bedrijven op die openden maar nog niet klikten.`
        : "Mijn advies: laat de motor rustig doorwerken en houd de eerste opens in de gaten."
  );
  return parts.join(" ");
}

/**
 * Returns the current briefing, regenerating it (from real facts) only when the
 * cached one is older than the TTL. Always returns something — on a model error
 * it falls back to a deterministic version built from the same facts.
 */
export async function getBriefing(force = false): Promise<{ text: string; createdAt: string }> {
  if (!force) {
    const { data: latest } = await db()
      .from("bn_briefings")
      .select("text, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      latest &&
      Date.now() - new Date(latest.created_at as string).getTime() < BRIEFING_TTL_MS
    ) {
      return { text: latest.text as string, createdAt: latest.created_at as string };
    }
  }

  const facts = await gatherBriefingFacts();
  let text: string;
  try {
    text = await writeBriefing(factsToText(facts));
    if (text.length < 20) text = fallbackBriefing(facts);
  } catch (err) {
    console.error("briefing generation failed:", err);
    text = fallbackBriefing(facts);
  }

  const { data: inserted } = await db()
    .from("bn_briefings")
    .insert({ text, facts })
    .select("created_at")
    .single();
  return { text, createdAt: (inserted?.created_at as string) ?? new Date().toISOString() };
}
