"""Visitekaartje TapKaarten — drukklaar, op ware grootte.

Nederlandse standaardmaat 85 x 55 mm, met 3 mm afloop rondom (91 x 61 mm).
Alles binnen 5 mm van de snijrand blijft leeg, zodat een snijmes dat een
millimeter afwijkt nooit door tekst gaat.

Vectorbestand: de tekst blijft tekst, dus scherp op elke drukpers. Het
lettertype (Inter, hetzelfde als op de website) zit in het bestand ingebed.
"""

import math
import pathlib

import qrcode
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

HIER = pathlib.Path(__file__).parent

# ---------------------------------------------------------------- maatvoering
SNIJ_B, SNIJ_H = 85 * mm, 55 * mm       # het kaartje zoals het uit de pers komt
AFLOOP = 3 * mm                          # extra kleur voorbij de snijrand
VEILIG = 5 * mm                          # niets belangrijks binnen deze rand
PAG_B, PAG_H = SNIJ_B + 2 * AFLOOP, SNIJ_H + 2 * AFLOOP

# Alles wordt gerekend vanaf de linkeronderhoek van het gesneden kaartje.
def x(mm_van_links):
    return AFLOOP + mm_van_links * mm

def y(mm_van_onder):
    return AFLOOP + mm_van_onder * mm

# ------------------------------------------------------------------- kleuren
ORANJE_DIEP = HexColor("#DB4E14")
ORANJE = HexColor("#F4801F")
ORANJE_LICHT = HexColor("#FFA83F")
INKT = HexColor("#1A202C")
GRIJS = Color(0.10, 0.13, 0.17, alpha=0.58)
WIT = HexColor("#FFFFFF")
WIT_ZACHT = Color(1, 1, 1, alpha=0.78)

# ---------------------------------------------------------------- gegevens
TELEFOON = "06 16 03 63 28"
EMAIL = "info@tapkaarten.nl"
WEBSITE = "tapkaarten.nl"
SITE_URL = "https://tapkaarten.nl"
SLOGAN = "NFC-bordjes voor meer reviews en volgers"

# Staat dit aan, dan worden alleen de vlakken getekend en geen tekst of
# merkteken. Daarmee is na te meten wat er precies inkt is en wat achtergrond,
# zodat de controle op de veiligheidsrand niet het verloop zelf aanziet voor
# inhoud.
ALLEEN_VLAK = False


def letters():
    for naam, bestand in [
        ("Inter", "Inter-Regular.ttf"),
        ("Inter-Semi", "Inter-SemiBold.ttf"),
        ("Inter-Bold", "Inter-Bold.ttf"),
    ]:
        pdfmetrics.registerFont(TTFont(naam, str(HIER / bestand)))


def verloop(c, x0, y0, breedte, hoogte, van, naar, stappen=140):
    """Verticaal kleurverloop. reportlab kan echte verlopen, maar niet in CMYK
    zonder gedoe; gestapelde balkjes drukken voorspelbaarder."""
    h = hoogte / stappen
    for i in range(stappen):
        f = i / (stappen - 1)
        c.setFillColorRGB(
            van.red + (naar.red - van.red) * f,
            van.green + (naar.green - van.green) * f,
            van.blue + (naar.blue - van.blue) * f,
        )
        c.rect(x0, y0 + i * h, breedte, h * 1.02, stroke=0, fill=1)


def ster(c, cx, cy, straal, kleur):
    """Het merkteken: vijfpuntige ster, punt naar boven."""
    binnen = straal * 0.382
    punten = []
    for i in range(10):
        hoek = math.pi / 2 + i * math.pi / 5
        r = straal if i % 2 == 0 else binnen
        punten.append((cx + r * math.cos(hoek), cy + r * math.sin(hoek)))
    p = c.beginPath()
    p.moveTo(*punten[0])
    for punt in punten[1:]:
        p.lineTo(*punt)
    p.close()
    c.setFillColor(kleur)
    c.drawPath(p, stroke=0, fill=1)


def nfc_bogen(c, cx, cy, kleur, schaal=1.0):
    """De twee boogjes uit het logo, rechts van de ster."""
    c.setStrokeColor(kleur)
    c.setLineCap(1)
    for straal, dikte in [(1.68, 0.335), (2.38, 0.335)]:
        c.setLineWidth(dikte * schaal)
        p = c.beginPath()
        stap = 4
        eerste = True
        for graden in range(-27, 28, stap):
            r = math.radians(graden)
            px = cx + math.cos(r) * straal * schaal
            py = cy + math.sin(r) * straal * schaal
            if eerste:
                p.moveTo(px, py)
                eerste = False
            else:
                p.lineTo(px, py)
        c.drawPath(p, stroke=1, fill=0)


