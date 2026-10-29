// Pokopia : les pages (maisons, détail d'une maison, Pokémon, objets) et leur lien avec le calcul.
import { obtenir, changer, abonner, cleMaison } from "./etat.js";
import * as partage from "./partage.js";

const USAGE = { repos: "repos", deco: "décoration", jouet: "jouet" };
const page = document.getElementById("page");

let D = null;                 // données : donnees/pokopia.json
const P = new Map(), O = new Map(), G = new Map(), ENV = new Map(), SAV = new Map();
let resultat = null;          // dernier calcul des maisons
let enCours = false;
let filtreEnv = "tous";       // filtre de la page Maisons (non gardé)
let filtrePk = { texte: "", vue: "tous" };
let filtreObjet = { texte: "", gout: "", sans: false };

// ---------- Outils ----------
const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const nomPk = (p) => p.fr || p.en;
const nomObjet = (o) => o.fr ? h(o.fr) : `${h(o.en || o.id)} <span class="anglais">nom anglais</span>`;
const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
// images : copiées dans images/ par outils/telecharger_images.py ; sans image, une case vide
const imgPk = (p, t) => p.img
  ? `<img class="vignette" src="images/pokemon/${p.img}.webp" width="${t}" height="${t}" loading="lazy" alt="">`
  : `<span class="vignette vide-img" style="width:${t}px;height:${t}px" aria-hidden="true"></span>`;
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
    const coches = new Set(e.coches);
    return visibles.filter((p) => coches.has(p.id));
  }
  return visibles.filter((p) => p.groupe !== "evenement");
}

