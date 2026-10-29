# En cours - Pokopia

Mis à jour le 29/10/2026.

## Où on en est
- **En ligne** : https://mathiiis7.github.io/pokopia (dépôt public `Mathiiis7/pokopia`, GitHub Pages, publié à chaque push). Première version finie selon le brief : vérifiée en ligne sur ordinateur et en largeur téléphone.
- Pages : Maisons (mes Pokémon / tout le jeu, filtres par environnement), détail d'une maison (qui est comblé, objets à poser, comment les avoir, baie à donner, « Je l'ai construite »), Pokémon (à cocher), Objets (par goût).
- Images de tous les Pokémon (369) et objets (735), 5 Mo en tout.
- **Partage entre appareils branché** sur Supabase (projet `xcundtthsdsftbrdxbhf`, clé publique dans `js/config.js`) et testé en ligne. Deux parties d'essai laissées dans la table `parties` (codes `essai-claude-…` et `v9cbXQ…`) : sans effet, supprimables dans Table Editor.

## Ce qui reste (rien d'obligatoire)
- Mathis doit créer son code sur un premier appareil (page Pokémon, « Mes appareils ») puis ouvrir le lien sur l'autre, et ajouter l'icône à l'écran d'accueil.
- Ajouter Pokopia à `qg/structure/projets.md` (à faire depuis le QG).
- 193 objets sans nom français, affichés en anglais.

## Décisions et pourquoi
- Familles d'évolution ensemble, même environnement, maisons construites bloquées (objets compris) : voir `CLAUDE.md`.
- Partage par code secret plutôt que par e-mail : pas de réglage d'e-mail, marche dans l'icône d'écran d'accueil de l'iPhone (où un lien reçu par e-mail s'ouvrirait dans Safari, à part).
- L'appli redemande toujours les fichiers au serveur (`sw.js`, « no-cache ») : sans ça, GitHub Pages servait l'ancienne version pendant 10 minutes.
