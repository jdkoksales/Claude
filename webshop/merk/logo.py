"""Het TapKaarten-merkteken als vierkant, in de maten die je echt nodig hebt.

De voorkant van het visitekaartje is het uitgangspunt: het oranje verloop, de
witte ster met de twee NFC-boogjes, en de naam eronder.

Er komen twee varianten uit, en dat is met opzet:

* **met naam** — voor de Instagram-profielfoto, de apple-touch-icon en het
  bedrijfslogo in de structured data. Dat zijn allemaal plekken waar het
  beeld groot genoeg staat om "TapKaarten" te kunnen lezen.
* **zonder naam** — voor het favicon. Op 16 pixels is een woordmerk een
  grijze veeg; daar wint de ster het altijd.

Instagram snijdt een profielfoto rond bij. Alles wat buiten de ingeschreven
cirkel valt is dus weg. `controleer.py` meet na of dat gebeurt.

    python3 logo.py
"""

import math
import pathlib

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HIER = pathlib.Path(__file__).parent
LETTERS = HIER.parent / "drukwerk"

ORANJE_DIEP = (219, 78, 20)
ORANJE_LICHT = (255, 168, 63)
WIT = (255, 255, 255, 255)

# Verhoudingen van het merkteken, overgenomen uit tk3-merk.svg zodat het
# vierkant en het liggende logo op de site hetzelfde teken tonen.
STER_BINNEN = 0.382          # binnenstraal van de ster
BOOG_STRALEN = (1.68, 2.38)  # ten opzichte van de sterstraal
BOOG_DIKTE = 0.335
BOOG_HOEK = 27               # graden, symmetrisch om de horizontale as

# De groep ster+boogjes zoals hij in beeld staat: de ster loopt van -1 tot +1,
# de boogjes lopen tot 2.38 naar rechts en tot ±1.0805 omhoog en omlaag.
GROEP_BREED = 1.0 + BOOG_STRALEN[1]
GROEP_HOOG = 2 * BOOG_STRALEN[1] * math.sin(math.radians(BOOG_HOEK))


def verloop(maat):
    """Oranje verloop van boven naar beneden, precies dat van het kaartje."""
    f = np.linspace(0.0, 1.0, maat, dtype=np.float32)[:, None]
    van = np.array(ORANJE_DIEP, dtype=np.float32)
    naar = np.array(ORANJE_LICHT, dtype=np.float32)
    rij = van + (naar - van) * f
    vlak = np.repeat(rij[:, None, :], maat, axis=1)
    beeld = np.dstack([vlak.round().astype(np.uint8),
                       np.full((maat, maat, 1), 255, np.uint8)])
    return Image.fromarray(beeld, "RGBA")


def ster(tek, cx, cy, straal, kleur):
    punten = []
    for i in range(10):
        hoek = math.pi / 2 + i * math.pi / 5
        r = straal if i % 2 == 0 else straal * STER_BINNEN
        # PIL rekent y naar beneden, dus de sinus draait om.
        punten.append((cx + r * math.cos(hoek), cy - r * math.sin(hoek)))
    tek.polygon(punten, fill=kleur)


def bogen(tek, cx, cy, straal, kleur):
    """De twee boogjes rechts van de ster, met ronde uiteinden.

    Als gevuld vlak getekend en niet als dikke lijn: een dikke polylijn laat
    op elke knik een haarfijne kier open, en die kieren zie je terug als
    streepjes dwars door de boog."""
    half = BOOG_DIKTE * straal / 2
    hoeken = [math.radians(g) for g in
              np.linspace(-BOOG_HOEK, BOOG_HOEK, 96)]
    for verhouding in BOOG_STRALEN:
        r = verhouding * straal
        buiten = [(cx + math.cos(h) * (r + half), cy - math.sin(h) * (r + half))
                  for h in hoeken]
        binnen = [(cx + math.cos(h) * (r - half), cy - math.sin(h) * (r - half))
                  for h in reversed(hoeken)]
        tek.polygon(buiten + binnen, fill=kleur)
        # Ronde uiteinden: een schijfje op elk hart van de boog.
        for h in (hoeken[0], hoeken[-1]):
            px, py = cx + math.cos(h) * r, cy - math.sin(h) * r
            tek.ellipse([px - half, py - half, px + half, py + half], fill=kleur)


