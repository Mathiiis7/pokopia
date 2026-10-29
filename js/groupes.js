// Forme les maisons de 4 Pokémon et choisit les objets à y poser.
// Pur calcul, sans page : utilisable dans le navigateur et avec node pour les essais.
//
// Règles (docs/regles-joenesteam.md) :
// - une maison = 4 Pokémon au plus, tous du même environnement ;
// - chaque Pokémon est comblé quand 4 de ses 5 goûts sont couverts par des objets de la maison ;
// - il faut au moins un objet de repos, un de décoration et un jouet ;
// - un objet compte pour tous les goûts qu'il porte et pour tous les habitants.
//
// Ce qu'on cherche, dans l'ordre : aucun Pokémon pas comblé, le moins d'objets possible,
// puis le plus de goûts couverts (les 5 plutôt que 4 : de la marge si un Pokémon fait un
// « caprice » et refuse un objet), par des objets testés en jeu et qui ont un nom français.

export const TAILLE_MAISON = 4;
export const GOUTS_A_COUVRIR = 4;
export const USAGES = ["repos", "deco", "jouet"];
const OBJETS_PAR_GOUT = 12;

// Valeur d'un goût couvert par un objet : testé en jeu par JoeNesTeam > vu seulement sur Serebii.
function valeur(objet, gout) {
  return (objet.testes.includes(gout) ? 1 : 0.85) - (objet.fr ? 0 : 0.05);
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
  const note = (o) => o.testes.length + 0.5 * o.gouts.length + (o.fr ? 0.5 : 0);
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
// Choix de Mathis (29/10/2026) : une famille vit ensemble. Dans un même environnement,
// une famille de 3 ou 4 a sa maison à elle ; une famille de 2 ou un Pokémon seul
// complètent les maisons avec les plus compatibles. Une famille dont l'environnement
// diffère est séparée par environnement (fait en amont : on travaille environnement par environnement).
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

function partagerEnvironnement(pokemon, masques) {
  const cout = (m) => goutsDifferents(m, masques);
  const toutes = unites(pokemon);
  const fixes = toutes.filter((u) => u.length >= 3).map((u) => [u]);
  // départ : les familles de 2 d'abord, puis chaque maison prend l'unité qui lui coûte le moins
  const restantes = toutes.filter((u) => u.length < 3).sort((a, b) => b.length - a.length);
  const souples = [];
  while (restantes.length) {
    const maison = [restantes.shift()];
    while (taille(maison) < TAILLE_MAISON) {
      let iMeilleur = -1, meilleur = Infinity;
      const base = cout(plat(maison));
      restantes.forEach((u, i) => {
        if (taille(maison) + u.length > TAILLE_MAISON) return;
        // coût par Pokémon ajouté, pour ne pas défavoriser les familles de 2
        const c = (cout(plat([...maison, u])) - base) / u.length;
        if (c < meilleur) { meilleur = c; iMeilleur = i; }
      });
      if (iMeilleur < 0) break;
      maison.push(restantes.splice(iMeilleur, 1)[0]);
    }
    souples.push(maison);
  }
  ameliorer(souples, cout, 10);
  return { fixes, souples };
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
  const parEnv = new Map();
  for (const p of pokemon) {
    if (pris.has(p.id) || !p.environnement || p.gouts.length < 5) continue;
    if (!parEnv.has(p.environnement)) parEnv.set(p.environnement, []);
    parEnv.get(p.environnement).push(p);
  }
  const parIdObjet = new Map(objets.map((o) => [o.id, o]));
  const maisons = [];
  const finales = [];
  for (const v of verrouillees) {
    const habitants = v.habitants.map((id) => parId.get(id)).filter(Boolean);
    if (!habitants.length) continue;
    const fixes = v.objets?.map((id) => parIdObjet.get(id) || { id, usage: id.replace("libre-", ""), gouts: [], testes: [], libre: true });
    // une maison construite garde ses objets : on ne fait que recompter ce qu'ils couvrent
    finales.push(fixes
      ? { habitants, verrouillee: true, environnement: habitants[0].environnement, ...evaluer(habitants, fixes) }
      : { habitants, verrouillee: true });
  }
  for (const [, groupe] of [...parEnv].sort(([a], [b]) => a.localeCompare(b))) {
    const { fixes, souples } = partagerEnvironnement(groupe, masques);
    const memo = new Map();
    ameliorer(souples, (m) => coutReel(m, prep, memo), 1, () => memo.size > essaisFinition);
    for (const m of [...fixes, ...souples]) maisons.push({ habitants: plat(m), verrouillee: false, famille: m.length === 1 && m[0].length > 1 });
  }
  const parNum = (a, b) => a.num - b.num || a.id.localeCompare(b.id);
  return [...finales, ...maisons]
    .map((m) => (m.objets ? m : { ...m, environnement: m.habitants[0].environnement, ...objetsPourMaison(m.habitants, prep) }))
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
