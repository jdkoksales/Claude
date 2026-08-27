/**
 * Het zinnetje van de dag: een wijze les om 's ochtends te lezen.
 *
 * Over de bronnen. Rond dit soort teksten gaat het toeschrijven online
 * structureel mis: de helft van wat als "Boeddha" of "Aristoteles" rondgaat is
 * nooit door hen gezegd. Daarom staan hier alleen regels waarvan de herkomst na
 * te lopen is, en staat de bron er ook echt bij.
 *
 * Twee keuzes die daaruit volgen:
 *
 * — Boeddhistische regels komen uit de **Dhammapada**, de canonieke bundel, en
 *   worden ook zo genoemd. "Boeddha zei" is bij losse citaten bijna nooit hard
 *   te maken; de vindplaats wel.
 * — "We zijn wat we herhaaldelijk doen" staat op naam van **Will Durant**, niet
 *   van Aristoteles. Durant vatte Aristoteles ermee samen in 1926, en sindsdien
 *   loopt het citaat met de verkeerde naam rond.
 *
 * Regels zonder bron zijn vragen om over na te denken. Die zijn voor deze app
 * geschreven en doen geen uitspraak die iemand anders zou hebben gedaan.
 *
 * Vertaald naar het Nederlands, want dat is de taal van de app.
 */

export const QUOTES = [
  // ── Dhammapada ───────────────────────────────────────────────────────────
  { text: 'Alles wat we zijn is het gevolg van wat we hebben gedacht.', source: 'Dhammapada, vers 1' },
  { text: 'Denk niet gering over het goede en zeg niet: het komt toch niet naar mij toe. Druppel voor druppel raakt de kruik gevuld.', source: 'Dhammapada, vers 122' },
  { text: 'Wie zichzelf overwint is een groter held dan wie duizend man in de strijd verslaat.', source: 'Dhammapada, vers 103' },
  { text: 'Haat wordt nooit gestild door haat. Alleen door niet te haten wordt haat gestild.', source: 'Dhammapada, vers 5' },
  { text: 'Beter dan duizend loze woorden is dat ene woord dat rust brengt.', source: 'Dhammapada, vers 100' },

  // ── Zen en spreekwoorden ─────────────────────────────────────────────────
  { text: 'Val zeven keer, sta acht keer op.', source: 'Japans spreekwoord' },
  { text: 'In de geest van de beginner zijn veel mogelijkheden. In die van de expert maar weinig.', source: 'Shunryu Suzuki, Zen Mind, Beginner’s Mind' },
  { text: 'Vóór de verlichting: hout hakken, water dragen. Ná de verlichting: hout hakken, water dragen.', source: 'Zen-spreekwoord' },
  { text: 'Zit rustig, doe niets. De lente komt, en het gras groeit vanzelf.', source: 'Zen-spreekwoord' },

  // ── Tao ──────────────────────────────────────────────────────────────────
  { text: 'Een reis van duizend mijl begint met één stap.', source: 'Lao Tzu, Tao Te Ching 64' },
  { text: 'Wie anderen kent is wijs. Wie zichzelf kent is verlicht.', source: 'Lao Tzu, Tao Te Ching 33' },

  // ── Stoïcijnen ───────────────────────────────────────────────────────────
  { text: 'Je hebt macht over je eigen geest, niet over wat er buiten je gebeurt. Besef dat, en je vindt kracht.', source: 'Marcus Aurelius, Overpeinzingen' },
  { text: 'De ziel neemt de kleur aan van je gedachten.', source: 'Marcus Aurelius, Overpeinzingen 5.16' },
  { text: 'Verspil geen tijd meer aan de vraag wat een goed mens is. Wees er een.', source: 'Marcus Aurelius, Overpeinzingen 10.16' },
  { text: 'De beste wraak is niet worden zoals degene die je onrecht deed.', source: 'Marcus Aurelius, Overpeinzingen 6.6' },
  { text: 'We lijden vaker in onze verbeelding dan in werkelijkheid.', source: 'Seneca, Brieven aan Lucilius 13' },
  { text: 'Wie niet weet naar welke haven hij vaart, heeft aan geen enkele wind iets.', source: 'Seneca, Brieven aan Lucilius 71' },
  { text: 'Het is niet zo dat we weinig tijd hebben. We verspillen er veel van.', source: 'Seneca, Over de kortheid van het leven' },
  { text: 'Niet de dingen zelf verontrusten ons, maar onze oordelen erover.', source: 'Epictetus, Enchiridion 5' },
  { text: 'Het is onmogelijk om te leren wat je denkt al te weten.', source: 'Epictetus, Verhandelingen' },

  // ── Gewoontes, doelen en mindset ─────────────────────────────────────────
  { text: 'We zijn wat we herhaaldelijk doen. Uitmuntendheid is daarom geen daad, maar een gewoonte.', source: 'Will Durant, over Aristoteles' },
  { text: 'Morele voortreffelijkheid is het resultaat van gewoonte.', source: 'Aristoteles, Ethica Nicomachea II' },
  { text: 'Je stijgt niet naar het niveau van je doelen. Je zakt naar het niveau van je systemen.', source: 'James Clear, Atomic Habits' },
  { text: 'Elke keer dat je iets doet, breng je een stem uit op het soort mens dat je wilt worden.', source: 'James Clear, Atomic Habits' },
  { text: 'Doorzettingsvermogen is passie en volharding, gericht op doelen die ver weg liggen.', source: 'Angela Duckworth, Grit' },
  { text: 'Het is geen "ik kan het niet". Het is "ik kan het nog niet".', source: 'Carol Dweck, over de groeimindset' },
  { text: 'Handel alsof wat je doet verschil maakt. Dat doet het.', source: 'William James' },
  { text: 'Het lijkt altijd onmogelijk, totdat het gedaan is.', source: 'Nelson Mandela' },
  { text: 'Het leven kan alleen achterwaarts worden begrepen, maar het moet voorwaarts worden geleefd.', source: 'Søren Kierkegaard' },

  // ── Aandacht en veerkracht ───────────────────────────────────────────────
  { text: 'Kunnen we een situatie niet meer veranderen, dan worden we uitgedaagd onszelf te veranderen.', source: 'Viktor Frankl, De zin van het bestaan' },
  { text: 'Het wonder is niet over water lopen. Het wonder is over de aarde lopen.', source: 'Thich Nhat Hanh, Het wonder van bewust leven' },
  { text: 'Adem in, en weet dat je ademt. Adem uit, en glimlach.', source: 'Thich Nhat Hanh' },
  { text: 'Jij bent de lucht. Al het andere is het weer.', source: 'Pema Chödrön' },

  // ── Vragen om mee te beginnen ────────────────────────────────────────────
  // Geen citaten maar vragen: voor deze app geschreven, dus geen bron.
  { text: 'Wat is het kleinste wat je vandaag kunt doen waar je morgen dankbaar voor bent?', source: null },
  { text: 'Waar gaat je aandacht vandaag vanzelf heen — en is dat waar je haar wilt hebben?', source: null },
  { text: 'Welke gewoonte zou over een jaar het meeste verschil hebben gemaakt?', source: null },
  { text: 'Wat zou je vandaag doen als je zeker wist dat het niet meteen hoefde te lukken?', source: null },
  { text: 'Wat houd je vast dat je eigenlijk allang los had kunnen laten?', source: null },
  { text: 'Waar wacht je op, en waar wacht je eigenlijk precies op?', source: null },
  { text: 'Wat zou je tegen een goede vriend zeggen die vandaag in jouw schoenen stond?', source: null },
  { text: 'Welke vijf minuten van vandaag wil je je over een week nog herinneren?', source: null },
  { text: 'Wat doe je uit gewoonte, en zou je het opnieuw kiezen als je vandaag mocht kiezen?', source: null },
  { text: 'Waar ben je harder voor jezelf dan je voor de ander zou zijn?', source: null },
  { text: 'Wat is er vandaag al goed, voordat er iets moet?', source: null },
  { text: 'Als vandaag één ding telt, welk ding is dat dan?', source: null },
];

