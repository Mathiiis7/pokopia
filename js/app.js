// Pokopia : les pages (maisons, détail d'une maison, Pokémon, objets) et leur lien avec le calcul.
import { obtenir, changer, abonner, cleMaison } from "./etat.js";
import * as partage from "./partage.js";
import { facile } from "./groupes.js";

const USAGE = { repos: "repos", deco: "décoration", jouet: "jouet" };
const page = document.getElementById("page");

let D = null;                 // données : donnees/pokopia.json
const P = new Map(), O = new Map(), G = new Map(), ENV = new Map(), SAV = new Map();
let resultat = null;          // dernier calcul des maisons
let enCours = false;
let filtreEnv = "tous";       // filtre de la page Maisons (non gardé)
let filtrePk = { texte: "", vue: "tous" };
let filtreObjet = { texte: "", gout: "", limite: 60 };
let ouvert = null;            // détail d'une maison : objet dont on regarde les remplaçants
let tousRemplacants = false;  // … et s'il faut tous les montrer

// ---------- Outils ----------
const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const nomPk = (p) => p.fr || p.en;
const nomObjet = (o) => o.fr ? h(o.fr) : `${h(o.en || o.id)} <span class="marque-en bulle" tabindex="0" data-nom="Nom anglais : pas de nom français trouvé">EN</span>`;
const nomTexte = (o) => o.fr || o.en || o.id;
// bulle : le nom s'affiche au survol (ordinateur) ou au toucher (téléphone)
const bulle = (nom, contenu, classe = "") =>
  `<span class="bulle ${classe}" tabindex="0" role="img" aria-label="${h(nom)}" data-nom="${h(nom)}">${contenu}</span>`;
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
// images : copiées dans images/ par outils/telecharger_images.py ; sans image, une case vide
const imgPk = (p, t) => p.img
  ? `<img class="vignette" src="images/pokemon/${p.img}.webp" width="${t}" height="${t}" loading="lazy" alt="">`
  : `<span class="vignette vide-img" style="width:${t}px;height:${t}px" aria-hidden="true"></span>`;
// goût : son icône seule ; le nom s'affiche au survol (ordinateur) ou au toucher (téléphone)
const IMG_GOUT = new Map();
const icone = (g, extra = "") => {
  const nom = h(G.get(g));
  const img = IMG_GOUT.get(g);
  return `<span class="ico-gout bulle${extra}" tabindex="0" role="img" aria-label="${nom}" data-nom="${nom}">${img
    ? `<img src="images/gouts/${img}.webp" width="32" height="32" alt="">` : nom.slice(0, 2)}</span>`;
};
const imgSaveur = (s, t) => s?.img
  ? `<img class="vignette" src="images/saveurs/${s.img}.webp" width="${t}" height="${t}" loading="lazy" alt="">` : "";
const imgObjet = (o, t) => o.img
  ? `<img class="vignette" src="images/objets/${o.img}.webp" width="${t}" height="${t}" loading="lazy" alt="">`
  : `<span class="vignette vide-img" style="width:${t}px;height:${t}px" aria-hidden="true"></span>`;

function pokemonVisibles(e = obtenir()) {
  return D.pokemon.filter((p) => p.groupe !== "dlc" || e.dlc);
}

// Pokémon donnés au calcul : mes cochés, ou tout le jeu (sans les Pokémon d'événement,
// qu'on ne peut plus forcément avoir ; cochés, ils comptent dans « mes Pokémon »).
function pokemonACalculer(e = obtenir()) {
  const visibles = pokemonVisibles(e);
  if (e.mode === "mes") {
    const pris = new Set([...e.coches, ...e.construites.flatMap((v) => (Array.isArray(v) ? v : v.habitants))]);
    return visibles.filter((p) => pris.has(p.id));
  }
  return visibles.filter((p) => p.groupe !== "evenement");
}

// Objets d'une maison : ceux que Mathis a choisis à la main s'il l'a fait, sinon ceux du calcul.
function objetsDe(m, e = obtenir()) {
  const choix = e.choix?.[cleMaison(m.habitants)];
  if (choix && choix.every((id) => O.has(id) || id.startsWith("libre-"))) return choix;
  return m.objets;
}
const usageDe = (id) => O.get(id)?.usage || id.replace("libre-", "");

// Goûts couverts pour chaque habitant par une liste d'objets.
function couverture(habitants, ids) {
  const gouts = new Set(ids.flatMap((id) => O.get(id)?.gouts || []));
  return habitants.map((p) => p.gouts.filter((g) => gouts.has(g)));
}

