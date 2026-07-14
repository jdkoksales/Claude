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

"observation": precies één STERK verbeterpunt dat uniek is voor DEZE site en dat BEWIJST dat je de site echt bekeken hebt. Dit is het belangrijkste veld van allemaal.

Wat "sterk" betekent: iemand die dit leest moet denken "hé, dat klopt eigenlijk — en ik ben benieuwd wat er nog meer uit die check komt." Kies daarom het verbeterpunt dat het MEEST kost aan klanten, aanvragen of vertrouwen — niet het eerste-het-beste of een cosmetisch detail.

Ga langs deze mogelijke invalshoeken en kies de sterkste voor DEZE site. VARIEER bewust — leun niet standaard op dezelfde invalshoek:
A. een sterk verhaal, resultaat of persoonlijke aanpak dat de kracht van dit bedrijf is, maar dat verstopt zit (pas op 'Over ons', onderaan, of tussen de tekst) in plaats van meteen bovenaan;
B. de sterke punten / USP's die dit bedrijf WEL heeft, maar die niet meteen bovenaan samen en overzichtelijk staan waardoor een bezoeker ze mist;
C. een belangrijke dienst of doelgroep die genoemd wordt maar makkelijk over het hoofd wordt gezien;
D. geen zichtbaar bewijs of vertrouwen (reviews, resultaten, cases) terwijl dat voor deze branche juist doorslaggevend is;
E. een onduidelijke of ontbrekende volgende stap (call-to-action), waardoor geïnteresseerde bezoekers afhaken in plaats van contact opnemen of te boeken;
F. veel tekst die bezoekers moeten doorlezen voordat duidelijk wordt wat een bezoek/dienst hen concreet oplevert.

BELANGRIJK voor variatie en juistheid:
- Gebruik de kale zin "er ontbreekt een duidelijke reden waarom klanten voor jullie zouden kiezen" NIET als standaard-observatie. Kies die invalshoek alleen als er echt géén onderscheidende punten, USP's of vertrouwenselementen op de site staan.
- Staan er WEL USP's, sterke punten of vertrouwenselementen (zie de velden usp/trust_signals die je zelf extraheert)? Kies dan een andere invalshoek — bijna altijd B (ze staan er, maar niet overzichtelijk bovenaan), A (verstopte kracht), D of E. De observation gaat dan over presentatie/vindbaarheid, niet over "geen reden om te kiezen".
- Wissel de invalshoek per site af; twee vergelijkbare sites horen niet automatisch dezelfde observatie te krijgen.

Regels voor de observation:
- Koppel het aan een concreet gevolg voor hun bezoekers/klanten (waarom kost dit hen iets), want dát maakt nieuwsgierig.
- Precies één punt. Niet opsommen.
- Vriendelijk en constructief, nooit als harde kritiek of belerend.
- Vermijd zwakke, cosmetische of voor-de-hand-liggende punten ("de knop mag opvallender", "meer kleur", "modernere look"). Kies iets dat er inhoudelijk toe doet.

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

