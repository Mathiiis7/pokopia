"""Télécharge les pages Serebii utiles à Pokopia dans outils/cache/serebii/.

Une page déjà présente n'est pas retéléchargée (relancer ne coûte rien).
Une seconde d'attente entre deux requêtes, pour ne pas charger le site.

Usage : python -I outils/telecharger_serebii.py
"""
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://www.serebii.net/pokemonpokopia/"
CACHE = Path(__file__).parent / "cache" / "serebii"
AGENT = "Mozilla/5.0 (guide perso Pokopia, une requete par seconde)"

LISTES = ["availablepokemon.shtml", "eventpokedex.shtml", "basinpokedex.shtml",
          "favorites.shtml", "flavors.shtml", "items.shtml", "locations.shtml"]


def telecharger(chemin):
    """chemin relatif à BASE, ex. « pokedex/bulbasaur.shtml »"""
    fichier = CACHE / chemin.replace("/", "__")
    if fichier.exists():
        return fichier.read_bytes()
    req = urllib.request.Request(BASE + urllib.parse.quote(chemin, safe="/."), headers={"User-Agent": AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        contenu = r.read()
    fichier.write_bytes(contenu)
    time.sleep(1)
    return contenu


def liens(contenu, motif):
    html = contenu.decode("latin-1")
    return sorted(set(re.findall(motif, html)))


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    fiches, categories = set(), set()
    for page in LISTES:
        contenu = telecharger(page)
        # « farfetch'd », « mr.mime », « mimejr. » : apostrophe et point dans l'adresse
        fiches.update(liens(contenu, r"/pokemonpokopia/(pokedex/[a-z0-9\-'.]+\.shtml)"))
        categories.update(liens(contenu, r'/pokemonpokopia/(favorites/[a-z0-9\-]+\.shtml)'))
        categories.update(liens(contenu, r'/pokemonpokopia/(flavors/[a-z0-9\-]+\.shtml)'))
    print(len(fiches), "fiches Pokémon,", len(categories), "pages de goûts")
    erreurs = []
    for i, chemin in enumerate(sorted(fiches | categories), 1):
        try:
            telecharger(chemin)
        except Exception as e:  # noté puis on continue
            erreurs.append((chemin, str(e)))
        if i % 50 == 0:
            print(i, "pages")
    print("Erreurs :", len(erreurs))
    for chemin, e in erreurs:
        print(" ", chemin, e)


if __name__ == "__main__":
    main()
