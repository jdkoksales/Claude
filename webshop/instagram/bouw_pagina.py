"""Bouwt één zelfstandige HTML-pagina met alle posts erin.

Alles zit in het bestand zelf: de beelden als data-URI, zodat je ze kunt
downloaden zonder internet, en het lettertype van het merk zodat de pagina er
hetzelfde uitziet als de posts.

    python3 bouw_pagina.py
"""

import base64
import html
import json
import pathlib

HIER = pathlib.Path(__file__).parent
UIT = HIER / "uit"
LETTERS = HIER.parent / "drukwerk"
DOEL = HIER / "tapkaarten-instagram.html"
PLAN = HIER / "onderschriften.md"


def b64(pad, mime):
    return f"data:{mime};base64," + base64.b64encode(pad.read_bytes()).decode()


def lettertype(bestand, gewicht):
    bron = b64(LETTERS / bestand, "font/ttf")
    return (f"@font-face{{font-family:Inter;src:url({bron}) format('truetype');"
            f"font-weight:{gewicht};font-style:normal;font-display:swap}}")


def dia(naam):
    bron = b64(UIT / naam, "image/jpeg")
    return f"""      <figure class="dia">
        <img src="{bron}" alt="{html.escape(naam)}" loading="lazy" width="1080" height="1350">
        <figcaption>
          <span class="best">{html.escape(naam)}</span>
          <a class="haal" href="{bron}" download="{html.escape(naam)}"
            data-naam="{html.escape(naam)}">Downloaden</a>
        </figcaption>
      </figure>"""


def blok(p):
    dias = "\n".join(dia(d) for d in p["dias"])
    tekst = html.escape(p["tekst"])
    tags = html.escape(p["tags"])
    meer = " meervoudig" if len(p["dias"]) > 1 else ""
    return f"""  <article class="post" id="post-{p['nr']}">
    <header class="kop">
      <span class="nr">{p['nr']}</span>
      <div class="titels">
        <h2>{html.escape(p['titel'])}</h2>
        <p class="meta"><span class="chip">{html.escape(p['vorm'])}</span>
          <span class="wanneer">{html.escape(p['dag'])}</span></p>
      </div>
    </header>

    <p class="doel">{html.escape(p['doel'])}</p>

    <div class="strip{meer}">
{dias}
    </div>

    <div class="tekstvak">
      <div class="vakkop">
        <h3>Onderschrift</h3>
        <button type="button" class="kopieer" data-doel="tekst-{p['nr']}">Kopiëren</button>
      </div>
      <pre id="tekst-{p['nr']}">{tekst}</pre>

      <div class="vakkop">
        <h3>Hashtags</h3>
        <button type="button" class="kopieer" data-doel="tags-{p['nr']}">Kopiëren</button>
      </div>
      <pre id="tags-{p['nr']}" class="tags">{tags}</pre>

      <p class="waarom"><b>Waarom zo:</b> {html.escape(p['waarom'])}</p>
    </div>
  </article>"""


def plan(posten):
    """Hetzelfde plan als platte tekst, voor wie liever een document leest dan
    een webpagina. Uit dezelfde posts.json, zodat de twee niet uit elkaar
    kunnen lopen — dat gebeurde met de vorige, handgeschreven versie wel."""
    regels = [
        "# Instagram-contentplan TapKaarten",
        "",
        "Vijf posts, in deze volgorde te plaatsen. Alle beelden zijn 1080 x 1350",
        "(4:5) en staan in `uit/`. De opgemaakte versie met downloadknoppen is",
        "`tapkaarten-instagram.html`.",
        "",
        "| # | Vorm | Onderwerp | Wanneer |",
        "|---|---|---|---|",
    ]
    for p in posten:
        regels.append(f"| {p['nr']} | {p['vorm']} | {p['titel']} | {p['dag']} |")

    for p in posten:
        regels += [
            "",
            "---",
            "",
            f"## {p['nr']}. {p['titel']}",
            "",
            f"**Vorm:** {p['vorm']}  ",
            f"**Wanneer:** {p['dag']}  ",
            f"**Waarvoor:** {p['doel']}",
            "",
            "**Beelden:** " + ", ".join(f"`uit/{d}`" for d in p["dias"]),
            "",
            "### Onderschrift",
            "",
            "```",
            p["tekst"],
            "",
            p["tags"],
            "```",
            "",
            f"**Waarom zo:** {p['waarom']}",
        ]

    regels += [
        "",
        "---",
        "",
        "## Wat hier niet in zit",
        "",
        "Reels. Die halen op Instagram veruit het meeste bereik, maar daar is",
        "filmmateriaal voor nodig dat er nog niet is. Een telefoonopname van tien",
        "seconden waarin een klant zijn telefoon tegen de standaard houdt is genoeg",
        "voor de eerste.",
        "",
        "## Iets aanpassen",
        "",
        "Teksten staan in `posts.json`, de beelden zijn HTML in deze map.",
        "`python3 render.py` maakt nieuwe beelden, `python3 bouw_pagina.py` bouwt",
        "de webpagina en dit document opnieuw. Dit bestand niet met de hand",
        "bijwerken: het wordt overschreven.",
        "",
    ]
    PLAN.write_text("\n".join(regels))
    print(f"{PLAN.relative_to(HIER.parent.parent)}  {PLAN.stat().st_size // 1024} kB")


