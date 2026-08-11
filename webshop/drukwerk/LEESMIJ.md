# Visitekaartje TapKaarten

## Wat je naar de drukker stuurt

**`tapkaarten-visitekaartje.pdf`** — dit bestand, verder niets.

- 2 pagina's: pagina 1 is de voorkant, pagina 2 de achterkant
- 91 × 61 mm, dat is 85 × 55 mm gesneden met 3 mm afloop rondom
- Vector: de tekst blijft tekst, dus scherp op elke pers
- Lettertype Inter zit ingebed, de drukker hoeft niets te installeren

**`tapkaarten-visitekaartje-proef.pdf`** is hetzelfde met snijtekens erbij.
Handig om zelf te bekijken; stuur bij twijfel gewoon het bestand zonder tekens,
de meeste drukkers zetten die er zelf op.

## Wat je bij het bestellen invult

| | |
|---|---|
| Formaat | 85 × 55 mm |
| Afloop | 3 mm (zit er al in) |
| Zijdes | dubbelzijdig, full colour |
| Papier | 350 g/m² of zwaarder |
| Afwerking | mat laminaat — de oranje voorkant blijft dan diep en krijgt geen vingerafdrukken |

Vraag om een **kleurproef** als de drukker die aanbiedt. De oranje is een
verloop over het hele vlak; dat is precies waar goedkope drukwerk verschilt.

## Wat er op staat

Voorkant: het merkteken en de naam op je huisoranje, met één regel die uitlegt
wat je verkoopt — want wie dit kaartje krijgt, kent je nog niet.

Achterkant: telefoonnummer (iets zwaarder gezet, dat is waar mensen naar
zoeken), e-mail, website en Instagram, elk met een klein teken ervoor, en een
QR-code die naar tapkaarten.nl gaat. Die code is nagelezen met een scanner,
ook op halve resolutie.

Die tekentjes zijn er niet voor de sier: met vier regels leest een losse
Instagram-glyph naast alleen die ene regel als een fout, en vier tekens houden
de tekstkolom bovendien netjes op één lijn.

## Iets veranderen

Alles staat in `visitekaartje.py`. De gegevens staan bovenin bij elkaar:

```python
TELEFOON = "06 16 03 63 28"
EMAIL = "info@tapkaarten.nl"
WEBSITE = "tapkaarten.nl"
INSTAGRAM = "@tapkaarten"
SITE_URL = "https://tapkaarten.nl"
SLOGAN = "NFC-bordjes voor meer reviews en volgers"
```

Opnieuw maken:

```
pip install reportlab qrcode
python3 visitekaartje.py
```

De drie `.ttf`-bestanden zijn Inter, uitgesneden uit de variabele webfont van
het thema op de gewichten 400, 600 en 700. Ze moeten naast het script staan.

## Wat er nog niet op staat

Er staat **geen persoonsnaam** op — je vroeg om telefoonnummer, e-mail en
website. Wil je je eigen naam en functie erbij, dan past dat onder de haarlijn
op de achterkant.

Ook niet opgenomen: KvK- en btw-nummer. Dat hoeft niet op een visitekaartje
(wel op je facturen en op de website, en daar staat het al).
