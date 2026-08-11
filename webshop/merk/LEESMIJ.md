# Het vierkante merkteken

De voorkant van het visitekaartje, dan vierkant: oranje verloop, witte ster
met de twee NFC-boogjes, en de naam eronder.

## Wat er ligt

| Bestand | Waarvoor |
|---|---|
| `tapkaarten-instagram-1080.png` | **Instagram-profielfoto.** Upload deze. |
| `tapkaarten-logo-vierkant-512.png` | Los logo om te delen — leveranciers, facturen, een partnerpagina |
| `voorbeeld-logo.png` | Proefblad: hoe het er straks echt uitziet |

En in het thema (`webshop/theme3/assets/`):

| Bestand | Waarvoor |
|---|---|
| `tk3-merk-vierkant.png` | Bedrijfslogo in de structured data, en de tegel die iOS op een beginscherm zet |
| `tk3-favicon-192.png`, `tk3-favicon-48.png` | Het icoontje in het tabblad en in de zoekresultaten |

## Waarom er twee versies zijn

Met naam en zonder naam, en dat is geen slordigheid.

Op een profielfoto staat het beeld rond de 110 pixels; daar leest
"TapKaarten" nog. In een tabblad staat het op 16 pixels, en daar wordt elk
woordmerk een grijze veeg. Vandaar dat het favicon alleen de ster toont — dat
is op die maat het enige dat overeind blijft.

## Waar het op is nagemeten

`controleer.py` doet drie dingen, omdat dit drie dingen zijn die stilletjes
fout gaan:

1. **Instagram snijdt rond bij.** Alles buiten de ingeschreven cirkel is weg.
   De verste witte pixel staat op 0,37 × de breedte vanaf het midden; de
   uitsnede loopt tot 0,50. Ruim.
2. **Leest de naam nog?** Op 110 pixels staan de letters 12 pixels hoog met
   een contrast van 91 op 255. Dat is gemeten op het echt verkleinde beeld,
   niet uitgerekend.
3. **Blijft het favicon een ster?** Op 16 pixels is 13% van het vlak wit, en
   dat wit zit voor 53% in het middenvierkant — dus geen vlek langs de rand.

```
python3 logo.py        # maakt alles opnieuw
python3 controleer.py  # meet na en schrijft het proefblad
```

De drie `.ttf`-bestanden staan in `../drukwerk/`; het is dezelfde Inter als op
de site en op het visitekaartje.

## Wat het niet is

Dit vervangt het **liggende** logo in de koptekst van de site niet. Dat is
`tk3-logo.svg`: ster, boogjes en het woord naast elkaar, in donkerblauw.
Een vierkante oranje tegel in een witte balk zou daar een sticker lijken.
Het teken zelf is in beide hetzelfde, dus ze horen zichtbaar bij elkaar.
