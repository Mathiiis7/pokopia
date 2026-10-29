"""Relie chaque goût en français (JoeNesTeam) à son goût anglais (Serebii)
en comparant les objets que les deux sources rangent dedans.

Aucune traduction faite à la main : un goût français prend le goût anglais
dont la liste d'objets lui ressemble le plus. Les cas douteux sont signalés.

Usage : python -I outils/correspondance_gouts.py
Sortie : outils/cache/correspondance_gouts.json  {icone_jnt: {fr, en, score, second}}
"""
import json
import sys
from pathlib import Path

ICI = Path(__file__).parent
JNT = json.loads((ICI / "cache" / "joenesteam.json").read_text(encoding="utf-8"))
SER = json.loads((ICI / "cache" / "serebii.json").read_text(encoding="utf-8"))
SORTIE = ICI / "cache" / "correspondance_gouts.json"


def objets_jnt():
    """icône du goût -> (libellé fr, ensemble des objets testés qui le portent)"""
    par_icone, libelles = {}, {}
    for t in JNT[1:]:  # le premier tableau est celui des environnements
        for ligne in t["lignes"]:
            icone, texte = ligne[0]["icone"], ligne[0]["texte"]
            libelles[icone] = texte
            par_icone.setdefault(icone, set())
    for t in JNT[1:]:
        for ligne in t["lignes"]:
            for o in ligne[1]["objets"]:
                for icone in o["icones"]:
                    if icone in par_icone:
                        par_icone[icone].add(o["image"])
    return {i: (libelles[i], s) for i, s in par_icone.items()}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    serebii = {cle: {o["slug"] for o in g["objets"]} for cle, g in SER["gouts"].items()}
    jnt = objets_jnt()
    # ressemblance = objets communs / objets réunis (Jaccard), puis attribution un pour un,
    # en commençant par les paires les plus sûres
    paires = []
    for icone, (fr, objets) in jnt.items():
        for cle, s in serebii.items():
            reunis = len(objets | s)
            paires.append((len(objets & s) / reunis if reunis else 0, icone, cle))
    paires.sort(reverse=True)
    resultat, en_pris = {}, set()
    for score, icone, cle in paires:
        if icone in resultat or cle in en_pris:
            continue
        fr, objets = jnt[icone]
        meilleur_libre = max((p for p in paires if p[1] == icone and p[2] != cle), default=(0, "", ""))
        resultat[icone] = {"fr": fr, "en": cle, "score": round(score, 2),
                           "communs": len(objets & serebii[cle]), "objets_jnt": len(objets),
                           "objets_serebii": len(serebii[cle]), "second": [meilleur_libre[2], round(meilleur_libre[0], 2)]}
        en_pris.add(cle)
    for icone, r in sorted(resultat.items(), key=lambda x: x[1]["score"]):
        alerte = "  <-- À VÉRIFIER" if r["score"] < 0.3 or r["second"][1] >= r["score"] else ""
        print(f"{r['fr']:28} -> {r['en']:20} {r['score']:.2f} ({r['communs']} communs, {r['objets_jnt']} JNT, "
              f"{r['objets_serebii']} Serebii)  2e : {r['second'][0]} {r['second'][1]:.2f}{alerte}")
    print("Sans équivalent :", sorted(set(jnt) - set(resultat)), sorted(set(serebii) - en_pris))
    SORTIE.write_text(json.dumps(resultat, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
