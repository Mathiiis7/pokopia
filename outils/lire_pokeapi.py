"""Télécharge chez PokeAPI de qui évolue chaque espèce du jeu (outils/cache/pokeapi.json).

Pokopia Guide ne donne pas toutes les évolutions (Sancoki -> Tritosor, presque tout le DLC) :
construire_donnees.py complète ses liens avec ceux-ci. Déjà téléchargé = pas redemandé.
"""
import json
import pathlib
import re
import time
import urllib.error
import urllib.request

ICI = pathlib.Path(__file__).parent
CACHE = ICI / "cache" / "pokeapi.json"
# formes du jeu : une espèce pour PokeAPI
FORME = re.compile(r"(eastsea|(lowkey|amped|female|male|curly|droopy|stretchy)form)$")
NOMS = {"farfetch'd": "farfetchd", "mimejr.": "mime-jr", "mr.mime": "mr-mime"}


def espece(pid):
    pid = FORME.sub("", pid)
    return NOMS.get(pid, pid)


def demander(nom):
    """Espèce d'origine (None si aucune) ; "inconnu" si PokeAPI ne connaît pas ce nom (formes propres au jeu)."""
    req = urllib.request.Request(f"https://pokeapi.co/api/v2/pokemon-species/{nom}", headers={"User-Agent": "pokopia-perso"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            parent = json.load(r)["evolves_from_species"]
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return "inconnu"
        raise
    time.sleep(0.1)
    return parent["name"] if parent else None


def main():
    donnees = json.loads((ICI.parent / "donnees" / "pokopia.json").read_text(encoding="utf-8"))
    connus = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    a_faire = sorted({espece(p["id"]) for p in donnees["pokemon"]})
    while a_faire:
        nom = a_faire.pop()
        if nom not in connus:
            connus[nom] = demander(nom)
        # on remonte aussi par une espèce absente du jeu : son parent peut y être
        if connus[nom] not in (None, "inconnu") and connus[nom] not in connus:
            a_faire.append(connus[nom])
    CACHE.write_text(json.dumps(connus, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    print(len(connus), "espèces ;", "inconnues :", sorted(k for k, v in connus.items() if v == "inconnu"))


if __name__ == "__main__":
    main()
