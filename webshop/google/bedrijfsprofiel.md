# Google-bedrijfsprofiel TapKaarten — wat er moet gebeuren

Twee dingen door elkaar in je schermafbeelding, en het zijn echt twee
verschillende plaatjes:

| Waar | Welk plaatje | Wie kan het veranderen |
|---|---|---|
| Het rondje naast **tapkaarten.nl** in het zoekresultaat | de favicon van de site | staat al goed, Google moet het alleen nog ophalen |
| Het logo bij het blok **Tapkaarten** eronder | een aparte upload in je bedrijfsprofiel | jij, en het is binnen een paar uur zichtbaar |

---

## 1. De favicon: de site klopt al

Nagemeten op de live site:

```
<link rel="icon" sizes="192x192" href=".../tk3-favicon-192.png">   192x192, vierkant
<link rel="icon" sizes="48x48"   href=".../tk3-favicon-48.png">     48x48, vierkant
<link rel="apple-touch-icon"     href=".../tk3-merk-vierkant.png">
```

Alle drie serveren het oranje merk. De maten zijn veelvouden van 48 zoals
Google eist, ze zijn vierkant, en robots.txt blokkeert de map niet. In het
schema.org-blok op de homepage staat `logo` ook al op het oranje merk.

Er is dus niets aan de site kapot. Wat je ziet is Google's eigen kopie.
Opgevraagd bij Google's faviconservice, in zes formaten:

```
sz=16   oud      sz=128  oud
sz=32   oud      sz=256  oud
sz=64   oud      sz=512  oud
```

Google bewaart favicons lang — in de praktijk twee tot zes weken, soms
maanden, omdat het icoon zelden verandert. De truc die je online tegenkomt
(een formaat opvragen dat Google nog nooit heeft gegenereerd, zodat hij de
bron opnieuw moet ophalen) heb ik geprobeerd; alle zes de formaten geven de
oude terug. Die werkt hier niet.

**Wat het wél versnelt:** Search Console → URL-inspectie → `https://tapkaarten.nl/`
→ *Indexering aanvragen*. Google haalt de favicon op bij de homepage-crawl,
dus een nieuwe crawl afdwingen is de enige knop die er is. Search Console
staat nog op je lijstje; dit is een reden te meer om het deze week te doen.

Daarna is het wachten. Niets meer aan te doen, en niets aan de site te
repareren.

---

## 2. Het logo in je bedrijfsprofiel: dat kan vandaag

Klaargezet: **`tapkaarten-google-bedrijfsprofiel-720.png`**

720 x 720, PNG, 59 kB — Google wil vierkant, minimaal 250 x 250 en tussen
10 kB en 5 MB.

Twee dingen die aan dit bestand anders zijn dan aan het websitelogo:

- **Geen afgeronde hoeken.** Google snijdt het logo zelf rond bij. Ronde
  hoeken ín een rond masker geven witte happen langs de rand.
- **Geen transparantie.** Die wordt op sommige Google-oppervlakken zwart.

Nagemeten tegen de ronde uitsnede die Google eroverheen legt: 0 pixels van
het merk vallen buiten de cirkel, en het merk vult 10,2% van het vlak — het
staat groot genoeg om op 64 px nog te lezen zonder tegen de rand aan te
lopen.

**Uploaden:** je bedrijfsprofiel openen via Google Zoeken → *Foto toevoegen*
→ *Logo*. Of in Maps → *Profiel bewerken* → *Logo*.

---

## 3. De rest van het profiel

Waarom dit de moeite waard is: van de tien sterkste signalen voor de
lokale resultaten komen er acht rechtstreeks uit het bedrijfsprofiel, en
het profiel weegt in 2026 voor 32% mee. Reviewsignalen zijn goed voor 20%.

Op volgorde van wat het meeste oplevert.

### 3.1 De hoofdcategorie staat verkeerd — begin hier

Je staat nu op **E-commerceservice**. Dat is de categorie voor bedrijven
die e-commerce *leveren aan anderen*: webshopbouwers, fulfilmentpartijen.
Niet voor een bedrijf dat zelf een product verkoopt.

De hoofdcategorie is het belangrijkste veld van je hele profiel — hij
bepaalt op welke soort zoekopdrachten je überhaupt mag verschijnen, en geen
enkel ander signaal maakt een verkeerde keuze goed. Niet je reviews, niet
je foto's, niet hoe vaak je post.

**Zet hem op:** `Leverancier van promotieartikelen`

Typ het in het categorieveld en kies uit Google's eigen lijst — de namen
liggen vast, je kunt er niets zelf van maken. Past die naam niet, kijk dan
wat er in de lijst het dichtst bij "wat wij verkopen" ligt, niet bij "hoe
wij verkopen".

Daarnaast mag je tot negen extra categorieën. Voeg alleen toe wat je echt
doet.

### 3.2 Je adres — hier zit een risico

`Dingspil 13, Roden` staat nu openbaar, met "Open" erbij.

Google's regel is dat een zichtbaar adres een plek is waar klanten je
tijdens je openingstijden persoonlijk kunnen treffen. Een woonadres met
geopende uren waar nooit iemand langskomt is een reden voor schorsing van
het profiel, en dat gebeurt zonder waarschuwing.

**Aanbeveling:** zet het profiel om naar een servicegebied. Adres verbergen,
servicegebied op Nederland. Je raakt de kans kwijt om in de kaartresultaten
van Roden te verschijnen — maar je klanten zitten in het hele land en zoeken
niet op "NFC-bordje Roden", dus dat kost je vrijwel niets. Wat je terugkrijgt
is een profiel dat niet omvalt en een woonadres dat niet meer op internet
staat.

### 3.3 Bedrijfsomschrijving