// Tous les objets qui peuvent prendre la place de « ancien » : chacun reste à 4 goûts sur 5
// au moins, et la maison garde un repos, une décoration et un jouet. Les meilleurs d'abord.
function remplacants(habitants, ids, ancien) {
  const reste = ids.filter((id) => id !== ancien);
  const usageGarde = reste.some((id) => usageDe(id) === usageDe(ancien));
  const goutsReste = new Set(reste.flatMap((id) => O.get(id)?.gouts || []));
  const liste = [];
  for (const o of D.objets) {
    if (!USAGE[o.usage] || ids.includes(o.id)) continue;
    if (!usageGarde && o.usage !== usageDe(ancien)) continue;
    const g = new Set([...goutsReste, ...o.gouts]);
    const n = habitants.map((p) => p.gouts.filter((x) => g.has(x)).length);
    if (n.some((x) => x < 4)) continue;
    const utiles = o.gouts.filter((x) => habitants.some((p) => p.gouts.includes(x)));
    liste.push({ o, utiles, total: n.reduce((a, b) => a + b, 0), testes: utiles.filter((x) => o.testes.includes(x)).length, facile: facile(o) });
  }
  return liste.sort((a, b) => b.total - a.total || b.testes - a.testes || b.facile - a.facile ||
    (a.o.fr ? 0 : 1) - (b.o.fr ? 0 : 1) || nomTexte(a.o).localeCompare(nomTexte(b.o)));
}

// Quand aucun objet seul ne suffit : deux objets qui, ensemble, prennent la place de « ancien ».
function pairesRemplacantes(habitants, ids, ancien, max = 8) {
  const reste = ids.filter((id) => id !== ancien);
  const usageGarde = reste.some((id) => usageDe(id) === usageDe(ancien));
  const goutsReste = new Set(reste.flatMap((id) => O.get(id)?.gouts || []));
  const voulus = new Set(habitants.flatMap((p) => p.gouts));
  // seuls les objets qui apportent un goût voulu et absent comptent ; les plus utiles d'abord
  const utiles = D.objets
    .filter((o) => USAGE[o.usage] && !ids.includes(o.id))
    .map((o) => ({ o, apport: o.gouts.filter((g) => voulus.has(g) && !goutsReste.has(g)) }))
    .filter((x) => x.apport.length)
    .sort((a, b) => b.apport.length - a.apport.length || facile(b.o) - facile(a.o))
    .slice(0, 120);
  const paires = [];
  for (let i = 0; i < utiles.length; i++) {
    for (let j = i + 1; j < utiles.length; j++) {
      const a = utiles[i].o, b = utiles[j].o;
      if (!usageGarde && a.usage !== usageDe(ancien) && b.usage !== usageDe(ancien)) continue;
      const g = new Set([...goutsReste, ...a.gouts, ...b.gouts]);
      const n = habitants.map((p) => p.gouts.filter((x) => g.has(x)).length);
      if (n.some((x) => x < 4)) continue;
      paires.push({ a, b, total: n.reduce((s, x) => s + x, 0), facile: facile(a) + facile(b) });
    }
  }
  return paires.sort((x, y) => y.total - x.total || y.facile - x.facile).slice(0, max);
}

// ---------- Calcul, à part de la page ----------
let travailleur = null, demande = 0, objetsEnvoyes = false;
function calculer() {
  const e = obtenir();
  const n = ++demande;
  enCours = true;
  const message = { demande: n, pokemon: pokemonACalculer(e), construites: e.construites, essais: 3000 };
  if (!travailleur) {
    try {
      travailleur = new Worker(new URL("./calcul.js", import.meta.url), { type: "module" });
      travailleur.onmessage = ({ data }) => {
        if (data.demande !== demande) return; // une demande plus récente est partie
        resultat = data.maisons;
        enCours = false;
        afficher();
      };
    } catch {
      travailleur = null;
    }
  }
  if (travailleur) {
    if (!objetsEnvoyes) { message.objets = D.objets; objetsEnvoyes = true; }
    travailleur.postMessage(message);
  } else {
    // sans travailleur (très vieux navigateur) : calcul sur place
    import("./groupes.js").then(({ formerMaisons }) => {
      const m = formerMaisons(message.pokemon, D.objets, message.construites, message.essais);
      resultat = m.map((x) => ({ ...x, habitants: x.habitants.map((p) => p.id), objets: x.objets.map((o) => o.id) }));
      enCours = false;
      afficher();
    });
  }
  afficher();
}

