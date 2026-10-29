"""Extrait le texte lisible d'une page HTML enregistrée (aide à l'étude des sources).

Usage : python -I outils/texte_page.py <fichier.html> [<fichier_sortie.txt>]
"""
import sys
from html.parser import HTMLParser


class Texte(HTMLParser):
    IGNORE = {"script", "style", "noscript", "svg"}
    BLOCS = {"p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "br", "table", "section"}

    def __init__(self):
        super().__init__()
        self.morceaux = []
        self.profondeur_ignoree = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.IGNORE:
            self.profondeur_ignoree += 1
        if tag in self.BLOCS:
            self.morceaux.append("\n")
        if tag in ("td", "th"):
            self.morceaux.append(" | ")
        if tag == "img":
            alt = dict(attrs).get("alt")
            if alt:
                self.morceaux.append(f"[img:{alt}]")

    def handle_endtag(self, tag):
        if tag in self.IGNORE and self.profondeur_ignoree:
            self.profondeur_ignoree -= 1
        if tag in self.BLOCS:
            self.morceaux.append("\n")

    def handle_data(self, data):
        if not self.profondeur_ignoree:
            self.morceaux.append(data)


def main():
    source = sys.argv[1]
    with open(source, "rb") as f:
        brut = f.read()
    try:
        html = brut.decode("utf-8")
    except UnicodeDecodeError:
        html = brut.decode("latin-1")
    p = Texte()
    p.feed(html)
    lignes = [" ".join(l.split()) for l in "".join(p.morceaux).splitlines()]
    texte = "\n".join(l for l in lignes if l)
    if len(sys.argv) > 2:
        with open(sys.argv[2], "w", encoding="utf-8") as f:
            f.write(texte)
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(texte)


if __name__ == "__main__":
    main()
