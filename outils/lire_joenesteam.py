"""Lit la page « Préférences » de JoeNesTeam (enregistrée dans outils/cache/)
et en sort les tableaux : environnements, puis objets par préférence et par usage.

Usage : python -I outils/lire_joenesteam.py
Sortie : outils/cache/joenesteam.json (brut, avant fusion avec Serebii)
"""
import json
import re
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

ICI = Path(__file__).parent
SOURCE = ICI / "cache" / "joenesteam-preferences.html"
SORTIE = ICI / "cache" / "joenesteam.json"


def slug_image(src):
    """« .../2026/04/woodenstool.png » -> « woodenstool »"""
    nom = src.rsplit("/", 1)[-1]
    nom = re.sub(r"-\d+x\d+(?=\.)", "", nom)  # vignettes WordPress
    return nom.rsplit(".", 1)[0]


class Tableaux(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tableaux = []      # [{id, entetes, lignes:[{cellules:[...]}]}]
        self.tableau = None
        self.ligne = None
        self.cellule = None
        self.dans_entete = False
        self.dans_infobulle = 0  # profondeur de <div class="tooltip-content">
        self.profondeur_div = 0
        self.objet = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = (a.get("class") or "").split()
        if tag == "table" and (a.get("id") or "").startswith("tablepress-"):
            self.tableau = {"id": a["id"], "entetes": [], "lignes": []}
            self.tableaux.append(self.tableau)
            return
        if self.tableau is None:
            return
        if tag == "thead":
            self.dans_entete = True
        elif tag == "tr":
            self.ligne = []
        elif tag in ("td", "th"):
            self.cellule = {"texte": "", "icone": None, "objets": []}
        elif tag == "div" and self.cellule is not None:
            self.profondeur_div += 1
            if "img-tooltip" in classes:
                self.objet = {"image": None, "icones": [], "texte": ""}
                self.cellule["objets"].append(self.objet)
            elif "tooltip-content" in classes:
                self.dans_infobulle = self.profondeur_div
        elif tag == "img" and self.cellule is not None:
            slug = slug_image(a.get("src", ""))
            if self.objet is not None and self.dans_infobulle:
                self.objet["icones"].append(slug)
            elif self.objet is not None and self.objet["image"] is None:
                self.objet["image"] = slug
                self.objet["src"] = a.get("src")
            elif self.cellule["icone"] is None:
                self.cellule["icone"] = slug
            else:
                self.cellule.setdefault("autres_images", []).append(slug)

    def handle_endtag(self, tag):
        if self.tableau is None:
            return
        if tag == "table":
            self.tableau = None
        elif tag == "thead":
            self.dans_entete = False
        elif tag == "div" and self.cellule is not None:
            if self.dans_infobulle == self.profondeur_div:
                self.dans_infobulle = 0
            elif self.objet is not None and not self.dans_infobulle:
                self.objet = None
            self.profondeur_div -= 1
        elif tag in ("td", "th") and self.cellule is not None:
            self.cellule["texte"] = " ".join(unescape(self.cellule["texte"]).split())
            self.ligne.append(self.cellule)
            self.cellule = None
            self.objet = None
            self.profondeur_div = 0
        elif tag == "tr" and self.ligne is not None:
            if self.dans_entete:
                self.tableau["entetes"] = [c["texte"] for c in self.ligne]
            else:
                self.tableau["lignes"].append(self.ligne)
            self.ligne = None

    def handle_data(self, data):
        if self.cellule is not None:
            if self.objet is not None:
                self.objet["texte"] += data
            else:
                self.cellule["texte"] += " " + data


def main():
    p = Tableaux()
    p.feed(SOURCE.read_text(encoding="utf-8"))
    for t in p.tableaux:
        for ligne in t["lignes"]:
            for c in ligne:
                for o in c["objets"]:
                    o["texte"] = " ".join(o["texte"].split())
    SORTIE.write_text(json.dumps(p.tableaux, ensure_ascii=False, indent=1), encoding="utf-8")
    for t in p.tableaux:
        n = sum(len(c["objets"]) for l in t["lignes"] for c in l)
        print(t["id"], t["entetes"], len(t["lignes"]), "lignes", n, "objets")


if __name__ == "__main__":
    main()
