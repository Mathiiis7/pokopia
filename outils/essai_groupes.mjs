// Essai du calcul des maisons sur les vraies données, hors navigateur.
// Usage : node outils/essai_groupes.mjs [base|tout]   (base = sans DLC ni événement)
import { readFileSync } from "node:fs";
import { formerMaisons } from "../js/groupes.js";

const d = JSON.parse(readFileSync(new URL("../donnees/pokopia.json", import.meta.url), "utf-8"));
const mode = process.argv[2] || "base";
const pokemon = d.pokemon.filter((p) => p.gouts.length === 5 && (mode === "tout" || p.groupe === "base"));
const tailles = new Map();
for (const p of d.pokemon) tailles.set(p.famille, (tailles.get(p.famille) || 0) + 1);
for (const p of pokemon) p.tailleFamille = tailles.get(p.famille);
const fr = Object.fromEntries(d.gouts.map((g) => [g.id, g.fr]));

const debut = performance.now();
const maisons = formerMaisons(pokemon, d.objets);
const duree = Math.round(performance.now() - debut);

const nb = maisons.map((m) => m.objets.length);
const pleines = maisons.filter((m) => m.habitants.length === 4).length;
console.log(`${pokemon.length} Pokémon, ${maisons.length} maisons (${pleines} pleines), ${duree} ms`);
console.log(`objets par maison : moyenne ${(nb.reduce((a, b) => a + b, 0) / nb.length).toFixed(1)}, min ${Math.min(...nb)}, max ${Math.max(...nb)}`);
console.log(`maisons avec un Pokémon pas comblé : ${maisons.filter((m) => m.manques.length).length}`);
for (const m of maisons.slice(0, Number(process.argv[3] || 4))) {
  console.log(`\n[${m.environnement}] ${m.habitants.map((p) => p.fr || p.en).join(", ")} : ${m.objets.length} objets`);
  for (const o of m.objets) {
    const pour = m.habitants.filter((p) => o.gouts.some((g) => p.gouts.includes(g))).map((p) => p.fr || p.en);
    console.log(`  - ${o.fr || o.en || o.id} (${o.usage}) : ${o.gouts.filter((g) => m.habitants.some((p) => p.gouts.includes(g))).map((g) => fr[g]).join(", ")} -> ${pour.join(", ")}`);
  }
}
