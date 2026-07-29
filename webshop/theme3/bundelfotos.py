#!/usr/bin/env python3
"""Zet bundelfoto's samen uit de losse productfoto's.

De losse foto's staan allemaal op precies dezelfde egale lichtgrijze
achtergrond met een zachte slagschaduw. Dat maakt uitknippen overbodig: we
plakken niet de rechthoek, maar het *verschil* met die achtergrond. Waar een
laag gelijk is aan de achtergrond draagt hij niets bij, dus er zijn geen naden
en de schaduw blijft zacht. Waar twee schaduwen elkaar raken worden ze iets
donkerder — precies wat je in het echt ook zou zien.

De kaartjes zelf mogen elkaar niet overlappen: bij optellen zou het witte vlak
van de voorste kaart door de QR-code van de kaart erachter heen schijnen.
Daarom rekent dit script met het kader van de kaart zonder schaduw en houdt het
die kaders uit elkaar.
"""
import os
from PIL import Image, ImageChops

HIER = os.path.dirname(os.path.abspath(__file__))
BRON = os.path.join(HIER, "assets")
DOEL = os.path.join(HIER, "bundels")

DOEK = 1400
ZACHT = 5     # hierboven telt een pixel als "niet de achtergrond"; laag houden,
              # anders snijdt de uitsnede door de zachte schaduw heen
HARD = 45     # hierboven telt hij als het product zelf (schaduw valt af)


def achtergrond(im):
    w, h = im.size
    hoeken = [im.getpixel(p) for p in ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3))]
    return tuple(sum(c[i] for c in hoeken) // 4 for i in range(3))


def kader(im, bg, drempel):
    w, h = im.size
    px = im.load()
    links, rechts, boven, onder = w, 0, h, 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            if max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2])) > drempel:
                links = min(links, x)
                rechts = max(rechts, x)
                boven = min(boven, y)
                onder = max(onder, y)
    if rechts <= links or onder <= boven:
        return (0, 0, w, h)
    return (links, boven, rechts + 1, onder + 1)


_cache = {}


def laag(naam):
    """Geeft (uitsnede incl. schaduw, achtergrondkleur, kader van het product
    zelf binnen die uitsnede)."""
    if naam in _cache:
        return _cache[naam]
    im = Image.open(os.path.join(BRON, naam)).convert("RGB")
    bg = achtergrond(im)
    zacht = kader(im, bg, ZACHT)
    hard = kader(im, bg, HARD)
    snede = im.crop(zacht)
    # kader van het product, omgerekend naar coördinaten binnen de uitsnede
    prod = (hard[0] - zacht[0], hard[1] - zacht[1], hard[2] - zacht[0], hard[3] - zacht[1])
    _cache[naam] = (snede, bg, prod)
    return _cache[naam]


def optellen(doek, vlak, bg):
    """Plak het verschil tussen vlak en de achtergrond op het doek."""
    egaal = Image.new("RGB", vlak.size, bg)
    op = ImageChops.subtract(vlak, egaal)      # waar de laag lichter is
    af = ImageChops.subtract(egaal, vlak)      # waar de laag donkerder is
    return op, af


def bouw(lagen):
    """lagen: lijst van (bestand, hoogte van het product, midden-x, voet-y)."""
    _, bg, _ = laag(lagen[0][0])
    doek = Image.new("RGB", (DOEK, DOEK), bg)
    kaders = []
    for bestand, prodhoogte, mid_x, voet_y in lagen:
        snede, _, prod = laag(bestand)
        # schaal zo dat het product (zonder schaduw) de gevraagde hoogte krijgt
        schaal = prodhoogte / (prod[3] - prod[1])
        nw, nh = max(1, round(snede.width * schaal)), max(1, round(snede.height * schaal))
        vlak = snede.resize((nw, nh), Image.LANCZOS)

        # positie bepalen aan de hand van het product, niet van de uitsnede
        px0, py0, px1, py1 = [round(v * schaal) for v in prod]
        x = round(mid_x - (px0 + px1) / 2)
        y = round(voet_y - py1)
        kaders.append((x + px0, y + py0, x + px1, y + py1))

        op, af = optellen(doek, vlak, bg)
        leeg_op = Image.new("RGB", doek.size, (0, 0, 0))
        leeg_af = Image.new("RGB", doek.size, (0, 0, 0))
        leeg_op.paste(op, (x, y))
        leeg_af.paste(af, (x, y))
        doek = ImageChops.subtract(ImageChops.add(doek, leeg_op), leeg_af)
    return doek, kaders


def controleer(naam, kaders):
    """Waarschuw als twee producten elkaar overlappen; optellen kan dat niet aan."""
    for i in range(len(kaders)):
        for j in range(i + 1, len(kaders)):
            a, b = kaders[i], kaders[j]
            breed = min(a[2], b[2]) - max(a[0], b[0])
            hoog = min(a[3], b[3]) - max(a[1], b[1])
            if breed > 0 and hoog > 0:
                print(f"   let op: in {naam} overlappen product {i} en {j} met {breed}x{hoog}px")


BUNDELS = {
    # (bestand, hoogte van het product, midden-x, voet-y)
    "tk3-bundel-start.jpg": [
        ("tk3-prod-sticker.jpg", 330, 1000, 1010),
        ("tk3-prod-wit.jpg", 700, 520, 1060),
    ],
    "tk3-bundel-balie.jpg": [
        ("tk3-prod-insta.jpg", 490, 285, 900),
        ("tk3-prod-fb.jpg", 490, 1115, 900),
        ("tk3-prod-wit.jpg", 600, 700, 1080),
    ],
    "tk3-bundel-punten.jpg": [
        ("tk3-prod-insta.jpg", 330, 250, 700),
        ("tk3-prod-fb.jpg", 330, 1150, 700),
        ("tk3-prod-zwart.jpg", 390, 545, 820),
        ("tk3-prod-wit.jpg", 390, 855, 820),
        ("tk3-prod-sticker.jpg", 200, 400, 1140),
        ("tk3-prod-sticker.jpg", 200, 700, 1170),
        ("tk3-prod-sticker.jpg", 200, 1000, 1140),
    ],
}


if __name__ == "__main__":
    os.makedirs(DOEL, exist_ok=True)
    for bestand, lagen in BUNDELS.items():
        doek, kaders = bouw(lagen)
        controleer(bestand, kaders)
        pad = os.path.join(DOEL, bestand)
        doek.save(pad, "JPEG", quality=92, optimize=True)
        print(pad, doek.size)
