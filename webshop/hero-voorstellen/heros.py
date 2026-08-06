"""Drie hero-voorstellen voor tapkaarten.nl.

Uitgangspunten uit de opdracht:
  * de bordjes moeten groot in beeld
  * je moet zien wát ze doen
  * de oranje verloopachtergrond van het visitekaartje

De bordjes zijn de echte productfoto's, uitgeknipt van hun egale ondergrond.
Er wordt niets bijverzonnen: geen nagemaakte QR-codes, geen nagetekende
logo's. Wat je ziet is het product.
"""

import math
import pathlib

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HIER = pathlib.Path("/tmp/claude-0/-home-user-Claude/4ed8d6d3-2641-5570-b485-c23a1aa27fe7/scratchpad")
KNIP = HIER / "uitknip"
LETTERS = pathlib.Path("/home/user/Claude/webshop/drukwerk")
UIT = HIER / "hero"
UIT.mkdir(exist_ok=True)

B, H = 1600, 900

ORANJE_DIEP = (219, 78, 20)
ORANJE_LICHT = (255, 168, 63)
INKT = (26, 32, 44)
GOUD = (242, 181, 15)


def font(gewicht, maat):
    naam = {400: "Inter-Regular.ttf", 600: "Inter-SemiBold.ttf", 700: "Inter-Bold.ttf"}[gewicht]
    return ImageFont.truetype(str(LETTERS / naam), maat)


def verloop(breedte, hoogte, hoek=True):
    """Diagonaal verloop; hetzelfde recept als de voorkant van het kaartje."""
    vlak = Image.new("RGB", (breedte, hoogte))
    tek = ImageDraw.Draw(vlak)
    for i in range(hoogte):
        f = i / max(1, hoogte - 1)
        tek.line([(0, i), (breedte, i)],
                 fill=tuple(round(a + (b - a) * f) for a, b in zip(ORANJE_DIEP, ORANJE_LICHT)))
    if not hoek:
        return vlak
    # Extra licht linksboven zodat het vlak niet als een gestreepte lucht leest.
    gloed = Image.new("L", (breedte, hoogte), 0)
    ImageDraw.Draw(gloed).ellipse(
        [-breedte * 0.35, -hoogte * 0.9, breedte * 0.75, hoogte * 0.7], fill=70)
    gloed = gloed.filter(ImageFilter.GaussianBlur(180))
    vlak.paste(Image.new("RGB", (breedte, hoogte), ORANJE_LICHT), (0, 0), gloed)
    return vlak


def balie(doek, horizon, diepte=None):
    """Een balieblad onder de bordjes.

    Dit is wat het verschil maakt tussen 'een kaartje' en 'een standaard':
    zonder vlak om op te staan blijft elk voorwerp een plaatje. Het blad is
    een lichte warme baan die naar voren toe iets donkerder wordt, met een
    scherpe lijn op de horizon als voorkant van de balie.
    """
    b, hoogte = doek.size
    diepte = diepte or hoogte - horizon
    blad = Image.new("RGBA", (b, diepte), (0, 0, 0, 0))
    tek = ImageDraw.Draw(blad)
    for i in range(diepte):
        f = i / max(1, diepte - 1)
        # vooraan iets donkerder: het blad vangt minder licht naar de kijker toe
        dek = round(232 - 96 * f)
        tek.line([(0, i), (b, i)], fill=(255, 246, 238, dek))
    doek.paste(blad, (0, horizon), blad)

    rand = Image.new("RGBA", doek.size, (0, 0, 0, 0))
    ImageDraw.Draw(rand).line([(0, horizon), (b, horizon)], fill=(255, 255, 255, 210), width=3)
    doek.paste(rand, (0, 0), rand)


