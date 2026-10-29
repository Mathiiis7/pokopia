"""Lit les données que Pokopia Guide (pokopiaguide.com) glisse dans ses pages
(Pokédex et objets, en français et en anglais), enregistrées dans outils/cache/pokopiaguide/.

Usage : python -I outils/lire_pokopiaguide.py
Sortie : outils/cache/pokopiaguide.json  {pokemon_fr, objets_fr, objets_en}
"""
import json
import re
from pathlib import Path

ICI = Path(__file__).parent
DOSSIER = ICI / "cache" / "pokopiaguide"
SORTIE = ICI / "cache" / "pokopiaguide.json"


def charge_utile(fichier):
    """Recolle les morceaux « self.__next_f.push([1,"..."]) » de la page, décodés."""
    html = fichier.read_text(encoding="utf-8")
    morceaux = re.findall(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', html)
    return "".join(json.loads(m) for m in morceaux)


def objets_json(texte, debut):
    """Tous les objets JSON qui commencent par le motif « debut »."""
    dec = json.JSONDecoder()
    trouves = []
    for m in re.finditer(re.escape(debut), texte):
        try:
            obj, _ = dec.raw_decode(texte, m.start())
        except json.JSONDecodeError:
            continue
        trouves.append(obj)
    return trouves


def uniques(liste, cle):
    vus = {}
    for o in liste:
        vus.setdefault(o[cle], o)
    return list(vus.values())


def main():
    pokedex = charge_utile(DOSSIER / "pokedex-fr.html")
    pokemon = uniques([o for o in objets_json(pokedex, '{"id":') if "slug" in o and "pokopia" in o], "slug")
    objets = {}
    for langue in ("fr", "en"):
        texte = charge_utile(DOSSIER / f"items-{langue}.html")
        objets[langue] = uniques([o for o in objets_json(texte, '{"id":"') if "categoryKey" in o], "id")
    SORTIE.write_text(json.dumps({"pokemon_fr": pokemon, "objets_fr": objets["fr"], "objets_en": objets["en"]},
                                 ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(pokemon), "Pokémon,", len(objets["fr"]), "objets fr,", len(objets["en"]), "objets en")


if __name__ == "__main__":
    main()