// ---------- Page Maisons ----------
function carteMaison(m) {
  const e = obtenir();
  const habitants = m.habitants.map((id) => P.get(id));
  const cle = cleMaison(m.habitants);
  const poses = new Set(e.poses[cle] || []);
  const ids = objetsDe(m, e);
  const objets = ids.map((id) => O.get(id) || { id, libre: true, usage: id.replace("libre-", "") });
  const reste = objets.filter((o) => !poses.has(o.id)).length;
  const pasComble = couverture(habitants, ids).some((c) => c.length < 4);
  const saveurs = groupesSaveur(habitants);
  const famille = habitants.length > 1 && habitants.every((p) => p.famille === habitants[0].famille);
  return `
    <article class="maison${m.verrouillee ? " construite" : ""}">
      <div class="maison-tete">
        <span class="env">${h(ENV.get(m.environnement)?.fr)}</span>
        <span class="releve">${m.verrouillee ? "construite" : famille ? "une famille" : ""}${pasComble ? ' · <span class="ko">pas tous comblés</span>' : ""}</span>
        <span class="releve">${reste ? pluriel(reste, "objet à poser", "objets à poser") : "tout est posé"}</span>
      </div>
      <a class="habitants-lien" href="#maison/${encodeURIComponent(cle)}"><ul class="habitants">${habitants.map((p) => `<li>${imgPk(p, 64)}<span>${h(nomPk(p))}</span></li>`).join("")}</ul></a>
      <div class="mini">
        <div class="mini-objets" aria-label="À poser">${objets.map((o) => o.libre
          ? bulle(`un ${USAGE[o.usage]} au choix`, "", "rond-objet libre")
          : bulle(`${nomTexte(o)} (${USAGE[o.usage]})`, imgObjet(o, 40), `rond-objet${poses.has(o.id) ? " pose" : ""}`)).join("")}</div>
        <div class="mini-baies" aria-label="À donner une fois">${saveurs.map((s) =>
          bulle(`${s.conseil} → ${s.noms.join(", ")}`, imgSaveur(s, 34), "rond-baie")).join("")}</div>
      </div>
      <a class="secondaire voir" href="#maison/${encodeURIComponent(cle)}">Voir le détail</a>
    </article>`;
}

function groupesSaveur(habitants) {
  const parSaveur = new Map();
  for (const p of habitants) {
    if (!p.saveur) continue;
    if (!parSaveur.has(p.saveur)) parSaveur.set(p.saveur, []);
    parSaveur.get(p.saveur).push(nomPk(p));
  }
  return [...parSaveur].map(([saveur, noms]) => ({ saveur, conseil: SAV.get(saveur).conseil, img: SAV.get(saveur).img, noms }));
}

function maisonsFiltrees() {
  return (resultat || []).filter((m) => filtreEnv === "tous" || m.environnement === filtreEnv);
}

function pageMaisons() {
  const e = obtenir();
  const nbCoches = pokemonVisibles(e).filter((p) => e.coches.includes(p.id)).length;
  const bascule = `
    <div class="bascule" role="group" aria-label="Pokémon pris en compte">
      <button data-mode="mes" aria-pressed="${e.mode === "mes"}">Mes Pokémon (${nbCoches})</button>
      <button data-mode="tout" aria-pressed="${e.mode === "tout"}">Tout le jeu</button>
    </div>`;
  if (e.mode === "mes" && !nbCoches) {
    return `<h1>Mes maisons</h1>${bascule}
      <div class="vide"><p>Coche d'abord les Pokémon que tu as : les maisons se formeront avec eux.</p>
      <a class="principal" href="#pokemon">Cocher mes Pokémon</a></div>`;
  }
  if (!resultat) return `<h1>Mes maisons</h1>${bascule}<p class="attente">Je forme les maisons…</p>`;
  const parEnv = new Map();
  for (const m of resultat) parEnv.set(m.environnement, (parEnv.get(m.environnement) || 0) + 1);
  const liste = maisonsFiltrees();
  const aPoser = liste.reduce((s, m) => s + objetsDe(m, e).filter((id) => !(e.poses[cleMaison(m.habitants)] || []).includes(id)).length, 0);
  const logés = liste.reduce((s, m) => s + m.habitants.length, 0);
  return `
    <h1>Mes maisons</h1>
    ${bascule}
    <div class="jetons" role="group" aria-label="Environnement">
      <button class="jeton" data-env="tous" aria-pressed="${filtreEnv === "tous"}">Tous<span class="releve">${resultat.length}</span></button>
      ${D.environnements.filter((x) => parEnv.has(x.id)).map((x) => `
        <button class="jeton" data-env="${x.id}" aria-pressed="${filtreEnv === x.id}">${h(x.fr)}<span class="releve">${parEnv.get(x.id)}</span></button>`).join("")}
    </div>
    <p class="resume">${pluriel(liste.length, "maison", "maisons")} pour ${pluriel(logés, "Pokémon", "Pokémon")} · ${pluriel(aPoser, "objet à poser", "objets à poser")}${enCours ? " · mise à jour…" : ""}</p>
    <div class="maisons">${liste.map(carteMaison).join("")}</div>`;
}

