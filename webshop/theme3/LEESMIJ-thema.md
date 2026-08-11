# Welk thema is welk, en wat je moet weten voor je iets uploadt

## De thema's

| Thema | Id | Rol |
|---|---|---|
| TapKaarten — live sinds 11 aug | `196964024697` | **MAIN, live op tapkaarten.nl** |
| PUBLICEER DEZE — brede schermen (12 aug) | `197367529849` | concept, wacht op publicatie |
| TapKaarten Premium (concept) | `196665213305` | oud, de versie van vóór 11 augustus |

## Het live thema kun je niet vanaf hier aanpassen

Schrijven naar het gepubliceerde thema is geblokkeerd, en dat is maar goed
ook: dat is de knop die de winkel omgooit. De werkwijze is dus:

1. `themeDuplicate` op het live thema — je krijgt een exacte kopie
2. de gewijzigde bestanden naar die kopie uploaden
3. checksums vergelijken met wat er lokaal ligt
4. de eigenaar publiceert hem in de Shopify-beheeromgeving

Wacht bij stap 1 tot `processing` op `false` staat; tot die tijd is de kopie
leeg en levert een upload niets op.

## Let op: `templates/index.json` loopt uit de pas

Zodra iemand iets in de thema-editor aanpast, herschrijft Shopify dit bestand.
De versie in deze map is dan verouderd, en hem alsnog uploaden gooit dat werk
weg — teksten, blokken, verborgen secties, alles.

**Lees dus altijd eerst het bestand uit de winkel** voordat je hier iets
uploadt, en voeg je wijziging in díe versie in:

```graphql
{ theme(id: "gid://shopify/OnlineStoreTheme/196964024697") {
    files(first: 1, filenames: ["templates/index.json"]) {
      nodes { body { ... on OnlineStoreThemeFileBodyText { content } } } } } }
```

Stand van zaken bij het schrijven hiervan: de kopie in deze map is **niet**
gelijk aan die in de winkel. Wat er in de winkel staat is leidend.

Shopify zet zelf een kopregel met "auto-generated" boven dit bestand. De
checksum van de winkel wijkt daardoor af van een lokale md5; dat is geen
verschil in inhoud.

## De metingen

`heroai.yml` en `reviewcheck.yml` meten via `?preview_theme_id=…`. Dat nummer
staat in beide bestanden hard ingevuld en moet mee veranderen zodra er een
nieuw conceptthema is — anders meet je het vorige thema na en lijkt alles goed.
Het thema-id wordt in de uitkomst meegeprint, juist om dat te kunnen zien.
