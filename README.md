# Samen — gedeelde agenda en doelen voor twee

Een kleine web-app voor jullie tweeën. Ieder logt in met een eigen pincode en
ziet daarna alles van de ander: afspraken, doelen en taken. Je zet hem op je
beginscherm en hij gedraagt zich als een gewone app, inclusief herinneringen.

Alles wat jullie invoeren blijft van jullie: op je eigen computer in één
JSON-bestand, of online in je eigen database. Met één klik heb je er een kopie
van.

## Wat erin zit

**Agenda.** Afspraken met begin- en eindtijd, of voor de hele dag. Elke
afspraak hoort bij jou, bij haar, of bij jullie samen — te zien aan de kleur.
Herhalingen (dagelijks, wekelijks, maandelijks, jaarlijks, eventueel met een
einddatum) en een herinnering vooraf. Jullie kunnen ook in elkaars agenda
zetten; wie het aanmaakte wordt onthouden.

**Doelen.** Twee soorten:

- *Gewoontes* die je afvinkt: elke dag, of een aantal keer per week. Je ziet je
  reeks, deze week, en een heatmap van de afgelopen dertien weken.
- *Projecten* die naar een streefgetal toewerken, bijvoorbeeld "€3000 sparen
  voor Italië" met een streefdatum. Je schrijft bedragen bij en de app zegt of
  je op schema ligt.

Beide soorten kunnen van jou zijn, van haar, of van jullie samen. Bij een
samen-doel telt een dag zodra één van jullie afvinkt, en zie je per persoon wie
wat heeft bijgedragen.

