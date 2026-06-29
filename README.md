# Claude als Slack-werknemer

Een Slack-bot die zich gedraagt als een virtuele teamgenoot, aangedreven door
Claude. Collega's kunnen de bot taggen in een kanaal (`@Claude Collega ...`) of
hem rechtstreeks een DM sturen. De bot antwoordt in de thread en houdt rekening
met de eerdere berichten in die thread.

## Hoe het werkt

```
Slack  ──(Socket Mode)──▶  Bolt-app (src/app.js)  ──▶  Claude API (src/claude.js)
  ▲                                                          │
  └──────────────────  antwoord in thread  ◀────────────────┘
```

- **Socket Mode**: er is geen publieke URL nodig, dus je kunt het meteen lokaal
  draaien en testen.
- **Persona**: het gedrag van de "werknemer" stel je in via `CLAUDE_PERSONA`.
- **Model**: standaard `claude-sonnet-4-6` (snel + goedkoop). Zet
  `CLAUDE_MODEL=claude-opus-4-8` voor de meest capabele antwoorden.

## Setup

### 1. Maak de Slack-app aan
1. Ga naar https://api.slack.com/apps → **Create New App** → **From an app manifest**.
2. Kies je workspace en plak de inhoud van [`slack-app-manifest.json`](./slack-app-manifest.json).
3. Onder **Basic Information → App-Level Tokens**: maak een token met scope
   `connections:write`. Dit is je `SLACK_APP_TOKEN` (`xapp-...`).
4. Onder **OAuth & Permissions**: installeer de app in je workspace en kopieer
   het **Bot User OAuth Token** (`xoxb-...`) → `SLACK_BOT_TOKEN`.

### 2. Configureer de omgeving
```bash
cp .env.example .env
# vul SLACK_BOT_TOKEN, SLACK_APP_TOKEN en ANTHROPIC_API_KEY in
```

Een Anthropic API-sleutel haal je op via https://console.anthropic.com/.

### 3. Installeer en start
```bash
npm install
npm start
```

Je ziet dan: `⚡️ Claude-werknemer draait in Slack als @...`.

### 4. Gebruiken
- Nodig de bot uit in een kanaal (`/invite @Claude Collega`) en tag hem.
- Of stuur hem een DM.

## Aanpassen

| Wat | Waar |
| --- | --- |
| Gedrag/persona van de "werknemer" | `CLAUDE_PERSONA` in `.env` |
| Welk Claude-model | `CLAUDE_MODEL` in `.env` |
| Lengte van antwoorden | `CLAUDE_MAX_TOKENS` in `.env` |
| Hoeveel thread-context meegaat | `limit` in `buildHistory()` (`src/app.js`) |

## Let op
- `.env` staat in `.gitignore` — commit je tokens nooit.
- Dit is een startpunt. Voor productie wil je waarschijnlijk: rate limiting,
  logging, en eventueel koppeling met jullie eigen kennisbank/data.
