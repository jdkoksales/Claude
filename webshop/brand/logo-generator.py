import math, os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

SRC = "/tmp/claude-0/-home-user-Claude/4ed8d6d3-2641-5570-b485-c23a1aa27fe7/scratchpad/package/files/inter-latin-wght-normal.woff2"
OUT = "/home/user/Claude/webshop/brand"

def wordmark_path(text, weight, tracking_em):
    f = TTFont(SRC)
    f = instancer.instantiateVariableFont(f, {"wght": weight}, inplace=False)
    upm = f["head"].unitsPerEm
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    hmtx = f["hmtx"]
    # kerning uit GPOS is hier niet nodig: Inter's defaults zijn al vlak voor kleine letters
    x = 0.0
    d = []
    for ch in text:
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}")
        tp = TransformPen(pen, Transform(1/upm, 0, 0, -1/upm, x/upm, 0))
        gs[g].draw(tp)
        s = pen.getCommands()
        if s: d.append(s)
        x += hmtx[g][0] + tracking_em * upm
    adv = x / upm - tracking_em            # laatste tracking telt niet mee
    return " ".join(d), adv

def star(cx, cy, R, ratio, rot=-90.0):
    r = R * ratio
    pts = []
    for i in range(10):
        a = math.radians(rot + i * 36.0)
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad*math.cos(a), cy + rad*math.sin(a)))
    return "M" + " L".join(f"{px:.4f} {py:.4f}" for px, py in pts) + " Z"

def arc(cx, cy, r, a0, a1):
    x0, y0 = cx + r*math.cos(math.radians(a0)), cy + r*math.sin(math.radians(a0))
    x1, y1 = cx + r*math.cos(math.radians(a1)), cy + r*math.sin(math.radians(a1))
    return f"M{x0:.4f} {y0:.4f} A{r:.4f} {r:.4f} 0 0 1 {x1:.4f} {y1:.4f}"

# ---- merk: reviewster + tap-golven (contactloos), in ster-eenheden ----
R      = 1.0          # buitenstraal ster
SPAN   = 27.0         # halve openingshoek van de golven
SW     = 0.335         # lijndikte golven
ARC_R  = (1.68, 2.38)

def mark_group(color, sw_scale=1.0):
    sw = SW * sw_scale
    p = [f'<path d="{star(0,0,R,0.478)}" fill="{color}"/>']
    for r in ARC_R:
        p.append(f'<path d="{arc(0,0,r,-SPAN,SPAN)}" fill="none" stroke="{color}" '
                 f'stroke-width="{sw:.3f}" stroke-linecap="round"/>')
    return "\n    ".join(p)

MARK_X0 = -R*math.cos(math.radians(18))            # linkerpunt ster
MARK_X1 = ARC_R[-1] + SW/2
MARK_Y0 = -R
MARK_Y1 = ARC_R[-1]*math.sin(math.radians(SPAN)) + SW/2
MARK_W  = MARK_X1 - MARK_X0
MARK_H  = MARK_Y1 - MARK_Y0

def lockup(text="tapkaarten", weight=600, tracking=-0.03,
           ink="#1A202C", accent=None, gap=0.30, mark_h=0.98):
    """Alles in em van het woordmerk. Basislijn op y=0, y-as omlaag."""
    d, adv = wordmark_path(text, weight, tracking)
    s = mark_h / MARK_H                                  # schaal van het merk
    # merk optisch centreren op de x-hoogte-as van het woord (~0.27em boven basislijn)
    my = -0.272
    mx = 0.0 - MARK_X0 * s
    star_col = accent or ink
    g = (f'<g transform="translate({mx:.4f} {my:.4f}) scale({s:.5f} {s:.5f})">\n    '
         + mark_group(ink) if not accent else
         f'<g transform="translate({mx:.4f} {my:.4f}) scale({s:.5f} {s:.5f})">\n    '
         + f'<path d="{star(0,0,R,0.478)}" fill="{accent}"/>\n    '
         + "\n    ".join(f'<path d="{arc(0,0,r,-SPAN,SPAN)}" fill="none" stroke="{ink}" '
                         f'stroke-width="{SW:.3f}" stroke-linecap="round"/>' for r in ARC_R))
    g += "\n  </g>"
    tx = MARK_W * s + gap
    word = f'<g transform="translate({tx:.4f} 0)"><path d="{d}" fill="{ink}"/></g>'

    x0, y0 = 0.0, my + MARK_Y0*s
    y0 = min(y0, -0.752)                                 # stijgers van t/k
    y1 = 0.212                                           # staart van de p
    x1 = tx + adv
    pad = 0.0
    vb = f"{x0-pad:.4f} {y0-pad:.4f} {x1-x0+2*pad:.4f} {y1-y0+2*pad:.4f}"
    body = f'  {g}\n  {word}'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" '
            f'role="img" aria-label="TapKaarten">\n{body}\n</svg>\n'), (x1-x0)/(y1-y0)

def markonly(ink="#1A202C", accent=None, bg=None, radius=None):
    star_col = accent or ink
    inner = f'<path d="{star(0,0,R,0.478)}" fill="{star_col}"/>\n  ' + "\n  ".join(
        f'<path d="{arc(0,0,r,-SPAN,SPAN)}" fill="none" stroke="{ink}" '
        f'stroke-width="{SW:.3f}" stroke-linecap="round"/>' for r in ARC_R)
    pad = 0.34
    vb = f"{MARK_X0-pad:.4f} {MARK_Y0-pad:.4f} {MARK_W+2*pad:.4f} {MARK_H+2*pad:.4f}"
    if bg:
        # vierkante tegel, merk gecentreerd
        side = max(MARK_W, MARK_H) + 2*0.42
        cx = MARK_X0 + MARK_W/2; cy = MARK_Y0 + MARK_H/2
        vb = f"{cx-side/2:.4f} {cy-side/2:.4f} {side:.4f} {side:.4f}"
        rect = (f'<rect x="{cx-side/2:.4f}" y="{cy-side/2:.4f}" width="{side:.4f}" '
                f'height="{side:.4f}" rx="{radius or side*0.22:.4f}" fill="{bg}"/>\n  ')
        inner = rect + inner
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="TapKaarten">\n  {inner}\n</svg>\n'

files = {}
files["tapkaarten-logo.svg"]        = lockup(ink="#1A202C")[0]
files["tapkaarten-logo-wit.svg"]    = lockup(ink="#FFFFFF")[0]
files["tapkaarten-logo-amber.svg"]  = lockup(ink="#1A202C", accent="#FBC26B")[0]
files["tapkaarten-merk.svg"]        = markonly()
files["tapkaarten-merk-wit.svg"]    = markonly(ink="#FFFFFF")
files["tapkaarten-favicon.svg"]     = markonly(ink="#FFFFFF", bg="#1A202C")

for n, s in files.items():
    open(os.path.join(OUT, n), "w").write(s)
    print(n, len(s))
_, ratio = lockup()
print("verhouding lockup b:h =", round(ratio, 3))
