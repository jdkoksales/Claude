import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/resend";
import { fetchHomepage } from "@/lib/fetchHomepage";
import { analyzeWebsiteText, writeIntro } from "@/lib/ai";
import { assembleFirstEmail } from "@/lib/emailTemplate";
import { logActivity } from "@/lib/activity";
import { normalizeDomain, websiteUrlForDomain } from "@/lib/normalize";
import { groundingScore, MIN_GROUNDING_SCORE } from "@/lib/textGuards";

function keyMatches(key: string): boolean {
  const a = Buffer.from(key);
  const b = Buffer.from(env.cronSecret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Runs the real outreach pipeline (fetch homepage → analyze → write intro →
 * assemble the fixed template) for an arbitrary website, but delivers the
 * result to a chosen test inbox instead of a real lead. Nothing is written
 * to the leads/companies tables — this is a pure preview-and-send, useful to
 * show the operator exactly what a specific site would receive.
 */
export async function GET(request: NextRequest) {
  const sessionOk = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!sessionOk && !(key && keyMatches(key))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const to = z.string().email().safeParse(request.nextUrl.searchParams.get("to"));
  if (!to.success) {
    return NextResponse.json({ error: "geef ?to=<emailadres> mee" }, { status: 400 });
  }
  const domain = normalizeDomain(request.nextUrl.searchParams.get("url") ?? "");
  if (!domain) {
    return NextResponse.json({ error: "geef ?url=<website> mee" }, { status: 400 });
  }

  const settings = await getSettings();
  if (!settings.from_email || !settings.website_check_url) {
    return NextResponse.json(
      { error: "from_email of website_check_url is niet ingesteld" },
      { status: 400 }
    );
  }

  const dryRun = request.nextUrl.searchParams.get("dry") === "1";

  const page = await fetchHomepage(websiteUrlForDomain(domain));
  if (!page.ok) {
    return NextResponse.json(
      { domain, ok: false, stage: "fetch", error: page.error },
      { status: dryRun ? 200 : 502 }
    );
  }

  const companyName = page.title || domain;
  const analysis = await analyzeWebsiteText(companyName, page.text);

  let observation = analysis.observation;
  if (observation && groundingScore(observation, page.text) < MIN_GROUNDING_SCORE) {
    observation = null;
  }
  if (!observation || !analysis.positive) {
    return NextResponse.json(
      {
        domain,
        ok: false,
        stage: "no_observation",
        error:
          "geen bruikbare observatie voor deze site — de AI zou deze lead in het echt overslaan",
        analysis,
      },
      { status: 200 }
    );
  }

  if (dryRun) {
    return NextResponse.json({
      domain,
      ok: true,
      stage: "analyzed",
      companyName,
      positive: analysis.positive,
      observation,
    });
  }

  const intro = await writeIntro({
    companyName,
    whatTheyDo: analysis.what_they_do,
    tone: analysis.tone,
    industry: analysis.industry,
    targetAudience: analysis.target_audience,
    services: analysis.services,
    usp: analysis.usp,
    positive: analysis.positive,
    observation,
    step: 0,
    previousIntros: [],
    insights: [],
  });

  const { subject, body, html } = assembleFirstEmail({
    firstName: analysis.contact_first_name,
    intro: intro.intro,
    websiteCheckUrl: settings.website_check_url,
  });

  const testSubject = `[TEST voor ${domain}] ${subject}`;
  const result = await sendEmail({
    to: to.data,
    subject: testSubject,
    body,
    html,
    fromName: settings.from_name,
    fromEmail: settings.from_email,
  });

  if (result.ok) {
    await logActivity(
      "system",
      `Testmail voor ${domain} verstuurd naar ${to.data} (niet aan een echte lead).`
    );
  }

  return NextResponse.json({
    ...result,
    domain,
    companyName,
    positive: analysis.positive,
    observation,
    subject,
    body,
  });
}