def contactschaduw(doek, midden_x, voet_y, breedte):
    """Kort en donker, direct onder de voet — dat 'plakt' het bordje vast."""
    laag = Image.new("L", doek.size, 0)
    ImageDraw.Draw(laag).ellipse(
        [midden_x - breedte / 2, voet_y - breedte * 0.055,
         midden_x + breedte / 2, voet_y + breedte * 0.055], fill=150)
    laag = laag.filter(ImageFilter.GaussianBlur(breedte * 0.035))
    doek.paste(Image.new("RGB", doek.size, (150, 92, 48)), (0, 0), laag)


def grondschaduw(doek, midden_x, onder_y, breedte, hoogte=None, sterkte=125):
    """Zachte ovale schaduw zodat een bordje op iets lijkt te staan.

    Smal en donker houden: een brede lichte vlek leest als mist en dan blijft
    het bordje zweven. De schaduw moet net onder de voet zitten.
    """
    hoogte = hoogte or round(breedte * 0.15)
    laag = Image.new("L", doek.size, 0)
    ImageDraw.Draw(laag).ellipse(
        [midden_x - breedte / 2, onder_y - hoogte / 2, midden_x + breedte / 2, onder_y + hoogte / 2],
        fill=sterkte)
    laag = laag.filter(ImageFilter.GaussianBlur(breedte * 0.09))
    doek.paste(Image.new("RGB", doek.size, (120, 38, 8)), (0, 0), laag)


def zet(doek, bordje, midden_x, onder_y, hoogte):
    """Bordje op ware verhouding neerzetten, met schaduw eronder."""
    schaal = hoogte / bordje.height
    b = bordje.resize((max(1, round(bordje.width * schaal)), round(hoogte)), Image.LANCZOS)
    grondschaduw(doek, midden_x, onder_y + 10, b.width * 1.6, sterkte=70)
    contactschaduw(doek, midden_x, onder_y - 8, b.width * 1.02)
    # eigen slagschaduw van het bordje, iets naar rechtsonder
    eigen = Image.new("L", doek.size, 0)
    eigen.paste(b.getchannel("A"), (round(midden_x - b.width / 2) + 10, round(onder_y - b.height) + 14))
    eigen = eigen.filter(ImageFilter.GaussianBlur(16))
    doek.paste(Image.new("RGB", doek.size, (140, 45, 10)), (0, 0), eigen.point(lambda v: v * 0.45))
    doek.paste(b, (round(midden_x - b.width / 2), round(onder_y - b.height)), b)
    return b


def paneel(doek, kader, radius, kleur=(255, 255, 255), schaduw=34):
    x0, y0, x1, y1 = kader
    if schaduw:
        laag = Image.new("L", doek.size, 0)
        ImageDraw.Draw(laag).rounded_rectangle([x0 + 4, y0 + 12, x1 + 4, y1 + 14], radius, fill=schaduw)
        laag = laag.filter(ImageFilter.GaussianBlur(22))
        doek.paste(Image.new("RGB", doek.size, (120, 38, 8)), (0, 0), laag)
    vlak = Image.new("RGBA", doek.size, (0, 0, 0, 0))
    ImageDraw.Draw(vlak).rounded_rectangle(kader, radius, fill=kleur + (255,))
    doek.paste(vlak, (0, 0), vlak)


def sterrenrij(tek, x, y, maat, aantal=5, kleur=GOUD, tussen=None):
    tussen = tussen or maat * 2.35
    for i in range(aantal):
        punten = []
        cx, cy = x + i * tussen, y
        for k in range(10):
            hoek = -math.pi / 2 + k * math.pi / 5
            r = maat if k % 2 == 0 else maat * 0.42
            punten.append((cx + r * math.cos(hoek), cy + r * math.sin(hoek)))
        tek.polygon(punten, fill=kleur)
    return x + (aantal - 1) * tussen + maat


def knop(doek, tek, x, y, tekst, vulling=(255, 255, 255), inkt=INKT, korps=25, hoog=60):
    f = font(700, korps)
    breed = tek.textlength(tekst, font=f) + 62
    paneel(doek, [x, y, x + breed, y + hoog], hoog / 2, vulling, schaduw=26)
    ImageDraw.Draw(doek).text((x + breed / 2, y + hoog / 2), tekst, font=f, fill=inkt, anchor="mm")
    return x + breed