750 tekens is het maximum. Wat er vóór het "meer"-knopje staat is wat
gelezen wordt, dus de eerste zin doet het werk.

```
TapKaarten maakt NFC-bordjes waarmee je klant met een tik op zijn telefoon
direct op jouw Google-, Instagram- of Facebookpagina staat. Geen app, geen
account, geen abonnement: je betaalt een keer.

Je zet het bordje op de balie, het tafeltje of naast de pinautomaat. Op het
moment dat je klant tevreden is en zijn telefoon toch al in de hand heeft,
stelt het bordje de vraag die jij zelf net niet stelt.

Wij zoeken jouw pagina op en koppelen die voordat je bestelling de deur uit
gaat, dus hij werkt zodra je hem uitpakt. Leest een ouder toestel geen NFC,
dan scant je klant de QR-code die op hetzelfde bordje staat.

Voor kappers, horeca, winkels, salons en kramen in heel Nederland. Op
werkdagen voor 16:00 besteld gaat dezelfde dag op de post.
```

Geen opsomming van zoekwoorden erin. Google leest de omschrijving niet mee
voor je positie, en een klant die hem wel leest haakt erop af.

### 3.4 Producten

Dit veld staat bij bijna iedereen leeg en het vult een half scherm in je
profiel. Zet er alle zeven in, met foto, prijs en een regel tekst — dezelfde
foto's als op de site. Ze verschijnen als een carrousel in het profiel zelf,
en elk product wordt een eigen aanklikbaar blok.

Begin met de Google-standaard à € 34,95, want dat is je instapproduct.

### 3.5 Vragen en antwoorden

Je mag zelf vragen stellen én ze zelf beantwoorden. Vrijwel niemand doet
dat, en het is de enige plek in je profiel waar je bezwaren mag wegnemen
voordat iemand ze uitspreekt. Zet deze vijf erin:

**Heb ik een abonnement nodig?**
Nee. Je betaalt eenmalig voor het bordje, verder niets. Geen maandkosten, en
je zet er later zelf een andere pagina op als je dat wilt.

**Werkt dit op elke telefoon?**
Elke iPhone vanaf de XR en vrijwel elke Android van de laatste jaren leest
NFC zonder dat er een app op hoeft. Leest een ouder toestel het niet, dan
scant je klant de QR-code die op hetzelfde bordje staat.

**Hoe groot is het bordje?**
7,6 bij 12,75 cm. Ongeveer een bierviltje op zijn kant. Het past naast de
pin, op de rand van een luikje of tegen de kassa aan.

**Moet ik zelf iets instellen?**
Nee. Je geeft je pagina door via het formulier en wij koppelen hem voordat
het pakket weggaat. Je haalt hem uit de doos en hij werkt.

**Kan hij ook naar Instagram of Facebook wijzen?**
Ja, daar zijn aparte uitvoeringen voor. En wil je er later een andere pagina
op, dan zet je die er zelf op met de gratis app NFC Tools: ongeveer twee
minuten werk, zo vaak je wilt.

Stel ze vanaf een ander Google-account dan het account dat het profiel
beheert, anders staat er "eigenaar" bij de vraag.

### 3.6 Reviews op je eigen profiel

Hier zit iets ongemakkelijks: je verkoopt een product dat reviews oplevert,
en je eigen profiel heeft er nauwelijks. Voor een koper die twijfelt is dat
het eerste wat opvalt.

Reviewsignalen wegen voor 20% mee, en *recentheid* staat inmiddels in de top
vijf — 74% van de mensen kijkt alleen naar reviews van de laatste drie
maanden. Een stapel oude reviews telt straks niet meer.

Het voor de hand liggende: zet je eigen bordje op je eigen bureau en stuur
de link naar iedereen die tot nu toe besteld heeft. Hilda om te beginnen —
zij heeft haar verhaal al opgeschreven, alleen op de verkeerde plek.

### 3.7 Openingstijden

"Bedrijf is geopend op het moment van zoeken" is dit jaar voor het eerst
een top-vijf-factor. Zet tijden neer die kloppen met wanneer je daad-
werkelijk bereikbaar bent. Ben je 's avonds nog aan de telefoon, zet dat er
dan in. Ben je zaterdag dicht, laat dat dan dicht staan — een profiel dat
altijd open zegt te zijn terwijl er niemand opneemt, kost je reviews.

### 3.8 De websitelink meetbaar maken

Zet in het websiteveld:

```
https://tapkaarten.nl/?utm_source=google&utm_medium=organic&utm_campaign=bedrijfsprofiel
```

Dan zie je in je statistieken hoeveel bezoek er echt uit het profiel komt,
in plaats van het te moeten raden.

### 3.9 Updates

Het profiel heeft een berichtenveld dat de meeste bedrijven leeg laten. De
onderschriften uit `webshop/instagram/onderschriften.md` kunnen er direct in
— dezelfde tekst, hetzelfde beeld. Eén per week is genoeg.

---

## Volgorde

1. Logo uploaden — vijf minuten, vandaag zichtbaar
2. Hoofdcategorie omzetten — grootste effect van alles op deze lijst
3. Adres verbergen, servicegebied op Nederland — haalt een schorsingsrisico weg
4. Omschrijving plakken
5. Zeven producten invoeren
6. Vijf vragen plaatsen en beantwoorden
7. Search Console verifiëren en indexering aanvragen voor de homepage
8. Reviewlink naar bestaande klanten sturen

Punt 1 tot en met 6 kan ik niet voor je doen: er is geen koppeling met
Google-bedrijfsprofiel in deze omgeving, dus het moet via je eigen account.
Punt 7 en 8 ook niet. De teksten hierboven zijn zo geschreven dat je ze kunt
kopiëren zonder er nog iets aan te hoeven veranderen.
