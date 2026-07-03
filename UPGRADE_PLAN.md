# UPGRADE_PLAN — verbouwing naar terugval-bestendige doelen-app

## Wat er nu staat (inventarisatie)

**Stack:** Node ≥20, Express 4, vanilla-JS PWA (geen bundler/build-stap),
JSON-bestand als opslag (`data/coach.json`), pincode-login met sessies,
Anthropic SDK. Optioneel: node-cron (geplande check-ins), web-push
(meldingen), googleapis (agenda/mail-tools).

**Datamodel v1** (`src/db.js`, geen versieveld):

| Collectie | Inhoud |
|---|---|
| `tasks` | id, title, due, status open/done, timestamps |
| `goals` | id, title, target_value, unit, target_date, status |
| `progress` | goal_id, note, value, created_at — basis voor **streaks** (berekend, niet opgeslagen) |
| `journal` | check-ins van de cron-coach (feed) |
| `chat` | volledige gespreksgeschiedenis met de coach |
| `subs` / `sessions` | web-push-abonnementen / logintokens |
| `seq` | id-tellers |

**UI:** dashboard (statregel met *streaks*, doelen met voortgangsbalk +
grafiek, taken met checkboxes, check-in-feed) + **open chatvenster**;
mobiele tabs; licht/donker; NL.

**Coach v1:** agentische chat met tools (taken/doelen/agenda/web-search) +
cron-check-ins (ochtend/avond/week) via push. De AI bepaalt zelf de inhoud;
er is geen deterministische triggerlaag.

## Per onderdeel: behouden / aanpassen / vervangen

| Onderdeel | Besluit | Toelichting |
|---|---|---|
| Express + vanilla JS + JSON-opslag | **Behouden** | Saai en robuust; geen nieuwe frameworks nodig |
| Pincode-login (`/api/login`, sessies, lockout) | **Behouden** | Ongewijzigd |
| `src/config.js` | **Aanpassen** | Cron/Google/persona-instellingen eruit; kern (PIN, poort, model, db-pad) blijft |
| `src/db.js` | **Vervangen** | Schema **v2** met versieveld + migratie; zie datamodel hieronder |
| `src/claude.js` (agent-loop + tools) | **Verwijderen** | Coach wordt één JSON-in/JSON-uit-call zonder tools |
| `src/tools.js`, `src/google.js` | **Verwijderen** | Hoorden bij de chat-agent; chat verdwijnt |
| `src/cli.js` (terminal-chat) | **Verwijderen** | Idem |
| `src/push.js` + node-cron + web-push | **Verwijderen** | Geplande interventies strijden met "max 1 interventie/dag, code beslist"; meldingen voeden het afhankelijkheidspatroon |
| `src/coach.js` | **Vervangen** | Deterministische checks + bewaakte API-call + defensieve parser + statische fallback |
| `src/server.js` | **Aanpassen** | Chat/push/checkin-endpoints eruit; log/doelen/coach/review/export/import erin |
| `public/` (UI) | **Vervangen** | Dag-eerst; chatvenster en feed eruit; heatmaps erin |
| `public/sw.js` | **Aanpassen** | Push-handlers eruit; offline-shell blijft |
| Taken (UI + API) | **Behouden** | Bestaande functionaliteit, ongewijzigd |
| manifest/icoon/start-coach.bat/ecosystem | **Behouden** | Ongewijzigd |
| `scripts/check.mjs` | **Aanpassen** | Google-checks eruit |
| Tests | **Nieuw** | Node's ingebouwde `node:test` (geen nieuwe dependency) |

## Datamodel v2 + migratie (verlies niets)

