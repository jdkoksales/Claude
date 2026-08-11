"""Nameten of het logo doet wat het moet doen.

Drie dingen die echt fout kunnen gaan:

1. **Instagram snijdt rond bij.** Alles buiten de ingeschreven cirkel is weg.
   We zoeken dus elke witte pixel en kijken hoe ver die van het midden staat.
2. **Het woordmerk verdwijnt.** Op een telefoon staat een profielfoto rond de
   110 pixels. We schalen echt terug en meten of de letters daar nog hoogte
   en contrast hebben.
3. **Het favicon wordt een vlek.** Op 16 pixels moet de ster nog een ster
   zijn: genoeg wit, en wit dat aaneengesloten in het midden ligt.

    python3 controleer.py
"""

import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw

HIER = pathlib.Path(__file__).parent
fouten = []
log = []


def wit_masker(beeld, drempel=170):
    """Waar staat de inkt? Het wit is het enige lichte in een oranje vlak."""
    a = np.asarray(beeld.convert("RGBA")).astype(np.int16)
    zichtbaar = a[:, :, 3] > 40
    # Wit onderscheidt zich van het oranje doordat blauw meeloopt met rood.
    return zichtbaar & (a[:, :, 2] > 150) & (a[:, :, 0] > drempel)


def binnen_de_cirkel(pad, ruimste=0.47):
    beeld = Image.open(pad)
    S = beeld.size[0]
    masker = wit_masker(beeld)
    ys, xs = np.nonzero(masker)
    if len(xs) == 0:
        fouten.append(f"{pad.name}: geen wit gevonden, is het beeld leeg?")
        return
    afstand = np.hypot(xs - (S - 1) / 2, ys - (S - 1) / 2) / S
    verst = afstand.max()
    log.append(f"{pad.name}: verste inktpixel op {verst:.3f}·breedte van het "
               f"midden (rond bijsnijden gebeurt op 0.500, marge tot {ruimste:.2f})")
    if verst > 0.5:
        fouten.append(f"{pad.name}: inkt op {verst:.3f}·breedte valt buiten de "
                      "ronde uitsnede van Instagram")
    elif verst > ruimste:
        fouten.append(f"{pad.name}: inkt op {verst:.3f}·breedte staat wel binnen "
                      "de cirkel maar tegen de rand aan")


def woord_leesbaar(pad, weergave=110):
    """Schaal terug naar het formaat waarop Instagram de foto toont en meet
    de onderste tekstband: hoe hoog staan de letters daar nog, en is het
    verschil met de achtergrond groot genoeg om ze te zien?"""
    klein = Image.open(pad).convert("RGB").resize((weergave, weergave), Image.LANCZOS)
    a = np.asarray(klein).astype(np.int16)
    band = a[int(weergave * 0.60):int(weergave * 0.88), :, :]

    licht = band.mean(axis=2)
    inkt = (band[:, :, 2] > 150) & (band[:, :, 0] > 170)
    if not inkt.any():
        fouten.append(f"{pad.name}: op {weergave}px is er van het woordmerk "
                      "niets meer over")
        return

    rijen = np.nonzero(inkt.any(axis=1))[0]
    hoogte = rijen[-1] - rijen[0] + 1
    contrast = licht[inkt].mean() - licht[~inkt].mean()
    log.append(f"{pad.name}: op {weergave}px is het woordmerk {hoogte}px hoog, "
               f"contrast {contrast:.0f} van de 255")
    if hoogte < 7:
        fouten.append(f"{pad.name}: het woordmerk is op {weergave}px nog maar "
                      f"{hoogte}px hoog, dat leest niet meer")
    if contrast < 60:
        fouten.append(f"{pad.name}: te weinig verschil tussen letters en "
                      f"achtergrond op {weergave}px ({contrast:.0f})")


