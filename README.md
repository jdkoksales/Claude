# Mijn Coach — doelen volhouden zonder alles-of-niets

Een lokale app (op je eigen PC) voor wie gemotiveerd start, rond week 2-3
afhaakt en na één gemiste dag alles laat vallen. Alles in deze app is daarop
ontworpen:

- 🚫 **Geen streaks.** Missen is verwacht gedrag. De app telt **dagen actief**
  en **comebacks** (weer beginnen na een gat) — en viert die comebacks.
- 🪜 **Twee niveaus per doel.** Een **minimum** (max 2 minuten, onmogelijk te
  falen) en een **target**. Een minimum-dag is een volwaardig succes.
- ✍️ **Doelen als implementatie-intentie**, afgedwongen format:
  *"Na [bestaande gewoonte] doe ik [actie] op [plek]"* — max **3 actieve
  doelen** (en eigenlijk werkt 1 het best).
- 👆 **Dagflow zonder frictie.** De app opent op VANDAAG; per doel drie
  knoppen: **[✓ Minimum] [✓✓ Target] [Vandaag niet]** — één tik, geen
  bevestigingen. Gisteren mag je alsnog loggen; verder terug niet.
  Een "dag" loopt tot **03:00**.
- 🗓️ **Maand-heatmap per doel:** licht = minimum, donker = target, leeg = leeg.
- 🤖 **AI-coach die je met rust laat.** Deterministische code checkt bij het
  openen de laatste ~14 dagen (drift naar minimums, oplopende "vandaag niet",
  gaten, comebacks). Alléén dan gaat er een samenvatting naar de Claude-API en
  verschijnt er één kort kaartje met 1-3 één-tik-acties. Max één interventie
  per dag, geen chatvenster. Valt de API uit → statisch welkom-terug-kaartje;
  de app werkt altijd 100% zonder coach.
- 📋 **Weekreview:** 4 korte vragen op je eigen gekozen dag, overslaanbaar.
- 💾 **Export/import** van al je data (JSON), prominent in de app.
- ✅ Plus een simpele takenlijst, pincode-slot, licht/donker, NL, mobiel.

## Draaien

```bash
npm install
npm run check    # controleert je .env
npm start        # of dubbelklik start-coach.bat (Windows)
```

Open **http://localhost:3000** en voer je pincode in.

### .env instellen (eenmalig)

Maak een bestand `.env` in de projectmap (zie `.env.example`):

```
ANTHROPIC_API_KEY=sk-ant-jouw-key
APP_PIN=4821
```

- **API-sleutel**: https://console.anthropic.com/ → API Keys (zet ook wat
  tegoed op Billing). De sleutel blijft op de server (je eigen PC) en komt
  nooit in de browser terecht.
- **APP_PIN**: zelfgekozen 4-6 cijfers waarmee je de app opent.
- Optioneel: `USER_NAME=Julian` (begroeting), `PORT`, `CLAUDE_MODEL`.

## Kom je van de vorige versie? (chat/streaks-versie)

```bash
git pull
npm install
npm start
```

Bij de eerste start gebeurt automatisch:
1. Er wordt een **backup** van je oude data gemaakt
   (`data/backup-v1-<datum>.json`).
2. Je data **migreert zonder verlies**: doelen krijgen een gegenereerd
   minimum (pas het aan met ✎), je voortgangshistorie telt mee als actieve
   dagen, en je chat/feed-geschiedenis blijft bewaard in het archief
   (zit in elke export).
3. Streaks bestaan niet meer; je historie telt voortaan als dagen actief +
   comebacks.

Het chatvenster en de geplande check-ins zijn bewust verdwenen — zie
`DECISIONS.md` voor alle keuzes en `UPGRADE_PLAN.md` voor het volledige plan.

## Mobiel gebruiken

- **Thuis (zelfde WiFi):** open `http://<ip-van-je-pc>:3000` op je telefoon
  (IP vinden: `ipconfig` → "IPv4-adres").
- **Onderweg:** installeer [Tailscale](https://tailscale.com) (gratis) op PC
  én telefoon, log in met hetzelfde account en draai op de PC:
  `tailscale serve --bg 3000`. Je krijgt een vast https-adres dat overal
  werkt (zolang je PC aanstaat). Voeg de pagina toe aan je beginscherm voor
  een app-icoon.

## Backuppen

Gebruik **⬇ Exporteer alles (JSON)** onderin de app en bewaar het bestand
ergens veilig. Terugzetten: **⬆ Importeer backup** — accepteert ook backups
van de oude versie (migreert automatisch) en maakt vóór het overschrijven
zelf een reservekopie in `data/`.

## Automatisch starten met Windows

1. Dubbelklik `start-coach.bat` om te testen (opent vanzelf je browser).
2. **Win + R** → `shell:startup` → Enter.
3. Sleep een snelkoppeling naar `start-coach.bat` in die map.

## Voor ontwikkelaars

- `npm test` — 35 unit tests (node:test, geen extra dependencies) over de
  03:00-daggrens, gisteren-loggen, comeback/drift-detectie, migratie v1→v2
  en de defensieve coach-parser (incl. kapotte antwoorden → fallback).
- `npm run dev` — start met auto-herstart bij wijzigingen.
- Geen build-stap; vanilla JS + Express + één JSON-bestand
  (`data/coach.json`, schema v2 met versieveld).

## Kosten & privacy

- De coach doet hoogstens één kleine API-call per dag (alleen bij een
  trigger): centen per maand.
- Al je data staat lokaal in `data/` op je eigen PC (staat niet in git).
  Alleen de compacte log-samenvatting gaat naar de Anthropic-API, en alleen
  wanneer de coach afgaat.