def kop(doek, tek, regels, y, korps=76, midden=True, kleur=(255, 255, 255), regelhoogte=1.1):
    f = font(700, korps)
    for i, r in enumerate(regels):
        yy = y + i * korps * regelhoogte
        if midden:
            tek.text((B / 2, yy), r, font=f, fill=kleur, anchor="ma")
        else:
            tek.text((y and 0 or 0, yy), r, font=f, fill=kleur)
    return y + len(regels) * korps * regelhoogte


def bordje(naam):
    return Image.open(KNIP / f"{naam}.png").convert("RGBA")


# ---------------------------------------------------------------- voorstel 1
def hero_een():
    """Eén bordje groot in beeld, met het resultaat ernaast.

    De bezoeker ziet in één oogopslag het ding dat hij koopt en wat er daarna
    op zijn scherm verschijnt.
    """
    doek = verloop(B, H)
    tek = ImageDraw.Draw(doek)

    tek.text((B / 2, 84), "Je beste marketing staat op de balie.",
             font=font(700, 68), fill=(255, 255, 255), anchor="ma")
    tek.text((B / 2, 176), "Eén tik met de telefoon en je klant staat op jouw reviewpagina.",
             font=font(400, 27), fill=(255, 255, 255, 220), anchor="ma")

    x = knop(doek, tek, B / 2 - 210, 232, "Bekijk de TapKaarten")
    ImageDraw.Draw(doek).text((x + 34, 262), "vanaf € 34,95", font=font(600, 24),
                              fill=(255, 255, 255), anchor="lm")

    balie(doek, 640)
    zet(doek, bordje("tk3-prod-wit"), 560, 806, 470)

    # Wat het oplevert: een melding zoals je die op je telefoon krijgt.
    kaart = [1000, 452, 1460, 706]
    paneel(doek, kaart, 26)
    t2 = ImageDraw.Draw(doek)
    einde = sterrenrij(t2, kaart[0] + 46, kaart[1] + 62, 15)
    t2.text((kaart[0] + 40, kaart[1] + 96), "Nieuwe review", font=font(700, 32), fill=INKT)
    t2.text((kaart[0] + 40, kaart[1] + 142), "Zojuist · via je TapKaart", font=font(400, 22),
            fill=(110, 116, 128))
    t2.line([kaart[0] + 40, kaart[1] + 176, kaart[2] - 40, kaart[1] + 176], fill=(228, 230, 234), width=2)
    t2.text((kaart[0] + 40, kaart[1] + 194), "“Snel geholpen en vriendelijk personeel.”",
            font=font(400, 21), fill=(70, 76, 88))
    doek.save(UIT / "hero-1-groot.png")


# ---------------------------------------------------------------- voorstel 2
def hero_twee():
    """Drie bordjes naast elkaar met erboven waar ze voor zijn."""
    doek = verloop(B, H)
    tek = ImageDraw.Draw(doek)

    tek.text((B / 2, 74), "Eén tik. Meer reviews, meer volgers.",
             font=font(700, 68), fill=(255, 255, 255), anchor="ma")
    tek.text((B / 2, 166), "Zet hem op de balie. Je klant doet de rest — zonder app, zonder gedoe.",
             font=font(400, 27), fill=(255, 255, 255, 220), anchor="ma")

    balie(doek, 640)

    for i, (naam, label) in enumerate([
        ("tk3-prod-wit", "Meer Google-reviews"),
        ("tk3-prod-insta", "Meer Instagram-volgers"),
        ("tk3-prod-fb", "Meer Facebook-volgers"),
    ]):
        mx = 380 + i * 420
        f = font(700, 23)
        breed = tek.textlength(label, font=f) + 46
        paneel(doek, [mx - breed / 2, 288, mx + breed / 2, 288 + 46], 23)
        ImageDraw.Draw(doek).text((mx, 311), label, font=f, fill=INKT, anchor="mm")
        zet(doek, bordje(naam), mx, 790, 400)

    doek.save(UIT / "hero-2-drieluik.png")


