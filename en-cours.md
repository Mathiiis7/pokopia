# En cours - Pokopia

Mis à jour le 29/10/2026.

## Où on en est
- **Appli écrite et testée en local** (direction A + C choisie par Mathis) : `index.html`, `style.css`, `js/app.js` (pages), `js/groupes.js` (calcul), `js/calcul.js` (calcul à part de la page), `js/etat.js` (coches dans le navigateur), `sw.js`, `manifest.webmanifest`, `icones/` (maison blanche sur vert forêt, `outils/icones.mjs`). Essai local : configuration « pokopia » dans `.claude/launch.json` (port 8642).
- Vérifié dans le navigateur, ordinateur et téléphone (375 px), clair et sombre : cocher, recherche, Mes Pokémon / Tout le jeu, filtres, détail d'une maison, objets posés, « Je l'ai construite » (la maison ne bouge plus, objets compris), pas de défilement de côté.
- Données : `donnees/pokopia.json`, avec les familles d'évolution. Jeu de base : 92 maisons, toutes comblées, 3,2 objets en moyenne, 0,2 s.
- Dépôt git local, **rien de commité**, pas encore sur GitHub.

## Ce qui reste
1. Mise en ligne : créer `Mathiiis7/pokopia` (public, GitHub Pages), commit, push, tester l'adresse sur téléphone. Attend le feu vert de Mathis.
2. Partage téléphone/ordi : Supabase. Idée retenue pour lui épargner les réglages d'e-mail : un « code de partie » secret (pas de connexion par e-mail), deux fonctions SQL lire/écrire. Mathis crée le compte et le projet, colle un script SQL, me donne l'adresse du projet et la clé publique.
3. Ajouter Pokopia à `qg/structure/projets.md` et une ligne dans `qg/savoir/skills-et-extensions.md` si besoin (rien d'installé).

## Décisions et pourquoi
- Familles d'évolution ensemble (choix de Mathis, voir `CLAUDE.md`).
- Les trois objets obligatoires (repos, déco, jouet) sont choisis en premier : souvent ils suffisent.
- Pas d'images de Pokémon : elles appartiennent à Nintendo, et le site est public. Les noms suffisent pour l'instant.
- 193 objets sans nom français : affichés en anglais, marqués « nom anglais ».
