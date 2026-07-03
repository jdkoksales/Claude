# DECISIONS — genomen beslissingen en waarom

1. **Chatvenster volledig verwijderd, historie bewaard.** De prompt verbiedt
   een open chat (voedt afhankelijkheid). De volledige chatgeschiedenis is
   niet weggegooid maar verplaatst naar `archive.chat` en zit in de export.

2. **Cron-check-ins en push-meldingen verwijderd** (node-cron, web-push,
   `src/push.js`). Geplande AI-berichten botsen frontaal met "de code bepaalt
   wanneer de coach afgaat" en "max 1 interventie per dag". De coach draait
   nu uitsluitend bij het openen van de app, op deterministische triggers.
   Oude push-abonnementen staan in `archive.subs`.

3. **Agent-tools (taken/doelen/agenda/web-search) en Google-integratie
   verwijderd.** Ze bestonden alleen voor de chat-agent. De coach-call is nu
   één JSON-in/JSON-uit-request zonder tools — kleiner aanvalsvlak, geen
   verrassingen. `googleapis` is als dependency verwijderd.

4. **Taken-lijst behouden, ongewijzigd.** Bestaande functionaliteit die
   losstaat van het faalpatroon; verwijderen zou functionaliteitsverlies zijn.

5. **Streaks vervangen door "dagen actief" + "comebacks".** Streaks worden
   nergens meer getoond of berekend. Historie migreert: elke oude
   progress-entry telt als actieve dag (level `target`, want er is die dag
   echt iets gedaan). Comeback = actieve dag na ≥2 volledig gemiste dagen;
   de eerste actieve dag ooit telt niet als comeback.

6. **Minimum-generatie bij migratie:** heuristiek op de doeltitel (sport →
   "2 minuten bewegen", lezen → "1 bladzijde", anders "2 minuten bezig met:
   <titel>"). Bewust conservatief klein; met ✎ in één klik bij te stellen.
   Oude numerieke velden (target_value/unit) blijven onder `goal.legacy`.

7. **Intentievelden bij gemigreerde doelen leeg.** Oude doelen hebben geen
   anker/plek; de app toont dan alleen de actie en nodigt uit ze aan te
   vullen. Nieuwe doelen dwingen het format "Na [gewoonte] doe ik [actie]
   op [plek]" af (alle drie verplicht).

8. **Meer dan 3 actieve doelen bij migratie:** nieuwste 3 blijven actief,
   oudere worden `paused` (niets verwijderd). Hard limiet zit server-side;
   de UI raadt expliciet 1 doel aan.

9. **"Vandaag niet" (skip) is een bewuste keuze en telt niet als actieve dag,
   maar breekt ook niets** — er bestaat niets meer dat kan breken. Skips
   worden wel gemeten (oplopende skips is een drift-signaal voor de coach).

10. **Daggrens 03:00 = lokale kloktijd van de machine waarop de server
    draait** (de eigen PC van de gebruiker). Geen timezone-configuratie —
    minder instellingen, minder foutbronnen.

11. **Coach-model:** `CLAUDE_MODEL` (default `claude-sonnet-4-6`), max_tokens
    500. Het aparte "coachModel" (Opus) is geschrapt: het kaartje is max 2
    zinnen; een zwaarder model voegt alleen kosten toe.

12. **Systeemprompt gehardcoded in `src/coach.js`** conform de prompt,
    inclusief: missen is normaal; bij twijfel minimum verkleinen, nooit
    vergroten; comebacks vieren; max 2 zinnen NL + 1-3 acties uit vaste
    lijst; bij aanhoudend vastlopen doorverwijzen naar mensen om de
    gebruiker heen; uitsluitend JSON `{bericht, acties:[{label,type}]}`.

13. **Vaste actielijst:** `verklein_minimum` (opent het minimumveld met een
    kleiner voorstel), `pauzeer_doel` (1 week pauze), `laat_zo` (sluiten).
    Onbekende types uit het AI-antwoord worden weggefilterd; lege lijst →
    alleen "laat zo". De actie geldt voor het doel dat de trigger aanwees.

14. **Defensieve parser:** ```-fences strippen, eerste JSON-object parsen,
    schema valideren (bericht ≤ 400 tekens; ≤ 3 acties; alleen whitelisted
    types). Elke afwijking of API-fout → statisch welkom-terug-kaartje.
    Coach-uitval maakt de app dus nooit onbruikbaar.

15. **Tests met Node's ingebouwde `node:test`** — nul nieuwe dependencies,
    conform "geen nieuwe frameworks tenzij nodig". `npm test` draait alles.

16. **Geen build-stap** (was er niet, komt er niet): "build foutloos" is
    hier `npm install` + `npm test` + opstart zonder fouten.

17. **Export/import:** export = volledige store als download; import
    accepteert v1- én v2-bestanden (migratie draait automatisch), maakt
    eerst een backup van de huidige data, en valideert vóór vervangen.

18. **Weekreview:** 4 vaste vragen (goedkoop, max 3 min), default zondag,
    instelbaar in de app; overslaan is één klik en wordt zonder oordeel
    geregistreerd. De laatste review gaat mee in de coach-payload.

19. **PWA blijft, meldingen niet.** Installeerbaar via manifest + service
    worker (offline shell); pushlaag is bewust gesloopt (zie besluit 2).

20. **`USER_NAME` blijft optioneel** voor de begroeting; `CLAUDE_PERSONA`,
    `CLAUDE_COACH_MODEL`, `CLAUDE_WEB_SEARCH`, `COACH_*`- en `GOOGLE_*`-
    variabelen vervallen (opgeruimd in `.env.example`; oude .env-regels
    worden genegeerd, niets breekt).