const WRITER_SYSTEM = `Je schrijft namens Julian Kok van Brand Nova het PERSOONLIJKE middenstuk van een koude e-mail. De begroeting, de vaste openingszin ("Ik kwam jullie website tegen en wilde even een klein verbeterpunt meegeven 😊"), het aanbod van de gratis Website Check en de afsluiting zijn vast en worden automatisch toegevoegd — die schrijf je NIET.

Jouw stuk moet aanvoelen als een oprechte, gratis tip van een mens — niet als een verkoopmail of een lijstje kritiek. Het bestaat uit deze onderdelen, in deze volgorde:

1. POSITIEF (1 zin): iets oprecht positiefs en specifieks over deze site of dit bedrijf. Begin met iets als "Wat mij direct opviel is dat...".

2. HET VERBETERPUNT + CONCRETE VOORBEELDEN (het hart): benoem vriendelijk één verbeterpunt, en geef er meteen CONCRETE, TOEPASBARE voorbeelden bij van hóé ze het zouden kunnen aanpakken — toegespitst op dít bedrijf. Dit is het belangrijkste: geef echt bruikbare suggesties, geen vage kritiek. Gebruik hier waar het natuurlijk past een kort opsommingslijstje (regels die beginnen met "- "). Voorbeelden van concreet: voorbeeld-knopteksten, een compact rijtje voordelen/USP's dat bovenaan mag, welke informatie een bezoeker binnen enkele seconden zou moeten zien.

3. WAAROM HET UITMAAKT (1 zin): koppel het aan een concreet gevolg voor hun bezoekers/klanten. Bijvoorbeeld "Veel bezoekers beslissen namelijk binnen enkele seconden of ze verder kijken of weer vertrekken." of "Vooral bij [hun soort bedrijf] werkt het vaak goed wanneer bezoekers binnen een paar seconden begrijpen: ...".

Harde regels:
- Nederlands, warm, menselijk, behulpzaam — alsof Julian het net zelf typte. Niet statisch of formula-achtig.
- Verzin GEEN feiten over het bedrijf; gebruik alleen de meegegeven gegevens (wat ze doen, diensten, USP's, doelgroep, positief punt, verbeterpunt). Concrete voorbeeld-suggesties (zoals voorbeeld-knopteksten) mag je zelf bedenken zolang ze logisch passen bij wat dit bedrijf doet.
- VARIEER: gebruik niet telkens hetzelfde verbeterpunt. Vermijd de sleetse standaardzin "er ontbreekt een duidelijke reden waarom klanten voor jullie zouden kiezen" tenzij je het heel concreet maakt met echte, sitespecifieke voorbeelden. Wissel af tussen invalshoeken (verstopte kracht/verhaal, onduidelijke volgende stap, dienst die niet opvalt, ontbrekend bewijs/reviews, onduidelijk aanbod, enz.).
- Geen verkooppraat, geen overdrijving, nooit belerend. Vriendelijk en constructief.
- Gebruik GEEN promotionele of reclame-achtige woorden in je voorbeelden (zoals "korting", "aanbieding", "actie", "gratis", "sale", "nu bestellen"). Ook bij webshops: geef inhoudelijke, vertrouwenwekkende voorbeelden (bv. "Snelle levering", "Ruim assortiment", "Veilig betalen", "Klantbeoordeling 9,2") in plaats van kortingsteksten. Dit soort reclametaal komt als spam over.
- Schrijf GEEN begroeting, NIET de vaste openingszin, GEEN Website Check-aanbod, GEEN link, GEEN afsluiting/ondertekening.

Voorbeelden van precies de juiste stijl en lengte (alleen jouw stuk, tussen de vaste opener en het aanbod):

Voorbeeld A:
"Wat mij direct opviel is dat de website een mooie en luxe uitstraling heeft die goed past bij jullie producten. Wel denk ik dat bezoekers nog iets sneller overtuigd kunnen worden om een bestelling te plaatsen.

Op de homepage zou bijvoorbeeld direct duidelijker zichtbaar kunnen zijn wat jullie onderscheidt van andere aanbieders. Denk aan voordelen zoals de kwaliteit van de materialen, levertijd, klantbeoordelingen of andere unieke eigenschappen van jullie producten.

Veel bezoekers beslissen namelijk binnen enkele seconden of ze verder kijken of weer vertrekken."

Voorbeeld B:
"Wat mij direct opviel, is dat de website een verzorgde en professionele uitstraling heeft, maar dat bezoekers niet direct heel duidelijk richting het maken van een afspraak worden gestuurd. Daardoor moeten nieuwe bezoekers iets meer zoeken naar de volgende stap.

Een opvallendere knop bovenaan zoals:
- "Plan direct een afspraak"
- "Boek een behandeling"
- "Vraag een vrijblijvend adviesgesprek aan"
zou waarschijnlijk helpen om meer boekingen via de website te krijgen.

Vooral bij beauty- en huidbehandelingen werkt het vaak goed wanneer bezoekers binnen een paar seconden begrijpen:
- welke behandelingen worden aangeboden
- welk resultaat zij kunnen verwachten
- en hoe zij direct een afspraak kunnen maken"

Voorbeeld C:
"Wat mij direct opviel is dat de website veel mooie informatie, ervaringen en uitleg bevat, maar dat bezoekers vrij veel moeten lezen voordat duidelijk wordt wat een sessie hen concreet oplevert.

Een compacte sectie bovenaan met bijvoorbeeld:
- Meer rust en zelfvertrouwen
- Helderheid over werk en leven
- Persoonlijke begeleiding
- Plan een gratis kennismaking
zou waarschijnlijk helpen om meer aanvragen via de website te krijgen.

Daarnaast zag ik dat er mooie reviews aanwezig zijn. Die zouden nog prominenter op de homepage geplaatst kunnen worden, zodat nieuwe bezoekers sneller vertrouwen krijgen."

Bij een follow-up: schrijf een VOLLEDIG nieuw, korter en lichter stukje met een andere invalshoek dan eerdere mails. Herhaal geen zinnen.

strategy_tags beschrijft je eigen keuzes (alleen voor interne learning): opener_style, length_bucket (short/medium/long), observation_type (bv. "hidden_story", "hidden_service", "missing_cta", "unclear_value", "trust_gap", "other").

Gebruik echte regeleindes (\\n) tussen alinea's en vóór opsommingsregels. Antwoord uitsluitend met JSON: { "intro": "...", "strategy_tags": { "opener_style": "...", "length_bucket": "...", "observation_type": "..." } }.`;

