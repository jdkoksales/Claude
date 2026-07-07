/**
 * Brand Nova's proven email structure, reverse-engineered from Julian's
 * hand-written winners. Only the personal top block (positive + one specific
 * improvement) is AI-generated; everything else here is fixed, proven copy.
 *
 * Subject and opener are constant; the bottom carries one strong, unchanging
 * offer of the free Website Check plus a human closing.
 */

const OPENER = "Ik kwam jullie website tegen en bleef er even op kijken.";

const SIGNATURE = "Groet,\nJulian Kok\nBrand Nova";

function greeting(firstName: string | null): string {
  return firstName ? `Hoi ${firstName},` : "Hoi,";
}

/** Fixed subject line, optionally personalized with a visible first name. */
export function buildSubject(firstName: string | null): string {
  const base = "er viel me iets op aan jullie website 😊";
  return firstName
    ? `${firstName}, ${base}`
    : base.charAt(0).toUpperCase() + base.slice(1);
}

/** The unchanging Website Check offer block. */
function offerBlock(websiteCheckUrl: string): string {
  return [
    "Daarom dacht ik dat je misschien iets hebt aan mijn gratis Website Check.",
    "Je voert alleen je website in en ontvangt direct 10 concrete verbeterpunten om meer uit je website te halen. Denk aan meer aanvragen, meer omzet of meer klanten.",
    websiteCheckUrl,
    "De Website Check is volledig gratis en vrijblijvend. Misschien bevestigt hij alleen dat alles al goed staat, maar vaak zitten er toch een paar praktische verbeterpunten tussen waar je direct iets mee kunt.",
  ].join("\n\n");
}

/**
 * Assembles a first-touch email from the AI-written intro plus the fixed
 * copy. `intro` is only the positive + one improvement point (no greeting,
 * no opener line, no offer).
 */
export function assembleFirstEmail(input: {
  firstName: string | null;
  intro: string;
  websiteCheckUrl: string;
}): { subject: string; body: string } {
  const body = [
    greeting(input.firstName),
    OPENER,
    input.intro.trim(),
    offerBlock(input.websiteCheckUrl),
    "Mocht je er iets aan hebben, dan hoor ik dat natuurlijk graag. Je kunt gewoon op deze mail reageren.",
    SIGNATURE,
  ].join("\n\n");
  return { subject: buildSubject(input.firstName), body };
}

/**
 * Follow-ups stay short and low-pressure: a fresh personal line and a brief,
 * no-repeat pointer back to the check — never the full pitch again.
 */
export function assembleFollowUp(input: {
  firstName: string | null;
  intro: string;
  websiteCheckUrl: string;
  step: number;
}): { subject: string; body: string } {
  const body = [
    greeting(input.firstName),
    input.intro.trim(),
    `Mocht je er iets mee willen: de gratis Website Check staat nog voor je klaar — ${input.websiteCheckUrl}`,
    SIGNATURE,
  ].join("\n\n");
  return {
    subject: `Nog een gedachte over jullie website 😊`,
    body,
  };
}