def merkteken(tek, midden_x, midden_y, straal, kleur):
    """Ster plus boogjes, als één geheel gecentreerd op (midden_x, midden_y)."""
    # De groep loopt van -1 tot +2.38 om het middelpunt van de ster; de ster
    # zelf staat dus links van het midden van de groep.
    ster_x = midden_x - (BOOG_STRALEN[1] - 1.0) / 2 * straal
    ster(tek, ster_x, midden_y, straal, kleur)
    bogen(tek, ster_x, midden_y, straal, kleur)


def passend_korps(pad, tekst, doelbreedte):
    """Grootste korps waarbij `tekst` nog binnen `doelbreedte` past."""
    laag, hoog = 4, 4000
    while laag < hoog:
        mid = (laag + hoog + 1) // 2
        f = ImageFont.truetype(str(pad), mid)
        if f.getbbox(tekst)[2] - f.getbbox(tekst)[0] <= doelbreedte:
            laag = mid
        else:
            hoog = mid - 1
    return laag


def tegel(maat, met_naam=True, ronding=0.0, overbemonstering=4):
    """Eén vierkant beeld. `ronding` is de hoekafronding als deel van de maat."""
    S = maat * overbemonstering
    beeld = verloop(S)

    if ronding:
        masker = Image.new("L", (S, S), 0)
        ImageDraw.Draw(masker).rounded_rectangle([0, 0, S - 1, S - 1],
                                                 radius=ronding * S, fill=255)
        beeld.putalpha(masker)

    tek = ImageDraw.Draw(beeld)

    if met_naam:
        # Teken boven, naam eronder, en het geheel als blok gecentreerd. De
        # hoogte van de letters wordt aan de inkt zelf gemeten en niet aan de
        # regelhoogte van het lettertype: die telt stok- en staartruimte mee
        # die "TapKaarten" nauwelijks gebruikt, en dan zakt alles scheef.
        straal = 0.1302 * S
        teken_hoog = GROEP_HOOG * straal

        korps = passend_korps(LETTERS / "Inter-Bold.ttf", "TapKaarten", 0.62 * S)
        letter = ImageFont.truetype(str(LETTERS / "Inter-Bold.ttf"), korps)
        vak = letter.getbbox("TapKaarten")
        woord_hoog = vak[3] - vak[1]

        tussen = 0.10 * S
        blok = teken_hoog + tussen + woord_hoog
        boven = (S - blok) / 2

        merkteken(tek, S / 2, boven + teken_hoog / 2, straal, WIT)
        # getbbox rekent vanaf de basislijn-oorsprong; door vak[1] eraf te
        # halen komt de bovenkant van de inkt precies op `onder` te liggen.
        onder = boven + teken_hoog + tussen
        tek.text((S / 2, onder - vak[1]), "TapKaarten", font=letter, fill=WIT,
                 anchor="ma")
    else:
        # Alleen de ster, en groter: op faviconformaat moet het teken het
        # vlak vullen, anders blijft er een oranje stip over.
        ster(tek, S / 2, S * 0.505, 0.335 * S, WIT)

    return beeld.resize((maat, maat), Image.LANCZOS)


def schrijf(beeld, pad):
    pad.parent.mkdir(parents=True, exist_ok=True)
    beeld.save(pad, optimize=True)
    print(f"{pad.relative_to(HIER.parent.parent)}  {beeld.size[0]}x{beeld.size[1]}"
          f"  {pad.stat().st_size // 1024} kB")


def maak():
    thema = HIER.parent / "theme3" / "assets"

    # Instagram: de app schaalt naar 320, maar levert scherper werk aan als je
    # groot aanlevert. Vierkant, want de ronde uitsnede maakt Instagram zelf.
    schrijf(tegel(1080, met_naam=True), HIER / "tapkaarten-instagram-1080.png")

    # Los bestand om te delen, en de bron voor alles wat hieronder staat.
    schrijf(tegel(512, met_naam=True), HIER / "tapkaarten-logo-vierkant-512.png")

    # Op de site: het bedrijfslogo in de structured data en de tegel die iOS
    # op het beginscherm zet. Beide staan groot genoeg voor het woordmerk.
    schrijf(tegel(512, met_naam=True), thema / "tk3-merk-vierkant.png")

    # Favicon: alleen de ster, met de afgeronde hoek die browsers laten zien.
    for maat in (48, 192):
        schrijf(tegel(maat, met_naam=False, ronding=0.22),
                thema / f"tk3-favicon-{maat}.png")


if __name__ == "__main__":
    maak()