```
{ schemaVersion: 2,
  settings:  { reviewDay },                 // 0=zo … 6=za
  goals:     [{ id, anchor, action, place,  // "Na [anchor] doe ik [action] op [place]"
                minimum, target, stake,
                status: active|paused|archived, paused_until,
                created_at, legacy }],       // legacy = oude velden, onaangetast
  dayLogs:   [{ id, goal_id, day, level: minimum|target|skip, logged_at }],
  reviews:   [{ id, week, answers|null, skipped, created_at }],
  coachLog:  [{ id, day, trigger, goal_id, bericht, acties, dismissed, fallback }],
  tasks:     …ongewijzigd…,
  sessions:  …ongewijzigd…,
  archive:   { chat, journal, progress, subs },  // volledige v1-historie, read-only
  seq }
```

**Migratie v1→v2** (`src/lib/migrate.js`, draait automatisch bij eerste start;
schrijft eerst `data/backup-v1-<timestamp>.json`):

| v1 | v2 |
|---|---|
| `goals.title` | `action` (intentievelden `anchor`/`place` leeg = "nog in te vullen") |
| `goals.target_value/unit/…` | → `target`-omschrijving; origineel onder `legacy` |
| — | `minimum` gegenereerd per doel (heuristiek op titel; achteraf 1-klik bij te stellen) |
| `progress`-entries | per goal+dag → `dayLogs` met `level: 'target'` (er wérd die dag echt iets gedaan); origineel blijft in `archive.progress` |
| streaks (berekend) | vervallen; **dagen actief** en **comebacks** worden uit dezelfde dayLogs berekend — historie blijft dus tellen |
| `chat`, `journal`, `subs` | → `archive.*` (niets weg; zit in export) |
| >3 actieve doelen | nieuwste 3 blijven actief, rest → `paused` (gelogd in migratie-output) |

## Datumlogica (nieuw, `src/lib/dates.js` — unit-getest)
- Een "dag" loopt tot **03:00 lokale tijd** (`dayKey`: kloktijd − 3 u → kalenderdag).
- Loggen kan uitsluitend voor **vandaag en gisteren** (server-side afgedwongen).
- Maand-heatmap per doel: leeg / licht (minimum) / donker (target).

## Inzichten (nieuw, `src/lib/insights.js` — unit-getest, puur/deterministisch)
- **Actieve dag** = ≥1 minimum- of target-log. **Comeback** = actieve dag na ≥2
  volledig gemiste dagen. Beide per doel én overall geteld.
- **Triggerdetectie over laatste 14 dagen** (code beslist, niet de AI):
  `comeback` (vandaag/gisteren) → `gap` (≥3 gemiste dagen) →
  `drift` (targets ↓ terwijl minimums ↑, week-op-week) →
  `skips` (≥3 "vandaag niet" en stijgend) → `weekly` (reviewdag).
  Hoogste prioriteit wint; **max 1 interventie per dag** (persistent in `coachLog`).

## Coachlaag (vervangt chat + cron)
- Alleen bij trigger: compacte JSON-samenvatting → Anthropic API →
  antwoord **uitsluitend** `{ bericht, acties[] }` met gehardcodeerde
  systeemprompt (zie DECISIONS).
- Acties uit vaste lijst: `verklein_minimum`, `pauzeer_doel`, `laat_zo` —
  één tik, server past toe.
- Defensief parsen (fences strippen, schema-validatie); bij elke fout →
  statisch welkom-terug-kaartje. App is 100% bruikbaar zonder coach.
- Weekreview: 4 vaste vragen op zelfgekozen dag, overslaanbaar; samenvatting
  gaat mee in de eerstvolgende coach-payload.

## Werkvolgorde
1. ✅ Dit plan + DECISIONS.md
2. `lib/dates.js` + `lib/insights.js` + `lib/migrate.js` + **unit tests**
3. `db.js` v2 + `server.js`-endpoints (log, doelen, export/import, review)
4. Dagflow-UI (vandaag-kaart, gisteren, heatmap, doelform, taken, backup)
5. Coachlaag + fallback + weekreview-UI
6. Bewijs: tests groen; migratie van kopie echte data zonder verlies;
   klikpad doel→log→herlaad→dagovergang→export→import; drift-dataset
   triggert coach; kapot antwoord → fallback; 0 console-errors;
   lange namen + lege states netjes; README bij.
