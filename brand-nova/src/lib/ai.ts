import OpenAI from "openai";
import { z } from "zod";
import { env } from "./env";
import type { Insight, ReplyClassification } from "./types";

let client: OpenAI | null = null;

function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env.openaiApiKey });
  return client;
}

async function jsonCall<T>(
  model: string,
  system: string,
  user: string,
  schema: z.ZodType<T>,
  temperature: number
): Promise<T> {
  const res = await openai().chat.completions.create({
    model,
    temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const raw = res.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`model returned invalid JSON: ${raw.slice(0, 200)}`);
  }
  return schema.parse(parsed);
}

// ---------------------------------------------------------------------------
// Website analysis (cheap model, structured extraction, null-observation path)
// ---------------------------------------------------------------------------

const analysisSchema = z.object({
  what_they_do: z.string(),
  target_audience: z.string(),
  services: z.array(z.string()).max(8),
  usp: z.array(z.string()).max(6),
  trust_signals: z.array(z.string()).max(6),
  ctas: z.array(z.string()).max(6),
  tone: z.string(),
  industry: z.string(),
  observation: z.string().nullable(),
});

export type WebsiteAnalysisResult = z.infer<typeof analysisSchema>;

const ANALYSIS_SYSTEM = `Je analyseert de homepage-tekst van een bedrijfswebsite voor Brand Nova, een bureau dat een gratis Website Check aanbiedt.

Extraheer uitsluitend wat LETTERLIJK uit de aangeleverde tekst blijkt. Verzin niets. Als iets niet uit de tekst blijkt, laat het veld leeg of de array leeg.

Het veld "observation" is het belangrijkste: één concrete, specifieke observatie over een verbeterkans van deze website die BEWIJST dat de site echt bekeken is. Goede observaties benoemen iets specifieks van deze site (een ontbrekende call-to-action, een concrete tekst die onduidelijk is, een dienst die verstopt staat). Verboden: algemene feedback die op elke website past ("de site kan moderner", "SEO kan beter"), complimenten, en alles wat niet direct uit de aangeleverde tekst afleidbaar is.

HARDE REGEL: als je geen specifieke, verifieerbare observatie kunt maken uit deze tekst, retourneer "observation": null. Null is een goed antwoord; een generieke observatie is een fout antwoord.

"industry" is één korte branche-aanduiding in het Nederlands (bv. "bouw", "horeca", "advocatuur").

Antwoord uitsluitend met JSON volgens het gevraagde formaat.`;

export async function analyzeWebsiteText(
  companyName: string,
  homepageText: string
): Promise<WebsiteAnalysisResult> {
  return jsonCall(
    env.modelLight,
    ANALYSIS_SYSTEM,
    `Bedrijf: ${companyName}\n\nHomepage-tekst:\n"""\n${homepageText}\n"""\n\nGeef JSON met velden: what_they_do, target_audience, services, usp, trust_signals, ctas, tone, industry, observation.`,
    analysisSchema,
    0.2
  );
}

// ---------------------------------------------------------------------------
// Email writing (better model; insights injected as steering, not template)
// ---------------------------------------------------------------------------

const emailSchema = z.object({
  subject: z.string().min(3),
  body: z.string().min(40),
  strategy_tags: z.object({
    opener_style: z.string(),
    length_bucket: z.enum(["short", "medium", "long"]),
    observation_type: z.string(),
  }),
});

export type GeneratedEmail = z.infer<typeof emailSchema>;

const WRITER_SYSTEM = `Je schrijft outreach-e-mails namens Brand Nova. Brand Nova biedt een gratis Website Check aan; het ENIGE doel van elke mail is het bedrijf uitnodigen die gratis check te doen via de meegegeven link.

Stijlregels (hard):
- Schrijf in het Nederlands, alsof een mens het snel maar attent heeft getikt.
- Klink nooit geautomatiseerd of als AI. Geen "Ik hoop dat deze mail u goed bereikt".
- Geen nepcomplimenten, geen overdrijving, geen verkooppraat, verkoop géén websites.
- Gebruik de meegegeven website-observatie als natuurlijke aanleiding — verwijs er concreet naar, bewijs dat je de site bekeken hebt.
- Verzin NIETS over het bedrijf dat niet in de meegegeven gegevens staat.
- Kort en luchtig. Eén vraag of uitnodiging, geen opsommingen met voordelen.
- Toon: vriendelijk, professioneel, behulpzaam, nieuwsgierig, menselijk.
- De Website Check-link moet één keer natuurlijk in de tekst staan (platte URL is prima).
- Geen placeholders zoals [naam] — alles moet direct verzendbaar zijn.
- Onderteken met de meegegeven afzendernaam.

Bij een follow-up: schrijf iets VOLLEDIG nieuws. Herhaal geen enkele zin, geen enkele formulering en niet dezelfde invalshoek als eerdere mails. Een follow-up is kort, licht en zonder druk.

strategy_tags beschrijft je eigen keuzes: opener_style (bv. "question", "observation", "context"), length_bucket, observation_type (bv. "missing_cta", "unclear_copy", "hidden_service", "trust_gap", "other").

Antwoord uitsluitend met JSON: subject, body, strategy_tags.`;

export interface WriterInput {
  companyName: string;
  whatTheyDo: string;
  tone: string;
  observation: string;
  websiteCheckUrl: string;
  fromName: string;
  step: number;
  previousEmails: Array<{ subject: string; body: string }>;
  insights: Insight[];
}

