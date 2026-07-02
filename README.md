# Mijn Coach — je persoonlijke assistent + coach als app

Een eigen app (draait op je PC, te openen op al je apparaten) met daarin:

- 💬 **Chat met je coach** — die taken uitvoert, teksten schrijft, op internet
  zoekt en je helpt met je doelen. Gesprekken worden bewaard.
- ✅ **Taken** — toevoegen en afvinken met knoppen óf via de chat.
- 🎯 **Doelen met voortgang** — voortgangsbalken, streak-tellers (🔥 dagen op
  rij) en grafiekjes over tijd.
- 💌 **Check-ins** — je coach schrijft elke ochtend, avond en week een
  persoonlijk bericht in je feed, met een melding op je apparaten.
- 🔒 **Pincode-slot** — met bescherming tegen gokken.
- 🌗 **Automatisch licht/donker**, warm design, en op je telefoon te
  installeren als echte app (via "Toevoegen aan beginscherm").

Draait op de **Claude API**: je betaalt per gebruik (typisch een paar euro per
maand) in plaats van een vast abonnement.

## Starten

```bash
npm install
npm run check    # controleert je instellingen
npm start        # of dubbelklik start-coach.bat (Windows)
```

Open dan **http://localhost:3000** in je browser. Voer je pincode in — klaar.

### Eerste keer? Dit heb je nodig in `.env`

```
ANTHROPIC_API_KEY=sk-ant-jouw-key
APP_PIN=4821
```

- De API-key haal je bij https://console.anthropic.com/ (API Keys; zet ook wat
  tegoed op Billing).
- `APP_PIN` kies je zelf: 4-6 cijfers waarmee je de app opent.
- Optioneel: `USER_NAME=Julian` voor een persoonlijke begroeting.

Zie `.env.example` voor alle instellingen (check-in-tijden, modellen, enz.).

### Kwam je van de vorige (Slack/terminal-)versie?

```bash
git pull
npm install
```

Voeg `APP_PIN=...` toe aan je `.env` en start met `npm start`. De Slack-tokens
heb je niet meer nodig. (De app begint bewust met een schoon geheugen;
`npm run chat` — de terminalversie — werkt ook nog steeds.)

## Op je telefoon

**Thuis (zelfde WiFi):** open `http://<ip-van-je-pc>:3000` in de browser van je
telefoon. Het IP van je PC vind je met `ipconfig` (het "IPv4-adres", bv.
`192.168.1.23`).

**Onderweg (overal) + meldingen — via Tailscale (gratis):**

Meldingen en "installeren als app" vereisen een beveiligde (https-)verbinding.
De makkelijkste en veiligste gratis manier is [Tailscale](https://tailscale.com):
een privé-netwerkje tussen jouw apparaten — niets staat open op internet.

1. Installeer Tailscale op je **PC** (tailscale.com/download) en log in
   (kan met je Google-account).
2. Installeer de **Tailscale-app op je telefoon** en log in met hetzelfde
   account.
3. Op je PC, in een terminal:
   ```
   tailscale serve --bg 3000
   ```
   Dit geeft je een vast **https-adres** (zoiets als
   `https://jouw-pc.tail1234.ts.net`).
4. Open dat adres op je telefoon (met Tailscale aan) → log in met je pincode →
   kies in je browsermenu **"Toevoegen aan beginscherm"** → zet meldingen aan
   via de banner in de app.

Vanaf nu heb je de coach als app-icoon op je telefoon, overal bereikbaar
(zolang je PC aanstaat), inclusief check-in-meldingen.

## Automatisch starten met Windows

1. Dubbelklik `start-coach.bat` om te testen — de app start en je browser opent
   vanzelf.
2. Druk **Win + R**, typ `shell:startup`, Enter.
3. Maak een snelkoppeling naar `start-coach.bat` (rechtermuisknop →
   *Snelkoppeling maken*) en sleep die in de geopende opstartmap.

> De app draait alleen als je PC aanstaat. Check-ins die vallen op een moment
> dat je PC uit staat, worden overgeslagen — kies de tijden dus rond momenten
> dat je PC meestal aan is (`COACH_*_CRON` in `.env`).

## Google Agenda & Gmail (optioneel)

De coach kan afspraken inplannen en concept-mails klaarzetten zodra je een
Google-koppeling invult:

1. [Google Cloud Console](https://console.cloud.google.com/) → nieuw project →
   zet **Google Calendar API** en **Gmail API** aan.
2. OAuth consent screen instellen (extern, jezelf als testgebruiker).
3. **Credentials → OAuth client ID** (type *Desktop app*) → `GOOGLE_CLIENT_ID`
   en `GOOGLE_CLIENT_SECRET`.
4. Genereer eenmalig een refresh token met scopes
   `https://www.googleapis.com/auth/calendar` en
   `https://www.googleapis.com/auth/gmail.compose` (bv. via de
   [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)) →
   `GOOGLE_REFRESH_TOKEN`.
5. In `.env` zetten en herstarten.

> Gmail maakt bewust alleen **concepten** aan — er wordt nooit automatisch
> iets verstuurd.

## Updates ophalen

Als er iets nieuws is gebouwd:

```bash
git pull
npm install
```

en herstart de app. Je taken, doelen, gesprekken en instellingen blijven staan
(die zitten in `data/` en `.env`, en die worden nooit overschreven).

## Kosten & privacy

- **Claude API**: per gebruik; licht persoonlijk gebruik ≈ enkele euro's per
  maand. De diepere coachmomenten gebruiken een sterker model
  (`CLAUDE_COACH_MODEL`), instelbaar.
- **Verder gratis**: de app zelf, Tailscale (persoonlijk gebruik) en meldingen
  kosten niets.
- **Privacy**: je taken, doelen, gesprekken en check-ins staan lokaal op je
  eigen PC in `data/` (staat niet in git). Berichten gaan alleen naar de
  Anthropic API om antwoorden te genereren.