**Momenten.** Alles wat leuk is staat bij elkaar. Bij het maken van een
afspraak kies je of het gewoon is, een *leuk ding*, of een *vakantie* — die
laatste loopt over meerdere dagen en verschijnt de hele periode in de agenda.
Op het Momenten-scherm staat links wat eraan komt, met een afteller ("over 12
dagen"), en rechts alles wat geweest is, met de nieuwste bovenaan.

Tik je zo'n moment aan, dan open je het album: foto's en opmerkingen. Foto's
worden in je browser verkleind voordat ze verstuurd worden, dus een kiekje van
5 MB kost er nog een paar honderd kB. Een vakantie van tien dagen krijgt één
album; een afspraak die zich herhaalt krijgt er een per keer.

**Taken.** Een gedeeld lijstje. Toewijzen aan jezelf, aan de ander, aan jullie
samen, of aan "wie het eerst kan". Met een datum erbij verschijnt de taak op
Vandaag.

**Week.** Eén scherm met de hele week: alle afspraken van jullie
beiden onder elkaar per dag, en daaronder hoe elk doel er deze week voor staat.

**Herinneringen.** Een melding op je telefoon vóór een afspraak, en één keer
per dag een overzicht van doelen die nog openstaan.

## Zo zet je hem op

Je hebt Node.js 20 of nieuwer nodig.

```bash
npm install
npm run setup     # maakt .env met een sessiegeheim en sleutels voor meldingen
npm start
```

Open daarna http://localhost:3000. De eerste keer vraagt de app om jullie twee
namen en twee pincodes. Daarna log je in met je eigen pincode.

Draaien de tests:

```bash
npm test
```

## Online zetten

Lokaal draaien werkt alleen als de computer aanstaat en jullie op hetzelfde
netwerk zitten. Om er op je telefoon overal bij te kunnen, moet de app ergens
draaien die altijd aan staat.

Er is maar één ding dat je echt moet invullen: **waar de gegevens heen gaan**.
Het sessiegeheim en de sleutels voor meldingen maakt de app bij de eerste start
zelf aan en bewaart hij bij de rest van de gegevens.

### Vercel met Supabase (serverless)

Vercel start per verzoek een functie in plaats van een server die blijft
draaien. Er is dus geen schijf die iets onthoudt, en niets dat elke minuut kan
kijken of er een herinnering klaarstaat. Beide zijn opgelost:

- Zet `DATABASE_URL` op de *Transaction pooler*-verbinding van je Supabase-
  project. De app gebruikt dan Postgres in plaats van een bestand. Draai eerst
  de twee migraties uit `db/` (schema `samen` met de tabellen `store` en
  `photo_data`).
- Laat een taak in de database elke minuut `/api/cron/tick` aanroepen. Dat
  adres is afgeschermd met een geheim uit de opslag; hoe je die taak aanmaakt
  staat onder [Herinneringen zonder server](#herinneringen-zonder-server).

`vercel.json` en `api/index.js` staan klaar. Koppel de repository in Vercel en
elke push rolt vanzelf uit.

### Fly.io (server die blijft draaien)

`fly.toml` en `Dockerfile` staan klaar. Verzin een eigen `app`-naam in
`fly.toml` en dan:

```bash
fly launch --copy-config --no-deploy
fly volumes create samen_data --size 1 --region ams
fly secrets set SESSION_SECRET=... VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_CONTACT=mailto:jij@example.com
fly deploy
```

De waarden voor die drie sleutels drukt `npm run setup` voor je af.

### Render

`render.yaml` staat klaar. Koppel de repository, vul in het dashboard
`SESSION_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` en `VAPID_CONTACT`
in. Let op: de schijf in `render.yaml` zit niet in het gratis pakket.

### Herinneringen zonder server

Draait de app serverless, dan is er geen proces dat de klok in de gaten houdt.
Laat Postgres het doen — `pg_cron` en `pg_net` staan bij Supabase klaar:

```sql
select cron.schedule('samen-tick', '* * * * *', $$
  select net.http_post(
    url     := 'https://JOUW-APP.vercel.app/api/cron/tick',
    headers := jsonb_build_object('x-samen-cron', 'HET-GEHEIM-UIT-DE-OPSLAG')
  );
$$);
```

Het geheim vind je met `select data->'settings'->>'cronSecret' from samen.store;`.

### Iets anders

Elke plek waar Docker draait volstaat, ook een Raspberry Pi of een oude laptop
bij jullie thuis. Zet dan wel https ervoor (bijvoorbeeld via Caddy of
Cloudflare Tunnel): zonder https werken meldingen niet en gaat je pincode
onversleuteld over de lijn.

## Op je beginscherm zetten

- **Android:** open de app in Chrome → menu → *App installeren*.
- **iPhone:** open de app in Safari → deelknop → *Zet op beginscherm*. Op iOS
  werken meldingen alléén als je dit doet.

Ga daarna naar **Meer → Herinneringen** en zet meldingen aan. Dat moet op elk
apparaat apart.

## Instellingen

Alles staat in `.env` (zie `.env.example`):

| Instelling | Waarvoor |
| --- | --- |
| `DATABASE_URL` | Postgres-verbinding. Leeg = alles in een bestand op schijf. |
| `SESSION_SECRET` | Ondertekent het sessiecookie. Leeg laten mag: de app maakt er zelf een en bewaart die. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Voor push-meldingen. Ook deze maakt de app zelf aan als je ze leeg laat. |
| `VAPID_CONTACT` | Een e-mailadres, verplicht onderdeel van de push-standaard. |
| `DAILY_DIGEST_AT` | Tijd van het dagelijkse overzicht van openstaande doelen. Standaard 20:00. |
| `TIMEZONE` | Waarin "vandaag" wordt bepaald. Standaard Europe/Amsterdam. |
| `DB_FILE` | Waar de gegevens staan als er geen `DATABASE_URL` is. Standaard `data/samen.json`. |
| `SESSION_DAYS` | Hoe lang je ingelogd blijft. Standaard 90 dagen. |
| `SECURE_COOKIES` | Aan zetten zodra de app achter https draait. |
| `PORT` | Standaard 3000. |

## Back-up

**Meer → Back-up → Gegevens downloaden** geeft je één JSON-bestand met alles
erin, zonder pincodes en zonder sleutels. Foto's zitten er niet in — die staan
apart en zijn te groot voor een bestandje in je downloads. Terugzetten vervangt
agenda, doelen en taken; jullie inloggegevens blijven staan. Doe dit af en toe — het is één klik en het scheelt
verdriet.

## Over privacy en beveiliging

Jullie zien elkaar volledig: er is bewust geen manier om iets voor de ander te
verbergen. Dat was de opzet.

De pincodes staan alleen versleuteld opgeslagen (scrypt met een eigen salt per
persoon) en komen nooit mee in een export. Na vijf misgokken gaat het inloggen
vijftien minuten op slot, per combinatie van apparaat en persoon — dat is wat
een korte pincode bruikbaar houdt. Wil je het steviger, kies dan een pincode
van zes cijfers of meer; dat mag tot tien.

## Hoe het in elkaar zit

```
src/
  server.js          alle API-routes
  auth.js            pincodes, sessies, slot na te vaak misgokken
  store.js           twee opslagvormen: een JSON-bestand of Postgres
  db.js              de opslag per aanvraag laden en wegschrijven
  push.js            versturen van meldingen
  scheduler.js       elke minuut kijken of er iets verstuurd moet worden
  config.js          instellingen uit .env
  lib/
    dates.js         datums en tijdzones
    recurrence.js    herhalingen en meerdaagse afspraken uitrekenen
    goals.js         reeksen, weekstanden, projectvoortgang
    validate.js      invoer controleren
api/index.js         ingang voor Vercel
public/              de app zelf: één html, één css, één js, geen bouwstap
tests/               81 tests over datums, herhalingen, doelen, invoer en de API
```

Geen bouwstap en geen framework. Wat je in `public/` ziet is precies wat de
browser krijgt, en dat blijft over vijf jaar nog werken.
