"""Adreslabel voor een bestelling, als PDF op A6.

Let op wat dit wel en niet is. Dit is een adreslabel: afzender, geadresseerde
en het bestelnummer. Het is GEEN frankering. Er staat bewust geen streepjes-
code op die op port lijkt, want die zou bij de balie niet werken en een
nagemaakte postzegelcode is geen grap. Je plakt dit op de doos en koopt de
port bij PostNL, of je haalt via je eigen PostNL-account een gefrankeerd
label op en plakt dat ernaast.

A6 is 105 x 148 mm. Dat is het formaat van de meeste labelvellen en past ook
op een A4 die je zelf doormidden knipt.

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
    regels = [b["naam"], b["straat"]]
    if b.get("straat2"):
        regels.insert(2, b["straat2"])
    inhoud = "".join(
        f"<li>{veilig(r['aantal'])}&times; {veilig(r['titel'])}"
        + (f" <span class=\"sku\">{veilig(r['sku'])}</span>" if r.get("sku") else "")
        + "</li>" for r in b.get("regels", []))

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
    color: #000; padding: 7mm 7mm 6mm;
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

  .naar {{ flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center;
           padding: 6mm 0 }}
  .naar .kop {{ font-size: 7pt; letter-spacing: .14em; text-transform: uppercase;
                margin-bottom: 3mm }}
  .naar .naam {{ font-size: 15pt; font-weight: 700; line-height: 1.2; margin-bottom: 2.5mm }}
  .naar .adres {{ font-size: 13pt; line-height: 1.35 }}
  .naar .pc {{ font-weight: 700 }}
  .naar .land {{ font-size: 11pt; text-transform: uppercase; letter-spacing: .06em;
                 margin-top: 2mm }}

  .voet {{ border-top: 0.3mm solid #000; padding-top: 3mm; font-size: 8pt; line-height: 1.5 }}
  .voet .nr {{ font-size: 10pt; font-weight: 700 }}
  .voet ul {{ list-style: none; margin-top: 1mm }}
  .voet .sku {{ font-family: ui-monospace, "DejaVu Sans Mono", monospace; font-size: 7.5pt }}
  .voet .let {{ margin-top: 2mm; font-size: 6.5pt; line-height: 1.4 }}
</style>

<div class="rand"></div>

<div class="afzender">
  {'<img src="data:image/png;base64,' + logo + '" alt="">' if logo else ''}
  <div>
    <div class="kop">Afzender</div>
    <b>{veilig(AFZENDER['naam'])}</b>
    {veilig(AFZENDER['straat'])}<br>
    {veilig(AFZENDER['postcode'])} {veilig(AFZENDER['plaats'])}, {veilig(AFZENDER['land'])}
  </div>
</div>

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
  <div class="let">Dit is een adreslabel, geen frankering. Port bij verzending voldoen.</div>
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
