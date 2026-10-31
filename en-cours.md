# En cours - Pokopia

Mis à jour le 31/10/2026.

## Où on en est
- **En ligne** : https://mathiiis7.github.io/pokopia (dépôt public `Mathiiis7/pokopia`, GitHub Pages, publié à chaque push). Première version finie selon le brief : vérifiée en ligne sur ordinateur et en largeur téléphone.
- Pages : Maisons (mes Pokémon / tout le jeu, filtres par environnement), détail d'une maison (qui est comblé, objets à poser, comment les avoir, baie à donner, « Je l'ai construite »), Pokémon (à cocher), Objets (par goût).
- Images de tous les Pokémon (369) et objets (735), 5 Mo en tout.
- **Partage entre appareils branché** sur Supabase (projet `xcundtthsdsftbrdxbhf`, clé publique dans `js/config.js`) et testé en ligne. Deux parties d'essai laissées dans la table `parties` (codes `essai-claude-…` et `v9cbXQ…`) : sans effet, supprimables dans Table Editor.

- Ajouté le 29/10 au soir : image de la baie à donner ; icônes des goûts ; cartes compactes (revue `docs/revue-usage.md`, points 1 à 11 faits) ; **toucher un objet dans le détail montre tout ce qui peut le remplacer** (seul, ou à deux si aucun ne suffit), le choix est gardé par maison (`choix` dans l'état). « Je ne l'ai pas » a été retiré à la demande de Mathis : il voulait surtout choisir un objet plus simple, et l'ancien marquage est effacé au chargement.
- Question ouverte : un lit par Pokémon ou un seul ? La seule preuve (vidéo [A] de JoeNesTeam) : un lit pour deux grands Pokémon a suffi. Pas vérifié pour 4.

- 30/10 : partage réparé (`js/fusion.js`) : les changements des deux appareils sont réunis au lieu de s'écraser, envoi en 0,5 s et à la fermeture de la page, lecture toutes les 10 s et au retour sur la fenêtre, le champ accepte le lien entier. Testé à deux navigateurs sur le faux serveur, puis en ligne sur le vrai service. Une partie d'essai de plus dans la table `parties` (code `vchB2i…`), supprimable. Pas essayé sur un vrai téléphone.

- 31/10 : en ligne (commit `1509e94`). Une famille de 2 ne cohabite qu'avec une autre famille de 2, sinon elle reste à deux. Les familles de 4 au plus dont l'environnement diffère vivent ensemble (Toudoudou, Rondoudou, Grodoudou) ; le détail signale qui n'est pas dans son environnement idéal ; Évoli reste réparti. Mention vue en local seulement, pas essayé sur un vrai téléphone.
- 31/10, en ligne : deux familles ne se mélangent plus, les Pokémon sans évolution se regroupent entre eux ou rejoignent une famille (règle dans `CLAUDE.md`). Sur le jeu de base : 116 maisons au lieu de 93, 12 familles avec invité. PokeAPI complète les évolutions absentes de Pokopia Guide (accord de Mathis : Sancoki avec Tritosor, Salarsen Grave avec Toxizap, familles DLC et événement) ; 50 Pokémon restent sans évolution.
- Essais dans l'appli : le navigateur intégré a un code de partage sur `localhost` et `127.0.0.1`, changer l'état y écrit dans le vrai Supabase. Utiliser `http://essai.localhost:8642`, sans code.

## Ce qui reste (rien d'obligatoire)
- Mathis doit créer son code sur un premier appareil (page Pokémon, « Mes appareils ») puis ouvrir le lien sur l'autre, et ajouter l'icône à l'écran d'accueil.
- Ajouter Pokopia à `qg/structure/projets.md` (à faire depuis le QG).
- 193 objets sans nom français, affichés en anglais.

## Décisions et pourquoi
- Familles d'évolution ensemble, même environnement, maisons construites bloquées (objets compris) : voir `CLAUDE.md`.
- Partage par code secret plutôt que par e-mail : pas de réglage d'e-mail, marche dans l'icône d'écran d'accueil de l'iPhone (où un lien reçu par e-mail s'ouvrirait dans Safari, à part).
- L'appli redemande toujours les fichiers au serveur (`sw.js`, « no-cache ») : sans ça, GitHub Pages servait l'ancienne version pendant 10 minutes.
