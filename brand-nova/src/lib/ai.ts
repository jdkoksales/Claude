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

const nullableString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
  z.string().nullable()
);

const analysisSchema = z.object({
  what_they_do: flexibleString,
  target_audience: flexibleString,
  services: flexibleStringArray(8),
  usp: flexibleStringArray(6),
  trust_signals: flexibleStringArray(6),
  ctas: flexibleStringArray(6),
  tone: flexibleString,
  industry: flexibleString,
  positive: nullableString,
  observation: nullableString,
  contact_first_name: nullableString,
});

export type WebsiteAnalysisResult = z.infer<typeof analysisSchema>;

const ANALYSIS_SYSTEM = `Je analyseert de homepage-tekst van een bedrijfswebsite voor Brand Nova, een bureau dat een gratis Website Check aanbiedt.

Extraheer uitsluitend wat LETTERLIJK uit de aangeleverde tekst blijkt. Verzin niets. Als iets niet uit de tekst blijkt, laat het veld leeg of de array leeg.

Twee velden zijn het belangrijkst, en ze horen bij elkaar (eerst positief, dan verbeterpunt):

"positive": één oprecht, specifiek positief punt over DEZE website of dit bedrijf, herkenbaar uit de tekst (bv. een sterk verhaal, een duidelijke dienst, een professionele uitstraling, een bijzondere aanpak). Geen holle complimenten die overal op passen.

"observation": precies één concreet, specifiek verbeterpunt dat uniek is voor DEZE site en dat BEWIJST dat je de site echt bekeken hebt. In de stijl van Brand Nova gaat dit vaak over iets goeds dat te weinig opvalt of pas laat zichtbaar wordt, bijvoorbeeld:
- een sterk verhaal of persoonlijke aanpak die pas op 'Over ons' of onderaan zichtbaar wordt in plaats van prominent op de homepage;
- een dienst/aanbod dat genoemd wordt maar niet opvalt of niet wordt uitgelegd;
- geen zichtbare prijzen of geen duidelijke manier om contact op te nemen / een afspraak te maken;
- een onduidelijke of ontbrekende call-to-action.
Formuleer het vriendelijk en constructief, niet als kritiek.

Verboden: algemene feedback die op elke website past ("de site kan moderner", "SEO kan beter", "responsive design"), en verzonnen feiten die niet uit de tekst blijken.

"contact_first_name": de voornaam van de eigenaar/contactpersoon ALS die duidelijk zichtbaar op de site staat (bv. "Hoi, ik ben Hester" of een team met namen). Bij twijfel of als er geen duidelijke persoonsnaam is: null. Nooit gokken.

Retourneer "positive" en "observation" alleen null als de tekst echt te leeg of onleesbaar is. In vrijwel alle andere gevallen vul je ze allebei.

"industry" is één korte branche-aanduiding in het Nederlands (bv. "bouw", "horeca", "advocatuur").

Antwoord uitsluitend met JSON volgens het gevraagde formaat.`;

export async function analyzeWebsiteText(
  companyName: string,
  homepageText: string
): Promise<WebsiteAnalysisResult> {
  return jsonCall(
    env.modelLight,
    ANALYSIS_SYSTEM,
    `Bedrijf: ${companyName}\n\nHomepage-tekst:\n"""\n${homepageText}\n"""\n\nGeef JSON met velden: what_they_do, target_audience, services, usp, trust_signals, ctas, tone, industry, positive, observation, contact_first_name.`,
    analysisSchema,
    0.2
  );
}

// ---------------------------------------------------------------------------
// Email writing (better model; insights injected as steering, not template)
// ---------------------------------------------------------------------------

// The AI writes ONLY the personal top block (positive + one improvement).
// Greeting, opener, the Website Check offer and the closing are fixed proven
// copy assembled in emailTemplate.ts. strategy_tags are learning metadata,
// normalized in code so a formatting quirk can never block a good email.
const introSchema = z.object({
  intro: z.string().min(20),
  strategy_tags: z.unknown().optional(),
});

export interface GeneratedIntro {
  intro: string;
  strategy_tags: {
    opener_style: string;
    length_bucket: "short" | "medium" | "long";
    observation_type: string;
  };
}

