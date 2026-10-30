# Pokopia

Guide perso de Mathis pour le jeu Pokémon Pokopia (Switch 2, mars 2026) : il coche ses Pokémon, l'appli forme des maisons de 4 qui partagent leurs goûts et dit quels objets y poser. Pour lui seul, en français, sur téléphone et ordinateur.

- Adresse prévue : https://mathiiis7.github.io/pokopia (GitHub Pages, dépôt `Mathiiis7/pokopia`). Le nom ne change plus.
- Charte graphique des projets perso, vert forêt : `~/Documents/0-Claude/0-QG/qg/structure/charte-graphique.md`, à lire avant tout style.
- Brief de départ : `~/Documents/0-Claude/0-QG/qg/structure/brief-pokopia.md`.

## Les données : ne rien inventer
- Tout vient de trois sources, reliées par des scripts dans `outils/` : Serebii (goûts, habitat idéal, objets par goût), Pokopia Guide (noms français, second avis sur les goûts), JoeNesTeam (goûts en français, objets testés en jeu). Détail et règles du jeu : `docs/recherche-jeu.md`, `docs/regles-joenesteam.md`.
- Pour mettre à jour : `python -I outils/telecharger_serebii.py`, puis `lire_serebii.py`, `lire_pokopiaguide.py`, `lire_joenesteam.py`, `correspondance_gouts.py`, `construire_donnees.py`. Les pages téléchargées restent dans `outils/cache/` (ignoré par git) ; pour Pokopia Guide et JoeNesTeam, les retélécharger à la main avec `curl` (adresses dans les scripts).
- Images (voulues par Mathis, le site n'est que pour lui) : `outils/telecharger_images.py` après `construire_donnees.py`, puis relancer `construire_donnees.py` (il note quelles images existent). Serebii d'abord, JoeNesTeam ensuite ; WebP 96 px (Pokémon) et 80 px (objets) dans `images/`. Les images de Pokopia Guide sont souvent des points d'interrogation : ne pas les prendre.
- `donnees/pokopia.json` et `docs/verification-donnees.md` sont générés : ne jamais les corriger à la main. Un désaccord entre sources reste signalé, pas tranché.
- Les goûts français sont reliés aux anglais par leurs objets communs (`correspondance_gouts.py`), jamais traduits à la main.

## Décisions de Mathis (29/10/2026)
- Maisons de 4 Pokémon du **même environnement** (cohabiter ailleurs est possible mais pas idéal).
- **Les familles d'évolution vivent ensemble** : une famille de 3 ou 4 a sa maison à elle (une maison de 3, « c'est pas grave ») ; une famille de 2 est complétée par les plus compatibles ; une famille dont l'environnement diffère est séparée par environnement. Liens d'évolution : Pokopia Guide.
- Une maison « construite » garde ses habitants et ses objets ; le calcul ne la touche plus.
- Groupes calculés au choix sur ses Pokémon cochés ou sur tout le jeu ; il n'a pas la zone DLC (Bubbly Basin).
- Coches partagées automatiquement entre téléphone et ordi, avec un compte ; icône sur l'écran d'accueil.
- Jeu en français : noms français partout, l'anglais seulement quand le français manque, signalé.

## Partage entre appareils
- Supabase, sans connexion par e-mail : un « code de partie » secret de 24 caractères, deux fonctions SQL (`docs/supabase.sql`). Adresse et clé publique dans `js/config.js` ; vides, le partage est caché.
- Ne jamais renvoyer la partie sans l'avoir relue : la version « la plus récente gagne » effaçait les coches de l'autre appareil (30/10/2026). On réunit les changements à partir de la dernière version commune (`js/fusion.js`), sans se fier à l'heure des appareils. Tests : `node outils/test-fusion.mjs`.
- Essai sans compte : `node outils/faux-supabase.mjs` et l'adresse `http://localhost:8643` dans `js/config.js`, **à remettre vide avant de commiter**.

## Rangement
- À la racine : `CLAUDE.md`, `en-cours.md`, `index.html` et ce que GitHub Pages sert, `_config.yml` (exclut de la mise en ligne `docs/`, `outils/`, `archives/` et ces deux fichiers), `.gitignore`.
- `donnees/` : les données lues par l'appli ; `images/pokemon/`, `images/objets/` : leurs images ; `polices/`, `icones/` (servis en ligne).
- `docs/`, `outils/`, `archives/` : base commune (`qg/structure/rangement.md`).
