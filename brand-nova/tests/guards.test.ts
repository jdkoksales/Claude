import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groundingScore,
  MIN_GROUNDING_SCORE,
  textOverlap,
  MAX_FOLLOWUP_OVERLAP,
  validateEmailStyle,
} from "../src/lib/textGuards.ts";
import {
  normalizeDomain,
  isValidEmailSyntax,
  normalizeEmail,
} from "../src/lib/normalize.ts";
import {
  isWithinSendingWindow,
  sendBudgetForTick,
  localTime,
} from "../src/lib/sendWindow.ts";
import type { Settings } from "../src/lib/types.ts";

// ---------------------------------------------------------------------------
// Grounding guard: observations must come from the real page text
// ---------------------------------------------------------------------------

const PAGE =
  "Bouwbedrijf Jansen realiseert dakkapellen en uitbouwen in de regio Utrecht. " +
  "Vraag vrijblijvend een offerte aan via ons contactformulier. " +
  "Al 25 jaar ervaring met verbouwingen en aanbouwen voor particulieren.";

test("grounded observation passes", () => {
  const obs =
    "Jullie noemen 25 jaar ervaring met dakkapellen en uitbouwen, maar het contactformulier is de enige manier om een offerte aan te vragen.";
  assert.ok(groundingScore(obs, PAGE) >= MIN_GROUNDING_SCORE);
});

test("hallucinated observation fails", () => {
  const obs =
    "Jullie prijzenpagina toont pakketten vanaf 499 euro maar mist reviews van klanten uit Amsterdam.";
  assert.ok(groundingScore(obs, PAGE) < MIN_GROUNDING_SCORE);
});

// ---------------------------------------------------------------------------
// Follow-up uniqueness guard
// ---------------------------------------------------------------------------

const EMAIL_A =
  "Ik zag op jullie site dat de offerte-aanvraag alleen via het formulier kan. " +
  "Met onze gratis Website Check zie je in twee minuten wat er beter kan.";

test("near-duplicate follow-up is caught", () => {
  const copy =
    "Ik zag op jullie site dat de offerte-aanvraag alleen via het formulier kan lopen. " +
    "Met onze gratis Website Check zie je binnen twee minuten wat er beter kan.";
  assert.ok(textOverlap(EMAIL_A, copy) > MAX_FOLLOWUP_OVERLAP);
});

test("genuinely new follow-up passes", () => {
  const fresh =
    "Vorige week stuurde ik je een berichtje over jullie website. Geen haast — " +
    "mocht je nieuwsgierig zijn hoe bezoekers jullie aanbod ervaren, de check staat nog voor je klaar.";
  assert.ok(textOverlap(EMAIL_A, fresh) <= MAX_FOLLOWUP_OVERLAP);
});

// ---------------------------------------------------------------------------
// Style guard
// ---------------------------------------------------------------------------

test("salesy email is rejected", () => {
  const problems = validateEmailStyle(
    "GRATIS WEBSITE AANBIEDING!!",
    "Korting! Klik hier! voor een gratis website met 100% gratis extra's!!!"
  );
  assert.ok(problems.length > 0);
});

test("normal email passes style guard", () => {
  const problems = validateEmailStyle(
    "Vraagje over jullie offerteformulier",
    "Hoi, ik keek net op jullie site en vroeg me af of het formulier veel wordt gebruikt. " +
      "We hebben een gratis check die dat inzichtelijk maakt: https://example.com/check\n\nGroet, Julian"
  );
  assert.equal(problems.length, 0);
});

// ---------------------------------------------------------------------------
// Normalization / dedupe keys
// ---------------------------------------------------------------------------

test("domain normalization", () => {
  assert.equal(normalizeDomain("https://www.Example.nl/pagina"), "example.nl");
  assert.equal(normalizeDomain("example.nl"), "example.nl");
  assert.equal(normalizeDomain("http://sub.example.nl"), "sub.example.nl");
  assert.equal(normalizeDomain("niet een domein"), null);
  assert.equal(normalizeDomain(""), null);
});

test("email syntax validation", () => {
  assert.ok(isValidEmailSyntax("info@example.nl"));
  assert.ok(!isValidEmailSyntax("info@localhost"));
  assert.ok(!isValidEmailSyntax("geen-email"));
  assert.equal(normalizeEmail("  Info@Example.NL "), "info@example.nl");
});

// ---------------------------------------------------------------------------
// Sending window + budget spreading
// ---------------------------------------------------------------------------

const SETTINGS = {
  daily_send_cap: 200,
  sending_hours: { start: "09:00", end: "17:00", tz: "Europe/Amsterdam", days: [1, 2, 3, 4, 5] },
} as Settings;

// A Monday 10:00 Amsterdam (UTC+2 in July → 08:00 UTC).
const MONDAY_10 = new Date("2026-07-06T08:00:00Z");
// Sunday same time.
const SUNDAY_10 = new Date("2026-07-05T08:00:00Z");
// Monday 20:00 Amsterdam.
const MONDAY_20 = new Date("2026-07-06T18:00:00Z");

test("window respects days and hours", () => {
  assert.ok(isWithinSendingWindow(SETTINGS, MONDAY_10));
  assert.ok(!isWithinSendingWindow(SETTINGS, SUNDAY_10));
  assert.ok(!isWithinSendingWindow(SETTINGS, MONDAY_20));
});

test("budget spreads the cap across the window", () => {
  // 10:00 with a 17:00 close → 420 minutes left → 84 five-minute ticks.
  const budget = sendBudgetForTick(SETTINGS, 0, 5, MONDAY_10);
  assert.ok(budget >= 2 && budget <= 4, `expected ~3, got ${budget}`);
});

test("budget stops at the cap and outside the window", () => {
  assert.equal(sendBudgetForTick(SETTINGS, 200, 5, MONDAY_10), 0);
  assert.equal(sendBudgetForTick(SETTINGS, 0, 5, SUNDAY_10), 0);
});

test("localTime handles timezones", () => {
  const local = localTime("Europe/Amsterdam", MONDAY_10);
  assert.equal(local.dayOfWeek, 1);
  assert.equal(local.minutesSinceMidnight, 600);
});
