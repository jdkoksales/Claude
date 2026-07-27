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
        # Veld op de productpagina waarin de klant zijn eigen link kwijt kan.
        # het thema zet de koopknoppen op één rij; het veld moet daar bovenop
        ".product-info__buy-buttons{flex-wrap:wrap}\n"
        ".tk3-linkveld{flex:1 0 100%;width:100%;margin:0 0 14px}\n"
        ".tk3-linkveld label{display:block;font-size:14px;font-weight:600;letter-spacing:-.01em;margin-bottom:6px}\n"
        ".tk3-linkveld input{width:100%;padding:12px 14px;font:inherit;font-size:15px;"
        "border:1px solid rgba(0,0,0,.16);border-radius:10px;background:#fff;color:inherit}\n"
        ".tk3-linkveld input::placeholder{color:rgba(0,0,0,.34)}\n"
        ".tk3-linkveld input:focus{outline:2px solid rgba(0,0,0,.55);outline-offset:1px;border-color:transparent}\n"
        ".tk3-linkveld small{display:block;margin-top:6px;font-size:12.5px;line-height:1.45;color:rgba(0,0,0,.55)}\n"
        # Staffelkorting op de productpagina.
        ".tk3-staffel{flex:1 0 100%;width:100%;margin:0 0 18px}\n"
        ".tk3-staffel-kop{font-size:14px;font-weight:600;letter-spacing:-.01em;margin-bottom:8px}\n"
        ".tk3-staffel-rij{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}\n"
        ".tk3-trede{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;"
        "font:inherit;text-align:center;cursor:pointer;background:#fff;color:inherit;"
        "border:1px solid rgba(0,0,0,.14);border-radius:10px;transition:border-color .12s,box-shadow .12s}\n"
        ".tk3-trede:hover{border-color:rgba(0,0,0,.38)}\n"
        ".tk3-trede.is-actief{border-color:rgba(0,0,0,.85);box-shadow:0 0 0 1px rgba(0,0,0,.85) inset}\n"
        ".tk3-trede-aantal{font-size:12px;font-weight:600;letter-spacing:-.01em}\n"
        ".tk3-trede-pct{font-size:13px;font-weight:700;letter-spacing:-.02em;color:#136C34}\n"
        ".tk3-trede:first-child .tk3-trede-pct{color:rgba(0,0,0,.36);font-weight:600}\n"
        ".tk3-trede-prijs{font-size:11.5px;color:rgba(0,0,0,.5)}\n"
        ".tk3-staffel small{display:block;margin-top:8px;font-size:12.5px;line-height:1.45;color:rgba(0,0,0,.55)}\n"
        "@media(max-width:420px){.tk3-staffel-rij{grid-template-columns:repeat(2,1fr)}}\n")
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


if __name__ == "__main__":
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    css = transform(open(SRC).read())
    header = ("/* tk3 — gegenereerd uit webshop/clone/style.css door build-css.py.\n"
              "   Niet met de hand aanpassen: pas de bron aan en draai het script. */\n")
    open(DST, "w").write(header + TAIL + css + "\n")
    print(DST, len(css), "tekens")