// ---------- Détail d'une maison ----------
function pageMaison(cle) {
  if (!resultat) return `<p class="attente">Je forme les maisons…</p>`;
  const liste = maisonsFiltrees().length ? maisonsFiltrees() : resultat;
  let i = liste.findIndex((m) => cleMaison(m.habitants) === cle);
  const tout = i < 0 ? resultat.findIndex((m) => cleMaison(m.habitants) === cle) : -1;
  const m = i >= 0 ? liste[i] : resultat[tout];
  if (!m) {
    return `<h1>Maison introuvable</h1><div class="vide"><p>Cette maison a changé depuis : tes Pokémon cochés ne sont plus les mêmes.</p>
      <a class="principal" href="#maisons">Revoir mes maisons</a></div>`;
  }
  const e = obtenir();
  const habitants = m.habitants.map((id) => P.get(id));
  const poses = new Set(e.poses[cle] || []);
  const ids = objetsDe(m, e);
  const objets = ids.map((id) => O.get(id) || { id, libre: true, usage: id.replace("libre-", ""), gouts: [], testes: [] });
  const couverts = couverture(habitants, ids);
  const env = ENV.get(m.environnement);
  const precedente = i > 0 ? liste[i - 1] : null, suivante = i >= 0 && i < liste.length - 1 ? liste[i + 1] : null;
  const lien = (x, sens, texte) => x
    ? `<a class="rond" href="#maison/${encodeURIComponent(cleMaison(x.habitants))}" aria-label="${texte}">${sens}</a>`
    : `<span class="rond" aria-hidden="true" style="opacity:.35">${sens}</span>`;

  // tableau : un goût par ligne, les plus partagés en haut
  const gouts = [...new Set(habitants.flatMap((p) => p.gouts))];
  const combien = (g) => habitants.filter((p) => p.gouts.includes(g)).length;
  const couvert = (k, g) => couverts[k].includes(g);
  gouts.sort((a, b) => combien(b) - combien(a) || (couvertParUn(b) - couvertParUn(a)) || G.get(a).localeCompare(G.get(b)));
  function couvertParUn(g) { return habitants.some((p, k) => couvert(k, g)) ? 1 : 0; }
  const tableau = `
    <div class="tableau-box"><table class="tableau">
      <thead><tr><th scope="col">Goût</th>${habitants.map((p) => `<th scope="col">${bulle(nomPk(p), imgPk(p, 48), "tete-pk")}</th>`).join("")}</tr></thead>
      <tbody>${gouts.map((g) => {
        const pris = habitants.some((p, k) => couvert(k, g));
        return `<tr class="${pris ? "" : "non-couvert"}"><td>${icone(g)}</td>${habitants.map((p, k) =>
          `<td>${p.gouts.includes(g) ? (couvert(k, g) ? '<span class="point" role="img" aria-label="couvert"></span>' : '<span class="point manque" role="img" aria-label="pas couvert"></span>') : ""}</td>`).join("")}</tr>`;
      }).join("")}</tbody>
      <tfoot><tr><td>Total</td>${habitants.map((p, k) => {
        const n = p.gouts.filter((g) => couvert(k, g)).length;
        return `<td class="${n >= 4 ? "ok" : "ko"}">${n}/5</td>`;
      }).join("")}</tr></tfoot>
    </table></div>`;

  const objetsEnv = D.objets.filter((o) => o.environnements.includes(m.environnement)).slice(0, 8);
  const saveurs = groupesSaveur(habitants);
  return `
    <div class="fil">
      ${lien(precedente, "‹", "Maison précédente")}
      <span class="releve">${i >= 0 ? `maison ${i + 1} sur ${liste.length}` : ""}</span>
      ${lien(suivante, "›", "Maison suivante")}
    </div>
    <h1>${habitants.map((p) => h(nomPk(p))).join(", ")}</h1>

    <section class="panneau">
      <h2>Environnement : ${h(env?.fr)}</h2>
      <span class="releve">2 objets suffisent</span>
      ${env?.conseil ? `<p style="margin:0 0 8px">${h(env.conseil)}</p>` : ""}
      ${objetsEnv.length ? `<div class="mini-objets">${objetsEnv.map((o) => bulle(nomTexte(o), imgObjet(o, 40), "rond-objet")).join("")}</div>` : ""}
    </section>

    <section class="panneau">
      <h2>Qui est comblé</h2>
      <span class="releve">il faut 4 goûts sur 5</span>
      ${tableau}
    </section>

    <section class="panneau">
      <h2>À poser</h2>
      <span class="releve">${pluriel(objets.length, "objet", "objets")} · coche quand c'est posé</span>
      <span class="releve">touche un objet pour voir ce qui peut le remplacer</span>
      <ul class="objets-liste">${objets.map((o) => {
        const liste = ouvert === o.id ? listeRemplacants(habitants, ids, o) : "";
        if (o.libre) return `<li class="objet-ligne"><div><button class="ouvrir-objet" data-remplacer="${h(o.id)}" aria-expanded="${ouvert === o.id}">
          <span class="vignette vide-img" style="width:56px;height:56px" aria-hidden="true"></span>
          <span>Un objet de ${USAGE[o.usage]} au choix (il en faut un)</span></button>${liste}</div></li>`;
        const utiles = o.gouts.filter((g) => habitants.some((p) => p.gouts.includes(g)));
        const pour = habitants.filter((p) => utiles.some((g) => p.gouts.includes(g))).map(nomPk);
        const teste = utiles.some((g) => o.testes.includes(g));
        return `<li class="objet-ligne">
          <input type="checkbox" id="pose-${h(o.id)}" data-pose="${h(o.id)}" ${poses.has(o.id) ? "checked" : ""} aria-label="Posé : ${h(nomTexte(o))}">
          <div class="objet-corps">
            <button class="ouvrir-objet" data-remplacer="${h(o.id)}" aria-expanded="${ouvert === o.id}">
              ${imgObjet(o, 56)}
              <span><span class="nom">${nomObjet(o)}</span> · ${USAGE[o.usage]} ${teste ? '<span class="teste">testé en jeu</span>' : ""}
              <span class="voir-rempl">${ouvert === o.id ? "Fermer" : "Remplacer…"}</span></span>
            </button>
            <span class="detail"><span class="icones">${utiles.map((g) => icone(g)).join("")}</span> → ${pour.map(h).join(", ")}</span>
            ${liste}
            ${o.obtention?.length || o.materiaux?.length ? `<details><summary>Comment l'avoir</summary><ul>
              ${o.materiaux?.length ? `<li>Fabriquer : ${o.materiaux.map(h).join(", ")}</li>` : ""}
              ${(o.obtention || []).map((x) => `<li>${h(x)}</li>`).join("")}</ul></details>` : ""}
          </div></li>`;
      }).join("")}</ul>
    </section>

    <section class="panneau">
      <h2>À donner une fois, en main propre</h2>
      <ul class="baies">${saveurs.map((s) => `<li>${imgSaveur(s, 56)}<span><b>${h(s.conseil)}</b> <span class="releve">goût ${h(s.saveur)}</span><br>${s.noms.map(h).join(", ")}</span></li>`).join("")}</ul>
    </section>

    <div class="actions">
      <a class="secondaire" href="#maisons">Toutes les maisons</a>
      ${m.verrouillee
        ? `<button class="secondaire" data-debloquer="${h(cle)}">Débloquer cette maison</button>`
        : `<button class="principal" data-construire="${h(cle)}">Je l'ai construite : ne plus la changer</button>`}
    </div>`;
}

// Liste des remplaçants d'un objet, ouverte sous lui dans le détail.
function listeRemplacants(habitants, ids, o) {
  const tous = remplacants(habitants, ids, o.id);
  const montres = tousRemplacants ? tous : tous.slice(0, 12);
  return `<div class="remplacants">
    <p class="releve">${tous.length ? `${pluriel(tous.length, "objet peut", "objets peuvent")} le remplacer, chacun garde tout le monde comblé :` : "Aucun objet seul ne garde tout le monde comblé."}</p>
    ${tous.length ? "" : listePaires(habitants, ids, o)}
    <ul>${montres.map(({ o: r, utiles, testes, facile: f }) => `<li>
      <button class="choisir" data-choisir="${h(o.id)}>${h(r.id)}">
        ${imgObjet(r, 44)}
        <span class="choisir-corps"><span class="nom">${nomObjet(r)}</span> · ${USAGE[r.usage]}
          ${testes ? '<span class="teste">testé en jeu</span>' : ""}${f ? "" : ' <span class="rare">plus dur à trouver</span>'}
          <span class="icones">${utiles.map((g) => icone(g)).join("")}</span></span>
      </button></li>`).join("")}</ul>
    ${tous.length > montres.length ? `<button class="secondaire plus" data-tous-rempl>Voir les ${tous.length}</button>` : ""}
  </div>`;
}

function listePaires(habitants, ids, o) {
  const paires = pairesRemplacantes(habitants, ids, o.id);
  if (!paires.length) return `<p class="releve">Ni seul ni à deux : garde cet objet si tu peux.</p>`;
  const ligne = (r) => `${imgObjet(r, 40)}<span class="nom">${nomObjet(r)}</span>`;
  return `<p class="releve">À deux, ces objets le remplacent :</p>
    <ul>${paires.map(({ a, b, facile: f }) => `<li>
      <button class="choisir paire" data-choisir="${h(o.id)}>${h(a.id)}+${h(b.id)}">
        <span class="choisir-corps"><span class="ligne-paire">${ligne(a)}</span><span class="ligne-paire">+ ${ligne(b)}</span>
        ${f < 2 ? '<span class="rare">un des deux plus dur à trouver</span>' : ""}</span>
      </button></li>`).join("")}</ul>`;
}

// ---------- Page Pokémon ----------
function lignePk(p, coches) {
  const coche = coches.has(p.id);
  return `<li class="pk${coche ? " coche" : ""}" data-id="${h(p.id)}" data-cle="${h(sansAccent(nomPk(p) + " " + p.en))}"><label>
    <input type="checkbox" data-coche="${h(p.id)}" ${coche ? "checked" : ""} aria-label="J'ai ${h(nomPk(p))}">
    ${imgPk(p, 56)}
    <span class="corps">
      <span class="ligne1"><span class="nom">${h(nomPk(p))}</span><span class="releve">n° ${p.num}${p.groupe === "dlc" ? " · DLC" : p.groupe === "evenement" ? " · événement" : ""}</span></span>
      <span class="gouts icones">${p.gouts.map((g) => icone(g)).join("")}</span>
      <span class="saveur">${p.saveur ? `Goût ${h(p.saveur)} : ${imgSaveur(SAV.get(p.saveur), 28)}${h(SAV.get(p.saveur).conseil)}` : "Saveur inconnue"}</span>
      ${p.a_verifier.length ? `<span class="alerte">À vérifier en jeu : ${h(p.a_verifier.join(", "))}</span>` : ""}
    </span></label></li>`;
}

function pagePokemon() {
  const e = obtenir();
  const coches = new Set(e.coches);
  const visibles = pokemonVisibles(e);
  const liste = visibles;
  const nbCoches = visibles.filter((p) => coches.has(p.id)).length;
  const groupe = (titre, ps) => ps.length ? `<section class="groupe-pk">
      <div class="section-titre"><h2>${h(titre)}</h2><span class="compteur">${ps.length}</span></div>
      <ul class="liste-pk">${ps.map((p) => lignePk(p, coches)).join("")}</ul></section>` : "";
  const sections = D.environnements.map((env) => groupe(env.fr, liste.filter((p) => p.environnement === env.id))).join("");
  const sansEnv = liste.filter((p) => !p.environnement);
  return `
    <h1>Mes Pokémon</h1>
    <p class="resume"><span data-nb-coches>${nbCoches}</span> cochés sur ${visibles.length}</p>
    <label class="champ">Chercher un Pokémon
      <input type="search" data-cherche-pk value="${h(filtrePk.texte)}" placeholder="Salamèche, Apitrini…" autocomplete="off">
    </label>
    <div class="jetons" role="group" aria-label="Afficher">
      <button class="jeton" data-vue="tous" aria-pressed="${filtrePk.vue === "tous"}">Tous</button>
      <button class="jeton" data-vue="coches" aria-pressed="${filtrePk.vue === "coches"}">Cochés</button>
      <button class="jeton" data-vue="non" aria-pressed="${filtrePk.vue === "non"}">Pas encore cochés</button>
    </div>
    ${sections}
    ${groupe("Environnement inconnu", sansEnv)}
    <div class="vide" data-aucun-pk hidden><p>Aucun Pokémon ne correspond.</p></div>
    <label class="reglage"><input type="checkbox" data-dlc ${e.dlc ? "checked" : ""}> Montrer les Pokémon de la zone DLC (Bubbly Basin)</label>
    ${blocPartage()}
    ${sources()}`;
}

// Applique la recherche et le filtre aux lignes déjà dessinées (bien plus rapide que tout redessiner).
function filtrerPk() {
  const t = sansAccent(filtrePk.texte.trim());
  const coches = new Set(obtenir().coches);
  let total = 0;
  for (const sec of page.querySelectorAll(".groupe-pk")) {
    let n = 0;
    for (const li of sec.querySelectorAll(".pk")) {
      const ok = (!t || li.dataset.cle.includes(t)) &&
        (filtrePk.vue === "tous" || (filtrePk.vue === "coches") === coches.has(li.dataset.id));
      li.hidden = !ok;
      if (ok) n++;
    }
    sec.hidden = !n;
    sec.querySelector(".compteur").textContent = n;
    total += n;
  }
  const aucun = page.querySelector("[data-aucun-pk]");
  if (aucun) aucun.hidden = total > 0;
  page.querySelectorAll("[data-vue]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.vue === filtrePk.vue));
}

// ---------- Mes appareils (partage par code) ----------
function blocPartage() {
  if (!partage.actif) return "";
  const c = partage.code();
  return `<section class="panneau partage">
    <h2>Mes appareils</h2>
    <span class="releve" data-statut-partage>${h(partage.statutActuel())}</span>
    ${c ? `
      <p>Ta partie se met à jour toute seule sur tous les appareils branchés avec ce code.</p>
      <p class="code-partie">${h(c)}</p>
      <div class="actions">
        <button class="principal" data-copier-lien>Copier le lien pour l'autre appareil</button>
        <button class="secondaire" data-arreter-partage>Débrancher cet appareil</button>
      </div>` : `
      <p>Pour retrouver tes coches sur ton téléphone et ton ordi : crée ton code sur un premier appareil,
      puis ouvre le lien qu'il donne sur l'autre (ou recopie le code ci-dessous).</p>
      <div class="actions"><button class="principal" data-creer-code>Créer mon code</button></div>
      <label class="champ" style="margin-top:12px">J'ai déjà un code
        <input type="text" data-saisie-code autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Le code ou le lien">
      </label>
      <button class="secondaire" data-valider-code>Brancher cet appareil</button>`}
  </section>`;
}
partage.surStatut((t) => { const el = page.querySelector("[data-statut-partage]"); if (el) el.textContent = t; });

// ---------- Page Objets ----------
function pageObjets() {
  const t = sansAccent(filtreObjet.texte.trim());
  const g = filtreObjet.gout;
  const liste = D.objets
    .filter((o) => o.usage && USAGE[o.usage])
    .filter((o) => (!g || o.gouts.includes(g)) && (!t || sansAccent(o.fr || "").includes(t) || sansAccent(o.en || "").includes(t)))
    .sort((a, b) => (g ? (b.testes.includes(g) - a.testes.includes(g)) : 0) || b.gouts.length - a.gouts.length || (a.fr || a.en).localeCompare(b.fr || b.en));
  const montres = liste.slice(0, filtreObjet.limite);
  const goutsTries = [...D.gouts].sort((a, b) => a.fr.localeCompare(b.fr));
  return `
    <h1>Objets</h1>
    <label class="champ">Goût
      <select data-gout-objet>
        <option value="">Tous les goûts</option>
        ${goutsTries.map((x) => `<option value="${x.id}" ${x.id === g ? "selected" : ""}>${h(x.fr)}</option>`).join("")}
      </select>
    </label>
    <label class="champ">Chercher un objet
      <input type="search" data-cherche-objet value="${h(filtreObjet.texte)}" placeholder="Lit, banc, lampe…" autocomplete="off">
    </label>
    <p class="resume">${pluriel(liste.length, "objet", "objets")}${liste.length > montres.length ? ` · les ${montres.length} premiers` : ""}</p>
    <div class="objets-grille">${montres.map((o) => `
      <article class="carte-objet">
        <div class="tete">${imgObjet(o, 56)}<span class="nom"><b>${nomObjet(o)}</b></span><span class="releve">${USAGE[o.usage]}</span></div>
        <div class="gouts icones">${o.gouts.map((x) => icone(x, (x === g ? " commun" : "") + (o.testes.includes(x) ? " ok-jeu" : ""))).join("")}</div>
        ${o.testes.length ? `<span class="teste">testé en jeu (goûts soulignés)</span>` : ""}
      </article>`).join("")}</div>
    ${liste.length > montres.length ? `<button class="secondaire plus" data-plus-objets>Voir ${Math.min(60, liste.length - montres.length)} objets de plus</button>` : ""}
    ${liste.length ? "" : `<div class="vide"><p>Aucun objet ne correspond.</p></div>`}
    ${sources()}`;
}

function sources() {
  return `<p class="sources">Données du ${h(new Date(D.version).toLocaleDateString("fr-FR"))}, tirées de
    <a href="${D.sources.serebii}">Serebii</a>, <a href="${D.sources.pokopiaguide}">Pokopia Guide</a> et
    <a href="${D.sources.joenesteam}">JoeNesTeam</a> (objets testés en jeu).</p>`;
}

// ---------- Aiguillage ----------
function routeActuelle() {
  const [nom, arg] = location.hash.replace(/^#/, "").split("/");
  return { nom: nom || "maisons", arg: arg ? decodeURIComponent(arg) : null };
}

function afficher() {
  if (!D) return;
  const { nom, arg } = routeActuelle();
  const pageNav = nom === "maison" ? "maisons" : nom;
  document.querySelectorAll(".capsule a").forEach((a) => {
    if (a.dataset.page === pageNav) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  const actif = document.activeElement;
  const recherche = actif?.matches?.("[data-cherche-pk], [data-cherche-objet]") ? { sel: actif.matches("[data-cherche-pk]") ? "[data-cherche-pk]" : "[data-cherche-objet]", pos: actif.selectionStart } : null;
  page.innerHTML = nom === "pokemon" ? pagePokemon() : nom === "objets" ? pageObjets() : nom === "maison" ? pageMaison(arg) : pageMaisons();
  if (nom === "pokemon") filtrerPk();
  if (recherche) {
    const champ = page.querySelector(recherche.sel);
    champ.focus();
    champ.setSelectionRange(recherche.pos, recherche.pos);
  }
}

let routePrecedente = "";
window.addEventListener("hashchange", () => {
  ouvert = null;
  afficher();
  const r = location.hash;
  if (r !== routePrecedente) { window.scrollTo(0, 0); routePrecedente = r; }
});

// ---------- Actions ----------
page.addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  if (b.matches("[data-creer-code]")) { partage.utiliserCode(partage.nouveauCode(), false).then(afficher); afficher(); return; }
  if (b.matches("[data-valider-code]")) {
    const v = page.querySelector("[data-saisie-code]").value.trim();
    if (v) partage.utiliserCode(v).then(afficher);
    return;
  }
  if (b.matches("[data-arreter-partage]")) { partage.arreter(); afficher(); return; }
  if (b.matches("[data-copier-lien]")) {
    navigator.clipboard?.writeText(partage.lienPartie()).then(() => { b.textContent = "Lien copié"; }, () => { b.textContent = partage.lienPartie(); });
    return;
  }
  if (b.dataset.remplacer) {
    ouvert = ouvert === b.dataset.remplacer ? null : b.dataset.remplacer;
    tousRemplacants = false;
    afficher();
    return;
  }
  if (b.matches("[data-tous-rempl]")) { tousRemplacants = true; afficher(); return; }
  if (b.dataset.choisir) {
    const [ancien, nouveau] = b.dataset.choisir.split(">");
    const cle = routeActuelle().arg;
    const m = resultat?.find((x) => cleMaison(x.habitants) === cle);
    if (!m) return;
    // « nouveau » peut être une paire : « a+b » remplace un objet par deux
    const ids = objetsDe(m).flatMap((id) => (id === ancien ? nouveau.split("+") : [id]));
    changer((e) => {
      e.choix = { ...(e.choix || {}), [cle]: ids };
      // maison construite : elle garde désormais ce choix
      e.construites = e.construites.map((v) => (!Array.isArray(v) && cleMaison(v.habitants) === cle ? { ...v, objets: ids } : v));
    });
    ouvert = null;
    afficher();
    return;
  }
  if (b.matches("[data-plus-objets]")) { filtreObjet.limite += 60; afficher(); return; }
  if (b.dataset.mode) { changer((e) => { e.mode = b.dataset.mode; }); resultat = null; filtreEnv = "tous"; calculer(); }
  else if (b.dataset.env) { filtreEnv = b.dataset.env; afficher(); }
  else if (b.dataset.vue) { filtrePk.vue = b.dataset.vue; filtrerPk(); }
  else if (b.dataset.construire) {
    // la maison garde ses habitants et ses objets tels qu'affichés
    const m = resultat.find((x) => cleMaison(x.habitants) === b.dataset.construire);
    if (!m) return;
    const membres = (v) => (Array.isArray(v) ? v : v.habitants);
    changer((e) => {
      e.construites = e.construites
        .filter((v) => !membres(v).some((id) => m.habitants.includes(id)))
        .concat([{ habitants: m.habitants, objets: objetsDe(m) }]);
    });
    calculer();
  } else if (b.dataset.debloquer) {
    const cle = b.dataset.debloquer;
    changer((e) => { e.construites = e.construites.filter((v) => cleMaison(Array.isArray(v) ? v : v.habitants) !== cle); });
    calculer();
  }
});

let attenteCalcul = null;
page.addEventListener("change", (ev) => {
  const c = ev.target;
  if (c.dataset.coche) {
    const id = c.dataset.coche;
    changer((e) => { e.coches = c.checked ? [...new Set([...e.coches, id])] : e.coches.filter((x) => x !== id); });
    c.closest(".pk").classList.toggle("coche", c.checked);
    const nb = page.querySelector("[data-nb-coches]");
    if (nb) nb.textContent = pokemonVisibles().filter((p) => obtenir().coches.includes(p.id)).length;
    // on attend que les coches s'arrêtent avant de recalculer
    clearTimeout(attenteCalcul);
    attenteCalcul = setTimeout(() => { if (obtenir().mode === "mes") calculer(); }, 600);
  } else if (c.dataset.pose) {
    const cle = routeActuelle().arg;
    changer((e) => {
      const l = new Set(e.poses[cle] || []);
      if (c.checked) l.add(c.dataset.pose); else l.delete(c.dataset.pose);
      e.poses[cle] = [...l];
    });
  } else if (c.matches("[data-dlc]")) {
    changer((e) => { e.dlc = c.checked; });
    calculer();
    afficher();
  } else if (c.matches("[data-gout-objet]")) {
    filtreObjet.gout = c.value; filtreObjet.limite = 60; afficher();
  }
});

let attenteRecherche = null;
page.addEventListener("input", (ev) => {
  const c = ev.target;
  clearTimeout(attenteRecherche);
  if (c.matches("[data-cherche-pk]")) {
    filtrePk.texte = c.value;
    attenteRecherche = setTimeout(filtrerPk, 120);
  } else if (c.matches("[data-cherche-objet]")) {
    filtreObjet.texte = c.value; filtreObjet.limite = 60;
    attenteRecherche = setTimeout(afficher, 150);
  }
});

// un changement venu d'un autre appareil : on recalcule
abonner((e, origine) => { if (origine === "distant") calculer(); });

// ---------- Démarrage ----------
async function demarrer() {
  try {
    const rep = await fetch("donnees/pokopia.json");
    D = await rep.json();
  } catch {
    page.innerHTML = `<p class="attente">Impossible de charger les données. Vérifie la connexion puis recharge la page.</p>`;
    return;
  }
  for (const p of D.pokemon) P.set(p.id, p);
  for (const o of D.objets) O.set(o.id, o);
  for (const g of D.gouts) { G.set(g.id, g.fr || g.en); IMG_GOUT.set(g.id, g.img); }
  for (const e of D.environnements) ENV.set(e.id, e);
  for (const s of D.saveurs) SAV.set(s.id, s);
  partage.demarrer(); // avant le premier affichage : il peut lire un lien …#partie/CODE
  routePrecedente = location.hash;
  afficher();
  calculer();
}
demarrer();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
