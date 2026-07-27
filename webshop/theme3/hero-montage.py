"""Monteert per uitvoering het bordje in dezelfde balie-foto.

De balie, de koffie, de tijdschriften en het pennenbakje blijven exact wat ze
waren; alleen het bordje en zijn contactschaduw worden vervangen. De plaat is
de originele hero-foto met het oude bordje weggewerkt en de achtergrond
uitgeknipt, zodat het sectieverloop van de pagina er doorheen komt.

Draai eerst `node viewer/bord-run.mjs` voor de losse bordjes.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

S = '/tmp/claude-0/-home-user-Claude/4ed8d6d3-2641-5570-b485-c23a1aa27fe7/scratchpad/'
PLATE = S + 'plate-cut.png'
OUT = 'webshop/theme3/assets/tk3-hero-%s.png'

# Maatvoering op de koffiebeker: die is 138 px hoog voor ~11,5 cm, dus ~12 px/cm.
# Een standaard van 12,75 cm die 12 graden achteroverleunt komt uit op ~155 px.
# Zo klopt de verhouding met de spullen op de balie en lijkt het bordje niet groter
# dan het is.
TARGET_H, BOTTOM, CX = 155, 482, 802
CROP = (0, 150, 1584, 672)
KEYS = ['google-wit', 'google-zwart', 'instagram', 'facebook', 'sticker']

plate = Image.open(PLATE).convert('RGBA')
alpha = plate.split()[3]
base = np.asarray(plate.convert('RGB')).astype(np.float32)

for k in KEYS:
    src = Image.open(f'viewer/dist/bord/{k}.png').convert('RGBA')
    b = src.crop(src.getbbox())
    h = TARGET_H if k != 'sticker' else round(TARGET_H * 0.62)
    b = b.resize((max(1, round(b.width * h / b.height)), h), Image.LANCZOS)

    # smalle kernschaduw direct onder de voet
    m = Image.new('L', plate.size, 0)
    ImageDraw.Draw(m).ellipse(
        [CX - b.width * 0.42, BOTTOM - 4, CX + b.width * 0.42, BOTTOM + 4], fill=255)
    core = np.asarray(m.filter(ImageFilter.GaussianBlur(3))).astype(np.float32)[:, :, None] / 255

    # brede, zachte aanzet naar rechts, in lijn met het licht van links
    m2 = Image.new('L', plate.size, 0)
    ImageDraw.Draw(m2).ellipse(
        [CX - b.width * 0.6, BOTTOM - 7, CX + b.width * 1.2, BOTTOM + 7], fill=255)
    soft = np.asarray(m2.filter(ImageFilter.GaussianBlur(10))).astype(np.float32)[:, :, None] / 255

    rgb = base * (1 - 0.22 * core) * (1 - 0.07 * soft)
    out = Image.merge('RGBA', (*Image.fromarray(rgb.clip(0, 255).astype('uint8')).split(), alpha))
    out.paste(b, (CX - b.width // 2, BOTTOM - h), b)

    out = out.crop(CROP)
    out = out.resize((1600, round(out.height * 1600 / out.width)), Image.LANCZOS)
    out.quantize(colors=255, method=Image.FASTOCTREE).save(OUT % k, optimize=True)
    print('ok', k, out.size)
