/**
 * Het zinnetje van de dag: een wijze les om 's ochtends te lezen, met bij elk
 * zinnetje wat het betekent en wat je er vandaag mee doet.
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
 * Elk zinnetje heeft `meaning` (wat het betekent) en `practice` (wat je er
 * vandaag mee doet). Zonder dat tweede blijft een wijze les een spreuk aan de
 * muur; het is juist de bedoeling dat je er iets mee kunt.
 *
 * Vertaald naar het Nederlands, want dat is de taal van de app.
 */

export const QUOTES = [
  // ── Dhammapada ───────────────────────────────────────────────────────────
  {
    text: 'Alles wat we zijn is het gevolg van wat we hebben gedacht.',
    source: 'Dhammapada, vers 1',
    meaning: 'Je gedachten zijn geen bijzaak. Ze bepalen waar je aandacht heen gaat, en daarmee wat je doet en uiteindelijk wordt. Dat is niet zweverig bedoeld: een gedachte die je vaak genoeg denkt, wordt de weg die je vanzelf gaat.',
    practice: 'Merk vandaag één terugkerende gedachte op waar je niets aan hebt — "dit lukt toch niet". Zet er de nuchtere versie naast. Je hoeft hem niet weg te duwen; opmerken is genoeg.',
  },
  {
    text: 'Denk niet gering over het goede en zeg niet: het komt toch niet naar mij toe. Druppel voor druppel raakt de kruik gevuld.',
    source: 'Dhammapada, vers 122',
    meaning: 'Kleine goede dingen voelen te klein om iets uit te maken, dus doen we ze niet. Maar elk groot resultaat is zo ontstaan: door optellen, niet door één grote daad.',
    practice: 'Kies iets wat je in twee minuten kunt doen en doe het nu. Niet omdat die twee minuten veel zijn, maar omdat het de kruik vult.',
  },
  {
    text: 'Wie zichzelf overwint is een groter held dan wie duizend man in de strijd verslaat.',
    source: 'Dhammapada, vers 103',
    meaning: 'De moeilijkste tegenstander is je eigen impuls: de snooze, het uitstel, het glas. Wie daar wint, hoeft verder niemand te verslaan.',
    practice: 'Bedenk waar jij vandaag je eigen tegenstander bent. Win dat ene moment — niet de hele oorlog.',
  },
  {
    text: 'Haat wordt nooit gestild door haat. Alleen door niet te haten wordt haat gestild.',
    source: 'Dhammapada, vers 5',
    meaning: 'Terugslaan voelt terecht, maar houdt het conflict in de lucht. Het stopt pas als één van beiden er niet meer in meegaat.',
    practice: 'Voel je irritatie richting iemand, wacht dan met reageren tot je een keer hebt uitgeademd. Vraag jezelf: wil ik gelijk krijgen, of wil ik dat het ophoudt?',
  },
  {
    text: 'Beter dan duizend loze woorden is dat ene woord dat rust brengt.',
    source: 'Dhammapada, vers 100',
    meaning: 'Veel zeggen is niet hetzelfde als iets zeggen. Eén rake zin doet meer dan een half uur praten.',
    practice: 'Zeg vandaag één ding tegen iemand dat echt helpt — een compliment, een geruststelling — en laat de rest weg.',
  },

  // ── Zen en spreekwoorden ─────────────────────────────────────────────────
  {
    text: 'Val zeven keer, sta acht keer op.',
    source: 'Japans spreekwoord',
    meaning: 'Falen wordt hier niet weggepoetst maar ingecalculeerd. Het gaat niet om hoe vaak je onderuitgaat, maar om het aantal keren dat je opstaat — dat is er altijd één meer.',
    practice: 'Denk aan iets waarmee je gestopt was. Begin er vandaag opnieuw mee, in de allerkleinste versie.',
  },
  {
    text: 'In de geest van de beginner zijn veel mogelijkheden. In die van de expert maar weinig.',
    source: 'Shunryu Suzuki, Zen Mind, Beginner’s Mind',
    meaning: 'Wie denkt het al te weten, ziet minder. Kennis maakt efficiënt maar ook blind: je herkent alleen nog wat je al kende.',
    practice: 'Doe vandaag iets bekends alsof het de eerste keer is, en let op één ding dat je nooit eerder had opgemerkt.',
  },
  {
    text: 'Vóór de verlichting: hout hakken, water dragen. Ná de verlichting: hout hakken, water dragen.',
    source: 'Zen-spreekwoord',
    meaning: 'Er komt geen moment waarna het gewone leven ophoudt. De afwas blijft. Wat verandert is niet je leven maar je verhouding ertoe.',
    practice: 'Kies één klusje waar je een hekel aan hebt en doe het met volle aandacht, in plaats van zo snel mogelijk.',
  },
  {
    text: 'Zit rustig, doe niets. De lente komt, en het gras groeit vanzelf.',
    source: 'Zen-spreekwoord',
    meaning: 'Niet alles wordt beter van duwen. Sommige dingen — rust, herstel, een idee — hebben juist ruimte nodig en gaan kapot aan forceren.',
    practice: 'Plan tien minuten waarin je niets doet. Geen telefoon, geen doel, geen muziek.',
  },

  // ── Tao ──────────────────────────────────────────────────────────────────
  {
    text: 'Een reis van duizend mijl begint met één stap.',
    source: 'Lao Tzu, Tao Te Ching 64',
    meaning: 'Het hele plan overzien verlamt; de eerste stap doen niet. Je hoeft de route niet te kennen om te vertrekken.',
    practice: 'Pak het ding waar je tegenop ziet en doe alleen de allereerste handeling. Map openen, nummer opzoeken, schoenen aan. Meer niet.',
  },
  {
    text: 'Wie anderen kent is wijs. Wie zichzelf kent is verlicht.',
    source: 'Lao Tzu, Tao Te Ching 33',
    meaning: 'Anderen doorzien is knap en gebeurt vaak. Jezelf doorzien is zeldzamer, ongemakkelijker en veel bruikbaarder.',
    practice: 'Vraag jezelf vanavond: waar reageerde ik vandaag feller dan de situatie vroeg? Daar zit iets van jou, niet van de ander.',
  },

  // ── Stoïcijnen ───────────────────────────────────────────────────────────
  {
    text: 'Je hebt macht over je eigen geest, niet over wat er buiten je gebeurt. Besef dat, en je vindt kracht.',
    source: 'Marcus Aurelius, Overpeinzingen',
    meaning: 'De kern van het stoïcisme: scheiden wat van jou is en wat niet. Energie steken in het tweede put je uit; energie steken in het eerste werkt.',
    practice: 'Schrijf op wat je vandaag dwarszit. Streep door wat buiten je invloed valt. Werk aan wat overblijft.',
  },
  {
    text: 'De ziel neemt de kleur aan van je gedachten.',
    source: 'Marcus Aurelius, Overpeinzingen 5.16',
    meaning: 'Waar je aandacht dag in dag uit heen gaat, kleurt hoe je je voelt. Je stemming is minder toeval dan het lijkt.',
    practice: 'Merk waar je aandacht vandaag vanzelf heen gaat — nieuws, zorgen, scherm. Vervang één zo’n moment door iets waar je vrolijk van wordt.',
  },
  {
    text: 'Verspil geen tijd meer aan de vraag wat een goed mens is. Wees er een.',
    source: 'Marcus Aurelius, Overpeinzingen 10.16',
    meaning: 'Praten en lezen over hoe het zou moeten voelt als vooruitgang, maar is het niet. Op een gegeven moment moet je het gewoon doen.',
    practice: 'Kies één eigenschap die je wilt hebben en doe vandaag één ding dat daarbij hoort — zonder het aan iemand te vertellen.',
  },
  {
    text: 'De beste wraak is niet worden zoals degene die je onrecht deed.',
    source: 'Marcus Aurelius, Overpeinzingen 6.6',
    meaning: 'Wie je heeft gekwetst wint pas echt als jij je gaat gedragen zoals hij. Je hoeft niets terug te doen om te winnen.',
    practice: 'Is er iemand die je dwarszit? Doe vandaag bewust het tegenovergestelde van wat die persoon deed.',
  },
  {
    text: 'We lijden vaker in onze verbeelding dan in werkelijkheid.',
    source: 'Seneca, Brieven aan Lucilius 13',
    meaning: 'De meeste dingen waar we bang voor zijn gebeuren niet. Maar we betalen er vooraf wel voor, soms wekenlang.',
    practice: 'Schrijf je grootste zorg van vandaag op, en daaronder wat er écht gebeurt als hij uitkomt. Meestal valt het tegen én mee.',
  },
  {
    text: 'Wie niet weet naar welke haven hij vaart, heeft aan geen enkele wind iets.',
    source: 'Seneca, Brieven aan Lucilius 71',
    meaning: 'Zonder richting is geen enkele omstandigheid gunstig, want je kunt niet zien of iets je dichterbij brengt. Meewind bestaat alleen als je een bestemming hebt.',
    practice: 'Schrijf in één zin op waar je dit jaar naartoe wilt. Kijk daarna of je agenda van deze week daarbij past.',
  },
  {
    text: 'Het is niet zo dat we weinig tijd hebben. We verspillen er veel van.',
    source: 'Seneca, Over de kortheid van het leven',
    meaning: 'Tijdgebrek is meestal aandachtgebrek. De uren zijn er wel; ze lekken alleen weg aan dingen die je niet gekozen hebt.',
    practice: 'Kijk waar je gisteren je tijd aan kwijt was. Kies er één ding uit dat je vandaag niet doet.',
  },
  {
    text: 'Niet de dingen zelf verontrusten ons, maar onze oordelen erover.',
    source: 'Epictetus, Enchiridion 5',
    meaning: 'Niet de regen maakt je chagrijnig, maar wat je erover vindt. Tussen wat er gebeurt en hoe jij je voelt zit een oordeel — en dat is van jou.',
    practice: 'Overkomt je iets vervelends, benoem dan eerst alleen de feiten, zonder bijvoeglijke naamwoorden. "De trein is weg" in plaats van "dit is een ramp".',
  },
  {
    text: 'Het is onmogelijk om te leren wat je denkt al te weten.',
    source: 'Epictetus, Verhandelingen',
    meaning: 'Zekerheid sluit de deur. Zolang je je mening al klaar hebt, kan er niets nieuws bij.',
    practice: 'Vraag vandaag iemand naar zijn kant van iets waarover jij je oordeel allang had. Luister zonder alvast te antwoorden.',
  },

  // ── Gewoontes, doelen en mindset ─────────────────────────────────────────
  {
    text: 'We zijn wat we herhaaldelijk doen. Uitmuntendheid is daarom geen daad, maar een gewoonte.',
    source: 'Will Durant, over Aristoteles',
    meaning: 'Goed zijn in iets is geen prestatie die je één keer levert, maar een patroon dat je onderhoudt. En let op: dit citaat staat overal op naam van Aristoteles, maar het is Durants samenvatting uit 1926.',
    practice: 'Kies één handeling die je vandaag doet en die je over een jaar nog wilt doen. Doe hem, ook al is hij klein.',
  },
  {
    text: 'Morele voortreffelijkheid is het resultaat van gewoonte.',
    source: 'Aristoteles, Ethica Nicomachea II',
    meaning: 'Je karakter is niet iets waarmee je geboren wordt maar iets wat je oefent. Geduldig word je door geduldig te doen, ook als je het niet voelt.',
    practice: 'Doe vandaag één keer het geduldige, vriendelijke of moedige ding — juist op het moment dat je er geen zin in hebt.',
  },
  {
    text: 'Je stijgt niet naar het niveau van je doelen. Je zakt naar het niveau van je systemen.',
    source: 'James Clear, Atomic Habits',
    meaning: 'Een doel zegt waar je heen wilt; je dagelijkse opzet bepaalt waar je komt. Iedereen wil fit worden — het verschil zit in wie zijn schoenen klaarzet.',
    practice: 'Pak een doel dat blijft liggen en verander niet het doel maar de omstandigheid: leg het klaar, zet het in de agenda, maak het één stap makkelijker.',
  },
  {
    text: 'Elke keer dat je iets doet, breng je een stem uit op het soort mens dat je wilt worden.',
    source: 'James Clear, Atomic Habits',
    meaning: 'Eén keer sporten maakt je niet fit, maar het is wel een stem. Je wint geen verkiezing met één stem; je hebt er ook niet alle voor nodig.',
    practice: 'Zeg vandaag één keer "ik ben iemand die …" en doe daarna dat ding, hoe klein ook.',
  },
  {
    text: 'Doorzettingsvermogen is passie en volharding, gericht op doelen die ver weg liggen.',
    source: 'Angela Duckworth, Grit',
    meaning: 'Uit haar onderzoek: wie het ver schopt is zelden de meest getalenteerde, maar bijna altijd degene die jarenlang aan hetzelfde bleef werken.',
    practice: 'Kies iets waar je al maanden mee bezig bent en doe er vandaag iets aan — ook al voel je geen vooruitgang.',
  },
  {
    text: 'Het is geen "ik kan het niet". Het is "ik kan het nog niet".',
    source: 'Carol Dweck, over de groeimindset',
    meaning: 'Eén woord verandert een eindpunt in een plek op de weg. Dweck liet zien dat dat verschil bepaalt of mensen doorgaan of afhaken.',
    practice: 'Hoor je jezelf vandaag "ik kan dat niet" zeggen, plak er dan hardop "nog" achter. Ook als het gek voelt.',
  },
  {
    text: 'Handel alsof wat je doet verschil maakt. Dat doet het.',
    source: 'William James',
    meaning: 'Wachten tot je je goed genoeg voelt werkt niet. Gedrag komt eerst; het gevoel komt er meestal achteraan.',
    practice: 'Doe vandaag iets alsof je er zin in had. Meestal komt de zin tijdens, niet ervoor.',
  },
  {
    text: 'Het lijkt altijd onmogelijk, totdat het gedaan is.',
    source: 'Nelson Mandela',
    meaning: '"Onmogelijk" is meestal een inschatting vooraf, geen feit. Achteraf lijkt het vanzelfsprekend dat het kon.',
    practice: 'Noem één ding dat je "niet kunt". Zoek vandaag iemand op die het wél deed, en kijk vooral hoe die begon.',
  },
  {
    text: 'Het leven kan alleen achterwaarts worden begrepen, maar het moet voorwaarts worden geleefd.',
    source: 'Søren Kierkegaard',
    meaning: 'Pas achteraf zie je waarom iets zo liep. Toch moet je nú kiezen, zonder dat inzicht. Dat is geen tekortkoming van jou maar de aard van het leven.',
    practice: 'Wees mild over een keuze uit het verleden die verkeerd uitpakte. Je wist toen niet wat je nu weet.',
  },

  // ── Aandacht en veerkracht ───────────────────────────────────────────────
  {
    text: 'Kunnen we een situatie niet meer veranderen, dan worden we uitgedaagd onszelf te veranderen.',
    source: 'Viktor Frankl, De zin van het bestaan',
    meaning: 'Frankl schreef dit na de kampen. Zijn punt: als alles vastligt, blijft je houding het enige wat nog beweegt — en dat is niet niks, dat is de laatste vrijheid.',
    practice: 'Is er iets wat je niet kunt veranderen? Schrijf op wat je er wél anders in kunt doen.',
  },
  {
    text: 'Het wonder is niet over water lopen. Het wonder is over de aarde lopen.',
    source: 'Thich Nhat Hanh, Het wonder van bewust leven',
    meaning: 'We zoeken het bijzondere in het spectaculaire en lopen ondertussen langs alles heen wat er al is.',
    practice: 'Loop vandaag honderd stappen waarbij je alleen op je voeten let. Verder niets.',
  },
  {
    text: 'Adem in, en weet dat je ademt. Adem uit, en glimlach.',
    source: 'Thich Nhat Hanh',
    meaning: 'Aandacht hoeft niet ingewikkeld te zijn. Eén ademhaling waar je bij bent is al de hele oefening; daar heb je geen kussen of half uur voor nodig.',
    practice: 'Adem vandaag drie keer bewust in en uit voordat je je telefoon pakt.',
  },
  {
    text: 'Jij bent de lucht. Al het andere is het weer.',
    source: 'Pema Chödrön',
    meaning: 'Gevoelens trekken over zoals buien: heftig, en tijdelijk. Jij bent niet je slechte bui, je bent waar hij doorheen trekt.',
    practice: 'Voel je iets zwaars, zeg dan "er is verdriet" in plaats van "ik ben verdrietig". Kijk of dat scheelt.',
  },

  // ── Vragen om mee te beginnen ────────────────────────────────────────────
  // Geen citaten maar vragen: voor deze app geschreven, dus geen bron.
  {
    text: 'Wat is het kleinste wat je vandaag kunt doen waar je morgen dankbaar voor bent?',
    source: null,
    meaning: 'Deze vraag verplaatst je van "wat moet er allemaal" naar "wat helpt de ik van morgen". Dat maakt de keuze klein en concreet in plaats van zwaar.',
    practice: 'Beantwoord hem in één zin en doe dat ding vóór de lunch.',
  },
  {
    text: 'Waar gaat je aandacht vandaag vanzelf heen — en is dat waar je haar wilt hebben?',
    source: null,
    meaning: 'Aandacht is je schaarste, niet tijd. Hij gaat vanzelf naar wat het hardst roept, en dat is zelden wat het belangrijkst is.',
    practice: 'Kies één ding dat vandaag je aandacht níet krijgt. Leg je telefoon in een andere kamer als dat helpt.',
  },
  {
    text: 'Welke gewoonte zou over een jaar het meeste verschil hebben gemaakt?',
    source: null,
    meaning: 'Je overschat wat je in een week doet en onderschat wat een jaar herhaling doet. Deze vraag maakt dat verschil zichtbaar.',
    practice: 'Noem er één en doe hem vandaag voor het eerst — in een versie die zo klein is dat hij niet kan mislukken.',
  },
  {
    text: 'Wat zou je vandaag doen als je zeker wist dat het niet meteen hoefde te lukken?',
    source: null,
    meaning: 'Veel dingen beginnen we niet omdat we ze meteen goed willen doen. Haal die eis weg en er blijft een hoop over dat je gewoon kunt proberen.',
    practice: 'Doe dat ding vandaag expres slecht. Eén keer.',
  },
  {
    text: 'Wat houd je vast dat je eigenlijk allang had kunnen loslaten?',
    source: null,
    meaning: 'Oude ergernissen, plannen die niet meer van jou zijn, spullen, gelijk willen hebben. Vasthouden kost energie die je nergens voor terugkrijgt.',
    practice: 'Noem één ding en laat het vandaag los — of zeg het hardop tegen iemand, dat helpt meestal.',
  },
  {
    text: 'Waar wacht je op, en waar wacht je eigenlijk precies op?',
    source: null,
    meaning: 'Wachten voelt als geduld maar is vaak uitstel met een net jasje aan. Meestal wacht je op een gevoel dat pas ná het beginnen komt.',
    practice: 'Schrijf op waar je op wacht. Kun je het niet in één zin opschrijven, begin dan gewoon.',
  },
  {
    text: 'Wat zou je tegen een goede vriend zeggen die vandaag in jouw schoenen stond?',
    source: null,
    meaning: 'Tegen anderen zijn we redelijk en mild; tegen onszelf hard en overdreven. Dezelfde situatie, een heel ander oordeel.',
    practice: 'Zeg dat vandaag tegen jezelf. Precies zoals je het tegen die vriend zou zeggen.',
  },
  {
    text: 'Welke vijf minuten van vandaag wil je je over een week nog herinneren?',
    source: null,
    meaning: 'Dagen vervagen; momenten blijven. Deze vraag zet je erop dat je zo’n moment ook zelf kunt maken.',
    practice: 'Bedenk welke vijf minuten dat zouden zijn en zorg dat ze gebeuren.',
  },
  {
    text: 'Wat doe je uit gewoonte, en zou je het opnieuw kiezen als je vandaag mocht kiezen?',
    source: null,
    meaning: 'Veel van wat je doet heb je ooit één keer gekozen en daarna nooit meer bekeken. Sommige van die keuzes passen allang niet meer.',
    practice: 'Pak er één en beslis vandaag opnieuw: houden of stoppen.',
  },
  {
    text: 'Waar ben je harder voor jezelf dan je voor de ander zou zijn?',
    source: null,
    meaning: 'Strengheid voelt als discipline maar werkt zelden zo. Wie zichzelf afbrandt na een misstap begint later opnieuw, niet eerder.',
    practice: 'Ging er vandaag iets mis, zeg dan hardop: dit hoort erbij. En ga door.',
  },
  {
    text: 'Wat is er vandaag al goed, voordat er iets moet?',
    source: null,
    meaning: 'De dag begint meestal met een lijst van wat er nog niet is. Deze vraag begint bij wat er wel is — dat verandert de toon van de rest.',
    practice: 'Noem er drie voordat je je telefoon pakt. Hardop of in je hoofd, dat maakt niet uit.',
  },
  {
    text: 'Als vandaag één ding telt, welk ding is dat dan?',
    source: null,
    meaning: 'Een lijst van tien dingen geeft tien keer het gevoel dat je tekortschiet. Eén ding geeft richting, en de rest mag meevallen.',
    practice: 'Kies dat ene ding en doe het eerst — vóór de mail, vóór de rest.',
  },
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
