# Brand Nova AI Employee — Bouwplan

> **Status:** Plan only. Niets hieronder is nog geïmplementeerd. Dit document is
> bedoeld om in één keer goed gebouwd te worden (bv. door Fable 5) zonder
> tussentijdse architectuurwissels.
>
> **Repo-opmerking:** deze repository bevat momenteel "Mijn Coach", een
> volledig ongerelateerd Node/Express project (Nederlandse gewoonte-tracker,
> lokaal draaiend, geen Next.js/Supabase). Brand Nova AI Employee is een
> nieuw, apart product en wordt in de map `brand-nova/` als eigen
> Next.js-project gebouwd, los van de bestaande coach-app (geen gedeelde
> code, geen gedeelde database, geen gedeelde deployment).
>
> **Beslissingen (definitief):**
> 1. **Locatie:** nieuwe map `brand-nova/` in deze repo.
> 2. **Website Check:** bestaat al bij Brand Nova → dit project bouwt géén
>    landingspagina/formulier, alleen de koppeling (link in de e-mail +
>    webhook/tracking-event die `leads.status` op
>    `website_check_completed` zet).
> 3. **E-mailprovider:** Resend, voor zowel outbound send als inbound
>    (replies) via webhook.
> 4. **Verzendvolume:** standaard max 200 e-mails/dag, maar dit is een
>    instelling in `settings.daily_send_cap` (aanpasbaar in de UI), niet
>    hardcoded in code.
>
> Dit plan is definitief en klaar om 1-op-1 gebouwd te worden.

---

## 1. Product frame

Eén KPI: **aantal warme leads per dag**. Alles in het systeem — architectuur,
UI, AI-gedrag, learning-loop — is ondergeschikt daaraan. Verzonden e-mails,
open rates en reply rates zijn *interne signalen*, geen doelen. Ze worden wel
opgeslagen (nodig voor de learning-loop), maar nooit als succes getoond aan
de gebruiker.

**Warm lead** = een lead-status die wordt bereikt door een van:
`positive_reply`, `question`, `website_check_completed`, `example_request`,
`info_request`, `meeting_request`, `buying_intent`. Zodra een lead een van
deze statussen krijgt, wordt hij niet meer automatisch benaderd (follow-ups
stoppen direct, zoals al gespecificeerd).

---