# ---------------------------------------------------------------- voorstel 3
def hero_drie():
    """Tekst links, het mechanisme rechts: bordje, tik, resultaat op het scherm."""
    doek = verloop(B, H, hoek=False)
    tek = ImageDraw.Draw(doek)

    marge = 108
    tek.text((marge, 210), "Je klant staat er\ntoch al.", font=font(700, 78),
             fill=(255, 255, 255), spacing=14)
    tek.text((marge, 402), "Eén tik met de telefoon en hij staat op jouw\n"
                           "Google-, Instagram- of Facebookpagina.\nJij hoeft niets te vragen.",
             font=font(400, 27), fill=(255, 255, 255, 225), spacing=13)
    knop(doek, tek, marge, 546, "Bekijk de TapKaarten")

    balie(doek, 660)
    b = zet(doek, bordje("tk3-prod-wit"), 985, 812, 440)

    # Telefoon rechts met het scherm waar de klant op uitkomt.
    tel = [1236, 300, 1476, 780]
    grondschaduw(doek, (tel[0] + tel[2]) / 2, tel[3] + 12, (tel[2] - tel[0]) * 1.5, sterkte=70)
    contactschaduw(doek, (tel[0] + tel[2]) / 2, tel[3] - 4, (tel[2] - tel[0]) * 1.02)
    paneel(doek, tel, 34, (24, 28, 36), schaduw=52)
    scherm = [tel[0] + 12, tel[1] + 12, tel[2] - 12, tel[3] - 12]
    paneel(doek, scherm, 26, (255, 255, 255), schaduw=0)
    t2 = ImageDraw.Draw(doek)
    t2.rounded_rectangle([tel[0] + 92, tel[1] + 26, tel[2] - 92, tel[1] + 36], 5, fill=(24, 28, 36))
    t2.text((scherm[0] + 30, scherm[1] + 74), "Beoordeel", font=font(400, 22), fill=(110, 116, 128))
    t2.text((scherm[0] + 30, scherm[1] + 104), "Café De Brink", font=font(700, 24), fill=INKT)
    sterrenrij(t2, scherm[0] + 44, scherm[1] + 186, 15, tussen=36)
    t2.rounded_rectangle([scherm[0] + 30, scherm[1] + 236, scherm[2] - 30, scherm[1] + 330], 14,
                         fill=(243, 244, 246))
    for k in range(3):
        t2.rounded_rectangle([scherm[0] + 48, scherm[1] + 258 + k * 26,
                              scherm[2] - (60 if k == 2 else 48), scherm[1] + 268 + k * 26],
                             5, fill=(214, 217, 222))
    t2.rounded_rectangle([scherm[0] + 30, scherm[1] + 356, scherm[2] - 30, scherm[1] + 412], 28,
                         fill=(26, 115, 232))
    t2.text(((scherm[0] + scherm[2]) / 2, scherm[1] + 384), "Plaatsen", font=font(700, 22),
            fill=(255, 255, 255), anchor="mm")

    # De tik: golfjes tussen bordje en telefoon.
    for i, straal in enumerate((26, 46, 66)):
        laag = Image.new("RGBA", doek.size, (0, 0, 0, 0))
        ImageDraw.Draw(laag).arc([1150 - straal, 470 - straal, 1150 + straal, 470 + straal],
                                 -52, 52, fill=(255, 255, 255, 235 - i * 55), width=7)
        doek.paste(laag, (0, 0), laag)

    doek.save(UIT / "hero-3-mechanisme.png")


if __name__ == "__main__":
    hero_een()
    hero_twee()
    hero_drie()
    for p in sorted(UIT.glob("*.png")):
        print(p.name, Image.open(p).size)
