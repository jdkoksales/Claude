"""Monteert per uitvoering het bordje in dezelfde balie-foto.

De balie, de koffie, de tijdschriften en het pennenbakje blijven exact wat ze
waren; alleen het bordje en zijn contactschaduw worden vervangen.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

S = '/tmp/claude-0/-home-user-Claude/4ed8d6d3-2641-5570-b485-c23a1aa27fe7/scratchpad/'
plate = Image.open(S + 'plate.png').convert('RGB')
TARGET_H, BOTTOM, CX = 268, 482, 802
KEYS = ['google-wit', 'google-zwart', 'instagram', 'facebook', 'sticker']

for k in KEYS:
    src = Image.open(f'viewer/dist/bord/{k}.png').convert('RGBA')
    b = src.crop(src.getbbox())
    h = TARGET_H if k != 'sticker' else round(TARGET_H * 0.62)
    b = b.resize((max(1, round(b.width * h / b.height)), h), Image.LANCZOS)

    arr = np.asarray(plate).astype(np.float32)

    # smalle kernschaduw direct onder de voet
    m = Image.new('L', plate.size, 0)
    ImageDraw.Draw(m).ellipse(
        [CX - b.width * 0.40, BOTTOM - 5, CX + b.width * 0.40, BOTTOM + 5], fill=255)
    core = np.asarray(m.filter(ImageFilter.GaussianBlur(4))).astype(np.float32)[:, :, None] / 255

    # brede, zachte aanzet naar rechts, in lijn met het licht van links
    m2 = Image.new('L', plate.size, 0)
    ImageDraw.Draw(m2).ellipse(
        [CX - b.width * 0.55, BOTTOM - 9, CX + b.width * 1.15, BOTTOM + 9], fill=255)
    soft = np.asarray(m2.filter(ImageFilter.GaussianBlur(13))).astype(np.float32)[:, :, None] / 255

    arr = arr * (1 - 0.22 * core) * (1 - 0.07 * soft)
    out = Image.fromarray(arr.clip(0, 255).astype('uint8'))
    out.paste(b, (CX - b.width // 2, BOTTOM - h), b)
    out.save(S + f'hero-{k}.png')
    print('ok', k, b.size)
