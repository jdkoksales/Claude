# Persoonlijke assistent + coach in Slack (powered by Claude)

Een eigen AI-teamgenoot in Slack die:

- 🗂️ **taken & planning** bijhoudt (toevoegen, tonen, afvinken);
- 🎯 **doelen en voortgang** onthoudt en je eraan helpt herinneren;
- ✍️ **teksten opstelt** (mails, berichten, samenvattingen);
- 🔎 **op internet zoekt** (via Claude's ingebouwde web-search);
- 📅 optioneel **Google Calendar & Gmail** bedient;
- 🌅 **proactief coacht** met ochtend-/avond-check-ins en een wekelijkse review.

Het draait op de **Claude API**, dus je betaalt per gebruik (typisch een paar
euro per maand voor persoonlijk gebruik) in plaats van een vast duur abonnement.

## Hoe het werkt

```
            Slack (Socket Mode)
                  │  @mention / DM
                  ▼
        src/app.js  ──►  src/claude.js  ──►  Claude API (tool use + web search)
                  ▲             │
   proactieve     │             ▼
   check-ins ◄────┤        src/tools.js ──► src/db.js (SQLite: taken/doelen/voortgang)
   (src/coach.js) │             └────────► src/google.js (Calendar/Gmail, optioneel)
```

- **Geheugen**: alles staat in een lokale SQLite-database (`data/assistant.db`).
  Een samenvatting daarvan gaat bij elk gesprek mee als context, zodat de coach
  continuïteit heeft.
- **Tool use**: Claude krijgt echte "knoppen" (taken, doelen, agenda, mail) en
  kiest zelf wanneer hij die gebruikt.
- **Proactief**: `node-cron` plant de check-ins; ze worden naar je
  `SLACK_COACH_CHANNEL` gepost.

## Setup

### 1. Slack-app aanmaken
1. https://api.slack.com/apps → **Create New App** → **From an app manifest**.
2. Plak [`slack-app-manifest.json`](./slack-app-manifest.json).
3. **Basic Information → App-Level Tokens**: maak een token met scope
   `connections:write` → dat is `SLACK_APP_TOKEN` (`xapp-...`).
4. **OAuth & Permissions**: installeer in je workspace, kopieer het
   **Bot User OAuth Token** (`xoxb-...`) → `SLACK_BOT_TOKEN`.
5. Voor `SLACK_COACH_CHANNEL`: open een DM met je bot (of een kanaal waar hij in
   zit) en kopieer het channel-id (begint met `D` of `C`).

### 2. Configureren
```bash
cp .env.example .env
# vul minimaal in: SLACK_BOT_TOKEN, SLACK_APP_TOKEN, ANTHROPIC_API_KEY, SLACK_COACH_CHANNEL
```
Een Anthropic-sleutel haal je bij https://console.anthropic.com/.

### 3. Starten
```bash
npm install
npm start
```
Je ziet: `⚡️ Persoonlijke assistent draait in Slack als @...`.

> **Let op:** de check-ins werken alleen zolang het proces draait. Voor 24/7
> coaching zet je dit op een altijd-aan machine (een goedkope VPS, een Raspberry
> Pi, of een klein cloud-servertje) en houd je het draaiend met bv. `pm2` of een
> systemd-service.

### 4. Gebruiken
- Nodig de bot uit in een kanaal (`/invite @...`) en tag hem, of stuur een DM.
- Voorbeelden:
  - "Zet *offerte sturen naar Jan* op mijn takenlijst voor vrijdag."
  - "Wat staat er nog open?"
  - "Mijn doel is 3x per week sporten — hou dat bij."
  - "Zoek de openingstijden van de bibliotheek op en vat ze samen."
  - "Schrijf een nette mail om een afspraak te verzetten."

## Google Calendar & Gmail (optioneel)

De agenda/mail-tools zitten erin maar staan uit tot je deze invult. Zo zet je ze aan:

1. Ga naar de [Google Cloud Console](https://console.cloud.google.com/) → nieuw
   project → **APIs & Services**.
2. Zet **Google Calendar API** en **Gmail API** aan.
3. **OAuth consent screen** instellen (extern, jezelf als testgebruiker).
4. **Credentials → OAuth client ID** (type *Desktop app*) → kopieer
   `GOOGLE_CLIENT_ID` en `GOOGLE_CLIENT_SECRET`.
5. Genereer eenmalig een **refresh token** met scopes
   `https://www.googleapis.com/auth/calendar` en
   `https://www.googleapis.com/auth/gmail.compose` (bv. via de
   [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)) →
   `GOOGLE_REFRESH_TOKEN`.
6. Vul de drie waarden in `.env` en herstart. De assistent merkt vanzelf dat de
   tools nu beschikbaar zijn.

> Gmail maakt bewust alleen **concepten** (drafts) aan — hij verstuurt niets
> automatisch, zodat jij altijd de laatste check hebt.

## Aanpassen

| Wat | Waar |
| --- | --- |
| Persona (assistent + coach) | `CLAUDE_PERSONA` in `.env` |
| Model voor chat / voor coaching | `CLAUDE_MODEL` / `CLAUDE_COACH_MODEL` |
| Web-search aan/uit | `CLAUDE_WEB_SEARCH` |
| Tijden van check-ins | `COACH_*_CRON` + `COACH_TIMEZONE` |
| Check-ins helemaal uit | `COACH_ENABLED=false` |

## Kosten in het kort
- **Claude API**: per token. Lichte persoonlijke usage ≈ enkele euro's/maand.
  Web-search en Opus-coaching kosten iets meer; stel ze af naar smaak.
- **Slack**: een gratis/bestaand plan volstaat (dit is je eigen app, geen
  betaalde Claude-Slack-integratie).
- **Hosting**: alleen als je 24/7 check-ins wilt (goedkope VPS / Pi).

## Privacy
Je taken, doelen en reflecties staan **lokaal** in `data/assistant.db` (niet in
git — `data/` staat in `.gitignore`). Gespreksinhoud gaat naar de Anthropic API
om antwoorden te genereren.
