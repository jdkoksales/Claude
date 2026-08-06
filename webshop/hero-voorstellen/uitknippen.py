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


def schaduwmasker(a, bg):
    """Welke pixels zijn slagschaduw en dus geen product.

    De schaduw is niets anders dan de achtergrond, verdonkerd. Hij houdt
    daarom de kleurverhouding van die achtergrond: die is blauwig, dus blauw
    ligt er een paar punten boven rood. Het product niet — het witte en het
    zwarte bordje zijn neutraal (blauw min rood is nul), het roze bordje zit
    tientallen punten de andere kant op en het blauwe bordje ver de goede
    kant op. Een smalle band rond de zweem van de achtergrond pikt er dus
    precies de schaduw uit, en laat de voet van de standaard staan.

    Knippen op breedte werkte niet: de voet is óók breder dan het paneel, dus
    dan verlies je juist het onderdeel waaraan je ziet dat het een standaard is.
    """
    zweem_bg = bg[2] - bg[0]
    zweem = a[:, :, 2] - a[:, :, 0]
    helderheid = a.mean(axis=2)
    # Ondergrens op de helderheid: een schaduw is de achtergrond maal een
    # factor, dus altijd nog een lichte grijstint. Zonder die grens viel het
    # zwarte bordje weg — dat is bijna zwart en heeft toevallig ook een paar
    # punten blauwzweem.
    return (
        (zweem >= zweem_bg * 0.35)
        & (zweem <= zweem_bg * 1.9)
        & (helderheid < bg.mean() - 1.5)
        & (helderheid > bg.mean() * 0.62)
    )


def knip(pad, tolerantie=9, erosie=2):
    a = np.array(Image.open(pad).convert("RGB")).astype(int)
    bg = achtergrondkleur(a)
    d = np.abs(a - bg).sum(axis=-1)

    achtergrond = vlakvulling(d <= tolerantie)
    lichaam = ~achtergrond & ~schaduwmasker(a, bg)

    # De kleurregel haalt ook grijstinten binnen het bordje weg: de QR-code,
    # de tekst, het lichte vlak van de sticker. Die liggen ingesloten door de
    # rand van het bordje, dus alles wat niet vanaf de buitenrand te bereiken
    # is hoort er gewoon bij. Terugvullen dus.
    # Tussen het paneel en de voet valt de eigen schaduw van het paneel. Die
    # heeft schaduwkleur maar hoort bij het product, en hij is niet ingesloten,
    # dus terugvullen helpt daar niet. Een sluiting (aangroeien, dan weer
    # terugslijpen) overbrugt zo'n smalle band zonder de vorm te veranderen.
    lichaam = slijp(slijp(lichaam, 7, groei=True), 7) & ~achtergrond
    lichaam = ~vlakvulling(~lichaam)

    # Langs de rand van een wit bordje loopt een paar pixels anti-aliasing die
    # toevallig aan de schaduwregel voldoet; daar hapt hij stukjes uit. Die
    # randband weer aangroeien, maar nooit verder dan de vlakvulling toestaat,
    # zodat er geen schaduw terugkruipt.
    lichaam = slijp(lichaam, 3, groei=True) & ~achtergrond

    # Randje wegslijpen zodat er geen lichte zoom van de oude achtergrond
    # blijft staan, daarna zacht maken.
    # De vlakvulling laat een gerafelde rand achter. Even vervagen en opnieuw
    # afkappen haalt de kartels eruit zonder de vorm te veranderen.
    glad = Image.fromarray((lichaam * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.4))
    lichaam = np.array(glad) > 132
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
    for naam in ["tk3-prod-wit", "tk3-prod-zwart", "tk3-prod-insta", "tk3-prod-fb"]:
        bak, dekking = knip(f"/home/user/Claude/webshop/theme3/assets/{naam}.jpg")
        bak.save(uit / f"{naam}.png")
        print(f"{naam:20} {bak.size[0]:4}x{bak.size[1]:<4}  beslaat {dekking*100:.1f}% van het origineel")
