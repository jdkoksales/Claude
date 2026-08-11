"""Van HTML naar een post die je kunt uploaden.

Rendert elke post-*.html op 1080 x 1350 en zet hem als JPEG in ./uit/.

Waarom op dubbele schaal renderen en dan verkleinen: Instagram comprimeert
alles nog een keer, en tekst die al scherp binnenkomt overleeft dat beter dan
tekst die op de nominale maat is getekend.

    python3 render.py            # alles
    python3 render.py post-1     # alleen wat daarmee begint
"""

import pathlib
import subprocess
import sys

from PIL import Image

HIER = pathlib.Path(__file__).parent
UIT = HIER / "uit"
BREED, HOOG = 1080, 1350
SCHAAL = 2


def chroom():
    treffers = sorted(pathlib.Path("/opt/pw-browsers").glob("chromium*/chrome-linux/chrome"))
    if not treffers:
        raise SystemExit("geen chromium gevonden onder /opt/pw-browsers")
    return str(treffers[0])


def render(html, doel):
    ruw = UIT / (doel.stem + "-ruw.png")
    subprocess.run([
        chroom(), "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
        f"--force-device-scale-factor={SCHAAL}",
        # Zonder deze twee schiet Chrome de opname af voordat het lettertype
        # geladen is. Het resultaat is dan een lege oranje plaat: de tekst
        # staat er wel, maar wordt nog niet getekend.
        "--virtual-time-budget=5000",
        "--run-all-compositor-stages-before-draw",
        # Chrome trekt van de vensterhoogte nog iets af voor zijn eigen balk:
        # vraag je 1350, dan meet het kijkvenster 1263 en wordt de onderste
        # 87px wit. Ruim aanvragen en zelf afsnijden.
        f"--window-size={BREED},{HOOG + 240}",
        f"--screenshot={ruw}",
        f"file://{html.resolve()}",
    ], check=True, capture_output=True)

    beeld = Image.open(ruw).convert("RGB")
    groot = (BREED * SCHAAL, HOOG * SCHAAL)
    if beeld.size[0] != groot[0] or beeld.size[1] < groot[1]:
        raise SystemExit(f"opname is {beeld.size}, minstens {groot} verwacht")
    beeld = beeld.crop((0, 0, *groot)).resize((BREED, HOOG), Image.LANCZOS)
    beeld.save(doel, quality=92, optimize=True, progressive=True, subsampling=0)
    ruw.unlink()
    return beeld


def maak(filter_op=None):
    UIT.mkdir(exist_ok=True)
    bestanden = sorted(HIER.glob("post-*.html"))
    if filter_op:
        bestanden = [b for b in bestanden if b.name.startswith(filter_op)]
    if not bestanden:
        raise SystemExit("geen posts gevonden")

    for html in bestanden:
        doel = UIT / (html.stem + ".jpg")
        beeld = render(html, doel)
        kb = doel.stat().st_size // 1024
        print(f"{doel.relative_to(HIER.parent.parent)}  {beeld.size[0]}x{beeld.size[1]}  {kb} kB")


if __name__ == "__main__":
    maak(sys.argv[1] if len(sys.argv) > 1 else None)