def qr_tekenen(c, links, onder, maat, kleur):
    q = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, border=0)
    q.add_data(SITE_URL)
    q.make(fit=True)
    matrix = q.get_matrix()
    n = len(matrix)
    blok = maat / n
    c.setFillColor(kleur)
    for rij, regels in enumerate(matrix):
        for kol, aan in enumerate(regels):
            if aan:
                c.rect(links + kol * blok, onder + (n - 1 - rij) * blok, blok * 1.02, blok * 1.02,
                       stroke=0, fill=1)
    return n


def voorkant(c):
    verloop(c, 0, 0, PAG_B, PAG_H, ORANJE_DIEP, ORANJE_LICHT)

    # Merkteken: ster met de twee boogjes, als één geheel gecentreerd.
    if ALLEEN_VLAK:
        return

    straal = 5.6 * mm
    blok_midden = x(42.5)
    ster(c, blok_midden - 4.4 * mm, y(35.4), straal, WIT)
    nfc_bogen(c, blok_midden - 4.4 * mm, y(35.4), WIT, schaal=straal)

    c.setFillColor(WIT)
    c.setFont("Inter-Bold", 21)
    c.drawCentredString(x(42.5), y(19.9), "TapKaarten")

    c.setFillColor(WIT_ZACHT)
    c.setFont("Inter", 7.2)
    c.drawCentredString(x(42.5), y(13.6), SLOGAN)


def achterkant(c):
    c.setFillColor(WIT)
    c.rect(0, 0, PAG_B, PAG_H, stroke=0, fill=1)

    # Smalle oranje baan langs de linkerrand: herkenbaar in een kaartenbakje,
    # en hij loopt door tot in de afloop zodat er geen witte streep ontstaat.
    verloop(c, 0, 0, AFLOOP + 4 * mm, PAG_H, ORANJE_DIEP, ORANJE_LICHT)

    if ALLEEN_VLAK:
        return

    ster(c, x(13.5), y(44), 3.1 * mm, ORANJE_DIEP)

    c.setFillColor(INKT)
    c.setFont("Inter-Bold", 10.5)
    c.drawString(x(19.5), y(42.1), "TapKaarten")

    c.setFillColor(GRIJS)
    c.setFont("Inter", 6.6)
    c.drawString(x(19.5), y(37.7), SLOGAN)

    # Haarlijntje tussen wie-we-zijn en hoe-je-ons-bereikt.
    c.setStrokeColor(Color(0.10, 0.13, 0.17, alpha=0.13))
    c.setLineWidth(0.4)
    c.line(x(13.5), y(32.5), x(52), y(32.5))

    # Contactregels. Telefoon iets zwaarder: dat is waar iemand naar zoekt.
    regels = [
        ("Inter-Semi", 10, TELEFOON),
        ("Inter", 9, EMAIL),
        ("Inter", 9, WEBSITE),
    ]
    hoogte = 25.9
    for lettertype, korps, tekst in regels:
        c.setFillColor(INKT)
        c.setFont(lettertype, korps)
        c.drawString(x(13.5), y(hoogte), tekst)
        hoogte -= 6.5

    # De QR staat rechts, met zijn bijschrift ruim binnen de veilige rand.
    qr = 17.5
    # Het bijschrift is breder dan de QR zelf; die bepaalt dus hoe ver
    # het blok naar rechts mag staan, niet de code.
    qr_links, qr_onder = 85 - 7.5 - qr, 11.7
    qr_tekenen(c, x(qr_links), y(qr_onder), qr * mm, INKT)
    c.setFillColor(GRIJS)
    c.setFont("Inter", 5.6)
    c.drawCentredString(x(qr_links + qr / 2), y(7.9), "Scan voor de webshop")


def maak(bestand, met_snijtekens=False):
    c = canvas.Canvas(str(bestand), pagesize=(PAG_B, PAG_H))
    c.setTitle("TapKaarten visitekaartje")
    for tekenaar in (voorkant, achterkant):
        tekenaar(c)
        if met_snijtekens:
            snijtekens(c)
        c.showPage()
    c.save()


def snijtekens(c):
    """Alleen voor de proefafdruk: laat zien waar het mes komt."""
    c.setStrokeColor(Color(0, 0, 0, alpha=0.55))
    c.setLineWidth(0.25)
    lengte = 2 * mm
    for px in (AFLOOP, AFLOOP + SNIJ_B):
        for py in (AFLOOP, AFLOOP + SNIJ_H):
            c.line(px - lengte - 0.6 * mm, py, px - 0.6 * mm, py)
            c.line(px + 0.6 * mm, py, px + lengte + 0.6 * mm, py)
            c.line(px, py - lengte - 0.6 * mm, px, py - 0.6 * mm)
            c.line(px, py + 0.6 * mm, px, py + lengte + 0.6 * mm)


if __name__ == "__main__":
    letters()
    maak(HIER / "tapkaarten-visitekaartje.pdf")
    maak(HIER / "tapkaarten-visitekaartje-proef.pdf", met_snijtekens=True)
    print(f"{PAG_B / mm:.0f} x {PAG_H / mm:.0f} mm inclusief afloop "
          f"({SNIJ_B / mm:.0f} x {SNIJ_H / mm:.0f} mm gesneden)")