def favicon_houdbaar(pad, klein=16):
    beeld = Image.open(pad).convert("RGBA").resize((klein, klein), Image.LANCZOS)
    masker = wit_masker(beeld, drempel=150)
    deel = masker.mean()
    midden = masker[klein // 4:klein * 3 // 4, klein // 4:klein * 3 // 4].mean()
    log.append(f"{pad.name}: op {klein}px is {deel * 100:.0f}% wit, waarvan het "
               f"middenvlak {midden * 100:.0f}%")
    if deel < 0.12:
        fouten.append(f"{pad.name}: op {klein}px is er te weinig wit "
                      f"({deel * 100:.0f}%), de ster verdwijnt")
    if midden < 0.35:
        fouten.append(f"{pad.name}: op {klein}px zit het wit niet in het midden "
                      f"({midden * 100:.0f}%), dat is geen ster meer")


def maten(verwacht):
    for pad, maat in verwacht:
        if not pad.exists():
            fouten.append(f"{pad.name}: bestaat niet")
            continue
        echt = Image.open(pad).size
        log.append(f"{pad.name}: {echt[0]}x{echt[1]}, {pad.stat().st_size // 1024} kB")
        if echt != (maat, maat):
            fouten.append(f"{pad.name}: is {echt[0]}x{echt[1]} in plaats van "
                          f"{maat}x{maat}")


def proefblad(pad_ig, pad_favicon, doel):
    """Laat zien wat je straks echt ziet: de ronde uitsnede van Instagram op
    de formaten waarop het profiel getoond wordt, en het favicon op tabmaat."""
    maten = [(150, "profiel op de site"), (110, "profiel op de telefoon"),
             (56, "in de verhalenbalk"), (32, "naast een reactie")]
    rand, tussen, grond = 28, 26, (240, 241, 243)
    breed = rand * 2 + sum(m for m, _ in maten) + tussen * (len(maten) - 1)
    blad = Image.new("RGB", (breed, 150 + rand * 2 + 34), grond)

    bron = Image.open(pad_ig).convert("RGB")
    plek = rand
    for maat, _ in maten:
        rond = bron.resize((maat, maat), Image.LANCZOS)
        masker = Image.new("L", (maat * 4, maat * 4), 0)
        ImageDraw.Draw(masker).ellipse([0, 0, maat * 4 - 1, maat * 4 - 1], fill=255)
        rond.putalpha(masker.resize((maat, maat), Image.LANCZOS))
        blad.paste(rond, (plek, rand + (150 - maat) // 2), rond)
        plek += maat + tussen

    icoon = Image.open(pad_favicon).convert("RGBA")
    plek = rand
    for maat in (16, 32):
        klein = icoon.resize((maat, maat), Image.LANCZOS)
        blad.paste(klein, (plek, rand + 150 + 12), klein)
        plek += maat + 12

    blad.save(doel)
    log.append(f"{doel.name}: proefblad geschreven ({blad.size[0]}x{blad.size[1]})")


thema = HIER.parent / "theme3" / "assets"
ig = HIER / "tapkaarten-instagram-1080.png"

maten([
    (ig, 1080),
    (HIER / "tapkaarten-logo-vierkant-512.png", 512),
    (thema / "tk3-merk-vierkant.png", 512),
    (thema / "tk3-favicon-48.png", 48),
    (thema / "tk3-favicon-192.png", 192),
])

binnen_de_cirkel(ig)
binnen_de_cirkel(HIER / "tapkaarten-logo-vierkant-512.png")
woord_leesbaar(ig, 110)
woord_leesbaar(ig, 150)
woord_leesbaar(thema / "tk3-merk-vierkant.png", 180)
favicon_houdbaar(thema / "tk3-favicon-48.png")
favicon_houdbaar(thema / "tk3-favicon-192.png")
proefblad(ig, thema / "tk3-favicon-192.png", HIER / "voorbeeld-logo.png")

print("\n".join(log))
print()
if fouten:
    print(f"GEVONDEN: {len(fouten)} punten")
    for f in fouten:
        print(" -", f)
    sys.exit(1)
print("GEEN AFWIJKINGEN GEVONDEN")
