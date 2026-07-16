/**
 * Brand Nova's proven email structure, reverse-engineered from Julian's
 * hand-written winners. The AI writes the personal top block: a warm, specific
 * mini-tip (positive + one improvement, WITH concrete examples of how to apply
 * it and why it matters). Everything else here is fixed, proven copy.
 *
 * Every email is built in two forms: a plain-text part (best for deliverability
 * and text-only clients) and an HTML part carrying the branded signature.
 */

import { openPixelUrl } from "./events";

const OPENER =
  "Ik kwam jullie website tegen en wilde even een klein verbeterpunt meegeven 😊";

/** Signature details, shown in every outgoing email. */
const SIG = {
  name: "Julian Kok",
  title: "Marketing Specialist",
  email: "julian@brand-nova.nl",
  phone: "+31 6 16036328",
  website: "www.brand-nova.nl",
  websiteUrl: "https://www.brand-nova.nl",
  address: "Westerkade 16/4, Groningen",
};

function greeting(firstName: string | null): string {
  return firstName ? `Hoi ${firstName},` : "Hoi,";
}

/** Fixed subject line, optionally personalized with a visible first name. */
export function buildSubject(firstName: string | null): string {
  const base = "er viel me iets op aan jullie website";
  return firstName
    ? `${firstName}, ${base}`
    : base.charAt(0).toUpperCase() + base.slice(1);
}

/** The unchanging Website Check offer block (plain text paragraphs). */
function offerBlock(websiteCheckUrl: string): string[] {
  return [
    "Daarom dacht ik dat je misschien iets hebt aan mijn gratis Website Check.",
    "Je voert alleen je website in en ontvangt direct 10 concrete verbeterpunten om meer uit je website te halen. Denk aan meer aanvragen, meer omzet of meer klanten.",
    websiteCheckUrl,
    "De Website Check is volledig gratis en vrijblijvend. Misschien bevestigt hij alleen dat alles al goed staat, maar vaak zitten er toch een paar praktische verbeterpunten tussen waar je direct iets mee kunt.",
  ];
}

const REPLY_LINE =
  "Mocht je er iets aan hebben, dan hoor ik dat natuurlijk graag. Je kunt gewoon op deze mail reageren.";

