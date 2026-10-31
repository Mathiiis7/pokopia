// Forme les maisons de 4 Pokémon et choisit les objets à y poser.
// Pur calcul, sans page : utilisable dans le navigateur et avec node pour les essais.
//
// Règles (docs/regles-joenesteam.md) :
// - une maison = 4 Pokémon au plus, tous du même environnement (sauf une famille réunie) ;
// - chaque Pokémon est comblé quand 4 de ses 5 goûts sont couverts par des objets de la maison ;
// - il faut au moins un objet de repos, un de décoration et un jouet ;
// - un objet compte pour tous les goûts qu'il porte et pour tous les habitants.
//
// Ce qu'on cherche, dans l'ordre : aucun Pokémon pas comblé, le moins d'objets possible,
// puis le plus de goûts couverts (les 5 plutôt que 4 : de la marge si un Pokémon fait un
// « caprice » et refuse un objet), par des objets testés en jeu et qui ont un nom français.

export const TAILLE_MAISON = 4;
export const GOUTS_A_COUVRIR = 4;
const GOUTS_EN_COMMUN = 3;
export const USAGES = ["repos", "deco", "jouet"];
const OBJETS_PAR_GOUT = 12;
// Maisons choisies par Mathis : elles passent avant le calcul et gardent leurs places libres.
const MAISONS_VOULUES = [["scyther", "scizor", "pinsir", "heracross"]];

// Valeur d'un goût couvert par un objet : testé en jeu par JoeNesTeam > vu seulement sur Serebii.
function valeur(objet, gout) {
  return (objet.testes.includes(gout) ? 1 : 0.85) - (objet.fr ? 0 : 0.05) - (facile(objet) ? 0 : 0.25);
}

// Facile à obtenir : se fabrique, ou s'achète à la boutique (d'après « Comment l'avoir »).
// Les autres (pièces de fossile, objets à expertiser…) ne passent qu'en dernier recours.
export function facile(objet) {
  return Boolean(objet.materiaux?.length) || (objet.obtention || []).some((x) => /boutique/i.test(x));
}

// Prépare les objets une fois pour toutes : seuls ceux qu'on pose dans une maison comptent.
export function preparer(objets) {
  const posables = objets.filter((o) => USAGES.includes(o.usage) && o.gouts.length);
  const parGout = new Map();
  for (const o of posables) {
    o._valeurs = new Map(o.gouts.map((g) => [g, valeur(o, g)]));
    for (const g of o.gouts) {
      if (!parGout.has(g)) parGout.set(g, []);
      parGout.get(g).push(o);
    }
  }
  // Pour chaque goût, on ne garde que les meilleurs objets (testés, nom français, beaucoup de goûts) :
  // le calcul reste rapide sur téléphone, et un objet qui ne porte qu'un goût ne gagne jamais.
  // Ordre fixe : à égalité, le premier de la liste gagne, et le résultat ne varie pas.
  const note = (o) => o.testes.length + 0.5 * o.gouts.length + (o.fr ? 0.5 : 0) + (facile(o) ? 1 : 0);
  for (const [g, liste] of parGout) {
    liste.sort((a, b) => note(b) - note(a) || (a.fr || a.en || a.id).localeCompare(b.fr || b.en || b.id));
    parGout.set(g, liste.slice(0, OBJETS_PAR_GOUT));
  }
  return { posables, parGout };
}

function candidats(habitants, prep) {
  const vus = new Set();
  const liste = [];
  for (const p of habitants) {
    for (const g of p.gouts) {
      for (const o of prep.parGout.get(g) || []) {
        if (!vus.has(o)) { vus.add(o); liste.push(o); }
      }
    }
  }
  return liste;
}

