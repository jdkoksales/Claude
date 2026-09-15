"""Adreslabel voor een bestelling, als PDF op A6.

Dit is het adres van de klant en het bestelnummer, meer niet. Er staat
bewust geen streepjescode op die op port lijkt: die zou bij PostNL niet
werken, en een nagemaakte frankeercode is iets anders dan een lelijk label.
Bij een pakket krijgt de doos aan de balie zijn eigen barcode; dit label
vertelt alleen waar hij heen moet.

A6 is 105 x 148 mm. Dat is het formaat van de meeste labelvellen en past ook
op een A4 die je zelf doormidden knipt.

Zet "afzender": true in de bestelling om het retouradres erop te krijgen.
Standaard staat het eraf. Zonder retouradres komt een onbestelbaar pakket
niet bij je terug, dus dat is een afweging en geen detail.

Gebruik:
    python3 maaklabel.py bestelling.json label.pdf
"""

import base64
import json
import pathlib
import shutil
import subprocess
import sys

HIER = pathlib.Path(__file__).parent
LOGO = HIER / ".." / "theme3" / "assets" / "tk3-favicon-192.png"

AFZENDER = {
    "naam": "TapKaarten",
    "straat": "Dingspil 13",
    "postcode": "9302 ET",
    "plaats": "Roden",
    "land": "Nederland",
}


def chroom():
    treffers = sorted(pathlib.Path("/opt/pw-browsers").glob("chromium*/chrome-linux/chrome"))
    if not treffers:
        for naam in ("chromium", "chromium-browser", "google-chrome"):
            pad = shutil.which(naam)
            if pad:
                return pad
        raise SystemExit("geen chromium gevonden")
    return str(treffers[0])


def veilig(tekst):
    """Naar HTML. Adressen van klanten gaan hier ongezien doorheen, dus alles
    wat op een tag lijkt wordt onschadelijk gemaakt."""
    return (str(tekst).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def bouw_html(b):
    logo = base64.b64encode(LOGO.resolve().read_bytes()).decode() if LOGO.exists() else ""
    inhoud = "".join(
        f"<li>{veilig(r['aantal'])}&times; {veilig(r['titel'])}"
        + (f" <span class=\"sku\">{veilig(r['sku'])}</span>" if r.get("sku") else "")
        + "</li>" for r in b.get("regels", []))

    afzender = ""
    if b.get("afzender"):
        a = AFZENDER
        afzender = f"""<div class="afzender">
  {'<img src="data:image/png;base64,' + logo + '" alt="">' if logo else ''}
  <div>
    <div class="kop">Afzender</div>
    <b>{veilig(a['naam'])}</b>
    {veilig(a['straat'])}<br>
    {veilig(a['postcode'])} {veilig(a['plaats'])}, {veilig(a['land'])}
  </div>
</div>"""

    return f"""<!doctype html>
<html lang="nl">
<meta charset="utf-8">
<title>Adreslabel {veilig(b['bestelling'])}</title>
<style>
  @page {{ size: 105mm 148mm; margin: 0 }}
  * {{ margin: 0; padding: 0; box-sizing: border-box }}
  html, body {{ width: 105mm; height: 148mm }}
  body {{
    font-family: Inter, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #000; padding: 8mm 8mm 7mm;
    display: flex; flex-direction: column;
  }}
  /* Een rand geeft de schaar een lijn om op te knippen als je van een A4 af
     werkt, en hij laat zien of de printer niet heeft geschaald. */
  .rand {{ position: fixed; inset: 3mm; border: 0.4mm solid #000 }}

  .afzender {{ display: flex; gap: 3mm; align-items: flex-start;
               font-size: 8pt; line-height: 1.35; padding-bottom: 4mm;
               border-bottom: 0.3mm solid #000 }}
  .afzender img {{ width: 9mm; height: 9mm; border-radius: 1.6mm; display: block }}
  .afzender b {{ font-size: 9.5pt; display: block }}
  .afzender .kop {{ font-size: 6.5pt; letter-spacing: .12em; text-transform: uppercase;
                    margin-bottom: .8mm }}

  /* Zonder afzenderblok is er ruimte over. Die gaat naar het adres zelf: hoe
     groter dat staat, hoe minder kans dat er iets misgaat bij het sorteren. */
  .naar {{ flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center }}
  .naar .kop {{ font-size: 7pt; letter-spacing: .14em; text-transform: uppercase;
                margin-bottom: 3.5mm }}
  .naar .naam {{ font-size: 18pt; font-weight: 700; line-height: 1.18; margin-bottom: 3mm }}
  .naar .adres {{ font-size: 15pt; line-height: 1.38 }}
  .naar .pc {{ font-weight: 700 }}
  .naar .land {{ font-size: 12pt; text-transform: uppercase; letter-spacing: .06em;
                 margin-top: 2.5mm }}

  .voet {{ border-top: 0.3mm solid #000; padding-top: 3mm; font-size: 8pt; line-height: 1.5 }}
  .voet .nr {{ font-size: 10pt; font-weight: 700 }}
  .voet ul {{ list-style: none; margin-top: 1mm }}
  .voet .sku {{ font-family: ui-monospace, "DejaVu Sans Mono", monospace; font-size: 7.5pt }}
</style>

<div class="rand"></div>

{afzender}

<div class="naar">
  <div class="kop">Geadresseerde</div>
  <div class="naam">{veilig(b['naam'])}</div>
  <div class="adres">
    {veilig(b['straat'])}<br>
    {'' if not b.get('straat2') else veilig(b['straat2']) + '<br>'}
    <span class="pc">{veilig(b['postcode'])}</span>&nbsp;&nbsp;{veilig(b['plaats'])}
    <div class="land">{veilig(b['land'])}</div>
  </div>
</div>

<div class="voet">
  <span class="nr">Bestelling {veilig(b['bestelling'])}</span> &middot; {veilig(b['datum'])}
  <ul>{inhoud}</ul>
</div>
</html>
"""


def maak(bestelling, doel):
    html = HIER / ".label.html"
    html.write_text(bouw_html(bestelling), encoding="utf-8")
    try:
        subprocess.run([
            chroom(), "--headless", "--disable-gpu", "--no-sandbox",
            "--virtual-time-budget=4000", "--run-all-compositor-stages-before-draw",
            "--no-pdf-header-footer", f"--print-to-pdf={doel}", f"file://{html.resolve()}",
        ], check=True, capture_output=True)
    finally:
        html.unlink(missing_ok=True)
    return pathlib.Path(doel)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    b = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    uit = maak(b, sys.argv[2])
    print(f"{uit}  {uit.stat().st_size / 1024:.0f} kB")
