// Vérifie que deux appareils ne perdent rien : node outils/test-fusion.mjs
import assert from "node:assert/strict";
import { fusionner, memeContenu } from "../js/fusion.js";

const vide = { coches: [], construites: [], poses: {}, choix: {}, mode: "mes", dlc: false, modifie: 0 };
const avec = (e) => ({ ...vide, ...e });
const trie = (l) => [...l].sort();

// Serveur et appareils simulés : même échange que js/partage.js.
function monde(depart = vide) {
  let serveur = depart;
  return {
    get serveur() { return serveur; },
    appareil() {
      let etat = depart, base = depart;
      return {
        get etat() { return etat; },
        changer(f, quand) { etat = { ...structuredClone(etat), modifie: quand }; f(etat); },
        echanger() {
          const fusion = fusionner(base, etat, serveur);
          etat = fusion;
          if (!memeContenu(fusion, serveur)) serveur = fusion;
          base = fusion;
        },
      };
    },
  };
}

const essais = {
  "coches sur les deux appareils sans s'être relus": () => {
    const m = monde(), tel = m.appareil(), ordi = m.appareil();
    tel.changer((e) => e.coches.push("pikachu"), 1000); tel.echanger();
    ordi.changer((e) => e.coches.push("bulbizarre"), 11000); ordi.echanger();
    tel.echanger();
    assert.deepEqual(trie(tel.etat.coches), ["bulbizarre", "pikachu"]);
    assert.deepEqual(trie(ordi.etat.coches), ["bulbizarre", "pikachu"]);
  },
  "coche pas encore envoyée quand l'autre a changé (téléphone verrouillé tout de suite)": () => {
    const m = monde(), tel = m.appareil(), ordi = m.appareil();
    tel.changer((e) => e.coches.push("pikachu"), 1000);
    ordi.changer((e) => e.coches.push("bulbizarre"), 5000); ordi.echanger();
    tel.echanger(); ordi.echanger();
    assert.deepEqual(trie(tel.etat.coches), ["bulbizarre", "pikachu"]);
    assert.deepEqual(trie(ordi.etat.coches), ["bulbizarre", "pikachu"]);
  },
  "une coche enlevée ne revient pas": () => {
    const m = monde(avec({ coches: ["pikachu", "bulbizarre"] })), tel = m.appareil(), ordi = m.appareil();
    tel.changer((e) => { e.coches = ["bulbizarre"]; }, 1000); tel.echanger();
    ordi.changer((e) => e.coches.push("salameche"), 2000); ordi.echanger();
    tel.echanger();
    assert.deepEqual(trie(tel.etat.coches), ["bulbizarre", "salameche"]);
    assert.deepEqual(trie(ordi.etat.coches), ["bulbizarre", "salameche"]);
  },
  "l'heure fausse d'un appareil ne change rien": () => {
    const m = monde(), tel = m.appareil(), ordi = m.appareil();
    tel.changer((e) => e.coches.push("pikachu"), 999999999); tel.echanger();
    ordi.changer((e) => e.coches.push("bulbizarre"), 5); ordi.echanger();
    tel.echanger();
    assert.deepEqual(trie(tel.etat.coches), ["bulbizarre", "pikachu"]);
  },
  "appareils déjà branchés, sans base : rien de perdu": () => {
    const r = fusionner(null, avec({ coches: ["a"], poses: { m: ["x"] } }), avec({ coches: ["b"], poses: { m: ["y"] } }));
    assert.deepEqual(trie(r.coches), ["a", "b"]);
    assert.deepEqual(trie(r.poses.m), ["x", "y"]);
  },
  "objets posés et retirés dans la même maison": () => {
    const m = monde(avec({ poses: { maison: ["lit", "banc"] } })), tel = m.appareil(), ordi = m.appareil();
    tel.changer((e) => { e.poses.maison = ["lit"]; }, 1); tel.echanger();
    ordi.changer((e) => e.poses.maison.push("lampe"), 2); ordi.echanger();
    tel.echanger();
    assert.deepEqual(trie(tel.etat.poses.maison), ["lampe", "lit"]);
  },
  "maisons construites : retirée reste retirée, un Pokémon dans une seule maison": () => {
    const h1 = { habitants: ["a", "b"], objets: [] }, h2 = { habitants: ["c", "d"], objets: [] };
    const m = monde(avec({ construites: [h1, h2] })), tel = m.appareil(), ordi = m.appareil();
    tel.changer((e) => { e.construites = [h2]; }, 1); tel.echanger();
    ordi.changer((e) => { e.construites = e.construites.filter((v) => v.habitants[0] !== "c").concat([{ habitants: ["c", "e"], objets: [] }]); }, 2);
    ordi.echanger(); tel.echanger();
    assert.deepEqual(tel.etat.construites, [{ habitants: ["c", "e"], objets: [] }]);
    assert.ok(memeContenu(tel.etat, ordi.etat));
  },
  "rien de changé : rien à écrire, rien à redessiner": () => {
    const e = avec({ coches: ["b", "a"], poses: { m: ["x"] } });
    const r = fusionner(e, { ...e, modifie: 5 }, { ...e, coches: ["a", "b"], modifie: 9 });
    assert.ok(memeContenu(r, e));
  },
  "réglages : celui qu'on vient de changer gagne": () => {
    const m = monde(), tel = m.appareil(), ordi = m.appareil();
    tel.changer((e) => { e.dlc = true; }, 1); tel.echanger();
    ordi.echanger();
    assert.equal(ordi.etat.dlc, true);
  },
};

let rates = 0;
for (const [nom, f] of Object.entries(essais)) {
  try { f(); console.log("ok   ", nom); }
  catch (err) { rates++; console.log("RATÉ ", nom, "\n", err.message); }
}
console.log(rates ? `${rates} essai(s) raté(s)` : `${Object.keys(essais).length} essais réussis`);
process.exit(rates ? 1 : 0);
