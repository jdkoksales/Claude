"""Meet de gerenderde posts in plaats van ze te bekijken.

Waarom dit bestaat: bij de hero en bij de downloadknop is er twee keer iets
misgegaan dat een controle had moeten vangen, omdat de controle iets anders
mat dan wat kapot was. Dus: hier wordt de echte doos van elk element
opgevraagd en vergeleken met de doos van zijn ouder.
"""

import json, pathlib, shutil, subprocess, sys

MAP = pathlib.Path(__file__).parent


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
  return JSON.stringify(uit);
})()
"""

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
    if melding:
        fout += 1
        print(f"FOUT  {html.name}")
        for m in melding:
            print(f"      {m}")
    else:
        print(f"ok    {html.name}  kop {data['regels']} regel(s)")

sys.exit(1 if fout else 0)
