"""Meet de gerenderde posts in plaats van ze te bekijken.

Waarom dit bestaat: bij de hero en bij de downloadknop is er twee keer iets
misgegaan dat een controle had moeten vangen, omdat de controle iets anders
mat dan wat kapot was. Dus: hier wordt de echte doos van elk element
opgevraagd en vergeleken met de doos van zijn ouder.
"""

import json, pathlib, shutil, subprocess, sys

import numpy as np
from PIL import Image

MAP = pathlib.Path(__file__).parent
UIT = MAP / "uit"


def chroom():
    for n in ("chromium", "chromium-browser", "google-chrome", "/opt/pw-browsers/chromium"):
        p = shutil.which(n) or (n if pathlib.Path(n).exists() else None)
        if p:
            return p
    sys.exit("geen chromium")


METING = """
(() => {
  const uit = {overloop: [], regels: []};
  const kader = (e) => e.getBoundingClientRect();
  document.querySelectorAll('.vlak, .slot, .foto, .raster').forEach(vak => {
    const v = kader(vak);
    vak.querySelectorAll('h1, h2, p, blockquote, .kicker, .getal, .stap, .vgl, .wie, .swipe').forEach(el => {
      const r = kader(el);
      // 1 px speling: afronding van de layout, geen echte overloop.
      if (r.top < v.top - 1 || r.bottom > v.bottom + 1 ||
          r.left < v.left - 1 || r.right > v.right + 1) {
        uit.overloop.push({el: el.className || el.tagName, el_top: Math.round(r.top),
          el_bot: Math.round(r.bottom), vak_top: Math.round(v.top), vak_bot: Math.round(v.bottom)});
      }
    });
  });
  // Koppen van meer dan vier regels lezen op duimnagelformaat niet meer.
  document.querySelectorAll('h1').forEach(h => {
    const regels = Math.round(kader(h).height / parseFloat(getComputedStyle(h).lineHeight));
    uit.regels.push(regels);
  });
  // Staat de voet niet over het onderste deel van het product heen?
  const f = document.querySelector('.foto img'), voet = document.querySelector('.voet');
  uit.voet_hoogte = voet ? Math.round(kader(voet).height) : 0;
  uit.doek = [document.querySelector('.post').offsetWidth, document.querySelector('.post').offsetHeight];
  // Labels van de feitenlijst: kleur en plek, zodat het contrast op het
  // gerenderde beeld te meten is in plaats van uit de CSS te raden.
  uit.labels = [...document.querySelectorAll('.feiten dt, .vgl p, .vgl h3')].map(e => {
    const r = kader(e);
    return {kleur: getComputedStyle(e).color,
            doos: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]};
  });
  return JSON.stringify(uit);
})()
"""

def helderheid(kleur):
    c = np.asarray(kleur, float) / 255
    c = np.where(c <= .03928, c / 12.92, ((c + .055) / 1.055) ** 2.4)
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]


def contrast(voor, achter):
    a, b = helderheid(voor), helderheid(achter)
    return (max(a, b) + .05) / (min(a, b) + .05)


def labelcontrast(data, naam):
    """Contrast van de feitenlabels, gemeten op de JPEG die eruit komt.

    Niet uit de CSS afgeleid: de vlakken hebben een verloop, dus de
    achtergrond onder rij 1 is een andere kleur dan onder rij 4. Een enkele
    berekening zou de onderste rijen missen - precies wat er eerder misging
    toen wit-op-oranje er in de code goed uitzag en op het beeld 2,2:1 haalde.
    """
    beeld = UIT / f"{naam}.jpg"
    if not data["labels"] or not beeld.exists():
        return []
    px = np.asarray(Image.open(beeld).convert("RGB"))
    klachten = []
    for i, label in enumerate(data["labels"]):
        voor = [int(v) for v in label["kleur"].strip("rgb()").split(",")[:3]]
        l, t, r, b = label["doos"]
        # De achtergrond wordt binnen het element zelf gemeten, als mediaan
        # over alle pixels. Tekst beslaat daar een minderheid van, dus de
        # mediaan is de ondergrond - bij lichte tekst op donker net zo goed
        # als andersom. Eerder werd rechts naast het element gemeten, en dat
        # landde bij twee vakken naast elkaar op het buurvak: die meting gaf
        # wit-op-wit en dus alarm waar niets aan de hand was.
        vak = px[max(t, 0):b, max(l, 0):r].reshape(-1, 3)
        if len(vak) < 50:
            continue
        achter = np.median(vak, axis=0)
        v = contrast(voor, achter)
        if v < 4.5:
            klachten.append(f"kleine tekst {i+1} haalt {v:.2f}:1 op {tuple(achter.round().astype(int))} (4.5 nodig)")
    return klachten


fout = 0
for html in sorted(MAP.glob("post-*.html")):
    # --dump-dom geeft geen scriptresultaat terug, dus de meting wordt in de
    # titel gezet en die lezen we uit de DOM.
    tijdelijk = MAP / f".meet-{html.name}"
    tijdelijk.write_text(html.read_text().replace("</html>",
        f"<script>window.addEventListener('load',()=>{{document.title={METING}}})</script></html>"))
    rt = subprocess.run([chroom(), "--headless", "--disable-gpu", "--no-sandbox",
        "--virtual-time-budget=5000", "--run-all-compositor-stages-before-draw",
        "--window-size=1080,1350", "--dump-dom", f"file://{tijdelijk.resolve()}"],
        capture_output=True, text=True)
    tijdelijk.unlink()
    tekst = rt.stdout
    start = tekst.find("<title>") + 7
    data = json.loads(tekst[start:tekst.find("</title>")].replace("&quot;", '"'))

    melding = []
    if data["doek"] != [1080, 1350]:
        melding.append(f"doek {data['doek']}")
    for o in data["overloop"]:
        melding.append(f"overloop {o['el']} {o['el_top']}..{o['el_bot']} buiten {o['vak_top']}..{o['vak_bot']}")
    for r in data["regels"]:
        if r > 4:
            melding.append(f"kop van {r} regels")
    melding += labelcontrast(data, html.stem)
    if melding:
        fout += 1
        print(f"FOUT  {html.name}")
        for m in melding:
            print(f"      {m}")
    else:
        print(f"ok    {html.name}  kop {data['regels']} regel(s)")

sys.exit(1 if fout else 0)
