#!/usr/bin/env python3
"""Zet webshop/clone/style.css om naar assets/tk3.css voor het Shopify-thema.

Het thema heeft een eigen stylesheet die overal op los gaat. Daarom krijgt
elke regel het voorvoegsel `.tk3`; de secties zetten dat als wrapper. `:root`,
`html` en `body` worden dezelfde wrapper, zodat de custom properties en de
basistypografie precies daar landen. `@font-face` gaat eruit — die zet de
layout zelf neer met `asset_url`.
"""
import re, sys, os

SRC = "/home/user/Claude/webshop/clone/style.css"
DST = "/home/user/Claude/webshop/theme3/assets/tk3.css"
ROOTS = {":root", "html", "body", "html,body", "body,html"}
# de universele reset moet ook op de wrapper zelf landen
UNIVERSAL = {"*", "*,*::before,*::after"}
# Regels die niet onder .tk3 kunnen wonen, plus twee correcties voor het thema:
#  - [hidden] verliest het van display:grid op .usecase, dus forceren
#  - overflow-x:clip houdt de horizontale rails binnen boord zonder sticky te slopen
TAIL = ("html{scroll-behavior:smooth}\n"
        "html,body{overflow-x:clip}\n"
        ".tk3 [hidden]{display:none!important}\n"
        # Concept zet 10px zijmarge op elke .shopify-section; onze secties zijn
        # full-bleed en moeten die kwijt.
        ".shopify-section:has(>.tk3){display:block!important;padding:0!important;margin:0!important;border:0!important;max-width:none!important;width:auto!important}\n"
        # het thema legt ook op de sectie-inhoud zelf een zijmarge
        ".shopify-section>.tk3{margin-left:0!important;margin-right:0!important;border:0!important;max-width:none!important;width:auto!important}\n"
        # De losse pagina's (verzending, retour, voorwaarden) draaien op de
        # sectie van het thema zelf. Die geeft koppen geen ruimte en tabellen
        # geen lijnen, waardoor lange teksten als één blok aanvoelen.
        ".page-section__inner{max-width:760px;margin-left:auto;margin-right:auto}\n"
        ".page-section__title{margin-bottom:.5em;letter-spacing:-.02em}\n"
        ".page-section__content.rte{line-height:1.65}\n"
        ".page-section__content.rte h2{font-size:1.35rem;font-weight:600;letter-spacing:-.01em;margin:2.1em 0 .5em}\n"
        ".page-section__content.rte h2:first-child{margin-top:0}\n"
        ".page-section__content.rte h3{font-size:1.06rem;font-weight:600;margin:1.7em 0 .4em}\n"
        ".page-section__content.rte p,.page-section__content.rte ul,.page-section__content.rte ol{margin:0 0 1em}\n"
        ".page-section__content.rte ul,.page-section__content.rte ol{padding-left:1.2em}\n"
        ".page-section__content.rte li{margin-bottom:.35em}\n"
        ".page-section__content.rte a{text-decoration:underline;text-underline-offset:2px}\n"
        ".page-section__content.rte table{width:100%;border-collapse:collapse;margin:0 0 1.4em}\n"
        ".page-section__content.rte td,.page-section__content.rte th{padding:.6em .2em;border-bottom:1px solid rgba(0,0,0,.08);text-align:left;vertical-align:top}\n"
        ".page-section__content.rte tr:last-child td{border-bottom:0}\n"
        # Aflopende klok tot de verzendgrens, pal boven de koopknop.
        ".tk3-klok{flex:1 0 100%;width:100%;margin:0 0 10px;display:flex;align-items:center;gap:9px;"
        "font-size:13.5px;line-height:1.45;color:rgba(0,0,0,.66)}\n"
        ".tk3-klok b{color:#1A202C;font-weight:750}\n"
        ".tk3-klok-punt{flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:rgba(0,0,0,.28)}\n"
        ".tk3-klok.is-vandaag .tk3-klok-punt{background:#136C34;"
        "box-shadow:0 0 0 4px rgba(19,108,52,.16);animation:tk3klop 2.2s ease-in-out infinite}\n"
        ".tk3-klok.is-vandaag b{color:#136C34}\n"
        "@keyframes tk3klop{0%,100%{box-shadow:0 0 0 3px rgba(19,108,52,.14)}"
        "50%{box-shadow:0 0 0 7px rgba(19,108,52,.05)}}\n"
        "@media(prefers-reduced-motion:reduce){.tk3-klok.is-vandaag .tk3-klok-punt{animation:none}}\n"
        # Geruststelling op de productpagina: wij koppelen je pagina.
        # het thema zet de koopknoppen op één rij, dus het blok moet daar bovenop
        ".product-info__buy-buttons{flex-wrap:wrap}\n"
        ".tk3-koppelmelding{flex:1 0 100%;width:100%;margin:0 0 14px;display:flex;gap:10px;"
        "align-items:flex-start;background:rgba(19,108,52,.06);border:1px solid rgba(19,108,52,.2);"
        "border-radius:12px;padding:13px 15px;font-size:13.5px;line-height:1.5;color:rgba(0,0,0,.7)}\n"
        ".tk3-koppelmelding-icoon{flex:0 0 auto;width:18px;height:18px;border-radius:50%;"
        "background:#136C34;color:#fff;font-size:11px;font-weight:800;display:flex;"
        "align-items:center;justify-content:center;margin-top:1px}\n"
        ".tk3-koppelmelding b{color:var(--ink,#1A202C)}\n"
        ".tk3-koppelmelding a{text-decoration:underline;text-underline-offset:2px;font-weight:600;"
        "white-space:nowrap}\n"
        # Dezelfde regel onderaan de winkelwagenlade, boven de afrekenknop.
        ".tk3-cartlink-ok{margin:0 0 10px;font-size:12.5px;font-weight:600;color:#136C34;line-height:1.45}\n"
        # Eén kaart erbij tilt de korting over de hele bestelling omhoog. Dit
        # blok staat bovenaan in de voet van de lade, waar de beslissing valt.
        ".tk3-staffelduw{display:flex;align-items:center;gap:12px;margin:0 0 12px;padding:11px 13px;"
        "border-radius:12px;background:linear-gradient(92deg,rgba(219,78,20,.09),rgba(244,128,31,.05));"
        "border:1px solid rgba(219,78,20,.26)}\n"
        ".tk3-staffelduw.is-max{background:rgba(19,108,52,.07);border-color:rgba(19,108,52,.26)}\n"
        ".tk3-staffelduw-tekst{flex:1 1 auto;min-width:0;line-height:1.35}\n"
        ".tk3-staffelduw-tekst b{display:block;font-size:13px;color:#1A202C}\n"
        ".tk3-staffelduw-tekst span{font-size:12px;color:rgba(0,0,0,.58)}\n"
        ".tk3-staffelduw.is-max .tk3-staffelduw-tekst b{color:#136C34}\n"
        ".tk3-staffelduw-knop{flex:0 0 auto;border:0;border-radius:100px;padding:9px 15px;"
        "font-size:12.5px;font-weight:750;cursor:pointer;color:#fff;"
        "background:linear-gradient(92deg,#DB4E14,#F4801F);transition:filter .15s}\n"
        ".tk3-staffelduw-knop:hover{filter:brightness(1.08)}\n"
        ".tk3-staffelduw-knop[disabled]{opacity:.6;cursor:default}\n"
        # Hoeveel er nog tot gratis verzending ontbreekt. Twee kaarten komen op
        # 62,92 uit; zonder deze balk ziet niemand dat 70 vlakbij ligt.
        ".tk3-verzendbalk{margin:0 0 14px}\n"
        ".tk3-verzendbalk p{margin:0 0 7px;font-size:13px;color:rgba(0,0,0,.66)}\n"
        ".tk3-verzendbalk b{color:#1A202C}\n"
        ".tk3-verzendmeter{height:6px;border-radius:100px;background:rgba(0,0,0,.09);overflow:hidden}\n"
        ".tk3-verzendmeter span{display:block;height:100%;border-radius:100px;"
        "background:linear-gradient(90deg,#DB4E14,#F4801F);transition:width .35s ease}\n"
        ".tk3-verzendbalk.is-gehaald .tk3-verzendmeter span{background:#136C34}\n"
        ".tk3-verzendbalk.is-gehaald b{color:#136C34}\n"
        # De sticker als bijverkoop, vlak boven het subtotaal.
        ".tk3-bijverkoop{display:flex;align-items:center;gap:12px;margin:0 0 14px;padding:10px 12px;"
        "border:1px dashed rgba(0,0,0,.2);border-radius:12px}\n"
        ".tk3-bijverkoop img{width:48px;height:48px;object-fit:contain;border-radius:8px;"
        "background:rgba(0,0,0,.04);flex:0 0 auto}\n"
        ".tk3-bijverkoop-tekst{flex:1 1 auto;min-width:0;line-height:1.35}\n"
        ".tk3-bijverkoop-tekst b{display:block;font-size:13px;color:#1A202C}\n"
        ".tk3-bijverkoop-tekst span{font-size:12px;color:rgba(0,0,0,.55)}\n"
        ".tk3-bijverkoop-knop{flex:0 0 auto;border:1px solid #1A202C;border-radius:100px;"
        "padding:8px 15px;font-size:12.5px;font-weight:700;background:#fff;color:#1A202C;cursor:pointer;"
        "transition:background .15s,color .15s}\n"
        ".tk3-bijverkoop-knop:hover{background:#1A202C;color:#fff}\n"
        ".tk3-bijverkoop-knop[disabled]{opacity:.55;cursor:default}\n"
        # Op een telefoon brak de tekst van deze twee blokken over vier of vijf
        # regels, waardoor ze samen ruim 260px hoog werden en de artikelenlijst
        # nog maar een strookje overhield. Kleinere afbeelding, kleinere knop en
        # minder tussenruimte geven de tekst genoeg breedte om op één regel te
        # blijven; dat scheelt ongeveer de helft van de hoogte.
        "@media(max-width:749px){\n"
        "  .tk3-bijverkoop,.tk3-staffelduw{gap:10px;padding:10px;margin-bottom:10px}\n"
        "  .tk3-bijverkoop img{width:40px;height:40px}\n"
        "  .tk3-bijverkoop-knop,.tk3-staffelduw-knop{padding:8px 12px;font-size:12px}\n"
        "  .tk3-bijverkoop-tekst,.tk3-staffelduw-tekst{line-height:1.3}\n"
        "  .tk3-verzendbalk{margin-bottom:10px}\n"
        "  .tk3-verzendbalk p{margin-bottom:5px}\n"
        "}\n"
        # De meeloopbalk onderaan de productpagina toont dezelfde actieprijs;
        # die moet dus ook rood zijn en niet zwart.
        ".product-sticky-bar__price{color:#E23B1E}\n"
        # Staffelkorting op de productpagina.
        ".tk3-staffel{flex:1 0 100%;width:100%;margin:0 0 18px}\n"
        ".tk3-staffel-kop{font-size:14px;font-weight:600;letter-spacing:-.01em;margin-bottom:8px}\n"
        ".tk3-staffel-rij{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}\n"
        ".tk3-trede{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;"
        "font:inherit;text-align:center;cursor:pointer;background:#fff;color:inherit;"
        "border:1px solid rgba(0,0,0,.14);border-radius:10px;transition:border-color .12s,box-shadow .12s}\n"
        ".tk3-trede:hover{border-color:rgba(0,0,0,.38)}\n"
        ".tk3-trede.is-actief{border-color:rgba(0,0,0,.85);box-shadow:0 0 0 1px rgba(0,0,0,.85) inset}\n"
        ".tk3-trede-aantal{font-size:12px;font-weight:600;letter-spacing:-.01em;color:rgba(0,0,0,.55)}\n"
        ".tk3-trede-stuk{font-size:17px;font-weight:750;letter-spacing:-.03em;color:#E23B1E;line-height:1.1}\n"
        ".tk3-trede:first-child .tk3-trede-stuk{color:#1A202C}\n"
        ".tk3-trede-eenheid{font-size:10.5px;color:rgba(0,0,0,.4);margin-top:-1px}\n"
        ".tk3-trede-pct{font-size:12px;font-weight:700;letter-spacing:-.01em;color:#136C34;margin-top:3px}\n"
        ".tk3-trede:first-child .tk3-trede-pct{color:rgba(0,0,0,.36);font-weight:600}\n"
        ".tk3-trede-prijs{font-size:11px;color:rgba(0,0,0,.42)}\n"
        ".tk3-staffel small{display:block;margin-top:8px;font-size:12.5px;line-height:1.45;color:rgba(0,0,0,.55)}\n"
        ".tk3-staffel small a{text-decoration:underline;text-underline-offset:2px;font-weight:600;color:rgba(0,0,0,.75)}\n"
        "@media(max-width:560px){.tk3-staffel-rij{grid-template-columns:repeat(2,1fr)}}\n"
        # Op een pakketpagina staat er geen staffel maar deze regel.
        ".tk3-pakketregel{flex:1 0 100%;width:100%;margin:0 0 16px;padding:12px 14px;"
        "background:rgba(0,0,0,.04);border-radius:12px;font-size:13.5px;line-height:1.5;"
        "color:rgba(0,0,0,.62)}\n"
        ".tk3-pakketregel b{display:block;color:#1A202C}\n"
        ".tk3-pakketregel a{text-decoration:underline;text-underline-offset:2px;font-weight:600;color:#1A202C}\n"
        # De koopkolom van het thema is op een telefoon smal; het linkveld en
        # de staffel moeten daar niet in de verdrukking komen.
        "@media(max-width:560px){.tk3-staffel-kop{font-size:13.5px}.tk3-trede{padding:11px 6px}.tk3-trede-aantal{font-size:12.5px}.tk3-trede-pct{font-size:14px}.tk3-staffel small{font-size:12px}.tk3-koppelmelding{font-size:13px}}\n")
