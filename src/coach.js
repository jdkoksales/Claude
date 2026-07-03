import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

/**
 * De coachlaag. De code beslist wanneer de coach afgaat (src/lib/insights.js);
 * dit bestand doet alleen: payload → API → defensief geparsed kaartje.
 * Bij elke fout: statische fallback. De app werkt altijd zonder coach.
 */

// Gehardcodeerd conform de productbeslissing — niet configureerbaar.
export const SYSTEM_PROMPT = `Je bent een coach in een doelen-app voor iemand die afhaakt rond week 2-3 en na één gemiste dag alles laat vallen. Je krijgt logdata als JSON. Je doel is dat de gebruiker de app over 6 maanden NIET meer nodig heeft.
Regels:
(1) Missen is normaal — nooit schuld, verwijt of teleurstelling.
(2) Bij twijfel: verklein het minimum, verhoog het nooit.
(3) Vier comebacks expliciet.
(4) Maximaal 2 zinnen Nederlands, warm en concreet, plus 1-3 acties uit de vaste lijst.
(5) Bij aanhoudend vastlopen: verwijs naar mensen om de gebruiker heen; positioneer jezelf niet als steunpilaar.
Toegestane actietypes: "verklein_minimum", "pauzeer_doel", "laat_zo".
Antwoord uitsluitend als JSON, zonder toelichting of markdown:
{ "bericht": string, "acties": [{ "label": string, "type": string }] }`;

export const ACTION_TYPES = ['verklein_minimum', 'pauzeer_doel', 'laat_zo'];

export const FALLBACK_CARD = Object.freeze({
  bericht:
    'Goed je weer te zien. Je hoeft vandaag niets in te halen — je minimum is genoeg.',
  acties: [{ label: 'Oké', type: 'laat_zo' }],
  fallback: true,
});

/**
 * Parse het modelantwoord defensief: fences strippen, eerste JSON-object
 * pakken, schema valideren. Gooit bij elke afwijking (caller vangt op).
 */
export function parseCoachReply(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('leeg antwoord');
  let t = text.replace(/```(?:json)?/gi, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('geen JSON-object gevonden');
  const obj = JSON.parse(t.slice(start, end + 1));

  const bericht = typeof obj.bericht === 'string' ? obj.bericht.trim() : '';
  if (!bericht || bericht.length > 400) throw new Error('ongeldig bericht-veld');

  let acties = Array.isArray(obj.acties) ? obj.acties : [];
  acties = acties
    .filter(
      (a) =>
        a &&
        typeof a.label === 'string' &&
        a.label.trim().length > 0 &&
        a.label.length <= 60 &&
        ACTION_TYPES.includes(a.type),
    )
    .slice(0, 3)
    .map((a) => ({ label: a.label.trim(), type: a.type }));
  if (acties.length === 0) acties = [{ label: 'Laat zo', type: 'laat_zo' }];

  return { bericht, acties };
}

let defaultClient = null;
function client() {
  if (!defaultClient) defaultClient = new Anthropic({ apiKey: config.anthropic.apiKey });
  return defaultClient;
}

/**
 * Eén coach-call: payload (JSON) in, gevalideerd kaartje uit.
 * `deps.createMessage` is injecteerbaar voor tests; elke fout → FALLBACK_CARD.
 */
export async function generateCard(payload, deps = {}) {
  const createMessage =
    deps.createMessage ||
    ((req) => client().messages.create(req));
  try {
    const response = await createMessage({
      model: config.anthropic.model,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    });
    const text = (response.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    return { ...parseCoachReply(text), fallback: false };
  } catch (err) {
    console.error('[coach] terugval op statisch kaartje:', err.message);
    return { ...FALLBACK_CARD };
  }
}
