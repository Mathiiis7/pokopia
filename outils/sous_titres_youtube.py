"""Récupère les sous-titres (automatiques ou non) d'une vidéo YouTube, en texte.

Usage : python -I outils/sous_titres_youtube.py <id_video> <fichier_sortie.txt>
"""
import html
import json
import re
import sys
import urllib.request

AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"


def lire(url, donnees=None, entetes=None):
    req = urllib.request.Request(url, data=donnees, headers={"User-Agent": AGENT, "Accept-Language": "fr-FR,fr", **(entetes or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def pistes(video):
    """Liste des pistes de sous-titres, via l'interface du lecteur Android (sans clé)."""
    corps = json.dumps({
        "context": {"client": {"clientName": "ANDROID", "clientVersion": "20.10.38", "hl": "fr"}},
        "videoId": video,
    }).encode()
    rep = json.loads(lire("https://www.youtube.com/youtubei/v1/player", corps, {"Content-Type": "application/json"}))
    titre = rep.get("videoDetails", {}).get("title", "")
    liste = rep.get("captions", {}).get("playerCaptionsTracklistRenderer", {}).get("captionTracks", [])
    return titre, liste


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    video, sortie = sys.argv[1], sys.argv[2]
    titre, liste = pistes(video)
    if not liste:
        print("Aucune piste de sous-titres pour", video, "-", titre)
        sys.exit(1)
    piste = next((p for p in liste if p.get("languageCode", "").startswith("fr")), liste[0])
    xml = lire(piste["baseUrl"])
    morceaux = re.findall(r"<(?:text|p)[^>]*>(.*?)</(?:text|p)>", xml, re.S)
    texte = " ".join(html.unescape(re.sub(r"<[^>]+>", "", m)) for m in morceaux)
    with open(sortie, "w", encoding="utf-8") as f:
        f.write(f"{titre}\nhttps://youtu.be/{video} (piste {piste.get('languageCode')}, {piste.get('kind', 'manuelle')})\n\n{texte}\n")
    print("OK", video, titre, len(texte), "caractères")


if __name__ == "__main__":
    main()
