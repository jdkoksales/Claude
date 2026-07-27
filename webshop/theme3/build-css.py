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
# scroll-behavior hoort op het document, niet op een div
TAIL = "html{scroll-behavior:smooth}\n"
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
