"""Télécharge les images des Pokémon et des objets et les range dans images/, en WebP léger.

Lit outils/cache/images-sources.json (écrit par construire_donnees.py) : pour chaque image,
plusieurs adresses possibles, essayées dans l'ordre (Serebii, puis JoeNesTeam).
Une image déjà présente n'est pas refaite. Une seconde d'attente entre deux téléchargements.
Conversion avec ffmpeg (déjà installé), en 96 × 96 pour les Pokémon et 80 × 80 pour les objets.

Usage : python -I outils/telecharger_images.py   puis relancer construire_donnees.py
"""
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ICI = Path(__file__).parent
RACINE = ICI.parent
SOURCES = json.loads((ICI / "cache" / "images-sources.json").read_text(encoding="utf-8"))
BRUT = ICI / "cache" / "images"
AGENT = "Mozilla/5.0 (guide perso Pokopia, une requete par seconde)"
TAILLES = {"pokemon": 96, "objets": 80, "saveurs": 64, "gouts": 48}


def telecharger(url):
    req = urllib.request.Request(url, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        if r.status != 200 or not r.headers.get("Content-Type", "").startswith("image/"):
            raise ValueError(f"pas une image ({r.headers.get('Content-Type')})")
        return r.read()


def convertir(source, cible, taille):
    cible.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", str(source),
        "-vf", f"scale={taille}:{taille}:force_original_aspect_ratio=decrease:flags=lanczos",
        "-c:v", "libwebp", "-quality", "82", "-compression_level", "6", str(cible),
    ], check=True)


def main():
    BRUT.mkdir(parents=True, exist_ok=True)
    rates, faits = [], 0
    seul = sys.argv[1] if len(sys.argv) > 1 else None  # « pokemon » ou « objets » : un seul genre
    for genre, liste in SOURCES.items():
        if seul and genre != seul:
            continue
        for nom, urls in liste.items():
            cible = RACINE / "images" / genre / f"{nom}.webp"
            if cible.exists():
                continue
            brut = BRUT / f"{genre}-{nom}.png"
            ok = brut.exists()
            for url in urls if not ok else []:
                try:
                    brut.write_bytes(telecharger(url))
                    ok = True
                    break
                except Exception as e:  # on essaie l'adresse suivante
                    print("  échec", url, e)
                finally:
                    time.sleep(1)
            if not ok:
                rates.append(f"{genre}/{nom}")
                continue
            try:
                convertir(brut, cible, TAILLES[genre])
                faits += 1
            except subprocess.CalledProcessError:
                rates.append(f"{genre}/{nom} (conversion)")
            if faits and faits % 100 == 0:
                print(faits, "images")
    print(faits, "images faites ;", len(rates), "ratées")
    for r in rates:
        print("  ", r)


if __name__ == "__main__":
    main()