KEYFRAMES = {"slide": "tk3slide", "float": "tk3float"}


def split_rules(css):
    """Loop de top-laag af en lever (selector, body, is_at_rule) per regel."""
    out, i, n, depth, start = [], 0, len(css), 0, 0
    head = ""
    while i < n:
        c = css[i]
        if c == "{":
            if depth == 0:
                head = css[start:i]
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                out.append((head, css[css.index("{", start) + 1:i]))
                start = i + 1
        i += 1
    return out


def prefix_selector(sel):
    parts = []
    for s in sel.split(","):
        s = s.strip()
        if not s:
            continue
        if s in UNIVERSAL:
            parts.append(".tk3,.tk3 *,.tk3 *::before,.tk3 *::after")
        elif s in ROOTS:
            parts.append(".tk3")
        elif s.startswith(":"):          # :is(), ::selection …
            parts.append(".tk3 " + s)
        else:
            parts.append(".tk3 " + s)
    return ",".join(parts)


def transform(css):
    # commentaar weg
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out = []
    for head, body in split_rules(css):
        head = head.strip()
        if head.startswith("@font-face"):
            continue                                    # zit in layout/theme.liquid
        if head.startswith("@keyframes"):
            name = head.split()[-1].strip()
            out.append(f"@keyframes {KEYFRAMES.get(name, name)}{{{body}}}")
            continue
        if head.startswith("@media") or head.startswith("@supports"):
            inner = "".join(f"{prefix_selector(h.strip())}{{{b}}}"
                            for h, b in split_rules(body))
            out.append(f"{head}{{{inner}}}")
            continue
        out.append(f"{prefix_selector(head)}{{{body}}}")
    css = "\n".join(out)
    for old, new in KEYFRAMES.items():
        css = re.sub(rf"animation(-name)?\s*:([^;}}]*?)\b{old}\b",
                     lambda m, n=new: f"animation{m.group(1) or ''}:{m.group(2)}{n}", css)
    return css


