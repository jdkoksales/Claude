"""Bordjes uitknippen van hun egale achtergrond.

De productfoto's staan op een exact uniforme kleur (241,242,246), maar het
witte bordje wijkt daar maar 24 van af op een schaal van 765. Een drempel
haalt daarom of de helft van het bordje weg, of de halve slagschaduw erbij.

Daarom: vlakvulling vanaf de rand. Alles wat vanaf de buitenrand te bereiken
is via achtergrondkleur is achtergrond; de rest is bordje of schaduw. De
schaduw is dun en zacht, dus die verdwijnt bij het wegslijpen (erosie) terwijl
het bordje blijft staan.
"""

import numpy as np
from PIL import Image, ImageFilter


def achtergrondkleur(a):
    hoeken = np.stack([a[3, 3], a[3, -3], a[-3, 3], a[-3, -3]])
    return np.median(hoeken, axis=0)


def vlakvulling(bereikbaar):
    """Welke achtergrondpixels hangen aan de buitenrand vast."""
    h, b = bereikbaar.shape
    gezien = np.zeros_like(bereikbaar)
    stapel = []
    for x in range(b):
        stapel += [(0, x), (h - 1, x)]
    for y in range(h):
        stapel += [(y, 0), (y, b - 1)]

    # Rijgewijs uitbreiden is in numpy veel sneller dan pixel voor pixel: we
    # groeien het bereikbare gebied net zo lang tot er niets meer bij komt.
    for y, x in stapel:
        if bereikbaar[y, x]:
            gezien[y, x] = True
    while True:
        groei = gezien.copy()
        groei[1:, :] |= gezien[:-1, :]
        groei[:-1, :] |= gezien[1:, :]
        groei[:, 1:] |= gezien[:, :-1]
        groei[:, :-1] |= gezien[:, 1:]
        groei &= bereikbaar
        if groei.sum() == gezien.sum():
            return gezien
        gezien = groei


def slijp(masker, straal, groei=False):
    b = Image.fromarray((masker * 255).astype(np.uint8))
    filt = ImageFilter.MaxFilter if groei else ImageFilter.MinFilter
    k = straal * 2 + 1
    while k > 9:  # PIL kan maar tot 9 in één keer
        b = b.filter(filt(9))
        k -= 8
    if k >= 3:
        b = b.filter(filt(k if k % 2 else k + 1))
    return np.array(b) > 127


def zonder_schaduw(masker):
    """De slagschaduw is een ellips die veel breder is dan het bordje.

    Van boven naar beneden blijft de breedte van het masker vrij constant —
    dat is het paneel met zijn voetje. Waar de ellips begint schiet die
    breedte omhoog. Op dat punt knippen we, en de schaduw tekenen we later
    zelf: een grijze schaduw van een grijze ondergrond klopt niet op oranje.
    """
    breedtes = masker.sum(axis=1).astype(float)
    gevuld = np.where(breedtes > 0)[0]
    boven, onder = gevuld[0], gevuld[-1]
    hoogte = onder - boven

    # De overgang van voet naar schaduw is de scherpste verbreding in het
    # onderste deel van de vorm: de voet groeit geleidelijk, de ellips schiet
    # in een paar rijen naar buiten. Zoek dus de grootste sprong, niet een
    # vaste verhouding — die knipte of de voet eraf of de schaduw er niet af.
    start = boven + int(hoogte * 0.55)
    venster = 6
    sprongen = breedtes[start:onder + 1] - breedtes[start - venster:onder + 1 - venster]
    grens = onder + 1 if len(sprongen) == 0 else start + int(np.argmax(sprongen)) - venster + 1

    schoon = masker.copy()
    schoon[grens:, :] = False
    return schoon, grens


def knip(pad, tolerantie=9, erosie=3):
    a = np.array(Image.open(pad).convert("RGB")).astype(int)
    bg = achtergrondkleur(a)
    d = np.abs(a - bg).sum(axis=-1)

    achtergrond = vlakvulling(d <= tolerantie)
    voorgrond = ~achtergrond               # bordje + schaduw, gaten al gevuld
    lichaam, grens = zonder_schaduw(voorgrond)

    # Randje wegslijpen zodat er geen lichte zoom van de oude achtergrond
    # blijft staan, daarna zacht maken.
    # De vlakvulling laat een gerafelde rand achter. Even vervagen en opnieuw
    # afkappen haalt de kartels eruit zonder de vorm te veranderen.
    glad = Image.fromarray((lichaam * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))
    lichaam = np.array(glad) > 140
    lichaam = slijp(lichaam, erosie)
    alpha = Image.fromarray((lichaam * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9))

    uit = Image.fromarray(a.astype(np.uint8)).convert("RGBA")
    uit.putalpha(alpha)

    kol = np.where(lichaam.any(axis=0))[0]
    rij = np.where(lichaam.any(axis=1))[0]
    bak = uit.crop((kol.min(), rij.min(), kol.max() + 1, rij.max() + 1))
    return bak, lichaam.mean()


if __name__ == "__main__":
    import pathlib
    uit = pathlib.Path("/tmp/claude-0/-home-user-Claude/4ed8d6d3-2641-5570-b485-c23a1aa27fe7/scratchpad/uitknip")
    uit.mkdir(exist_ok=True)
    for naam in ["tk3-prod-wit", "tk3-prod-zwart", "tk3-prod-insta", "tk3-prod-fb", "tk3-prod-sticker"]:
        bak, dekking = knip(f"/home/user/Claude/webshop/theme3/assets/{naam}.jpg")
        bak.save(uit / f"{naam}.png")
        print(f"{naam:20} {bak.size[0]:4}x{bak.size[1]:<4}  beslaat {dekking*100:.1f}% van het origineel")
