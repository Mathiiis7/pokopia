"""Assemble le fichier de données de l'appli à partir des trois sources lues :
Serebii (goûts et habitat de chaque Pokémon, objets par goût), Pokopia Guide
(noms français, deuxième avis sur les goûts, comment obtenir un objet) et
JoeNesTeam (goûts en français, objets testés en jeu, objets d'environnement).

Rien n'est complété à la main : ce qui manque reste vide et part dans le rapport.

À lancer après lire_serebii.py, lire_pokopiaguide.py, lire_joenesteam.py
et correspondance_gouts.py :
    python -I outils/construire_donnees.py
Sorties : donnees/pokopia.json (lu par l'appli) et docs/verification-donnees.md
"""
import json
import re
from datetime import date
from pathlib import Path

ICI = Path(__file__).parent
RACINE = ICI.parent
CACHE = ICI / "cache"
SER = json.loads((CACHE / "serebii.json").read_text(encoding="utf-8"))
PG = json.loads((CACHE / "pokopiaguide.json").read_text(encoding="utf-8"))
JNT = json.loads((CACHE / "joenesteam.json").read_text(encoding="utf-8"))
CORR = json.loads((CACHE / "correspondance_gouts.json").read_text(encoding="utf-8"))
SORTIE = RACINE / "donnees" / "pokopia.json"
RAPPORT = RACINE / "docs" / "verification-donnees.md"
# adresses des images, pour outils/telecharger_images.py (les images vont dans images/)
SOURCES_IMAGES = CACHE / "images-sources.json"
IMAGES = RACINE / "images"
SEREBII_BASE = "https://www.serebii.net"

# Libellés français : ceux du tableau d'environnements de JoeNesTeam et de sa vidéo [A]
ENVIRONNEMENTS = {"bright": "Lumineux", "dark": "Sombre", "humid": "Humide",
                  "dry": "Sec", "warm": "Chaud", "cool": "Froid"}
ENV_JNT = {"Lumineux": "bright", "Sombre": "dark", "Humide": "humid", "Sec": "dry", "Chaud": "warm", "Froid": "cool"}
ENV_PG = {"bright": "bright", "dark": "dark", "moist": "humid", "dry": "dry", "warm": "warm", "cool": "cool"}
# Saveurs : nom anglais de Serebii -> mot de la vidéo [A] ; baie ou légume conseillé par [A],
# repris par son nom anglais (page Flavors de Serebii) puis traduit par Pokopia Guide
SAVEURS = {"Sweet": ("sucré", "Pecha Berry"), "Sour": ("acide", "Aspear Berry"),
           "Spicy": ("épicé", "Fresh carrot"), "Bitter": ("amer", "Rawst Berry"), "Dry": ("âcre", "Chesto Berry")}
USAGES = {"Relaxation": "repos", "Decoration": "deco", "Toy": "jouet"}
USAGES_JNT = {"Se reposer": "repos", "Décorer": "deco", "S’amuser": "jouet"}
# Formes : adresse Serebii -> adresse Pokopia Guide (les deux noms disent la même forme)
FORMES = {"frillishfemaleform": "frillish-female", "frillishmaleform": "frillish-male",
          "jellicentfemaleform": "jellicent-female", "jellicentmaleform": "jellicent-male",
          "shelloseastsea": "shellos-east", "gastrodoneastsea": "gastrodon-east",
          "tatsugiricurlyform": "tatsugiri", "tatsugiridroopyform": "tatsugiri-droopy",
          "tatsugiristretchyform": "tatsugiri-stretchy", "toxtricityampedform": "toxtricity",
          "toxtricitylowkeyform": "toxtricity-low-key"}


def cle(texte):
    return re.sub(r"[^a-z0-9]", "", texte.lower())


def orthographe(libelle):
    """Libellés de goût de JoeNesTeam : fautes de frappe et majuscules au milieu corrigées,
    le mot lui-même ne change pas (« Pour s’entraïner » -> « Pour s’entraîner »)."""
    libelle = libelle.replace("entraïner", "entraîner").replace("épanouïes", "épanouies")
    mots = libelle.split(" ")
    return " ".join([mots[0]] + [m.lower() for m in mots[1:]])


