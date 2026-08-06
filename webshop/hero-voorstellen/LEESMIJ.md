# Drie hero-voorstellen

Alle drie: de oranje verloopachtergrond van het visitekaartje, het bordje veel
groter dan nu, en iets in beeld dat laat zien wát het doet.

| Bestand | Idee | Sterk punt | Zwak punt |
|---|---|---|---|
| `hero-1-groot.png` | Eén bordje groot, met de review die eruit komt ernaast | Meest direct: product én resultaat in één blik | Toont maar één van de drie soorten |
| `hero-2-drieluik.png` | Drie bordjes naast elkaar met hun doel erboven | Laat het hele assortiment zien | Geen enkel bordje is echt groot |
| `hero-3-mechanisme.png` | Tekst links, bordje → tik → telefoonscherm rechts | Legt uit hoe het werkt zonder één woord uitleg | Drukste beeld van de drie |

## Waar de bordjes vandaan komen

Uit je eigen productfoto's (`tk3-prod-*.jpg`), uitgeknipt van hun egale
ondergrond met `uitknippen.py`. Er is niets bijgetekend of gegenereerd: de
QR-codes, de logo's en de teksten op de bordjes zijn precies wat je verkoopt.

Het uitknippen was niet triviaal. De achtergrond van de foto's is
`(241,242,246)` en het witte bordje wijkt daar maar 24 van af op een schaal
van 765 — een gewone drempelwaarde haalt of het halve bordje weg, of de
slagschaduw erbij. Daarom een vlakvulling vanaf de rand, en de schaduw wordt
gescheiden op de plek waar het masker ineens veel breder wordt.

## Wat er nog moet gebeuren als je er één kiest

1. **De hero-sectie wordt oranje.** Je koptekst staat nu donker op wit; op
   oranje moet die wit worden. Dat raakt `tk3-hero.liquid` en de CSS.
2. **Een telefoonversie.** Deze drie zijn 1600 × 900. De hero snijdt per
   schermgrootte anders bij (die verhoudingen staan al in de CSS); voor het
   gekozen voorstel moet er een staande variant komen, anders valt het bordje
   op een telefoon buiten beeld.
3. **De foto van het zwarte bordje** staat er nog niet in, en de twee nieuwe
   review-standaards ook niet — daar zijn nog geen foto's van.

## Zelf aanpassen

```
python3 uitknippen.py   # bordjes vrijstaand maken
python3 heros.py        # de drie voorstellen renderen
```

Koppen, subregels en knopteksten staan bovenin de drie functies `hero_een`,
`hero_twee` en `hero_drie`.