## 2. High-level architectuur

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js App (App Router, TypeScript)                            │
│  ├─ /app (dashboard, "AI employee control room")                 │
│  ├─ /app/api/* (route handlers: CSV upload, webhooks, admin)     │
│  └─ Server Components + Supabase Realtime (live activity feed)   │
└─────────────────────────────────────────────────────────────────┘
                │                              │
                ▼                              ▼
┌───────────────────────────┐      ┌───────────────────────────────┐
│  Supabase (Postgres)       │      │  Background workers            │
│  - leads, companies         │◄────►│  (Vercel Cron → queue runner,  │
│  - website_analyses (cache) │      │  of Supabase Edge Functions)   │
│  - emails, sequences        │      │  - website analyzer             │
│  - replies, classifications │      │  - email writer                 │
│  - insights (learning)       │      │  - sender (rate-limited)        │
│  - activity_log (feed)       │      │  - reply poller/classifier      │
│  - Realtime channel          │      │  - daily learning aggregator    │
└───────────────────────────┘      └───────────────────────────────┘
                │                              │
                ▼                              ▼
┌───────────────────────────┐      ┌───────────────────────────────┐
│  OpenAI API                 │      │  Email provider (send+inbound) │
│  - gpt-4o-mini: classificatie,│    │  Resend (send + inbound webhook)│
│    extractie, observaties    │      │  - outbound send                │
│  - gpt-4.1 / gpt-4o: e-mail  │      │  - inbound webhook (replies)    │
│    schrijven (hogere kwaliteit)│    │  - bounce/unsubscribe events    │
└───────────────────────────┘      └───────────────────────────────┘
```

**Waarom dit en geen "CRM met een AI-knopje":** de workers zijn losgekoppeld
van de UI. De UI is een *view* op een continu draaiend systeem, niet de motor
zelf. Dat is wat het "voelt als een werknemer die al aan het werk was"-effect
mogelijk maakt (morning briefing werkt ook als niemand inlogt).

**Runtime keuze voor workers:** Vercel Cron (elke minuut/5 min triggert een
route handler die een batch uit de queue pakt) is voldoende voor het
gespecificeerde volume (max 200 mails/dag, instelbaar). Bij toekomstige
volumegroei kan dit later verhuizen naar Supabase Edge Functions met
pg_cron, zonder schema-wijzigingen.

---

## 3. Datamodel (Supabase / Postgres)

```sql
-- Bedrijven, uniek op genormaliseerd domein (dedupe-sleutel)
companies (
  id uuid pk,
  name text,
  website_url text,
  domain text unique,              -- genormaliseerd (zonder www, lowercase)
  email text,
  email_valid boolean,
  industry text,                   -- afgeleid door AI, voor learning-segmentatie
  created_at timestamptz,
  source_csv_import_id uuid fk
)

website_analyses (               -- CACHE: nooit opnieuw analyseren binnen TTL
  id uuid pk,
  company_id uuid fk unique,
  raw_homepage_text text,          -- geëxtraheerde leestekst (Readability-stijl)
  fetched_at timestamptz,
  what_they_do text,
  target_audience text,
  services text[],
  usp text[],
  trust_signals text[],
  ctas text[],
  tone text,
  improvement_observation text,    -- HET ene concrete, bewijsbare observatie
  analysis_version int,            -- bump = her-analyse toestaan na model-upgrade
  status text check (status in ('pending','done','failed','unreachable'))
)

leads (                            -- 1 lead = 1 company in 1 outreach-traject
  id uuid pk,
  company_id uuid fk,
  status text check (status in (
    'new','queued','emailed','followup_1','followup_2','followup_3',
    'positive_reply','question','warm_lead','meeting_request',
    'website_check_completed','not_interested','spam','out_of_office',
    'bounced','unsubscribed','stopped'
  )),
  warm_since timestamptz,          -- null tenzij warm; dé KPI-timestamp
  next_action_at timestamptz,      -- wanneer volgende follow-up mag
  followups_sent int default 0,
  created_at timestamptz
)

email_sequences (                  -- elke individuele verzonden mail
  id uuid pk,
  lead_id uuid fk,
  step int,                        -- 0 = eerste mail, 1-3 = follow-ups
  subject text,
  body text,
  observation_used text,           -- welke website-observatie is gebruikt
  strategy_tags jsonb,             -- {opener_style, length_bucket, send_hour, ...}
  sent_at timestamptz,
  provider_message_id text,
  status text check (status in ('draft','sent','bounced','failed'))
)

replies (
  id uuid pk,
  lead_id uuid fk,
  email_sequence_id uuid fk,       -- welke mail dit beantwoordt
  raw_body text,
  received_at timestamptz,
  classification text,             -- zelfde enum-achtig als lead status subset
  classification_confidence numeric,
  auto_replied boolean,
  auto_reply_body text,
  needs_human boolean              -- lage confidence → geen auto-antwoord
)

insights (                         -- learning-loop, geaggregeerd, geen raw PII
  id uuid pk,
  dimension text,                  -- 'subject_line','opener','observation_type',
                                    -- 'length_bucket','industry','send_hour',
                                    -- 'followup_timing','reply_style'
  key text,                        -- bv. 'question_opener', 'tue_10h', 'short'
  warm_lead_rate numeric,          -- rolling window conversie
  sample_size int,
  updated_at timestamptz
)

activity_log (                     -- voedt de live activity feed in de UI
  id uuid pk,
  occurred_at timestamptz,
  type text,                       -- 'analyzing','writing','sending','reading',
                                    -- 'learning','followup','warm_lead'
  company_id uuid fk nullable,
  message text,                    -- door AI gegenereerde statusregel
  metadata jsonb
)

csv_imports (
  id uuid pk, filename text, row_count int, duplicate_count int,
  invalid_email_count int, imported_at timestamptz
)

settings (                         -- single-row config, instelbaar in de UI
  id int pk default 1,
  daily_send_cap int default 200,  -- instelbaar (default 200, geen hardcoded limiet elders in code)
  sending_hours jsonb,             -- bv. {"start":"09:00","end":"17:00","tz":"Europe/Amsterdam"}
  daily_warm_lead_goal int,
  max_followups int default 3,
  followup_delay_days int[] default '{3,5,7}'
)
```

Alle statistiek voor de learning-loop draait op `email_sequences.strategy_tags`
+ `leads.status` → geaggregeerd naar `insights`. Geen losse ML-infra nodig:
dit is gewoon SQL-aggregatie plus een dagelijkse job.

---

## 4. Pipeline per fase

### 4.1 CSV-import
- Upload → parse (papaparse) → normaliseer domein (strip protocol/www,
  lowercase) → dedupe op `domain` → e-mail-syntax + MX-record check
  (deterministisch, geen AI) → invalide rijen apart tonen, niet stilzwijgend
  droppen.
- Nieuwe companies krijgen `status='new'` op de bijbehorende lead.

### 4.2 Website-analyse (cache-first, AI alleen als nodig)
1. Check `website_analyses` op `company_id` + `analysis_version`. Bestaat en
   binnen TTL (bv. 90 dagen) → **skip AI-call volledig**, hergebruik.
2. Zo niet: fetch homepage (timeout ~8s, max grootte, user-agent netjes
   geïdentificeerd, respecteer robots.txt voor de homepage-fetch zelf niet
   nodig maar wel netjes rate-limiten per domein).
3. Extractie van leestekst (Readability/cheerio, deterministisch, geen AI).
4. **Eén AI-call** (gpt-4o-mini, low temperature, JSON-mode) die uit de
   leestekst structured output haalt: what_they_do, audience, services, usp,
   trust_signals, ctas, tone, **en één concrete observation-kandidaat**.
   Prompt bevat een harde regel: *"Als je niets specifieks en verifieerbaars
   kunt vinden, retourneer observation=null"* — dan wordt de lead
   overgeslagen voor vandaag i.p.v. een generieke mail te sturen (voorkomt
   het "never generic feedback"-risico hard, niet alleen via prompting).
5. Fetch-fout / geen homepage bereikbaar → `status='unreachable'`, lead
   krijgt geen mail, verschijnt in een "kon niet bereikt worden"-lijstje i.p.v.
   silent te falen.

### 4.3 E-mail schrijven
- Eén AI-call (hoger-kwaliteit model, bv. gpt-4.1) per mail.
- Input: company data + `improvement_observation` + top-N `insights`
  (winnende openers/lengtes/subject-patterns voor die industry/segment) als
  few-shot sturing — **niet** als verplichte template, om herhaling tegen te
  gaan.
- Output: subject + body + `strategy_tags` (welke opener-stijl, lengte-bucket
  is gebruikt) zodat de learning-loop achteraf kan koppelen aan uitkomst.
- Harde constraints in prompt + post-validatie (regex/checks, geen tweede
  AI-call): geen woorden als "korting", geen overdreven complimenten-lijst
  detectie, max lengte, geen opgesomde bullet-verkooppraat.
- Follow-ups: aparte call per stap, expliciet met de vorige mail(en) als
  context met instructie "schrijf iets volledig nieuws, herhaal geen zinnen
  uit eerdere mails" + een tekst-similarity check (bv. simpele n-gram overlap)
  als harde deterministische guard — bij te veel overlap opnieuw genereren
  (max 1 retry, anders skip follow-up i.p.v. een slechte mail versturen).

### 4.4 Versturen
- Rate-limited queue: `settings.daily_send_cap`, verspreid over
  `settings.sending_hours` (niet alles om 09:00 in één batch — voelt
  onnatuurlijk en is slecht voor deliverability).
- Voor verzending: laatste check of lead nog steeds `queued`/eligible is
  (race-conditie-veilig via een `sending` lock-status).
- **Resend** verstuurt de mail (via Resend API/SDK) en logt `provider_message_id`
  (Resend's email-id) voor threading van replies.

### 4.5 Reply monitoring & classificatie
- **Resend inbound webhook** (Resend Inbound / verwerkte reply-emails) levert
  binnenkomende replies als route-handler event; koppeling aan `lead_id` via
  `In-Reply-To`/`References` headers gematcht op `provider_message_id`, met
  domein/afzender-e-mail als fallback-match.
- Classificatie: één AI-call (gpt-4o-mini, JSON-mode) → classification +
  confidence.
- `classification_confidence < threshold` (bv. 0.7) → `needs_human=true`,
  geen auto-reply, verschijnt prominent in UI als "wacht op jou".
- Warm-classificaties → `leads.status` bijgewerkt, `warm_since` gezet,
  follow-up queue voor die lead direct geannuleerd.
- Simpele vragen (bv. "wat kost het", "hoe werkt het") met hoge confidence →
  auto-reply gegenereerd met strikte grounding-prompt ("gebruik alleen
  onderstaande feitenlijst, verzin niets, beloof geen maatwerk") — feitenlijst
  komt uit een door de gebruiker beheerd `settings`/`faq`-tabel, niet uit
  AI-fantasie.

### 4.6 Learning-loop (dagelijkse job)
- Aggregeert `email_sequences.strategy_tags` × `leads.status` → warm-lead-rate
  per dimensie/key → schrijft naar `insights`.
- Puur SQL/deterministisch, **geen AI-call nodig** voor de aggregatie zelf.
- Volgende generatie-calls (4.3) lezen deze tabel als context — dit ís de
  "wordt elke dag beter"-lus, zonder fine-tuning of dure re-training.

---

## 5. AI Employee dashboard (UX/visueel)

- **Hoofdscherm** = live activity feed (uit `activity_log` via Supabase
  Realtime), geen tabel-als-hoofdervaring. Denk: verticale stream van
  statusregels met subtiele typing/scanning-animaties per regel
  ("Analyzing website...", "Writing a personalized email...").
- **Morning briefing card**: bovenaan, gegenereerd uit een samenvattende
  query over de laatste 24u (geanalyseerd, verstuurd, website-checks,
  warm leads, meetings) + huidige actieve taak. Dit is een template met
  ingevulde cijfers, **geen AI-tekstgeneratie nodig** (deterministisch,
  goedkoop, en altijd feitelijk correct — belangrijk, want dit is het eerste
  wat de gebruiker ziet en moet nooit "verzonnen" aanvoelen).
- **Live counters**: warm leads vandaag / doel vandaag, geanimeerd
  (count-up), met voortgangsindicator.
- **Visuele taal**: glassmorphism cards, zachte gradient-achtergrond, gloed
  rond de "AI is actief"-indicator, smooth transitions (framer-motion),
  donker thema als basis (voelt "control room", niet "spreadsheet").
- **Geen** aparte CRM-achtige lead-tabel als primaire pagina; wel een
  secundaire "Leads"-pagina met filters/tabel voor wie wil graven — bewust
  ondergeschikt aan de feed.

---

## 6. Kostenoptimalisatie (concreet, niet alleen intentie)

| Wat | Hoe |
|---|---|
| Website-analyse | 1x per domein, gecached met TTL, nooit herhaald zolang `analysis_version` gelijk blijft |
| Model-keuze | gpt-4o-mini voor extractie/classificatie (goedkoop, JSON-mode, hoog volume); duurder model alléén voor de uiteindelijke e-mailtekst (laag volume, kwaliteit telt) |
| Batching | Homepage-fetch + extractie gebeurt async in de queue, niet on-demand per pageview |
| Dedupe | CSV-dedupe vóór elke verdere stap — nooit tweemaal dezelfde company verwerken |
| Auto-reply | Alleen bij hoge confidence; lage confidence = geen call, mens grijpt in |
| Learning-aggregatie | Pure SQL, geen AI-call |
| Rate caps | `daily_send_cap` voorkomt onbedoelde kostenpieken bij grote CSV's |

---

## 7. Betrouwbaarheid / "nooit generiek, nooit verzonnen"

Dit is de kwetsbaarste eis in de spec (AI kan hallucineren of generiek
worden onder de radar). Concrete guardrails, niet alleen prompting:

1. Structured-output extractie met expliciete `observation: string | null` —
   null is een geldig, verwacht pad, geen mail bij null.
2. Post-generatie check: observation-tekst moet (fuzzy) voorkomen in/afgeleid
   zijn van de gefetchte homepage-tekst (bv. keyword-overlap check) —
   mismatch → discard en skip, niet opnieuw hallucineren.
3. FAQ/auto-reply antwoorden alleen gegrond op een door mens beheerde
   feiten-tabel, nooit vrije generatie van beloftes.
4. Alles wat de AI "beweert te hebben gedaan" in de activity feed en morning
   briefing komt uit echte database-events, nooit uit een los AI-praatje.

---

## 8. Compliance/deliverability (niet in spec genoemd, maar noodzakelijk voor productie)

- Unsubscribe-link verplicht in elke mail + tabel `unsubscribed` hard
  gerespecteerd (nooit meer benaderen, ook niet bij CSV re-import).
- SPF/DKIM/DMARC op verzenddomein vóór volume — anders komt niets aan.
- Bounce-handling: hard bounce → `email_valid=false`, geen retries.
- GDPR: verwerkingsgrond (gerechtvaardigd belang, B2B-outreach) en
  redelijke opt-out-termijn vastleggen in een korte privacyparagraaf op de
  Website Check-landingspagina.

---

## 9. Fasering (bouwvolgorde voor Fable 5)

1. **Fundament**: Next.js project, Supabase schema (sectie 3), auth (simpele
   login voor Julian, geen multi-tenant nodig tenzij anders gewenst),
   settings-scherm.
2. **CSV-import + dedupe + validatie** (volledig deterministisch, testbaar
   zonder AI-kosten).
3. **Website-analyse pipeline** + caching + de null-observation guardrail.
4. **E-mail generatie + verzending** (zonder learning-loop nog, met
   Resend-integratie).
5. **Reply-ontvangst + classificatie + auto-reply** met confidence-gate.
6. **Learning-aggregatie job** + injectie van insights in e-mailgeneratie.
7. **Dashboard/UX-laag**: activity feed, morning briefing, live counters,
   visueel afwerken (glassmorphism/animaties) — bewust laatst, zodat de
   feed echte data heeft om te tonen tijdens het bouwen/testen.
8. **Hardening**: rate limits, bounce/unsubscribe, compliance-teksten,
   monitoring/alerting als een cron-job faalt (bv. gemiste dag mag niet
   stilzwijgend gebeuren).

---

## 10. Wat expliciet *niet* gebouwd wordt

- Geen lead-search/scraping (alleen CSV-input, zoals gespecificeerd).
- Geen chatvenster/los AI-chatscherm — status komt uit de feed, niet uit
  een conversatie-UI (past bij "voelt niet als software").
- Geen automatische onderhandeling of custom-werk-toezeggingen in
  auto-replies (harde regel uit spec, hierboven als guardrail geïmplementeerd
  i.p.v. alleen als prompt-instructie).

---

## 11. Beslissingen (definitief, geen open punten meer)

1. **Repo-locatie**: `brand-nova/` binnen deze repo, los van Mijn Coach.
2. **Website Check**: bestaat al bij Brand Nova. Dit project bouwt geen
   landingspagina — alleen: (a) de link naar de bestaande tool in elke
   e-mail (met een uniek tracking-token per lead), en (b) een webhook/
   tracking-endpoint dat Brand Nova's Website Check-tool aanroept zodra een
   bezoeker met dat token de check voltooit, wat `leads.status` bijwerkt
   naar `website_check_completed`. **Aanname, te bevestigen bij bouw:** de
   bestaande Website Check-tool kan een tracking-token (query param) doorgeven
   aan een callback/webhook. Als dat niet kan, is een minimale server-side
   redirect-pagina (`/wc/[token]` die naar de echte tool doorstuurt en het
   bezoek logt) een goedkope tussenoplossing, zonder de echte tool te hoeven
   aanpassen.
3. **E-mailprovider**: Resend, voor zowel outbound (API) als inbound
   (Resend inbound webhook voor replies).
4. **Verzendvolume**: `settings.daily_send_cap` default **200**, volledig
   instelbaar via de UI (geen hardcoded limiet in de code). Eén verzenddomein
   voorlopig; domein-rotatie is niet gebouwd in v1 maar het datamodel
   (`provider_message_id`, per-lead tracking) staat dat later toe zonder
   schema-wijziging.

Dit plan bevat geen open aannames meer en kan 1-op-1 naar Fable 5 om in één
keer goed gebouwd te worden.
