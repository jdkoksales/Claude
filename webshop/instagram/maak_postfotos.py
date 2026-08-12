"""Liggende productfoto's voor de Instagram-posts.

De bronfoto's zijn vierkant (700x700): een standaard op een vlakke
studio-achtergrond met een zachte slagschaduw. Een post heeft een liggend
vlak nodig, en dat vlak is breder dan de bron.

Eerdere poging: de rand-kolommen uitrekken. Dat gaf een harde grijze balk
onderin, want de onderste beeldrij is de tafelrand en die werd een streep
over de volle breedte.

Wat hier gebeurt: de achtergrondkleur wordt uit de rand van de bron gemeten,
het bordje mét schaduw wordt uitgesneden, en dat knipsel wordt op een doek
van diezelfde kleur gezet - groter, zodat het product leesbaar blijft. De
achtergrond wordt dus niet verzonnen: hij was al vlak.
"""

from PIL import Image, ImageFilter
import numpy as np

BRON = "../theme3/assets/"


def achtergrondkleur(a, rand=14):
    """Mediaan van de buitenste rand. Mediaan en geen gemiddelde: als het
    product de rand raakt trekt een gemiddelde de kleur weg."""
    ring = np.concatenate([
        a[:rand].reshape(-1, 3), a[-rand:].reshape(-1, 3),
        a[:, :rand].reshape(-1, 3), a[:, -rand:].reshape(-1, 3)])
    return np.median(ring, axis=0)


def knipsel(a, kleur, drempel=5):
    """Kader om alles wat van de achtergrond afwijkt. De drempel staat laag
    zodat de schaduw meekomt - zonder schaduw zweeft het bordje."""
    afwijking = np.abs(a.astype(np.int16) - kleur).max(axis=2)
    rijen = np.where(afwijking.max(axis=1) > drempel)[0]
    kolommen = np.where(afwijking.max(axis=0) > drempel)[0]
    return kolommen[0], rijen[0], kolommen[-1] + 1, rijen[-1] + 1


def liggend(naam, doel, breed, hoog, vulling=0.80, x=0.5, y=0.52):
    """vulling = hoe hoog het knipsel wordt t.o.v. het doek."""
    im = Image.open(BRON + naam).convert("RGB")
    a = np.asarray(im)
    kleur = achtergrondkleur(a)
    l, b, r, o = knipsel(a, kleur)

    uitsnede = im.crop((l, b, r, o))
    schaal = (hoog * vulling) / uitsnede.height
    nieuw = (max(1, round(uitsnede.width * schaal)), round(uitsnede.height * schaal))
    uitsnede = uitsnede.resize(nieuw, Image.LANCZOS)

    doek = Image.new("RGB", (breed, hoog), tuple(int(round(k)) for k in kleur))
    px = round((breed - nieuw[0]) * x)
    py = round((hoog - nieuw[1]) * y)

    # Zachte rand: het knipsel heeft een flinterdunne vignettering van de
    # bronfoto op de randen. Zonder deze vervaging zie je een rechthoek.
    masker = Image.new("L", nieuw, 0)
    masker.paste(255, (18, 18, nieuw[0] - 18, nieuw[1] - 18))
    masker = masker.filter(ImageFilter.GaussianBlur(14))
    doek.paste(uitsnede, (px, py), masker)
    doek.save(doel, quality=94, optimize=True)
    print(f"{doel}  {breed}x{hoog}  knipsel {nieuw[0]}x{nieuw[1]}  bg {tuple(int(k) for k in kleur)}")


if __name__ == "__main__":
    # Maten zijn exact de hoogte van het fotovlak in de post, zodat
    # object-fit: cover niets meer weg hoeft te snijden.
    #   .vlak.kort = 46% van 1350  ->  fotovlak 729 px
    #   .vlak      = 57% van 1350  ->  fotovlak 580 px
    liggend("tk3-prod-insta.jpg", "../theme3/assets/tk3-post-insta.jpg", 1080, 729, vulling=0.84)
    liggend("tk3-prod-fb.jpg",    "../theme3/assets/tk3-post-fb.jpg",    1080, 729, vulling=0.84)
    # Wit bordje op zwart: onder een oranje vlak leest dat het scherpst,
    # en post 9 is de enige andere donkere in het raster.
    liggend("tk3-detail-1.jpg",   "../theme3/assets/tk3-post-formaat.jpg", 1080, 580, vulling=0.80, y=0.46)