function normalizeStrategyTags(raw: unknown): GeneratedIntro["strategy_tags"] {
  const tags: Record<string, unknown> =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
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

const WRITER_SYSTEM = `Je schrijft namens Julian Kok van Brand Nova het PERSOONLIJKE openingsstuk van een koude e-mail. De rest van de mail (de begroeting, de vaste openingszin, het aanbod van de gratis Website Check en de afsluiting) is vast en wordt automatisch toegevoegd — die schrijf je NIET.

Jouw taak: schrijf uitsluitend het stukje dat direct ná de vaste zin "Ik kwam jullie website tegen en bleef er even op kijken." komt. Dat stukje bestaat uit precies twee dingen, in deze volgorde:
1. Eerst iets oprecht positiefs over deze specifieke website of dit bedrijf.
2. Daarna precies één concreet, specifiek verbeterpunt dat uniek is voor déze website, vriendelijk en constructief geformuleerd (vaak: iets goeds dat te weinig opvalt, pas laat zichtbaar wordt, of prominenter mag).

Harde regels:
- 2 tot 4 zinnen. Nederlands. Warm en menselijk, alsof Julian het net zelf typte.
- Verzin NIETS: gebruik alleen de meegegeven gegevens (positief punt, verbeterpunt, wat ze doen).
- Geen verkooppraat, geen opsommingen, geen complimenten die op elke site passen.
- Formuleer het verbeterpunt als vriendelijke observatie, nooit als harde kritiek.
- Schrijf GEEN begroeting ("Hoi"), NIET de zin "Ik kwam jullie website tegen...", GEEN aanbod van de Website Check, GEEN link, GEEN afsluiting of ondertekening. ALLEEN het positieve punt + het verbeterpunt.

Voorbeelden van goede stukjes (exact deze stijl en lengte):
- "Wat me direct opviel is dat jullie een bijzonder verhaal hebben. De passie achter jullie duurzame kinderkleding maakt jullie uniek. Ik ontdekte dat verhaal echter pas op de pagina 'Over ons'. Juist dat persoonlijke verhaal kan nieuwe bezoekers eerder overtuigen wanneer het prominenter op de homepage zichtbaar is."
- "De website oogt professioneel en rustig. Ik merkte alleen dat jullie persoonlijke aanpak pas later duidelijk wordt, terwijl dat juist een belangrijke reden is waarom mensen voor een opticien kiezen."
- "De diensten zijn direct duidelijk. Ik merkte alleen dat jouw persoonlijke verhaal pas verder op de pagina zichtbaar wordt, terwijl dat juist vertrouwen geeft aan ondernemers die een administratiekantoor zoeken."

Bij een follow-up: schrijf een VOLLEDIG nieuw, kort en licht stukje met een andere invalshoek dan eerdere mails. Herhaal geen zinnen.

strategy_tags beschrijft je eigen keuzes (alleen voor interne learning): opener_style, length_bucket (short/medium/long), observation_type (bv. "hidden_story", "hidden_service", "missing_cta", "unclear_copy", "trust_gap", "other").

Antwoord uitsluitend met JSON: { "intro": "...", "strategy_tags": { "opener_style": "...", "length_bucket": "...", "observation_type": "..." } }.`;

export interface WriterInput {
  companyName: string;
  whatTheyDo: string;
  tone: string;
  positive: string;
  observation: string;
  step: number;
  previousIntros: string[];
  insights: Insight[];
}

export async function writeIntro(input: WriterInput): Promise<GeneratedIntro> {
  const insightLines = input.insights
    .filter((i) => i.sample_size >= 5)
    .slice(0, 8)
    .map(
      (i) =>
        `- ${i.dimension}=${i.key}: ${(i.warm_lead_rate * 100).toFixed(1)}% warm-lead-rate (n=${i.sample_size})`
    )
    .join("\n");

  const previous = input.previousIntros
    .map((t, i) => `--- Eerder stukje ${i + 1} ---\n${t}`)
    .join("\n\n");

  const user = [
    `Bedrijf: ${input.companyName}`,
    `Wat ze doen: ${input.whatTheyDo}`,
    `Toon van hun site: ${input.tone}`,
    `Positief punt (gebruik dit als opening): ${input.positive}`,
    `Verbeterpunt (gebruik dit, precies één): ${input.observation}`,
    input.step === 0
      ? `Dit is de EERSTE mail aan dit bedrijf.`
      : `Dit is FOLLOW-UP nummer ${input.step}. Schrijf een volledig nieuw, kort en licht stukje met een andere invalshoek. Eerdere stukjes:\n\n${previous}`,
    insightLines
      ? `Wat historisch het best werkt (richtinggevend, blijf gevarieerd):\n${insightLines}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const parsed = await jsonCall(env.modelWriter, WRITER_SYSTEM, user, introSchema, 0.75);
  return {
    intro: parsed.intro.trim(),
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