// Choisit les objets d'une maison : les trois obligatoires, puis des objets en plus s'il faut.
export function objetsPourMaison(habitants, prep) {
  const cands = candidats(habitants, prep);
  const couverts = habitants.map(() => new Map()); // goût -> valeur du meilleur objet qui le couvre
  const choisis = [];
  const besoin = (i) => GOUTS_A_COUVRIR - couverts[i].size;

  const gain = (o, plafond) => {
    let g = 0;
    habitants.forEach((p, i) => {
      const reste = plafond ? besoin(i) : 5 - couverts[i].size;
      if (reste <= 0) return;
      let n = 0, v = 0;
      for (const gout of p.gouts) {
        if (!couverts[i].has(gout) && o._valeurs.has(gout)) { n++; v = Math.max(v, o._valeurs.get(gout)); }
      }
      g += Math.min(n, reste) * v;
    });
    return g;
  };
  const poser = (o) => {
    choisis.push(o);
    habitants.forEach((p, i) => {
      for (const gout of p.gouts) {
        const v = o._valeurs.get(gout);
        if (v !== undefined && (couverts[i].get(gout) || 0) < v) couverts[i].set(gout, v);
      }
    });
  };

  // 1. les trois objets obligatoires d'abord (un repos, une décoration, un jouet), chacun
  //    choisi pour couvrir le plus de goûts encore libres : souvent, ils suffisent
  for (let k = 0; k < USAGES.length; k++) {
    let meilleur = null, meilleurGain = -1;
    for (const o of cands) {
      if (choisis.includes(o) || choisis.some((c) => c.usage === o.usage)) continue;
      const g = gain(o, false);
      if (g > meilleurGain) { meilleur = o; meilleurGain = g; }
    }
    if (!meilleur) break;
    poser(meilleur);
  }
  for (const usage of USAGES) {
    if (!choisis.some((o) => o.usage === usage)) choisis.push({ id: `libre-${usage}`, usage, gouts: [], testes: [], libre: true });
  }

  // 2. s'il manque encore des goûts, l'objet qui rapproche le plus les habitants de leurs 4 goûts
  while (habitants.some((_, i) => besoin(i) > 0)) {
    let meilleur = null, meilleurGain = 1e-9;
    for (const o of cands) {
      if (choisis.includes(o)) continue;
      const g = gain(o, true);
      if (g > meilleurGain) { meilleur = o; meilleurGain = g; }
    }
    if (!meilleur) break; // goût sans aucun objet connu : il ira dans « manques »
    poser(meilleur);
  }

  const manques = habitants.map((p, i) => ({ id: p.id, manque: Math.max(0, besoin(i)) })).filter((m) => m.manque);
  const marge = couverts.reduce((s, c) => s + [...c.values()].reduce((a, b) => a + b, 0), 0);
  return { objets: choisis, couverts: habitants.map((p, i) => [...couverts[i].keys()]), manques, marge };
}

// Pendant la recherche, on mesure une maison au nombre de goûts différents de ses habitants :
// moins il y en a, plus les mêmes objets servent à tous. Bien plus rapide que de choisir
// les objets à chaque essai (5 s contre quelques dizaines de ms), et les objets ne sont
// choisis qu'une fois, pour les maisons retenues.
function masque(p, index) {
  let bas = 0, haut = 0;
  for (const g of p.gouts) {
    const i = index.get(g);
    if (i < 30) bas |= 1 << i; else haut |= 1 << (i - 30);
  }
  return [bas, haut];
}

