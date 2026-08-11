# Samen — werkafspraken voor deze repo

Deze repo bevat één ding: **Samen**, een web-app waarmee Julian en zijn vriendin
één agenda, hun doelen en hun leuke momenten delen. Lees eerst de `README.md`
voor wat de app doet; dit bestand gaat over hoe eraan gewerkt wordt en waarom
bepaalde keuzes zo zijn.

> Deze repository is **openbaar**. Zet hier nooit wachtwoorden, sleutels of
> verbindingsgegevens in. Die horen in omgevingsvariabelen.

## De taal

De app, de commit-berichten, de codecommentaren en het gesprek met Julian zijn
**Nederlands**. Alleen de code zelf (functienamen, sleutels in de opslag) is
Engels. Niet halverwege omschakelen.

## Wat er is besloten, en waarom

Deze keuzes zijn met Julian doorgenomen. Verander ze niet zonder het te vragen.

- **Alles is voor elkaar zichtbaar.** Er is bewust geen manier om een afspraak
  of doel voor de ander te verbergen. Dat was de uitdrukkelijke wens.
- **Inloggen met een eigen pincode per persoon.** Kort en snel; de veiligheid
  komt uit het slot na vijf misgokken, niet uit de lengte.
- **Vaste kleuren.** De eerste persoon die bij het inrichten wordt ingevuld
  krijgt blauw, de tweede roze, en "Samen" is geel. De letterkleur op een
  gekleurd blok wordt uitgerekend uit de helderheid.
- **Geen bouwstap, geen framework.** Wat in `public/` staat is precies wat de
  browser krijgt. Dat blijft over vijf jaar nog werken en laadt meteen.
- **Geen afbeeldingen in de interface.** Alles is CSS en SVG. Achtergronden
  achter de agenda of de doelen zijn eerder afgewezen: kost leesbaarheid en
  laadtijd op schermen die je tien keer per dag bekijkt.

## Hoe het in elkaar zit

```
src/
  server.js       alle API-routes
  auth.js         pincodes, sessies, slot na te vaak misgokken
  store.js        twee opslagvormen: een JSON-bestand of Postgres
  db.js           de opslag per aanvraag laden en wegschrijven
  push.js         meldingen versturen
  scheduler.js    elke minuut kijken of er iets verstuurd moet worden
  lib/            datums, herhalingen, doelen, invoercontrole
api/index.js      ingang voor Vercel
public/           de app zelf: één html, één css, één js
db/               de SQL-migraties (schema `samen`)
tests/            81 tests
```

Vier dingen die niet vanzelfsprekend zijn:

1. **De hele inhoud staat als één JSONB-rij in `samen.store`.** Voor twee mensen
   is dat ruim voldoende en het scheelt een migratie bij elke nieuwe soort
   gegevens. Schrijvende aanvragen pakken een rijvergrendeling, zodat ze elkaar
   niet overschrijven.
2. **De opslag wordt per aanvraag geladen, niet bij het opstarten.** Op Vercel
   draaien meerdere exemplaren naast elkaar. `AsyncLocalStorage` draagt de
   gegevens mee, zodat `db()` overal blijft werken. Het antwoord gaat pas de
   deur uit nadat de wijziging is weggeschreven — een serverless proces kan
   vlak daarna bevriezen.
3. **Foto's staan apart, in `samen.photo_data`.** Ze zouden die ene JSONB-rij
   onwerkbaar maken. Alleen lichte metagegevens (wie, wanneer, welk album)
   staan in de store. De browser verkleint een foto naar maximaal 1600 pixels
   voor het versturen.
4. **Herinneringen komen van een taak in Postgres.** Op Vercel draait geen
   doorlopend proces, dus `pg_cron` roept elke minuut `/api/cron/tick` aan.
   Dat adres is afgeschermd met een geheim uit de opslag.

Sleutels (sessiegeheim, VAPID, cron) maakt de app bij de eerste start zelf aan
en bewaart hij in de opslag. Daardoor is er bij het uitrollen maar één ding
echt nodig: `DATABASE_URL`.

## Werkwijze

```bash
npm install
npm test          # 81 tests
npm start         # draait op een JSON-bestand in data/
```

**Controleer werk in een echte browser, niet alleen met tests.** Playwright
staat klaar; Chromium staat op `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
Elke ronde tot nu toe leverde zo minstens één echte fout op die de tests niet
zagen — een lege waarde die als de tekst "null" op het scherm kwam, twee
schermen die over elkaar heen stonden, een titel die halverwege zijn blok hing.

**Meet, kijk niet.** Op een schermafbeelding ziet fout er vaak "ongeveer goed"
uit. De laatste twee fouten kwamen pas boven door de posities uit de pagina te
lezen in plaats van naar het plaatje te turen.

Draai de server opnieuw met verse gegevens (`rm -rf data`) voordat je een
browsertest doet; anders stapelen testafspraken zich op.

## Waar het draait

- **Vercel**, project `samen-agenda`, gekoppeld aan deze repo. De productie-
  branch is `claude/shared-calendar-goals-app-o38fg4`, niet `main`. Elke push
  daarheen rolt vanzelf uit. De functie draait in Frankfurt, vlak bij de database.
- **Supabase**, schema `samen` in Julians bestaande project — bewust een eigen
  schema, want in `public` staat ander werk van hem. De app gebruikt een eigen
  databasegebruiker `samen_app` die alleen bij dat schema kan.
- De enige omgevingsvariabele die Vercel nodig heeft is `DATABASE_URL`.

Project- en team-ids kun je zelf opvragen met de Vercel- en Supabase-tools; ze
staan expres niet in dit openbare bestand.

## Waar we gebleven zijn

De app staat live op **https://samen-agenda.vercel.app** en werkt: opslag op
Postgres bevestigd via `/api/health`, en de herinneringstaak in Postgres krijgt
netjes antwoord.

Openstaand:

1. **Julian en zijn vriendin moeten de app nog inrichten** (twee namen, twee
   pincodes) en op hun beginscherm zetten. Tot die tijd is `users` leeg.
2. **Higgsfield koppelen.** Julian heeft het netwerkbeleid van deze omgeving op
   *Full* gezet en zet `HF_API_KEY` en `HF_API_SECRET` in de omgevings-
   variabelen (of `HF_KEY` als hij één string met een dubbele punt heeft).
   Controleer eerst of `platform.higgsfield.ai` bereikbaar is. Let op: de
   Higgsfield-MCP loopt via een gekoppeld account dat bijna geen credits meer
   heeft — dat is iets anders dan zijn API-sleutel.
   Waar het voor bedoeld is: een mooier app-icoon, en een deelplaatje zodat de
   link in WhatsApp niet kaal oogt. Niet: achtergronden in de app zelf.
3. **De repository op privé zetten** is Julian aangeraden maar nog niet gedaan.
4. **Het databasewachtwoord vervangen** kan wanneer hij wil; het is een keer in
   een gesprek langsgekomen.

## Met Julian praten

Hij is geen ontwikkelaar. Leg dingen uit in gewone taal, zonder jargon, en geef
bij een instelling het exacte klikpad — hij stuurt schermafbeeldingen als hij er
niet uitkomt, en dat werkt goed. Zeg eerlijk wat je wel en niet hebt kunnen
controleren. Draaf niet door in opties: kies er een, zeg waarom, en ga door.