/**
 * Een stap die geen deler gemeen heeft met de lengte van de lijst. Daardoor
 * loopt de reeks álle zinnetjes langs voordat er één terugkomt, en kan hij per
 * definitie nooit twee dagen op hetzelfde uitkomen.
 *
 * Dit ving een echte fout af: eerst rekende hij met een tekstsom over de datum,
 * en dat gaf "meestal" een ander zinnetje. Bij het uitbreiden van de lijst
 * botsten twee opeenvolgende dagen alsnog. "Meestal" is hier niet genoeg —
 * een zinnetje dat blijft hangen is precies wat je niet wilt zien.
 */
function stride(len) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  for (let s = Math.floor(len / 2); s > 1; s -= 1) if (gcd(s, len) === 1) return s;
  return 1;
}

/**
 * Welk zinnetje er vandaag staat. Uit de datum gerekend, dus:
 * — jullie zien allebei hetzelfde
 * — het wisselt om middernacht
 * — er hoeft niets voor opgeslagen of onthouden te worden
 */
export function quoteOfDay(dateKey, list = QUOTES) {
  if (!list.length) return null;
  const [y, m, d] = String(dateKey).split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
  if (!Number.isFinite(dayNumber)) return list[0];
  const i = (dayNumber * stride(list.length)) % list.length;
  return list[(i + list.length) % list.length];
}