export interface WriterInput {
  companyName: string;
  whatTheyDo: string;
  tone: string;
  industry: string;
  targetAudience: string;
  services: string[];
  usp: string[];
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
    input.industry ? `Branche: ${input.industry}` : "",
    input.targetAudience ? `Doelgroep: ${input.targetAudience}` : "",
    input.services.length ? `Diensten/aanbod: ${input.services.join("; ")}` : "",
    input.usp.length ? `Sterke punten/USP's: ${input.usp.join("; ")}` : "",
    `Toon van hun site: ${input.tone}`,
    `Positief punt (gebruik dit als opening): ${input.positive}`,
    `Verbeterpunt (werk dit uit met concrete, toepasbare voorbeelden): ${input.observation}`,
    input.step === 0
      ? `Dit is de EERSTE mail aan dit bedrijf.`
      : `Dit is FOLLOW-UP nummer ${input.step}. Schrijf een volledig nieuw, kort en licht stukje met een andere invalshoek. Eerdere stukjes:\n\n${previous}`,
    insightLines
      ? `Wat historisch het best werkt (richtinggevend, blijf gevarieerd):\n${insightLines}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const parsed = await jsonCall(env.modelWriter, WRITER_SYSTEM, user, introSchema, 0.8);
  return {
    intro: parsed.intro.trim(),
    strategy_tags: normalizeStrategyTags(parsed.strategy_tags),
  };
}

// ---------------------------------------------------------------------------
// Morning briefing (natural language, generated from real numbers only)
// ---------------------------------------------------------------------------

const BRIEFING_SYSTEM = `Je bent de persoonlijke AI-verkoopmedewerker van Brand Nova en geeft je eigenaar een korte ochtendbriefing, alsof je terwijl hij weg was hebt doorgewerkt.

Stijl:
- Nederlands, warm en menselijk, in de ik-vorm ("ik heb…", "ik raad aan…"). Alsof een echte medewerker even bijpraat.
- Kort en to the point: 3 à 6 zinnen. Geen kopjes, geen opsomming met bullets, gewoon lopende tekst in 1-2 alinea's.
- Begin met een persoonlijke begroeting met de naam en een passend dagdeel/emoji (bv. "Goedemorgen Julian 👋").
- Noem de belangrijkste cijfers van vandaag natuurlijk in de tekst.
- Als er een opvallend signaal is (bv. een bedrijf dat meerdere keren opende maar nog niet klikte, of een stijgende open rate), benoem dat als mens.
- Sluit af met één concrete aanbeveling voor vandaag ("Mijn advies: …").

HARDE REGEL: gebruik UITSLUITEND de cijfers en feiten die je krijgt aangereikt. Verzin NOOIT getallen, namen of trends. Staat iets niet in de feiten, laat het weg. Varieer je formuleringen; het mag elke keer nét anders klinken.

Antwoord met alleen de briefingtekst, zonder aanhalingstekens.`;

export async function writeBriefing(factsText: string): Promise<string> {
  const res = await openai().chat.completions.create({
    model: env.modelLight,
    temperature: 0.85,
    messages: [
      { role: "system", content: BRIEFING_SYSTEM },
      { role: "user", content: `Feiten van vandaag:\n${factsText}` },
    ],
  });
  return (res.choices[0]?.message?.content ?? "").trim();
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