function compter(n) {
  n -= (n >>> 1) & 0x55555555;
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function goutsDifferents(maison, masques) {
  let bas = 0, haut = 0;
  for (const p of maison) { const [b, h] = masques.get(p.id); bas |= b; haut |= h; }
  return maison.length ? compter(bas) + compter(haut) : 0;
}


// ---------- Familles d'évolution ----------
// Choix de Mathis (31/10/2026) : une famille vit ensemble et deux familles ne se mélangent jamais.
// Les Pokémon sans évolution se regroupent entre eux, ou rejoignent une famille s'ils ont vraiment
// ses goûts (voir accueillir). Une famille de 4 au plus dont l'environnement diffère vit quand même
// ensemble ; une plus grande (Évoli, 9) est séparée par environnement.

// Environnement d'une maison : celui du plus grand nombre, à égalité celui de la dernière évolution.
function environnementCommun(membres) {
  const compte = new Map();
  for (const p of membres) compte.set(p.environnement, (compte.get(p.environnement) || 0) + 1);
  const max = Math.max(...compte.values());
  const derniers = [...membres].sort((a, b) => b.num - a.num);
  return derniers.find((p) => compte.get(p.environnement) === max).environnement;
}

// Environnement où loger chaque Pokémon. tailleFamille : la famille entière dans le jeu, même
// si tous ses membres ne sont pas cochés (sans elle, on compte ceux qu'on a reçus).
function environnementsDeLogement(pokemon) {
  const parFamille = new Map();
  for (const p of pokemon) {
    const f = p.famille || p.id;
    if (!parFamille.has(f)) parFamille.set(f, []);
    parFamille.get(f).push(p);
  }
  const logement = new Map();
  for (const membres of parFamille.values()) {
    const reunie = (membres[0].tailleFamille ?? membres.length) <= TAILLE_MAISON;
    const commun = environnementCommun(membres);
    for (const p of membres) logement.set(p.id, reunie ? commun : p.environnement);
  }
  return logement;
}

function unites(pokemon) {
  const parFamille = new Map();
  for (const p of pokemon) {
    const f = p.famille || p.id;
    if (!parFamille.has(f)) parFamille.set(f, []);
    parFamille.get(f).push(p);
  }
  const liste = [];
  for (const membres of parFamille.values()) {
    membres.sort((a, b) => a.num - b.num || a.id.localeCompare(b.id));
    for (let i = 0; i < membres.length; i += TAILLE_MAISON) liste.push(membres.slice(i, i + TAILLE_MAISON));
  }
  return liste.sort((a, b) => a[0].id.localeCompare(b[0].id));
}

const plat = (maison) => maison.flat();
const taille = (maison) => maison.reduce((s, u) => s + u.length, 0);

// Morceaux échangeables d'une maison : une unité, ou deux Pokémon seuls.
function morceaux(maison) {
  const m = maison.map((u, i) => [i]);
  const seuls = maison.map((u, i) => (u.length === 1 ? i : -1)).filter((i) => i >= 0);
  for (let x = 0; x < seuls.length; x++) for (let y = x + 1; y < seuls.length; y++) m.push([seuls[x], seuls[y]]);
  return m;
}

// Échange des morceaux de même taille entre deux maisons tant que le total baisse.
// limite() renvoie vrai pour arrêter (nombre d'essais épuisé).
function ameliorer(maisons, cout, tours, limite = () => false) {
  for (let t = 0; t < tours; t++) {
    let ameliore = false;
    for (let a = 0; a < maisons.length; a++) {
      for (let b = a + 1; b < maisons.length; b++) {
        if (limite()) return;
        let fait = true;
        while (fait) {
          fait = false;
          const avant = cout(plat(maisons[a])) + cout(plat(maisons[b]));
          for (const ma of morceaux(maisons[a])) {
            const na = ma.reduce((s, i) => s + maisons[a][i].length, 0);
            for (const mb of morceaux(maisons[b])) {
              if (mb.reduce((s, i) => s + maisons[b][i].length, 0) !== na) continue;
              const A = maisons[a].filter((_, i) => !ma.includes(i)).concat(mb.map((i) => maisons[b][i]));
              const B = maisons[b].filter((_, i) => !mb.includes(i)).concat(ma.map((i) => maisons[a][i]));
              if (cout(plat(A)) + cout(plat(B)) < avant - 1e-9) {
                maisons[a] = A; maisons[b] = B; fait = ameliore = true;
                break;
              }
            }
            if (fait) break;
          }
        }
      }
    }
    if (!ameliore) return;
  }
}

// Remplit les maisons avec des unités de même taille : chacune prend celle qui lui coûte le moins.
function remplir(unitesMemeTaille, cout) {
  const restantes = [...unitesMemeTaille];
  const maisons = [];
  while (restantes.length) {
    const maison = [restantes.shift()];
    while (restantes.length && taille(maison) + restantes[0].length <= TAILLE_MAISON) {
      let iMeilleur = 0, meilleur = Infinity;
      restantes.forEach((u, i) => {
        const c = cout(plat([...maison, u]));
        if (c < meilleur) { meilleur = c; iMeilleur = i; }
      });
      maison.push(restantes.splice(iMeilleur, 1)[0]);
    }
    maisons.push(maison);
  }
  ameliorer(maisons, cout, 10);
  return maisons;
}

const sansEvolution = (unite) => unite.length === 1 && (unite[0].tailleFamille ?? 1) === 1;

// Places prises dans la maison d'une famille : ses membres pas encore cochés gardent la leur,
// pour qu'un invité n'ait pas à déménager le jour où ils arrivent.
function placesPrises(maison) {
  const famille = maison[0];
  const total = famille[0].tailleFamille ?? famille.length;
  return taille(maison) + (total <= TAILLE_MAISON ? total - famille.length : 0);
}

// Un Pokémon sans évolution rejoint une famille seulement s'il a au moins 3 de ses 5 goûts en
// commun avec chaque habitant et si la maison reste comblée sans un objet de plus. Les meilleurs
// accords passent d'abord ; renvoie ceux qui restent sans famille.
function accueillir(familles, seuls, prep) {
  const restants = [...seuls];
  for (;;) {
    let meilleur = null;
    for (const maison of familles) {
      if (placesPrises(maison) >= TAILLE_MAISON) continue;
      const habitants = plat(maison);
      for (const unite of restants) {
        const communs = Math.min(...habitants.map((p) => p.gouts.filter((g) => unite[0].gouts.includes(g)).length));
        if (communs < GOUTS_EN_COMMUN || (meilleur && communs <= meilleur.communs)) continue;
        const avec = objetsPourMaison([...habitants, ...unite], prep);
        if (avec.manques.length || avec.objets.length > objetsPourMaison(habitants, prep).objets.length) continue;
        meilleur = { maison, unite, communs };
      }
    }
    if (!meilleur) return restants;
    meilleur.maison.push(meilleur.unite);
    restants.splice(restants.indexOf(meilleur.unite), 1);
  }
}

function partagerEnvironnement(pokemon, masques, prep) {
  const cout = (m) => goutsDifferents(m, masques);
  const toutes = unites(pokemon);
  const fixes = toutes.filter((u) => !sansEvolution(u)).map((u) => [u]);
  const seuls = remplir(accueillir(fixes, toutes.filter(sansEvolution), prep), cout);
  return { fixes, seuls };
}

// Coût réel d'une maison : pas comblé >> nombre d'objets >> goûts couverts (qui le baissent un peu).
function coutReel(habitants, prep, memo) {
  if (!habitants.length) return 0;
  const cle = habitants.map((p) => p.id).sort().join("|");
  let c = memo.get(cle);
  if (c === undefined) {
    const r = objetsPourMaison(habitants, prep);
    c = 100 * r.manques.reduce((s, m) => s + m.manque, 0) + r.objets.length - 0.05 * r.marge;
    memo.set(cle, c);
  }
  return c;
}

// pokemon : ceux à loger ; verrouillees : maisons déjà construites (listes d'ids), gardées telles quelles.
// essaisFinition : maisons essayées par environnement pour la finition au vrai nombre d'objets
// (un nombre et non un temps, pour que le résultat soit le même sur téléphone et sur ordinateur).
export function formerMaisons(pokemon, objets, verrouillees = [], essaisFinition = 3000) {
  const prep = preparer(objets);
  const index = new Map([...new Set(pokemon.flatMap((p) => p.gouts))].sort().map((g, i) => [g, i]));
  const masques = new Map(pokemon.map((p) => [p.id, masque(p, index)]));
  const parId = new Map(pokemon.map((p) => [p.id, p]));
  // maison construite : { habitants: [ids], objets: [ids] } (ou l'ancienne forme, une simple liste d'ids)
  verrouillees = verrouillees.map((v) => (Array.isArray(v) ? { habitants: v, objets: null } : v));
  const pris = new Set(verrouillees.flatMap((v) => v.habitants));
  const logeables = pokemon.filter((p) => !pris.has(p.id) && p.environnement && p.gouts.length >= 5);
  const voulues = MAISONS_VOULUES.map((ids) => logeables.filter((p) => ids.includes(p.id))).filter((m) => m.length);
  const aLoger = logeables.filter((p) => !voulues.flat().includes(p));
  const logement = environnementsDeLogement(aLoger);
  const parEnv = new Map();
  for (const p of aLoger) {
    const env = logement.get(p.id);
    if (!parEnv.has(env)) parEnv.set(env, []);
    parEnv.get(env).push(p);
  }
  const parIdObjet = new Map(objets.map((o) => [o.id, o]));
  const maisons = [];
  const finales = [];
  for (const habitants of voulues) maisons.push({ habitants, verrouillee: false, environnement: environnementCommun(habitants), famille: false });
  for (const v of verrouillees) {
    const habitants = v.habitants.map((id) => parId.get(id)).filter(Boolean);
    if (!habitants.length) continue;
    // un objet qui n'est plus dans les données (après une mise à jour) : on rechoisit les objets
    const manquant = v.objets?.some((id) => !id.startsWith("libre-") && !parIdObjet.has(id));
    const fixes = manquant ? null : v.objets?.map((id) => parIdObjet.get(id) || { id, usage: id.replace("libre-", ""), gouts: [], testes: [], libre: true });
    // une maison construite garde ses objets : on ne fait que recompter ce qu'ils couvrent
    const environnement = environnementCommun(habitants);
    finales.push(fixes
      ? { habitants, verrouillee: true, environnement, ...evaluer(habitants, fixes) }
      : { habitants, verrouillee: true, environnement });
  }
  for (const [environnement, groupe] of [...parEnv].sort(([a], [b]) => a.localeCompare(b))) {
    const { fixes, seuls } = partagerEnvironnement(groupe, masques, prep);
    const memo = new Map();
    ameliorer(seuls, (m) => coutReel(m, prep, memo), 1, () => memo.size > essaisFinition);
    for (const m of [...fixes, ...seuls]) maisons.push({ habitants: plat(m), verrouillee: false, environnement, famille: m.length === 1 && m[0].length > 1 });
  }
  const parNum = (a, b) => a.num - b.num || a.id.localeCompare(b.id);
  return [...finales, ...maisons]
    .map((m) => (m.objets ? m : { ...m, ...objetsPourMaison(m.habitants, prep) }))
    .map((m) => {
      // habitants dans l'ordre du Pokédex ; « couverts » suit le même ordre
      const ordre = m.habitants.map((p, i) => [p, m.couverts[i]]).sort(([a], [b]) => parNum(a, b));
      return { ...m, habitants: ordre.map(([p]) => p), couverts: ordre.map(([, c]) => c) };
    });
}

// Ce que couvre une liste d'objets donnée (maison déjà construite).
function evaluer(habitants, objets) {
  const couverts = habitants.map((p) => p.gouts.filter((g) => objets.some((o) => o.gouts.includes(g))));
  const manques = habitants
    .map((p, i) => ({ id: p.id, manque: Math.max(0, GOUTS_A_COUVRIR - couverts[i].length) }))
    .filter((m) => m.manque);
  return { objets, couverts, manques, marge: 0 };
}
