import OpenAI from "openai";
import { z } from "zod";
import { env } from "./env";
import type { Insight, ReplyClassification } from "./types";

let client: OpenAI | null = null;

function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env.openaiApiKey });
  return client;
}

// The third type param is the schema's INPUT type. Fixing it to `unknown`
// lets schemas that use z.preprocess (which accept unknown input) still infer
// their OUTPUT type T cleanly at the call site.
async function jsonCall<T>(
  model: string,
  system: string,
  user: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
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

// The model is not perfectly consistent: array fields sometimes come back as
// a single string (or null), and string fields sometimes as null. These
// coercions make parsing tolerant instead of throwing away a whole analysis
// over a formatting quirk.
const flexibleString = z.preprocess(
  (v) => (v == null ? "" : typeof v === "string" ? v : String(v)),
  z.string()
);
const flexibleStringArray = (max: number) =>
  z.preprocess((v) => {
    if (v == null) return [];
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    if (typeof v === "string") return v.trim() ? [v.trim()] : [];
    return [];
  }, z.array(z.string()).max(max));

const analysisSchema = z.object({
  what_they_do: flexibleString,
  target_audience: flexibleString,
  services: flexibleStringArray(8),
  usp: flexibleStringArray(6),
  trust_signals: flexibleStringArray(6),
  ctas: flexibleStringArray(6),
  tone: flexibleString,
  industry: flexibleString,
  observation: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
    z.string().nullable()
  ),
});

export type WebsiteAnalysisResult = z.infer<typeof analysisSchema>;

const ANALYSIS_SYSTEM = `Je analyseert de homepage-tekst van een bedrijfswebsite voor Brand Nova, een bureau dat een gratis Website Check aanbiedt.

Extraheer uitsluitend wat LETTERLIJK uit de aangeleverde tekst blijkt. Verzin niets. Als iets niet uit de tekst blijkt, laat het veld leeg of de array leeg.

Het veld "observation" is het belangrijkste: één concrete, specifieke observatie die BEWIJST dat je de site echt bekeken hebt en die een natuurlijke aanleiding vormt voor de gratis Website Check. Verwijs naar iets herkenbaars van DEZE site.

Een goede observatie gaat over iets wat je op deze specifieke pagina wél of juist NIET ziet, bijvoorbeeld:
- een dienst of aanbod dat genoemd wordt maar niet verder uitgelegd of moeilijk vindbaar is;
- geen zichtbare prijzen, tarieven of pakketten terwijl bezoekers daar wel naar zoeken;
- geen duidelijke manier om te reserveren, contact op te nemen of een offerte aan te vragen;
- een homepage die veel over het bedrijf zelf vertelt maar weinig een bezoeker uitnodigt tot een volgende stap;
- een onduidelijke of ontbrekende call-to-action.

Verwijs concreet naar wat het bedrijf doet (dat blijkt uit de tekst) zodat het persoonlijk is. Bijna elke kleine bedrijfssite heeft zo'n concrete verbeterkans — zoek er één.

Verboden: algemene feedback die op elke website past zonder iets specifieks van dit bedrijf te noemen ("de site kan moderner", "SEO kan beter", "responsive design"), complimenten, en verzonnen feiten over het bedrijf die niet uit de tekst blijken.

Retourneer "observation": null ALLEEN als de aangeleverde tekst echt te leeg of onleesbaar is om er iets zinnigs over te zeggen. In vrijwel alle andere gevallen maak je een concrete observatie.

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

// strategy_tags are for learning only and are normalized in code below, so
// the schema stays permissive — a formatting quirk there must never block an
// otherwise-good email.
const emailSchema = z.object({
  subject: z.string().min(3),
  body: z.string().min(40),
  strategy_tags: z.record(z.string(), z.unknown()).optional(),
});

export interface GeneratedEmail {
  subject: string;
  body: string;
  strategy_tags: {
    opener_style: string;
    length_bucket: "short" | "medium" | "long";
    observation_type: string;
  };
}

function normalizeStrategyTags(
  raw: Record<string, unknown> | undefined
): GeneratedEmail["strategy_tags"] {
  const tags = raw ?? {};
  const bucket = tags.length_bucket;
  return {
    opener_style: typeof tags.opener_style === "string" ? tags.opener_style : "",
    length_bucket:
      bucket === "short" || bucket === "medium" || bucket === "long"
        ? bucket
        : "medium",
    observation_type:
      typeof tags.observation_type === "string" ? tags.observation_type : "",
  };
}

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

  const parsed = await jsonCall(env.modelWriter, WRITER_SYSTEM, user, emailSchema, 0.8);
  return {
    subject: parsed.subject,
    body: parsed.body,
    strategy_tags: normalizeStrategyTags(parsed.strategy_tags),
  };
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