// ---------- Calcul, à part de la page ----------
let travailleur = null, demande = 0, objetsEnvoyes = false;
function calculer() {
  const e = obtenir();
  const n = ++demande;
  enCours = true;
  const message = { demande: n, pokemon: pokemonACalculer(e), construites: e.construites, exclus: e.sansObjets || [], essais: 3000 };
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
      const exclus = new Set(message.exclus);
      const m = formerMaisons(message.pokemon, D.objets.filter((o) => !exclus.has(o.id)), message.construites, message.essais);
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
  const objets = m.objets.map((id) => O.get(id) || { id, libre: true, usage: id.replace("libre-", "") });
  const reste = objets.filter((o) => !poses.has(o.id)).length;
  const saveurs = groupesSaveur(habitants);
  const famille = habitants.length > 1 && habitants.every((p) => p.famille === habitants[0].famille);
  return `
    <article class="maison${m.verrouillee ? " construite" : ""}">
      <div class="maison-tete">
        <span class="env">${h(ENV.get(m.environnement)?.fr)}</span>
        <span class="releve">${m.verrouillee ? "construite" : famille ? "une famille" : ""}${m.manques.length ? ' · <span class="ko">pas tous comblés</span>' : ""}</span>
        <span class="releve">${reste ? pluriel(reste, "objet à poser", "objets à poser") : "tout est posé"}</span>
      </div>
      <ul class="habitants">${habitants.map((p) => `<li>${imgPk(p, 64)}<span>${h(nomPk(p))}</span></li>`).join("")}</ul>
      <ul class="a-poser">${objets.map((o) => o.libre
        ? `<li><span class="vignette vide-img" style="width:40px;height:40px" aria-hidden="true"></span><span>un ${USAGE[o.usage]} au choix</span></li>`
        : `<li class="${poses.has(o.id) ? "pose" : ""}">${imgObjet(o, 40)}<span>${nomObjet(o)}</span></li>`).join("")}</ul>
      <div class="donner"><span>À donner une fois :</span>${saveurs.map((s) => `<span class="baie" title="${h(s.conseil)} (${h(s.saveur)})">${imgSaveur(s, 32)}<span>${h(s.conseil)}${saveurs.length > 1 ? ` <span class="pour">→ ${s.noms.map(h).join(", ")}</span>` : ""}</span></span>`).join("")}</div>
      <div class="actions">
        <a class="secondaire" href="#maison/${encodeURIComponent(cle)}">Voir le détail</a>
        ${m.verrouillee ? "" : `<button class="principal" data-construire="${h(cle)}">Je l'ai construite</button>`}
      </div>
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
  const aPoser = liste.reduce((s, m) => s + m.objets.filter((id) => !(e.poses[cleMaison(m.habitants)] || []).includes(id)).length, 0);
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
  const objets = m.objets.map((id) => O.get(id) || { id, libre: true, usage: id.replace("libre-", ""), gouts: [], testes: [] });
  const env = ENV.get(m.environnement);
  const precedente = i > 0 ? liste[i - 1] : null, suivante = i >= 0 && i < liste.length - 1 ? liste[i + 1] : null;
  const lien = (x, sens, texte) => x
    ? `<a class="rond" href="#maison/${encodeURIComponent(cleMaison(x.habitants))}" aria-label="${texte}">${sens}</a>`
    : `<span class="rond" aria-hidden="true" style="opacity:.35">${sens}</span>`;

  // tableau : un goût par ligne, les plus partagés en haut
  const gouts = [...new Set(habitants.flatMap((p) => p.gouts))];
  const combien = (g) => habitants.filter((p) => p.gouts.includes(g)).length;
  const couvert = (k, g) => (m.couverts?.[k] || []).includes(g);
  gouts.sort((a, b) => combien(b) - combien(a) || (couvertParUn(b) - couvertParUn(a)) || G.get(a).localeCompare(G.get(b)));
  function couvertParUn(g) { return habitants.some((p, k) => couvert(k, g)) ? 1 : 0; }
  const court = (p) => { const n = nomPk(p); return n.length > 8 ? n.slice(0, 7) + "." : n; };
  const tableau = `
    <div class="tableau-box"><table class="tableau">
      <thead><tr><th scope="col">Goût</th>${habitants.map((p) => `<th scope="col" title="${h(nomPk(p))}">${imgPk(p, 44)}<span class="nom-court">${h(court(p))}</span></th>`).join("")}</tr></thead>
      <tbody>${gouts.map((g) => {
        const pris = habitants.some((p, k) => couvert(k, g));
        return `<tr class="${pris ? "" : "non-couvert"}"><td>${h(G.get(g))}</td>${habitants.map((p, k) =>
          `<td>${p.gouts.includes(g) ? (couvert(k, g) ? '<span class="point" role="img" aria-label="couvert"></span>' : '<span class="point manque" role="img" aria-label="pas couvert"></span>') : ""}</td>`).join("")}</tr>`;
      }).join("")}</tbody>
      <tfoot><tr><td>Total</td>${habitants.map((p, k) => {
        const n = p.gouts.filter((g) => couvert(k, g)).length;
        return `<td class="${n >= 4 ? "ok" : "ko"}">${n}/5</td>`;
      }).join("")}</tr></tfoot>
    </table></div>`;

  const objetsEnv = D.objets.filter((o) => o.environnements.includes(m.environnement)).slice(0, 4);
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
      <p style="margin:0">${env?.conseil ? h(env.conseil) : objetsEnv.map((o) => nomObjet(o)).join(" · ")}</p>
    </section>

    <section class="panneau">
      <h2>Qui est comblé</h2>
      <span class="releve">il faut 4 goûts sur 5</span>
      ${tableau}
    </section>

    <section class="panneau">
      <h2>À poser</h2>
      <span class="releve">${pluriel(objets.length, "objet", "objets")} · coche quand c'est posé</span>
      <ul class="objets-liste">${objets.map((o) => {
        if (o.libre) return `<li class="objet-ligne"><span>Un objet de ${USAGE[o.usage]} au choix (il en faut un)</span></li>`;
        const utiles = o.gouts.filter((g) => habitants.some((p) => p.gouts.includes(g)));
        const pour = habitants.filter((p) => utiles.some((g) => p.gouts.includes(g))).map(nomPk);
        const teste = utiles.some((g) => o.testes.includes(g));
        return `<li class="objet-ligne">
          <input type="checkbox" id="pose-${h(o.id)}" data-pose="${h(o.id)}" ${poses.has(o.id) ? "checked" : ""}>
          ${imgObjet(o, 56)}
          <div><label for="pose-${h(o.id)}"><span class="nom">${nomObjet(o)}</span> · ${USAGE[o.usage]} ${teste ? '<span class="teste">testé en jeu</span>' : ""}</label>
            <span class="detail">${utiles.map((g) => h(G.get(g))).join(", ")} → ${pour.map(h).join(", ")}</span>
            <button class="lien-action" data-sans="${h(o.id)}">Je ne l'ai pas : proposer autre chose</button>
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

// ---------- Page Pokémon ----------
function lignePk(p, coches) {
  const coche = coches.has(p.id);
  return `<li class="pk${coche ? " coche" : ""}" data-id="${h(p.id)}"><label>
    <input type="checkbox" data-coche="${h(p.id)}" ${coche ? "checked" : ""} aria-label="J'ai ${h(nomPk(p))}">
    ${imgPk(p, 56)}
    <span class="corps">
      <span class="ligne1"><span class="nom">${h(nomPk(p))}</span><span class="releve">n° ${p.num}${p.groupe === "dlc" ? " · DLC" : p.groupe === "evenement" ? " · événement" : ""}</span></span>
      <span class="gouts">${p.gouts.map((g) => `<span class="gout">${h(G.get(g))}</span>`).join("")}</span>
      <span class="saveur">${p.saveur ? `Goût ${h(p.saveur)} : ${imgSaveur(SAV.get(p.saveur), 28)}${h(SAV.get(p.saveur).conseil)}` : "Saveur inconnue"}</span>
      ${p.a_verifier.length ? `<span class="alerte">À vérifier en jeu : ${h(p.a_verifier.join(", "))}</span>` : ""}
    </span></label></li>`;
}

function pagePokemon() {
  const e = obtenir();
  const coches = new Set(e.coches);
  const t = sansAccent(filtrePk.texte.trim());
  const visibles = pokemonVisibles(e);
  const liste = visibles.filter((p) =>
    (!t || sansAccent(nomPk(p)).includes(t) || sansAccent(p.en).includes(t)) &&
    (filtrePk.vue === "tous" || (filtrePk.vue === "coches") === coches.has(p.id)));
  const nbCoches = visibles.filter((p) => coches.has(p.id)).length;
  const sections = D.environnements.map((env) => {
    const ps = liste.filter((p) => p.environnement === env.id);
    if (!ps.length) return "";
    return `<div class="section-titre"><h2>${h(env.fr)}</h2><span class="compteur">${ps.length}</span></div>
      <ul class="liste-pk">${ps.map((p) => lignePk(p, coches)).join("")}</ul>`;
  }).join("");
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
    <label class="reglage"><input type="checkbox" data-dlc ${e.dlc ? "checked" : ""}> Montrer les Pokémon de la zone DLC (Bubbly Basin)</label>
    ${sections}
    ${sansEnv.length ? `<div class="section-titre"><h2>Environnement inconnu</h2></div><ul class="liste-pk">${sansEnv.map((p) => lignePk(p, coches)).join("")}</ul>` : ""}
    ${liste.length ? "" : `<div class="vide"><p>Aucun Pokémon ne correspond.</p></div>`}
    ${blocPartage()}
    ${sources()}`;
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
        <input type="text" data-saisie-code autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="24 caractères">
      </label>
      <button class="secondaire" data-valider-code>Brancher cet appareil</button>`}
  </section>`;
}
partage.surStatut((t) => { const el = page.querySelector("[data-statut-partage]"); if (el) el.textContent = t; });

// ---------- Page Objets ----------
function pageObjets() {
  const t = sansAccent(filtreObjet.texte.trim());
  const g = filtreObjet.gout;
  const sans = new Set(obtenir().sansObjets || []);
  const liste = D.objets
    .filter((o) => o.usage && USAGE[o.usage])
    .filter((o) => !filtreObjet.sans || sans.has(o.id))
    .filter((o) => (!g || o.gouts.includes(g)) && (!t || sansAccent(o.fr || "").includes(t) || sansAccent(o.en || "").includes(t)))
    .sort((a, b) => (g ? (b.testes.includes(g) - a.testes.includes(g)) : 0) || b.gouts.length - a.gouts.length || (a.fr || a.en).localeCompare(b.fr || b.en));
  const montres = liste.slice(0, 60);
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
    <div class="jetons" role="group" aria-label="Afficher">
      <button class="jeton" data-objets-sans="non" aria-pressed="${!filtreObjet.sans}">Tous</button>
      <button class="jeton" data-objets-sans="oui" aria-pressed="${filtreObjet.sans}">Ceux que je n'ai pas<span class="releve">${sans.size}</span></button>
    </div>
    <p class="resume">${pluriel(liste.length, "objet", "objets")}${liste.length > montres.length ? ` · les ${montres.length} premiers` : ""}</p>
    <div class="objets-grille">${montres.map((o) => `
      <article class="carte-objet${sans.has(o.id) ? " absent" : ""}">
        <div class="tete">${imgObjet(o, 56)}<span class="nom"><b>${nomObjet(o)}</b></span><span class="releve">${USAGE[o.usage]}</span></div>
        <div class="gouts">${o.gouts.map((x) => `<span class="gout${x === g ? " commun" : ""}">${h(G.get(x))}</span>`).join("")}</div>
        ${o.testes.length ? `<span class="teste">testé en jeu : ${o.testes.map((x) => h(G.get(x))).join(", ")}</span>` : ""}
        <button class="lien-action" data-sans="${h(o.id)}">${sans.has(o.id) ? "Je l'ai maintenant" : "Je ne l'ai pas"}</button>
      </article>`).join("")}</div>
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
  if (recherche) {
    const champ = page.querySelector(recherche.sel);
    champ.focus();
    champ.setSelectionRange(recherche.pos, recherche.pos);
  }
}

let routePrecedente = "";
window.addEventListener("hashchange", () => {
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
  if (b.dataset.sans) {
    const id = b.dataset.sans;
    changer((e) => {
      const l = new Set(e.sansObjets || []);
      if (l.has(id)) l.delete(id); else l.add(id);
      e.sansObjets = [...l];
    });
    calculer();
    return;
  }
  if (b.dataset.objetsSans) { filtreObjet.sans = b.dataset.objetsSans === "oui"; afficher(); return; }
  if (b.dataset.mode) { changer((e) => { e.mode = b.dataset.mode; }); resultat = null; filtreEnv = "tous"; calculer(); }
  else if (b.dataset.env) { filtreEnv = b.dataset.env; afficher(); }
  else if (b.dataset.vue) { filtrePk.vue = b.dataset.vue; afficher(); }
  else if (b.dataset.construire) {
    // la maison garde ses habitants et ses objets tels qu'affichés
    const m = resultat.find((x) => cleMaison(x.habitants) === b.dataset.construire);
    if (!m) return;
    const membres = (v) => (Array.isArray(v) ? v : v.habitants);
    changer((e) => {
      e.construites = e.construites
        .filter((v) => !membres(v).some((id) => m.habitants.includes(id)))
        .concat([{ habitants: m.habitants, objets: m.objets }]);
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
    filtreObjet.gout = c.value; afficher();
  }
});

page.addEventListener("input", (ev) => {
  const c = ev.target;
  if (c.matches("[data-cherche-pk]")) { filtrePk.texte = c.value; afficher(); }
  else if (c.matches("[data-cherche-objet]")) { filtreObjet.texte = c.value; afficher(); }
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
  for (const g of D.gouts) G.set(g.id, g.fr || g.en);
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
