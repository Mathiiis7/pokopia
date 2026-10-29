// Ce que Mathis a fait dans sa partie : Pokémon cochés, maisons construites, objets posés, réglages.
// Gardé dans le navigateur ; le partage entre téléphone et ordinateur viendra s'y brancher.

const CLE = "pokopia-etat";

const DEFAUT = {
  coches: [],         // ids des Pokémon obtenus
  construites: [],    // maisons bloquées : listes d'ids
  poses: {},          // clé de maison -> ids des objets posés
  choix: {},          // clé de maison -> objets choisis à la main (remplaçants)
  mode: "mes",        // « mes » : mes Pokémon cochés ; « tout » : tout le jeu
  dlc: false,         // montrer les Pokémon de la zone DLC (Bubbly Basin)
  modifie: 0,         // horodatage de la dernière modification
};

let etat = lire();
const abonnes = new Set();

function lire() {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? nettoyer(JSON.parse(brut)) : { ...DEFAUT };
  } catch {
    return { ...DEFAUT };
  }
}

// « Je ne l'ai pas » n'existe plus (29/10/2026) : les objets marqués redeviennent disponibles.
function nettoyer(e) {
  const { sansObjets, ...reste } = e;
  return { ...DEFAUT, ...reste };
}

function ecrire() {
  try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* navigateur privé : rien de grave */ }
}

export function obtenir() {
  return etat;
}

// changer(e => { ... }) : modifie l'état, l'enregistre et prévient les abonnés.
export function changer(modif) {
  const copie = structuredClone(etat);
  modif(copie);
  copie.modifie = Date.now();
  etat = copie;
  ecrire();
  for (const f of abonnes) f(etat, "local");
}

// Remplace tout l'état (venu d'un autre appareil).
export function remplacer(nouveau) {
  etat = nettoyer(nouveau);
  ecrire();
  for (const f of abonnes) f(etat, "distant");
}

export function abonner(f) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

export const cleMaison = (ids) => [...ids].sort().join("+");