function signatureText(): string {
  return [
    "Met vriendelijke groet,",
    `${SIG.name} | ${SIG.title}`,
    `E: ${SIG.email}`,
    `T: ${SIG.phone}`,
    `W: ${SIG.website}`,
    SIG.address,
    "Brand Nova",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// HTML rendering (inline styles for email-client compatibility)
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function para(text: string): string {
  return `<p style="margin:0 0 16px;">${escapeHtml(text)}</p>`;
}

function urlPara(url: string, href?: string): string {
  const u = escapeHtml(url.trim());
  const target = escapeHtml((href ?? url).trim());
  return `<p style="margin:0 0 16px;"><a href="${target}" style="color:#4353c9;text-decoration:underline;">${u}</a></p>`;
}

/**
 * Renders the AI intro, which may contain multiple paragraphs (blank-line
 * separated) and bullet lists (lines starting with "-", "•" or "*").
 */
function richTextToHtml(text: string): string {
  let html = "";
  let paraLines: string[] = [];
  let bulletLines: string[] = [];
  const flushPara = () => {
    if (paraLines.length) {
      html += `<p style="margin:0 0 16px;">${paraLines.map(escapeHtml).join("<br>")}</p>`;
      paraLines = [];
    }
  };
  const flushBullets = () => {
    if (bulletLines.length) {
      html +=
        `<ul style="margin:0 0 16px;padding-left:20px;">` +
        bulletLines
          .map((b) => `<li style="margin:0 0 4px;">${escapeHtml(b)}</li>`)
          .join("") +
        `</ul>`;
      bulletLines = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      flushPara();
      continue;
    }
    const bullet = line.match(/^[-•*]\s+(.*)/);
    if (bullet) {
      flushPara();
      bulletLines.push(bullet[1]);
    } else {
      flushBullets();
      paraLines.push(line);
    }
  }
  flushBullets();
  flushPara();
  return html;
}

function signatureHtml(): string {
  return `
<table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;font-family:Verdana,Arial,sans-serif;font-size:13px;color:#333333;line-height:1.5;">
  <tr><td style="padding-bottom:10px;">Met vriendelijke groet,</td></tr>
  <tr><td style="padding-bottom:12px;border-top:1px solid #dddddd;"></td></tr>
  <tr>
    <td style="padding-bottom:12px;">
      <strong style="color:#111111;">${SIG.name}</strong>
      <span style="color:#888888;"> | ${SIG.title}</span>
    </td>
  </tr>
  <tr>
    <td style="font-size:13px;color:#333333;">
      E: <a href="mailto:${SIG.email}" style="color:#b0197f;text-decoration:none;">${SIG.email}</a><br>
      T: ${SIG.phone}<br>
      W: <a href="${SIG.websiteUrl}" style="color:#b0197f;text-decoration:none;">${SIG.website}</a><br>
      ${escapeHtml(SIG.address)}<br>
      Brand Nova
    </td>
  </tr>
</table>`.trim();
}

function wrapHtml(innerHtml: string, trackToken?: string | null): string {
  const pixel = trackToken
    ? `<img src="${escapeHtml(openPixelUrl(trackToken))}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;overflow:hidden;" />`
    : "";
  return `<!doctype html>
<html lang="nl"><body style="margin:0;padding:0;background:#ffffff;">
<div style="max-width:600px;margin:0 auto;padding:16px;font-family:Verdana,Arial,sans-serif;font-size:14px;color:#222222;line-height:1.6;">
${innerHtml}
${signatureHtml()}
${pixel}
</div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Assemblers
// ---------------------------------------------------------------------------

export interface AssembledEmail {
  subject: string;
  /** Plain-text part. */
  body: string;
  /** HTML part with the branded signature. */
  html: string;
}

/**
 * First-touch email: fixed opener + AI mini-tip + fixed Website Check offer
 * + branded signature. `intro` is the AI's positive + improvement + concrete
 * examples + why-it-matters (no greeting, no opener, no offer).
 */
export function assembleFirstEmail(input: {
  firstName: string | null;
  intro: string;
  websiteCheckUrl: string;
  trackToken?: string | null;
}): AssembledEmail {
  const offer = offerBlock(input.websiteCheckUrl);
  // Deliverability: the visible Website Check link stays on the sender's own
  // domain. Rewriting it to the app's vercel.app tracking redirect made the
  // link domain mismatch the from-domain — a strong spam signal that tanked
  // opens to zero on day 2. Click tracking resumes once a custom tracking
  // domain (e.g. t.brand-nova.nl) exists; the open pixel below stays.
  const textBlocks = [
    greeting(input.firstName),
    OPENER,
    input.intro.trim(),
    ...offer,
    REPLY_LINE,
    signatureText(),
  ];
  const html = wrapHtml(
    para(greeting(input.firstName)) +
      para(OPENER) +
      richTextToHtml(input.intro) +
      offer.map((o) => (/^https?:\/\//.test(o.trim()) ? urlPara(o) : para(o))).join("") +
      para(REPLY_LINE),
    input.trackToken
  );
  return {
    subject: buildSubject(input.firstName),
    body: textBlocks.join("\n\n"),
    html,
  };
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
  trackToken?: string | null;
}): AssembledEmail {
  const pointerPrefix = "Mocht je er iets mee willen: de gratis Website Check staat nog voor je klaar — ";
  const pointer = `${pointerPrefix}${input.websiteCheckUrl}`;
  const textBlocks = [
    greeting(input.firstName),
    input.intro.trim(),
    pointer,
    signatureText(),
  ];
  const html = wrapHtml(
    para(greeting(input.firstName)) +
      richTextToHtml(input.intro) +
      `<p style="margin:0 0 16px;">${escapeHtml(pointerPrefix)}<a href="${escapeHtml(
        input.websiteCheckUrl
      )}" style="color:#4353c9;text-decoration:underline;">${escapeHtml(
        input.websiteCheckUrl
      )}</a></p>`,
    input.trackToken
  );
  return {
    subject: "Nog een gedachte over jullie website",
    body: textBlocks.join("\n\n"),
    html,
  };
}
