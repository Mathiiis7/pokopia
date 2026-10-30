// Réunit ce qui a changé sur cet appareil et sur l'autre, sans dépendre de l'heure des appareils.
// base : la dernière version sur laquelle les deux étaient d'accord ; ce qui en diffère a été changé.
// Sans base (appareil branché avant cette règle) : rien n'est considéré comme retiré.
import { cleMaison } from "./etat.js";

const membres = (v) => (Array.isArray(v) ? v : v.habitants);
const cleDe = (v) => cleMaison(membres(v));

// Forme comparable : l'ordre des listes et des clés ne compte pas, ni l'heure de modification.
function forme(x) {
  if (Array.isArray(x)) return `[${x.map(forme).sort().join(",")}]`;
  if (x && typeof x === "object") {
    return `{${Object.keys(x).filter((k) => k !== "modifie").sort().map((k) => `${k}:${forme(x[k])}`).join(",")}}`;
  }
  return JSON.stringify(x) ?? "";
}
export const memeContenu = (a, b) => forme(a) === forme(b);

function fusionListe(b, l, d) {
  const base = new Set(b), local = new Set(l);
  const retires = new Set(b.filter((x) => !local.has(x)));
  return [...new Set([...d.filter((x) => !retires.has(x)), ...l.filter((x) => !base.has(x))])];
}

function fusionPoses(b, l, d) {
  const r = {};
  for (const k of new Set([...Object.keys(l), ...Object.keys(d)])) {
    const liste = fusionListe(b[k] || [], l[k] || [], d[k] || []);
    if (liste.length) r[k] = liste;
  }
  return r;
}

// Un choix d'objets par maison : celui qu'on a changé ici, sinon celui de l'autre appareil.
function fusionChoix(b, l, d) {
  const r = { ...d };
  for (const k of new Set([...Object.keys(b), ...Object.keys(l)])) {
    if (memeContenu(b[k], l[k])) continue;
    if (l[k] === undefined) delete r[k]; else r[k] = l[k];
  }
  return r;
}

function fusionConstruites(b, l, d) {
  const base = new Map(b.map((v) => [cleDe(v), v]));
  const local = new Set(l.map(cleDe));
  const retirees = new Set(b.map(cleDe).filter((k) => !local.has(k)));
  let r = d.filter((v) => !retirees.has(cleDe(v)));
  for (const v of l) {
    if (base.has(cleDe(v)) && memeContenu(base.get(cleDe(v)), v)) continue;
    // même règle qu'à la construction : un Pokémon n'habite qu'une maison
    r = r.filter((x) => !membres(x).some((id) => membres(v).includes(id))).concat([v]);
  }
  return r;
}

export function fusionner(base, local, distant) {
  const b = base || {};
  const reglage = (cle, defaut) => (local[cle] !== b[cle] ? local[cle] : distant[cle]) ?? defaut;
  return {
    coches: fusionListe(b.coches || [], local.coches || [], distant.coches || []),
    construites: fusionConstruites(b.construites || [], local.construites || [], distant.construites || []),
    poses: fusionPoses(b.poses || {}, local.poses || {}, distant.poses || {}),
    choix: fusionChoix(b.choix || {}, local.choix || {}, distant.choix || {}),
    mode: reglage("mode", "mes"),
    dlc: reglage("dlc", false),
    modifie: Math.max(local.modifie || 0, distant.modifie || 0),
  };
}