def keur(bron, css):
    """Weiger stil door te bouwen als er iets niet klopt.

    Twee keer op rij heb ik bij het uitbreiden van een commentaarblok een
    tweede `*/` laten staan. De regel eronder werd dan geen regel meer, kreeg
    dus geen `.tk3` voor zich en deed op de winkel helemaal niets — zonder dat
    er iets zichtbaar misging. Dat is precies het soort fout waar een script
    voor is.
    """
    klachten = []

    if bron.count("/*") != bron.count("*/"):
        klachten.append(f"commentaarmarkeringen niet in balans: "
                        f"{bron.count('/*')}x /* tegen {bron.count('*/')}x */")

    # Elke selector in het omgezette deel moet met .tk3 beginnen of een at-regel
    # zijn. Staat er iets anders, dan is de omzetting eroverheen gelopen.
    for head, _ in split_rules(css):
        head = head.strip()
        if not head or head.startswith("@"):
            continue
        for sel in head.split(","):
            sel = sel.strip()
            if sel and not sel.startswith(".tk3"):
                klachten.append(f"selector zonder .tk3-voorvoegsel: {sel[:70]!r}")

    # Een regel in een media query die verderop nog eens onvoorwaardelijk wordt
    # gezet, verliest: gelijke specificiteit, latere regel wint. Dan staat er
    # netjes CSS die niets doet. Overkwam me met .hero-calc{display:none}, dat
    # tachtig regels verderop weer op inline-flex werd gezet.
    def eigenschappen(blok):
        namen = set()
        for stuk in blok.split(";"):
            if ":" in stuk:
                namen.add(stuk.split(":", 1)[0].strip().lower())
        return {n for n in namen if n and not n.startswith("--")}

    in_media = []          # (selector, eigenschappen, volgnummer)
    plat = []              # (selector, eigenschappen, volgnummer)
    for n, (head, body) in enumerate(split_rules(css)):
        head = head.strip()
        if head.startswith("@media") or head.startswith("@supports"):
            for h, b in split_rules(body):
                for sel in h.split(","):
                    in_media.append((sel.strip(), eigenschappen(b), n))
        elif not head.startswith("@"):
            for sel in head.split(","):
                plat.append((sel.strip(), eigenschappen(body), n))

    for sel, eig, n in in_media:
        for sel2, eig2, n2 in plat:
            if sel2 == sel and n2 > n:
                botsend = eig & eig2
                if botsend:
                    klachten.append(
                        f"media query op {sel[:44]!r} zet {sorted(botsend)}, "
                        f"maar een gewone regel verderop zet dat opnieuw — de media query verliest")

    if klachten:
        for k in klachten:
            print("AFGEKEURD:", k, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    bron = open(SRC).read()
    css = transform(bron)
    keur(bron, css)
    header = ("/* tk3 — gegenereerd uit webshop/clone/style.css door build-css.py.\n"
              "   Niet met de hand aanpassen: pas de bron aan en draai het script. */\n")
    open(DST, "w").write(header + TAIL + css + "\n")
    print(DST, len(css), "tekens")
