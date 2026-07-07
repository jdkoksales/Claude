/**
 * Deterministic text guards backing two hard rules from the spec:
 *
 * 1. "Never invent information" — an observation must be grounded in the
 *    homepage text we actually fetched.
 * 2. "Every follow-up must be completely unique" — new emails must not
 *    overlap too much with earlier emails in the sequence.
 *
 * These run AFTER generation as checks, so the rules don't depend on the
 * model following instructions.
 */

const STOPWORDS = new Set([
  "de", "het", "een", "en", "van", "in", "op", "voor", "met", "aan", "bij",
  "dat", "die", "je", "ik", "we", "ze", "is", "zijn", "er", "om", "te", "als",
  "the", "a", "an", "and", "of", "in", "on", "for", "with", "to", "at",
  "that", "this", "it", "is", "are", "be", "as", "or", "your", "you", "we",
]);

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Fraction of the observation's content words that also occur in the source
 * text. A grounded observation quotes or paraphrases real page content, so
 * a meaningful share of its distinctive words must come from the page.
 */
export function groundingScore(observation: string, sourceText: string): number {
  const obsWords = contentWords(observation);
  if (obsWords.length === 0) return 0;
  const source = new Set(contentWords(sourceText));
  const hits = obsWords.filter((w) => source.has(w)).length;
  return hits / obsWords.length;
}

/**
 * Minimum grounding score below which an observation is discarded. Kept low
 * on purpose: the best observations are often about something *missing* from
 * the page (no pricing, no booking button), whose words don't appear in the
 * source text. This threshold only needs to catch wholesale hallucination —
 * an observation about a completely different company shares ~0% of its
 * distinctive words with the page. The prompt ("verzin geen feiten") and the
 * style validator carry the rest.
 */
export const MIN_GROUNDING_SCORE = 0.12;

function trigrams(text: string): Set<string> {
  const words = contentWords(text);
  const grams = new Set<string>();
  for (let i = 0; i + 2 < words.length; i++) {
    grams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return grams;
}

/**
 * Trigram overlap between a new email and a previous one (0..1, relative to
 * the smaller text). High overlap means the model repeated itself.
 */
export function textOverlap(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const g of ta) if (tb.has(g)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

/** Maximum allowed trigram overlap between sequence emails. */
export const MAX_FOLLOWUP_OVERLAP = 0.25;

/**
 * Deterministic style validation for outgoing email bodies. These catch the
 * failure modes the spec forbids (salesy, exaggerated, automated-sounding)
 * without another AI call. Returns a list of violations; empty = pass.
 */
export function validateEmailStyle(subject: string, body: string): string[] {
  const problems: string[] = [];
  const full = `${subject}\n${body}`.toLowerCase();

  const banned = [
    "korting", "discount", "gratis website", "aanbieding", "actie!",
    "100% gratis", "geen verplichtingen!", "unsubscribe", "dear sir",
    "geachte heer/mevrouw", "beste webmaster", "click here", "klik hier!",
  ];
  for (const phrase of banned) {
    if (full.includes(phrase)) problems.push(`banned phrase: "${phrase}"`);
  }
  if ((body.match(/!/g) ?? []).length > 2) {
    problems.push("too many exclamation marks");
  }
  if (body.split(/\s+/).length > 220) {
    problems.push("body too long (>220 words)");
  }
  if (subject.length > 70) {
    problems.push("subject too long (>70 chars)");
  }
  if (/[A-Z]{6,}/.test(subject)) {
    problems.push("shouting in subject");
  }
  return problems;
}