export async function writeOutreachEmail(input: WriterInput): Promise<GeneratedEmail> {
  const insightLines = input.insights
    .filter((i) => i.sample_size >= 5)
    .slice(0, 8)
    .map(
      (i) =>
        `- ${i.dimension}=${i.key}: ${(i.warm_lead_rate * 100).toFixed(1)}% warm-lead-rate (n=${i.sample_size})`
    )
    .join("\n");

  const previous = input.previousEmails
    .map((e, i) => `--- Eerdere mail ${i + 1} ---\nOnderwerp: ${e.subject}\n${e.body}`)
    .join("\n\n");

  const user = [
    `Bedrijf: ${input.companyName}`,
    `Wat ze doen: ${input.whatTheyDo}`,
    `Toon van hun site: ${input.tone}`,
    `Concrete website-observatie (gebruik deze): ${input.observation}`,
    `Website Check-link: ${input.websiteCheckUrl}`,
    `Afzendernaam: ${input.fromName}`,
    input.step === 0
      ? `Dit is de EERSTE mail aan dit bedrijf.`
      : `Dit is FOLLOW-UP nummer ${input.step}. Eerdere mails staan hieronder; schrijf iets volledig nieuws.\n\n${previous}`,
    insightLines
      ? `Wat historisch het best werkt (richtinggevend, geen sjabloon — blijf gevarieerd):\n${insightLines}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return jsonCall(env.modelWriter, WRITER_SYSTEM, user, emailSchema, 0.8);
}

// ---------------------------------------------------------------------------
// Reply classification (cheap model, confidence-gated)
// ---------------------------------------------------------------------------

const classificationSchema = z.object({
  classification: z.enum([
    "interested",
    "question",
    "warm_lead",
    "meeting_request",
    "website_check_completed",
    "not_interested",
    "spam",
    "out_of_office",
  ]),
  confidence: z.number().min(0).max(1),
  question_summary: z.string().nullable(),
});

export interface ClassifiedReply {
  classification: ReplyClassification;
  confidence: number;
  questionSummary: string | null;
}

const CLASSIFIER_SYSTEM = `Je classificeert antwoorden op outreach-mails van Brand Nova (aanbieder van een gratis Website Check).

Categorieën:
- interested: positieve reactie, wil meer weten of staat open
- question: stelt een concrete vraag
- warm_lead: expliciete koopintentie of vraag om voorbeelden/meer informatie
- meeting_request: wil bellen/afspreken
- website_check_completed: geeft aan de Website Check te hebben ingevuld/gedaan
- not_interested: wijst af
- spam: automatische marketing/rommel, geen echt antwoord
- out_of_office: afwezigheidsbericht

confidence: hoe zeker je bent (0-1). Wees eerlijk laag bij twijfel of dubbelzinnigheid.
question_summary: als er een vraag in zit, een korte samenvatting daarvan, anders null.

Antwoord uitsluitend met JSON: classification, confidence, question_summary.`;

export async function classifyReply(
  originalEmail: string,
  replyText: string
): Promise<ClassifiedReply> {
  const result = await jsonCall(
    env.modelLight,
    CLASSIFIER_SYSTEM,
    `Onze oorspronkelijke mail:\n"""\n${originalEmail.slice(0, 2000)}\n"""\n\nHun antwoord:\n"""\n${replyText.slice(0, 4000)}\n"""`,
    classificationSchema,
    0
  );
  return {
    classification: result.classification,
    confidence: result.confidence,
    questionSummary: result.question_summary,
  };
}

// ---------------------------------------------------------------------------
// Auto-reply (grounded ONLY in the user-managed FAQ table)
// ---------------------------------------------------------------------------

const autoReplySchema = z.object({
  can_answer: z.boolean(),
  body: z.string().nullable(),
});

const AUTO_REPLY_SYSTEM = `Je beantwoordt namens Brand Nova een vraag van een prospect, kort en menselijk, in het Nederlands.

HARDE REGELS:
- Gebruik UITSLUITEND de meegegeven feitenlijst. Staat het antwoord daar niet in, zet dan can_answer op false en body op null.
- Nooit onderhandelen, nooit prijzen of maatwerk toezeggen, niets beloven of verzinnen.
- Geen verkooppraat; beantwoord de vraag en verwijs waar logisch vriendelijk naar de gratis Website Check.
- Onderteken met de meegegeven afzendernaam.

Antwoord uitsluitend met JSON: can_answer, body.`;

export async function writeAutoReply(input: {
  replyText: string;
  questionSummary: string;
  faq: Array<{ question: string; answer: string }>;
  websiteCheckUrl: string;
  fromName: string;
}): Promise<{ canAnswer: boolean; body: string | null }> {
  if (input.faq.length === 0) {
    return { canAnswer: false, body: null };
  }
  const facts = input.faq
    .map((f, i) => `${i + 1}. V: ${f.question}\n   A: ${f.answer}`)
    .join("\n");
  const result = await jsonCall(
    env.modelLight,
    AUTO_REPLY_SYSTEM,
    [
      `Feitenlijst (de enige toegestane kennis):\n${facts}`,
      `Website Check-link: ${input.websiteCheckUrl}`,
      `Afzendernaam: ${input.fromName}`,
      `Vraag (samengevat): ${input.questionSummary}`,
      `Volledige mail van de prospect:\n"""\n${input.replyText.slice(0, 3000)}\n"""`,
    ].join("\n\n"),
    autoReplySchema,
    0.4
  );
  return { canAnswer: result.can_answer && !!result.body, body: result.body };
}
