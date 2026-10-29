"""Lit les pages Serebii enregistrées par telecharger_serebii.py.

Usage : python -I outils/lire_serebii.py
Sortie : outils/cache/serebii.json  {listes, pokemon, gouts}
"""
import json
import re
from html import unescape
from pathlib import Path

ICI = Path(__file__).parent
CACHE = ICI / "cache" / "serebii"
SORTIE = ICI / "cache" / "serebii.json"


def lire(nom):
    return (CACHE / nom).read_text(encoding="latin-1")


def propre(texte):
    return " ".join(unescape(re.sub(r"<[^>]+>", " ", texte)).split())


def lignes_liste(html):
    """Lignes « #001 | image | nom » d'une liste Serebii : (numero, slug, nom)."""
    motif = re.compile(
        r'<td class="cen">#(\d+)</td>\s*<td class="cen"><a href="/pokemonpokopia/pokedex/([a-z0-9\-\'.]+)\.shtml">'
        r'.*?<td class="cen"><a href="/pokemonpokopia/pokedex/[a-z0-9\-\'.]+\.shtml"><u>(.*?)</u>', re.S)
    return [(int(n), s, propre(nom)) for n, s, nom in motif.findall(html)]


def images_liste(html):
    """Image de chaque Pokémon dans une liste Serebii : slug -> adresse de l'image."""
    motif = re.compile(r'<a href="/pokemonpokopia/pokedex/([a-z0-9\-\'.]+)\.shtml"><img src="(/pokemonpokopia/pokemon/[^"]+)"')
    return dict(motif.findall(html))


def bloc_stats(html):
    """Les blocs « Specialty / Ideal Habitat / Favorites » d'une fiche (un par forme)."""
    blocs = []
    for m in re.finditer(r'<td class="foo">Favorites</td>', html):
        # la cellule « Specialty » contient sa propre <table> : on coupe à la fin du bloc
        fin = html.find("</table><br />", m.end())
        morceau = html[m.end():fin]
        habitat = re.findall(r'idealhabitat/([a-z]+)\.shtml"><u>(.*?)</u>', morceau)
        gouts = re.findall(r'href="/pokemonpokopia/(favorites/([a-z0-9]+)|flavors)\.shtml"><u>(.*?)</u>', morceau)
        blocs.append({
            "habitat": [h[0] for h in habitat],
            "gouts": [g[1] for g in gouts if g[1]],
            "saveur": [propre(g[2]) for g in gouts if not g[1]],
            "gouts_libelles": [propre(g[2]) for g in gouts if g[1]],
        })
    return blocs


def fiche(slug):
    html = lire(f"pokedex__{slug}.shtml")
    titre = propre(re.search(r"<title>(.*?)</title>", html, re.S).group(1)).split(" - ")[0]
    # seulement la section « Habitats & Locations » (le menu du site cite toutes les zones)
    debut = html.find("Habitats & Locations")
    section = html[debut:html.find("</table><br />", debut)] if debut >= 0 else ""
    lieux = sorted(set(re.findall(r'/pokemonpokopia/locations/([a-z]+)\.shtml', section)))
    habitats = sorted(set(re.findall(r'/pokemonpokopia/habitatdex/([a-z0-9]+)\.shtml', section)))
    return {"slug": slug, "titre": titre, "stats": bloc_stats(html), "lieux": lieux, "habitats_dex": habitats}


def page_gout(nom):
    html = lire(nom)
    i = html.find("Items </h2>")
    j = html.find("List of Pok")
    objets = re.findall(
        r'<td class="cen"><a href="/pokemonpokopia/items/([a-z0-9\-\'.()]+)\.shtml"><u>(.*?)</u></a></td>\s*'
        r'<td class="fooinfo">.*?</td>\s*<td class="cen">(.*?)</td>', html[i:j], re.S)
    pokemon = lignes_liste(html[j:])
    titre = propre(re.search(r"<title>(.*?)</title>", html, re.S).group(1)).split(" - ")[0]
    return {
        "titre": titre,
        "objets": [{"slug": s, "nom": propre(n), "usage": propre(u)} for s, n, u in objets],
        "pokemon": [s for _, s, _ in pokemon],
    }


def main():
    listes, images = {}, {}
    for page in ("availablepokemon", "eventpokedex", "basinpokedex"):
        listes[page] = lignes_liste(lire(f"{page}.shtml"))
        images.update(images_liste(lire(f"{page}.shtml")))
    slugs = sorted({s for l in listes.values() for _, s, _ in l})
    pokemon, manquants = [], []
    for s in slugs:
        if (CACHE / f"pokedex__{s}.shtml").exists():
            pokemon.append(fiche(s))
        else:
            manquants.append(s)
    gouts = {}
    for f in sorted(CACHE.glob("favorites__*.shtml")):
        gouts[f.name[len("favorites__"):-len(".shtml")]] = page_gout(f.name)
    SORTIE.write_text(json.dumps({"listes": listes, "images_pokemon": images, "pokemon": pokemon, "gouts": gouts},
                                 ensure_ascii=False, indent=1), encoding="utf-8")
    print({k: len(v) for k, v in listes.items()}, len(slugs), "fiches uniques,", len(pokemon), "lues,",
          len(manquants), "manquantes,", len(gouts), "pages de goûts")


if __name__ == "__main__":
    main()
