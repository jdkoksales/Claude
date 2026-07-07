# Brand Nova — AI Employee

Een autonome AI-medewerker met één KPI: **warme leads**. Je uploadt een CSV
met bedrijven; de AI analyseert hun websites, schrijft volledig persoonlijke
e-mails met een bewijsbare website-observatie, verstuurt binnen een instelbaar
venster, leest en classificeert antwoorden, beantwoordt simpele vragen zelf en
leert dagelijks van wat werkt. Het volledige ontwerp staat in `PLAN.md`.

## Stack

Next.js (App Router) · TypeScript · TailwindCSS v4 · Supabase (Postgres) ·
OpenAI API · Resend · Vercel Cron.

## Eenmalige setup

1. **Database** — de migratie in `supabase/migrations/0001_init.sql` is al
   toegepast op het Supabase-project (alle tabellen hebben een `bn_`-prefix en
   RLS zonder policies: alleen de service-role key kan erbij).
2. **Env vars** — kopieer `.env.example` naar `.env.local` en vul in:
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase dashboard → Settings → API.
   - `OPENAI_API_KEY`: platform.openai.com.
   - `RESEND_API_KEY`: resend.com (verifieer eerst je verzenddomein incl.
     SPF/DKIM/DMARC).
   - `RESEND_WEBHOOK_SECRET`: maak in Resend een webhook naar
     `https://<app>/api/webhooks/resend` met events `email.received`,
     `email.bounced`, `email.complained`; kopieer het signing secret.
     Stel voor replies ook Resend Inbound in op het verzenddomein.
   - `APP_PASSWORD`: waarmee jij inlogt. `APP_SECRET`: lange willekeurige
     string (sessies + unsubscribe-tokens). `CRON_SECRET`: lange willekeurige
     string; Vercel stuurt hem automatisch mee met cron-aanroepen.
   - `APP_URL`: de publieke URL van de deployment (voor unsubscribe-links).
3. **Deploy naar Vercel** — `vercel.json` bevat de twee cron jobs:
   - `/api/cron/tick` elke 5 minuten (analyseren, schrijven, versturen),
   - `/api/cron/daily` om 04:30 (learning-aggregatie + dagdoel).
4. **In de app** — log in, zet bij Instellingen het afzendadres en de
   Website Check-URL, en upload je CSV. Daarna is menselijke input alleen
   nog nodig voor antwoorden die de AI bewust aan jou voorlegt.

## Lokaal draaien

```bash
npm install
npm run dev        # app op http://localhost:3000
npm run typecheck  # strikte TS-check
npm test           # unit tests (guards, venster-logica, normalisatie)
```

Lokaal vuur je de heartbeat handmatig af:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/tick
```

## Architectuur in één alinea

De UI is een *view* op een continu draaiend systeem, niet de motor. De motor
is `/api/cron/tick`: elke 5 minuten analyseert hij een batch websites
(cache-first, één AI-call per bedrijf, ooit) en verstuurt hij binnen het
verzendvenster een evenredig deel van de dagcap (instelbaar, standaard 200).
Antwoorden komen binnen via de Resend-webhook, worden geclassificeerd met een
confidence-gate (laag = mens beslist), en elke verzonden mail draagt
strategy-tags die de dagelijkse learning-job aggregeert naar `bn_insights` —
de sturing voor de volgende generatie mails. Vier harde guardrails staan los
van prompts in code: observaties zonder verifieerbare bron worden weggegooid
(lead wordt overgeslagen, nooit een generieke mail), follow-ups met te veel
tekst-overlap worden niet verstuurd, auto-antwoorden kunnen alleen uit de
door jou beheerde kennisbank putten, en uitschrijvingen zijn permanent.

