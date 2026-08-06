# Drie hero-voorstellen

Alle drie: de oranje verloopachtergrond van het visitekaartje, het bordje veel
groter dan nu, en iets in beeld dat laat zien wát het doet.

| Bestand | Idee | Sterk punt | Zwak punt |
|---|---|---|---|
| `hero-1-groot.png` | Eén bordje groot, met de review die eruit komt ernaast | Meest direct: product én resultaat in één blik | Toont maar één van de drie soorten |
| `hero-2-drieluik.png` | Drie bordjes naast elkaar met hun doel erboven | Laat het hele assortiment zien | Geen enkel bordje is echt groot |
| `hero-3-mechanisme.png` | Tekst links, bordje → tik → telefoonscherm rechts | Legt uit hoe het werkt zonder één woord uitleg | Drukste beeld van de drie |

## Dat het een standaard is, en geen kaartje

Twee dingen doen dat werk:

1. **De voet staat erop.** In de eerste versie was die weggeknipt. De schaduw
   werd toen gescheiden op breedte, en de voet is óók breder dan het paneel —
   dus die verdween mee. Nu wordt de schaduw op kleur herkend: hij is de
   achtergrond maal een factor en houdt daardoor de blauwzweem daarvan
   (blauw min rood is 3 tot 5), terwijl het witte en zwarte bordje neutraal
   zijn en het roze en blauwe bordje er ver naast liggen.
2. **Er ligt een balieblad onder.** Zonder vlak om op te staan blijft elk
   voorwerp een plaatje. Het blad heeft een lichte voorrand op de horizon, en
   onder elke voet zit een korte donkere contactschaduw — dat 'plakt' het
   bordje aan het blad vast.

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
3. **Het zwarte bordje** is wel vrijgesteld (`uitknip/tk3-prod-zwart.png`)
   maar staat in geen van de drie voorstellen; de twee nieuwe
   review-standaards ontbreken nog helemaal, daar zijn geen foto's van.
4. **De sticker** doet niet mee. Dat is geen standaard, en zijn lichte vlak
   loopt tot de rand door waardoor de kleurregel er gaten in slaat.

## Zelf aanpassen

```
python3 uitknippen.py   # bordjes vrijstaand maken
python3 heros.py        # de drie voorstellen renderen
```

Koppen, subregels en knopteksten staan bovenin de drie functies `hero_een`,
`hero_twee` en `hero_drie`.
