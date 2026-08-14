/**
 * Het zinnetje van de dag.
 *
 * Bewust geen beroemde uitspraken: die worden op internet aan de lopende band
 * aan de verkeerde persoon toegeschreven, en dan staat er elke dag een leugen
 * op je beginscherm. Dit zijn eigen regels, geschreven voor deze app en voor
 * twee mensen die samen dingen willen.
 *
 * En bewust geen dienst die ze ophaalt: zo staat er ook iets als je geen
 * bereik hebt, en er gaat niets van jullie de deur uit.
 */

export const QUOTES = [
  'Klein en elke dag wint het van groots en soms.',
  'Je hoeft het niet perfect te doen. Je hoeft het te doen.',
  'De dag is nog helemaal open. Pak er één ding uit.',
  'Wat je vandaag begint, is morgen al een gewoonte aan het worden.',
  'Twee mensen die dezelfde kant op kijken komen verder dan twee die trekken.',
  'Vier de kleine dingen. Daar bestaat een leven grotendeels uit.',
  'Een streep door je lijst is een klein feestje. Behandel het ook zo.',
  'Vraag je niet af of je zin hebt. Begin, dan komt de zin vanzelf.',
  'Wat aandacht krijgt, groeit. Kies dus waar je die aandacht laat.',
  'Vandaag hoeft niet je beste dag te worden. Alleen een goede.',
  'Je bent verder dan je denkt. Kijk eens achterom.',
  'Rust is geen luiheid. Rust is het deel waarin je sterker wordt.',
  'Zeg het gewoon tegen elkaar. De meeste dingen worden kleiner als je ze deelt.',
  'Een plan zonder datum is een wens. Zet er een dag bij.',
  'Doe het samen. Alleen ga je sneller, samen hou je het vol.',
  'De beste tijd om te beginnen was vorige maand. De op één na beste is nu.',
  'Wees net zo aardig tegen jezelf als tegen elkaar.',
  'Niet elke dag telt evenveel. Ze tellen wel allemaal mee.',
  'Wat je aandacht geeft aan elkaar, krijg je dubbel terug.',
  'Een reeks van drie is een reeks. Laat hem niet uitgaan.',
  'Je hebt geen motivatie nodig om te beginnen. Je hebt vijf minuten nodig.',
  'Trots zijn op elkaar mag hardop.',
  'Wat vandaag zwaar voelt, is precies het stuk dat je sterker maakt.',
  'Kies vandaag één ding dat je morgen dankbaar zal zijn.',
  'Plannen is liefde: het betekent dat je aan de ander hebt gedacht.',
  'Doe het rustig, maar laat niet los.',
  'Elke keer dat je toch begint, wordt de volgende keer makkelijker.',
  'Zet het in de agenda. Dan bestaat het.',
  'Een dag waarop jullie hebben gelachen is nooit een verloren dag.',
  'Verwacht geen sprong. Verwacht een stap. Doe die.',
  'Wat jullie samen opbouwen, bouw je zin voor zin.',
  'Je hoeft niet alles vandaag. Alleen het volgende.',
  'Wie het leuke inplant, houdt het zware beter vol.',
  'Fouten zijn het bewijs dat je het echt hebt geprobeerd.',
  'Er is altijd tijd voor tien minuten van iets goeds.',
  'Onthoud waarom je begon. Meestal is dat genoeg.',
  'Samen thuiskomen is ook een doel dat je haalt.',
  'Kleine moeite, grote dag: vraag hoe het met de ander gaat.',
  'Doorzetten is niet hard zijn. Het is aardig blijven en toch doorgaan.',
  'Morgen begint met wat je vanavond klaarlegt.',
];

/**
 * Welk zinnetje er vandaag staat. Uit de datum gerekend, dus:
 * — jullie zien allebei hetzelfde
 * — het wisselt om middernacht
 * — er hoeft niets voor opgeslagen of onthouden te worden
 *
 * De keer-31 is een gewone tekstsom; twee opeenvolgende dagen komen daardoor
 * altijd op een ander zinnetje uit.
 */
export function quoteOfDay(dateKey, list = QUOTES) {
  if (!list.length) return '';
  let n = 0;
  for (const ch of String(dateKey)) n = (n * 31 + ch.charCodeAt(0)) % 1_000_003;
  return list[n % list.length];
}
