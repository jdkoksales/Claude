# TapKaarten-configurator

Bron van `assets/tk3-configurator.js`. TypeScript, gebundeld met esbuild.

```
npm install
node build.mjs          # bouwt naar ../theme3/assets/tk3-configurator.js
npx tsc --noEmit        # typecontrole
```

## Waar pas je iets aan

Alles wat je normaal wilt wijzigen staat in **`src/config/calculatorConfig.ts`**:
producten (gekoppeld op Shopify-handle), exposure-curves, basisconversies,
aannames, sliderbereik, btw-tarief en de snelkeuzes.

Prijzen en variant-ID's staan hier bewust **niet** in. Die rendert
`sections/tk3-configurator.liquid` server-side uit Shopify, zodat ze altijd
kloppen en er geen extra API-verzoek nodig is.

## Rekenmodel

```
bezoekers/maand   = bezoekers/dag × 30
kassabezoekers    = bezoekers/maand × 0,80
exposure          = som van de curve per product en aantal
effectiviteit     = 1 − e^(−exposure)        (genormaliseerd, zie hieronder)
resultaat         = kassabezoekers × basisconversie × effectiviteit
```

`normaliseEffectiveness` staat standaard aan. Zonder normaliseren geeft één
standaard maar 63% effectiviteit (`1 − e^-1`), waardoor het eerste product
minder oplevert dan de basisconversie suggereert. Genormaliseerd telt de eerste
standaard voor 100% en levert elk extra exemplaar er steeds minder bij.
Zet hem op `false` voor de kale formule.
