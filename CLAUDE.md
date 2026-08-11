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
- **Geen decoratieve afbeeldingen in de interface.** Alles is CSS en SVG.
  Achtergronden achter de agenda of de doelen zijn afgewezen: kost leesbaarheid
  en laadtijd op schermen die je tien keer per dag bekijkt. Twee uitzonderingen,
  allebei inhoud en geen versiering: de **avatars** van Julian en zijn vriendin
  (`public/avatars/a1.jpg` en `a2.jpg`, ~27 kB per stuk), en foto's in albums.
  Het app-icoon en het deelplaatje staan buiten de app.
- **De avatar hoort bij de plek in de rij.** De eerste persoon uit het
  instelscherm krijgt `a1.jpg`, de tweede `a2.jpg` — dezelfde volgorde die ook
  de kleur bepaalt. Daardoor is er niets in te stellen en niets op te slaan.
  Laadt een plaatje niet, dan staat de beginletter er nog: de app werkt dus ook
  zonder avatars.
- **Diepte en beweging zijn versiering, nooit constructie.** Er hangt geen
  enkele knop of scherm aan een animatie: haal het hele blok "Diepte en
  beweging" uit `styles.css` en de app doet nog precies hetzelfde. Wie in zijn
  telefoon beweging uitzet, krijgt de rustige versie — de eindeloos lopende
  animaties worden dan echt uitgezet, niet alleen versneld.

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
2. **De repository op privé zetten** is Julian aangeraden maar nog niet gedaan.
3. **Het databasewachtwoord vervangen** kan wanneer hij wil; het is een keer in
   een gesprek langsgekomen.

## Higgsfield

Gedaan: het app-icoon en het deelplaatje zijn ermee gemaakt. Niet gebruikt voor
achtergronden in de app zelf — die afspraak staat.

Zo werkt het, mocht er ooit een nieuw plaatje nodig zijn. De sleutels staan als
`HIGGSFIELD_API_KEY` en `HIGGSFIELD_API_SECRET` in de omgevingsvariabelen; ze
gaan als `hf-api-key` en `hf-secret` mee in de kop van de aanvraag.

```
POST https://platform.higgsfield.ai/v1/text2image/soul
{"params":{"prompt":"...","width_and_height":"1536x1536","enhance_prompt":true}}
GET  https://platform.higgsfield.ai/v1/job-sets/<id>     # tot status "completed"
```

Dingen die tijd kosten als je ze niet weet:

- **Vraag het met `curl`, niet met Python.** Cloudflare weigert de aanvraag van
  `urllib` met foutcode 1010; via `curl` gaat hij er gewoon doorheen.
- **Het model tekent een icoon mét witte marge en ronde hoeken.** iOS legt daar
  zijn eigen masker overheen, dus die marge moet eraf: bijsnijden tot een vol
  vlak, anders krijg je een geslonken icoon met witte hoekjes.
- **`enhance_prompt` gooit je stijlopdracht weg.** Hij herschrijft je prompt tot
  een fotobeschrijving. Vraag je om een geïllustreerde avatar, dan krijg je een
  foto. Zet hem op `false` zodra de stijl belangrijker is dan de rijkdom.
- **Julians eigen sleutel heeft alleen `soul`,** en dat is tekst-naar-beeld.
  Modellen die een referentiefoto aannemen (`nano_banana_pro`, `soul_2`) zitten
  alleen achter de MCP. Een plaatje *van een foto* maken kan dus niet met zijn
  eigen sleutel.
- **`batch_size` mag alleen 1 of 4 zijn.** Vier varianten en dan de beste kiezen
  werkt goed; bij gezichten is de eerste poging zelden meteen raak.

De Higgsfield-MCP is iets anders: die loopt via een gekoppeld account, en dat is
inmiddels **door zijn credits heen**. Gebruik de API met Julians eigen sleutels.

**De avatars zijn getekend met `soul`, uit een beschrijving — niet uit hun
foto.** De weg erheen, zodat je hem niet opnieuw hoeft te zoeken:

1. Met `soul_2` en hun eigen foto als referentie (via de MCP) kwamen er twee
   vreemden uit die vaag op ze leken. Onbruikbaar; die route is een doodlopende
   weg voor gelijkenis.
2. Wat wél werkt: `enhance_prompt: false` en een prompt die de persoon in
   kenmerken beschrijft — kapsel en kleur, ogen, pet, neusring, kleding — plus
   een harde stijlopdracht ("flat vector, dunne donkere omlijning, egale
   kleuren, effen pastelachtergrond, geen tekst").
3. Snijd daarna vierkant bij rond het hoofd (een paar regels Pillow) en schaal
   naar 320 px. Groter heeft geen zin: het grootste rondje in de app is 46 px.

## Met Julian praten

Hij is geen ontwikkelaar. Leg dingen uit in gewone taal, zonder jargon, en geef
bij een instelling het exacte klikpad — hij stuurt schermafbeeldingen als hij er
niet uitkomt, en dat werkt goed. Zeg eerlijk wat je wel en niet hebt kunnen
controleren. Draaf niet door in opties: kies er een, zeg waarom, en ga door.