def p_nom(pokemon, pid):
    return next(p["en"] for p in pokemon if p["id"] == pid)


def liste(valeur):
    """Pokopia Guide donne parfois une chaîne, parfois une liste."""
    if not valeur:
        return []
    return [valeur] if isinstance(valeur, str) else list(valeur)


def main():
    rapport = []
    # ---- goûts
    fr_par_en = {r["en"]: orthographe(r["fr"]) for r in CORR.values()}
    icone_vers_en = {i: r["en"] for i, r in CORR.items()}
    gouts = [{"id": k, "en": g["titre"].replace(" Favorites", ""), "fr": fr_par_en.get(k)}
             for k, g in sorted(SER["gouts"].items())]

    # ---- objets : base Pokopia Guide (noms fr/en), goûts Serebii + JoeNesTeam
    pg_fr = {o["id"]: o for o in PG["objets_fr"]}
    pg_par_cle = {}
    for o in PG["objets_en"]:
        pg_par_cle.setdefault(cle(o["name"]), o)
    objets = {}

    def objet(slug, nom_en=None):
        k = cle(slug)
        if k not in objets:
            pg = pg_par_cle.get(k)
            fr = pg_fr.get(pg["id"]) if pg else None
            objets[k] = {"id": k, "en": pg["name"] if pg else nom_en, "fr": fr["name"] if fr else None,
                         "usage": None, "gouts": set(), "testes": set(), "environnements": set(),
                         "obtention": (liste(fr["obtain"]) + liste(fr["recipe"])) if fr else [],
                         "materiaux": [f"{m['name']} ×{m['count']}" for m in fr["materials"]] if fr else [],
                         "_src": []}
        o = objets[k]
        if nom_en and not o["en"]:
            o["en"] = nom_en
        return o

    for k, g in SER["gouts"].items():
        for item in g["objets"]:
            o = objet(item["slug"], item["nom"])
            o["_src"].insert(0, f"{SEREBII_BASE}/pokemonpokopia/items/{item['slug']}.png")
            o["gouts"].add(k)
            o["usage"] = o["usage"] or USAGES.get(item["usage"], "autre" if item["usage"] else None)
    for t in JNT[1:]:
        usage = USAGES_JNT.get(t["entetes"][1])
        for ligne in t["lignes"]:
            for item in ligne[1]["objets"]:
                o = objet(item["image"])
                o["_src"].append(item.get("src"))
                o["usage"] = o["usage"] or usage
                if usage and o["usage"] != usage:
                    rapport.append(f"Objet `{o['en'] or item['image']}` : usage {o['usage']} chez Serebii, {usage} chez JoeNesTeam")
                for icone in item["icones"]:
                    if icone in icone_vers_en:
                        o["gouts"].add(icone_vers_en[icone])
                        o["testes"].add(icone_vers_en[icone])
    for ligne in JNT[0]["lignes"]:
        env = ENV_JNT.get(ligne[0]["texte"])
        for item in ligne[1]["objets"]:
            o = objet(item["image"])
            o["_src"].append(item.get("src"))
            o["environnements"].add(env)
            for icone in item["icones"]:
                if icone in icone_vers_en:
                    o["gouts"].add(icone_vers_en[icone])
                    o["testes"].add(icone_vers_en[icone])
    conseils_env = {ENV_JNT[l[0]["texte"]]: l[1]["texte"].strip(" +") or None for l in JNT[0]["lignes"]}

    # ---- Pokémon
    pg_pokemon = {p["slug"]: p for p in PG["pokemon_fr"]}
    pg_par_cle_pk = {cle(s): p for s, p in pg_pokemon.items()}
    groupes = {}
    for page, groupe in (("availablepokemon", "base"), ("eventpokedex", "evenement"), ("basinpokedex", "dlc")):
        for num, slug, nom in SER["listes"][page]:
            groupes[slug] = (groupe, num, nom)
    pokemon = []
    for f in SER["pokemon"]:
        slug = f["slug"]
        groupe, num, nom_en = groupes[slug]
        stats = f["stats"][0] if f["stats"] else {"habitat": [], "gouts": [], "saveur": []}
        if len(f["stats"]) != 1:
            rapport.append(f"{nom_en} : {len(f['stats'])} blocs de goûts sur sa fiche Serebii")
        pg = pg_pokemon.get(FORMES.get(slug, "")) or pg_par_cle_pk.get(cle(slug))
        # « Sweet flavors » ou « Sweet Flavors » selon les fiches
        saveur = stats["saveur"][0].split()[0].capitalize() if stats["saveur"] and stats["saveur"][0] else None
        env = stats["habitat"][0] if stats["habitat"] else None
        p = {"id": slug, "num": num, "fr": pg["name"] if pg else None, "en": nom_en, "groupe": groupe,
             "environnement": env, "gouts": stats["gouts"], "saveur": SAVEURS[saveur][0] if saveur in SAVEURS else None,
             "a_verifier": []}
        if not pg:
            rapport.append(f"{nom_en} : absent de Pokopia Guide (pas de nom français)")
        else:
            pg_gouts = [cle(x) for x in pg["pokopia"].get("favorites") or []]
            pg_obj = sorted(x for x in pg_gouts if not x.endswith("flavors"))
            pg_sav = [x for x in pg_gouts if x.endswith("flavors")]
            if pg_gouts and sorted(p["gouts"]) != pg_obj:
                diff = sorted(set(p["gouts"]) ^ set(pg_obj))
                p["a_verifier"].append("goûts")
                rapport.append(f"{nom_en} : goûts différents entre Serebii et Pokopia Guide ({', '.join(diff)})")
            if pg_sav and saveur and pg_sav[0] != cle(saveur + "flavors"):
                p["a_verifier"].append("saveur")
                rapport.append(f"{nom_en} : saveur {saveur} chez Serebii, {pg_sav[0]} chez Pokopia Guide")
            pg_env = ENV_PG.get(pg["pokopia"].get("environmentPreference"))
            if pg_env and env and pg_env != env:
                p["a_verifier"].append("environnement")
                rapport.append(f"{nom_en} : environnement {env} chez Serebii, {pg_env} chez Pokopia Guide")
            if not pg_gouts:
                rapport.append(f"{nom_en} : pas de goûts chez Pokopia Guide (Serebii seul)")
        if len(p["gouts"]) != 5 or not p["saveur"] or not env:
            p["a_verifier"].append("incomplet")
            rapport.append(f"{nom_en} : fiche Serebii incomplète ({len(p['gouts'])} goûts, saveur {saveur}, environnement {env})")
        src = SER["images_pokemon"].get(slug)
        p["_src"] = [SEREBII_BASE + src] if src else []
        pokemon.append(p)

    # familles d'évolution, d'après les liens « évolue de / en » de Pokopia Guide
    vers_id = {}
    for p in pokemon:
        pg = pg_pokemon.get(FORMES.get(p["id"], "")) or pg_par_cle_pk.get(cle(p["id"]))
        if pg:
            vers_id[pg["slug"]] = p["id"]
    parent = {p["id"]: p["id"] for p in pokemon}

    def racine(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for slug_pg, pid in vers_id.items():
        info = pg_pokemon[slug_pg]["pokopia"]
        liens = [info.get("evolvesFrom")] + list(info.get("evolvesTo") or [])
        for autre in filter(None, liens):
            if autre in vers_id:
                a, b = racine(pid), racine(vers_id[autre])
                if a != b:
                    parent[max(a, b)] = min(a, b)
            else:
                rapport.append(f"{p_nom(pokemon, pid)} : évolution « {autre} » inconnue de Serebii")
    for p in pokemon:
        p["famille"] = racine(p["id"])

    # même goût vu depuis la page du Pokémon et depuis la page du goût (Serebii contre Serebii)
    par_gout = {k: set(g["pokemon"]) for k, g in SER["gouts"].items()}
    for p in pokemon:
        for k in p["gouts"]:
            if p["id"] not in par_gout.get(k, set()):
                rapport.append(f"{p['en']} : aime « {k} » sur sa fiche, absent de la page du goût")
    connus = {p["id"] for p in pokemon}
    for k, slugs in par_gout.items():
        for s in sorted(slugs - connus):
            rapport.append(f"Page du goût « {k} » : Pokémon `{s}` sans fiche lue")
        for s in sorted(slugs & connus):
            if k not in next(p for p in pokemon if p["id"] == s)["gouts"]:
                rapport.append(f"Page du goût « {k} » cite `{s}`, mais sa fiche ne le dit pas")

    # ---- saveurs
    noms_fr = {cle(o["name"]): pg_fr[o["id"]]["name"] for o in PG["objets_en"] if o["id"] in pg_fr}
    saveurs = [{"id": fr, "en": en, "conseil": noms_fr.get(cle(conseil), conseil),
                "_src": [f"{SEREBII_BASE}/pokemonpokopia/items/{cle(conseil)}.png"]}
               for en, (fr, conseil) in SAVEURS.items()]

    liste_objets = []
    for o in sorted(objets.values(), key=lambda o: (o["fr"] or o["en"] or o["id"]).lower()):
        if not o["gouts"] and not o["environnements"]:
            continue
        if not o["fr"]:
            rapport.append(f"Objet `{o['en'] or o['id']}` : pas de nom français trouvé")
        liste_objets.append({**o, "gouts": sorted(o["gouts"]), "testes": sorted(o["testes"]),
                             "environnements": sorted(o["environnements"])})

    donnees = {
        "version": date.today().isoformat(),
        "sources": {
            "serebii": "https://www.serebii.net/pokemonpokopia/",
            "pokopiaguide": "https://pokopiaguide.com/fr/pokedex",
            "joenesteam": "https://www.joenesteam.fr/pokopia-preferences-exceptionnel/",
        },
        "environnements": [{"id": k, "fr": v, "conseil": conseils_env.get(k)} for k, v in ENVIRONNEMENTS.items()],
        "saveurs": saveurs,
        "gouts": gouts,
        "pokemon": sorted(pokemon, key=lambda p: (p["num"], p["id"])),
        "objets": liste_objets,
    }
    SORTIE.parent.mkdir(exist_ok=True)
    # images : l'adresse d'origine part dans le cache ; l'appli sait seulement si le fichier existe
    sources = {"pokemon": {}, "objets": {}, "saveurs": {}}
    for genre, liste_ in (("pokemon", donnees["pokemon"]), ("objets", donnees["objets"]), ("saveurs", donnees["saveurs"])):
        for x in liste_:
            fichier = cle(x["id"])
            sources[genre][fichier] = [u for u in dict.fromkeys(x.pop("_src")) if u]
            x["img"] = fichier if (IMAGES / genre / f"{fichier}.webp").exists() else None
            if not x["img"]:
                rapport.append(f"{'Pokémon' if genre == 'pokemon' else 'Objet'} `{x.get('en') or x['id']}` : pas d'image")
    SOURCES_IMAGES.write_text(json.dumps(sources, ensure_ascii=False, indent=1), encoding="utf-8")
    SORTIE.write_text(json.dumps(donnees, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    compte = {g: sum(1 for p in pokemon if p["groupe"] == g) for g in ("base", "evenement", "dlc")}
    a_verifier = [p for p in pokemon if p["a_verifier"]]
    entete = [
        "# Vérification des données",
        "",
        f"Généré par `outils/construire_donnees.py` le {date.today().strftime('%d/%m/%Y')}. Ne pas modifier à la main : relancer le script.",
        "",
        f"- Pokémon : {len(pokemon)} ({compte['base']} jeu de base, {compte['evenement']} événement, {compte['dlc']} DLC Bubbly Basin)",
        f"- Pokémon avec un point à vérifier en jeu : {len(a_verifier)}",
        f"- Objets utiles (au moins un goût ou un environnement) : {len(liste_objets)}, dont "
        f"{sum(1 for o in liste_objets if o['testes'])} testés par JoeNesTeam, "
        f"{sum(1 for o in liste_objets if not o['fr'])} sans nom français",
        f"- Goûts : {len(gouts)}, tous reliés à leur nom français ({sum(1 for g in gouts if g['fr'])})",
        "",
        "## Désaccords et manques",
        "",
    ]
    RAPPORT.write_text("\n".join(entete + [f"- {l}" for l in rapport]) + "\n", encoding="utf-8")
    print("\n".join(entete[4:9]))
    print(len(rapport), "lignes dans le rapport ;", round(SORTIE.stat().st_size / 1024), "Ko de données")


if __name__ == "__main__":
    main()