def maak():
    data = json.loads((HIER / "posts.json").read_text())
    posten = data["posts"]
    aantal_dias = sum(len(p["dias"]) for p in posten)

    fonts = "".join([
        lettertype("Inter-Regular.ttf", 400),
        lettertype("Inter-SemiBold.ttf", 600),
        lettertype("Inter-Bold.ttf", 700),
    ])

    blokken = "\n\n".join(blok(p) for p in posten)

    pagina = f"""<meta charset="utf-8">\n<title>TapKaarten — Instagram-posts</title>
<style>
{fonts}

/* De lichte stand staat op kale :root, zodat hij ook geldt als de kijker
   niets heeft ingesteld. De donkere stand herdefinieert alleen de tokens. */
:root {{
  --grond: #FBF8F4;
  --vlak: #FFFFFF;
  --inkt: #1F1B18;
  --zacht: #6E635A;
  --lijn: rgba(31,27,24,.12);
  --accent: #C4430F;
  --accent-vlak: #FDEFE3;
  --schaduw: 0 1px 2px rgba(31,27,24,.05), 0 8px 24px rgba(31,27,24,.06);
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --grond: #15120F;
    --vlak: #1E1A16;
    --inkt: #F5EFE8;
    --zacht: #A79889;
    --lijn: rgba(255,255,255,.14);
    --accent: #FF8340;
    --accent-vlak: rgba(255,131,64,.14);
    --schaduw: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
  }}
}}
:root[data-theme="dark"] {{
  --grond: #15120F;
  --vlak: #1E1A16;
  --inkt: #F5EFE8;
  --zacht: #A79889;
  --lijn: rgba(255,255,255,.14);
  --accent: #FF8340;
  --accent-vlak: rgba(255,131,64,.14);
  --schaduw: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
}}

* {{ box-sizing: border-box }}

body {{
  margin: 0; background: var(--grond); color: var(--inkt);
  font-family: Inter, system-ui, sans-serif;
  font-size: 17px; line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}}

.blad {{ max-width: 1120px; margin: 0 auto; padding: 64px 28px 120px }}

/* ---------- kop van de pagina ---------- */
.merk {{
  display: flex; align-items: center; gap: 12px;
  font-size: 14px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  color: var(--accent); margin-bottom: 26px;
}}
.merk::after {{ content: ""; flex: 1 1 auto; height: 1px; background: var(--lijn) }}

h1 {{
  font-size: clamp(34px, 5.4vw, 54px); line-height: 1.06; letter-spacing: -.035em;
  font-weight: 700; margin: 0 0 20px; text-wrap: balance; max-width: 20ch;
}}
.intro {{ max-width: 62ch; color: var(--zacht); font-size: 19px; margin: 0 0 40px }}
.intro strong {{ color: var(--inkt); font-weight: 600 }}

.tip {{
  margin: 0 0 30px; padding: 16px 20px; border-radius: 12px;
  background: var(--accent-vlak); color: var(--inkt);
  font-size: 15px; line-height: 1.5; max-width: 68ch;
}}
.tip b {{ font-weight: 600 }}

.feiten {{
  display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 1px;
  background: var(--lijn); border: 1px solid var(--lijn); border-radius: 14px;
  overflow: hidden; margin-bottom: 76px;
}}
.feiten div {{ background: var(--vlak); padding: 22px 24px }}
.feiten dt {{
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px; letter-spacing: .1em; text-transform: uppercase;
  color: var(--zacht); margin-bottom: 8px;
}}
.feiten dd {{ margin: 0; font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums }}

/* ---------- een post ---------- */
.post {{ margin-bottom: 92px; scroll-margin-top: 24px }}
.post + .post {{ padding-top: 84px; border-top: 1px solid var(--lijn) }}

.kop {{ display: flex; align-items: flex-start; gap: 22px; margin-bottom: 10px }}
.nr {{
  flex: 0 0 auto; width: 54px; height: 54px; border-radius: 14px;
  display: grid; place-items: center;
  background: var(--accent-vlak); color: var(--accent);
  font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums;
}}
.titels {{ min-width: 0 }}
.kop h2 {{
  font-size: clamp(24px, 3.2vw, 32px); line-height: 1.15; letter-spacing: -.025em;
  font-weight: 700; margin: 2px 0 10px; text-wrap: balance;
}}
.meta {{ margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 12px }}
.chip {{
  padding: 5px 13px; border-radius: 999px; background: var(--accent-vlak); color: var(--accent);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px; font-weight: 600; letter-spacing: .04em;
}}
.wanneer {{
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px; color: var(--zacht); letter-spacing: .04em;
}}
.doel {{ margin: 0 0 26px 76px; color: var(--zacht); max-width: 58ch }}

/* ---------- de dia's ---------- */
/* Een los beeld staat op zijn eigen breedte; een carrousel schuift
   horizontaal, net als in de app zelf. */
.strip {{ display: flex; gap: 16px; margin-bottom: 30px }}
.strip.meervoudig {{ overflow-x: auto; padding-bottom: 10px; scroll-snap-type: x proximity }}
.strip.meervoudig .dia {{ scroll-snap-align: start }}

.dia {{ margin: 0; flex: 0 0 auto; width: 268px }}
.dia img {{
  display: block; width: 100%; height: auto; border-radius: 12px;
  background: var(--vlak); box-shadow: var(--schaduw);
}}
.dia figcaption {{
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin-top: 10px;
}}
.best {{
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; color: var(--zacht);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}}
.haal {{
  flex: 0 0 auto; font-size: 13px; font-weight: 600; color: var(--accent);
  text-decoration: none; border-bottom: 1px solid currentColor; padding-bottom: 1px;
}}
.haal:hover {{ color: var(--inkt) }}

/* ---------- tekstvak ---------- */
.tekstvak {{
  background: var(--vlak); border: 1px solid var(--lijn); border-radius: 16px;
  padding: 26px 28px 24px;
}}
.vakkop {{ display: flex; align-items: center; justify-content: space-between; gap: 16px }}
.vakkop h3 {{
  margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--zacht);
  font-weight: 600;
}}
.vakkop + pre {{ margin-top: 12px }}
pre {{
  margin: 0 0 24px; white-space: pre-wrap; word-break: break-word;
  font-family: Inter, system-ui, sans-serif; font-size: 16px; line-height: 1.62;
}}
pre.tags {{ color: var(--accent); font-size: 15px; margin-bottom: 22px }}

.kopieer {{
  font: inherit; font-size: 13px; font-weight: 600;
  padding: 7px 16px; border-radius: 999px; cursor: pointer;
  background: var(--accent-vlak); color: var(--accent);
  border: 1px solid transparent; transition: background .15s, color .15s;
}}
.kopieer:hover {{ background: var(--accent); color: #fff }}
.kopieer:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 3px }}
.kopieer[data-klaar] {{ background: var(--accent); color: #fff }}

.waarom {{
  margin: 0; padding-top: 20px; border-top: 1px solid var(--lijn);
  font-size: 15px; color: var(--zacht); max-width: 66ch;
}}
.waarom b {{ color: var(--inkt); font-weight: 600 }}

/* ---------- slot ---------- */
.slot {{ margin-top: 40px; padding-top: 36px; border-top: 1px solid var(--lijn); max-width: 62ch }}
.slot h2 {{ font-size: 22px; margin: 0 0 14px; letter-spacing: -.02em }}
.slot p {{ margin: 0 0 14px; color: var(--zacht) }}
.slot code {{
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px;
  background: var(--accent-vlak); color: var(--accent); padding: 2px 7px; border-radius: 6px;
}}

@media (max-width: 640px) {{
  .blad {{ padding: 40px 18px 80px }}
  .kop {{ gap: 14px }}
  .nr {{ width: 42px; height: 42px; font-size: 19px; border-radius: 11px }}
  .doel {{ margin-left: 0 }}
  .dia {{ width: 218px }}
  .strip {{ overflow-x: auto }}
}}
@media (prefers-reduced-motion: reduce) {{
  * {{ transition: none !important }}
}}
</style>

<div class="blad">
  <p class="merk">TapKaarten · contentplan</p>
  <h1>{len(posten)} posts, klaar om te plaatsen.</h1>
  <p class="intro">Alle beelden staan op <strong>1080 × 1350</strong> — het formaat dat in
    de tijdlijn de meeste schermhoogte pakt. Download het beeld, kopieer het onderschrift,
    plak de hashtags eronder. In deze volgorde plaatsen werkt het best: de posts bouwen op
    elkaar voort.</p>

  <p class="tip" id="tip">Werkt <b>Downloaden</b> niet? Dan kijk je naar deze pagina in een
    ingebed kader, en dat kader blokkeert downloads. Open de pagina in een eigen tabblad,
    of klik met de rechtermuisknop op een beeld en kies <b>Afbeelding opslaan als</b>.
    Op een telefoon: houd het beeld ingedrukt.</p>

  <dl class="feiten">
    <div><dt>Posts</dt><dd>5</dd></div>
    <div><dt>Beelden</dt><dd>{aantal_dias}</dd></div>
    <div><dt>Formaat</dt><dd>1080 × 1350</dd></div>
    <div><dt>Looptijd</dt><dd>3 weken</dd></div>
  </dl>

{blokken}

  <section class="slot">
    <h2>Wat hier nog niet in zit</h2>
    <p>Reels. Die halen op Instagram veruit het meeste bereik — het advies voor 2026 is
      grofweg drie tot vier per week — maar daar is filmmateriaal voor nodig dat er nog
      niet is. Eén telefoonopname van tien seconden waarin een klant zijn telefoon tegen
      de standaard houdt, is genoeg voor de eerste; zeg het maar als je die maakt.</p>
    <p>Deze vijf zijn allemaal statisch of carrousel. Dat is bewust: carrousels halen de
      meeste saves, en een save blijft doorwerken lang nadat de post uit de tijdlijn is.</p>
    <h2>Iets aanpassen</h2>
    <p>De posts staan als HTML in <code>webshop/instagram/</code>. Tekst wijzigen en
      <code>python3 render.py</code> draaien levert nieuwe beelden op, in dezelfde stijl.</p>
  </section>
</div>

<script>
// Een <a download> naar een data-URI wordt in een ingebed kader geweigerd.
// Via een blob lukt het meestal wel; lukt dat ook niet, dan openen we het beeld
// in een nieuw tabblad zodat je het daar kunt opslaan.
document.querySelectorAll('.haal').forEach(function (link) {{
  link.addEventListener('click', function (e) {{
    var naam = link.dataset.naam || 'post.jpg';
    e.preventDefault();
    fetch(link.href).then(function (r) {{ return r.blob(); }}).then(function (blob) {{
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = naam;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () {{ URL.revokeObjectURL(url); }}, 5000);
    }}).catch(function () {{
      var w = window.open(link.href, '_blank');
      if (!w) {{
        var tip = document.getElementById('tip');
        if (tip) {{
          tip.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
          tip.style.outline = '2px solid var(--accent)';
          tip.style.outlineOffset = '4px';
        }}
      }}
    }});
  }});
}});

document.querySelectorAll('.kopieer').forEach(function (knop) {{
  knop.addEventListener('click', function () {{
    var bron = document.getElementById(knop.dataset.doel);
    if (!bron) return;
    var tekst = bron.textContent;
    var klaar = function () {{
      var was = knop.textContent;
      knop.textContent = 'Gekopieerd';
      knop.setAttribute('data-klaar', '1');
      setTimeout(function () {{
        knop.textContent = was;
        knop.removeAttribute('data-klaar');
      }}, 1600);
    }};
    if (navigator.clipboard && navigator.clipboard.writeText) {{
      navigator.clipboard.writeText(tekst).then(klaar, function () {{ handmatig(tekst, klaar); }});
    }} else {{
      handmatig(tekst, klaar);
    }}
  }});
}});

// Terugval voor browsers zonder klembord-toegang: even in een veld zetten en
// de oude execCommand gebruiken.
function handmatig(tekst, klaar) {{
  var veld = document.createElement('textarea');
  veld.value = tekst;
  veld.setAttribute('readonly', '');
  veld.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.appendChild(veld);
  veld.select();
  try {{ document.execCommand('copy'); klaar(); }} catch (e) {{ /* niets */ }}
  veld.remove();
}}
</script>
"""
    # De pagina komt in een omhulsel terecht waarvan wij de charset niet
    # bepalen. Alles buiten ASCII als entiteit wegschrijven maakt het bestand
    # daar ongevoelig voor: anders wordt "1080 x 1350" met een echt maalteken
    # als "1080 \u0106\u2014 1350" getoond.
    pagina = pagina.encode("ascii", "xmlcharrefreplace").decode("ascii")
    DOEL.write_text(pagina, encoding="ascii")
    kb = DOEL.stat().st_size // 1024
    print(f"{DOEL.relative_to(HIER.parent.parent)}  {kb} kB  ({len(posten)} posts, {aantal_dias} beelden)")
    plan(posten)


if __name__ == "__main__":
    maak()
