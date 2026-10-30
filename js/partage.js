// Partage de la partie entre appareils, par un code secret (voir docs/supabase.sql).
// Envoi juste après chaque changement ; lecture au retour sur la page et toutes les 10 s.
// Rien n'est écrasé : on lit d'abord la partie enregistrée, puis on réunit les changements (fusion.js).
import { SUPABASE_URL, SUPABASE_CLE } from "./config.js";
import { obtenir, abonner, remplacer } from "./etat.js";
import { fusionner, memeContenu } from "./fusion.js";

const CLE_CODE = "pokopia-code";
const CLE_BASE = "pokopia-base";  // la dernière version sur laquelle les appareils étaient d'accord
export const actif = Boolean(SUPABASE_URL && SUPABASE_CLE);
let statut = "";            // texte affiché sous le réglage
const ecouteurs = new Set();

function dire(t) { statut = t; for (const f of ecouteurs) f(t); }
export const surStatut = (f) => { ecouteurs.add(f); f(statut); };
export const statutActuel = () => statut;

export function code() {
  try { return localStorage.getItem(CLE_CODE) || ""; } catch { return ""; }
}

function garderCode(c) {
  try { if (c) localStorage.setItem(CLE_CODE, c); else localStorage.removeItem(CLE_CODE); } catch { /* rien */ }
}

function lireBase() {
  try { return JSON.parse(localStorage.getItem(CLE_BASE)); } catch { return null; }
}

function garderBase(e) {
  try { if (e) localStorage.setItem(CLE_BASE, JSON.stringify(e)); else localStorage.removeItem(CLE_BASE); } catch { /* rien */ }
}

export function nouveauCode() {
  const octets = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...octets)).replace(/\+/g, "-").replace(/\//g, "_"); // 24 caractères
}

async function rpc(nom, corps) {
  const texteCorps = JSON.stringify(corps);
  const rep = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: "POST",
    headers: { apikey: SUPABASE_CLE, Authorization: `Bearer ${SUPABASE_CLE}`, "Content-Type": "application/json" },
    body: texteCorps,
    keepalive: document.hidden && texteCorps.length < 60000, // la page se ferme : finir quand même l'envoi
  });
  if (!rep.ok) throw new Error(`${rep.status} ${await rep.text()}`);
  const texte = await rep.text();
  return texte ? JSON.parse(texte) : null;
}

// Un seul échange à la fois ; celui en attente verra de toute façon le dernier état.
let file = Promise.resolve(), enAttente = false;
function synchroniser(prendreDistant = false) {
  if (enAttente && !prendreDistant) return file;
  enAttente = true;
  file = file.then(() => { enAttente = false; return echanger(prendreDistant); });
  return file;
}

// prendreDistant : sur le deuxième appareil, la partie déjà enregistrée gagne toujours,
// même si on y avait coché quelque chose avant de le brancher.
async function echanger(prendreDistant) {
  const c = code();
  if (!c) return;
  try {
    const distant = await rpc("lire_partie", { p_code: c });
    if (code() !== c) return; // débranché entre-temps
    if (!distant && prendreDistant) { dire("Ce code ne correspond à aucune partie : vérifie-le"); garderCode(""); return; }
    const local = obtenir();
    const fusion = !distant ? local : prendreDistant ? distant : fusionner(lireBase(), local, distant);
    if (!memeContenu(fusion, local)) remplacer(fusion);
    if (!distant || !memeContenu(fusion, distant)) await rpc("ecrire_partie", { p_code: c, p_etat: fusion });
    garderBase(fusion);
    dire(`À jour à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`);
  } catch {
    dire("Pas de connexion : ce sera envoyé plus tard");
  }
}

// Brancher le partage avec ce code (nouveau, recopié de l'autre appareil, ou le lien entier).
export async function utiliserCode(c, prendreDistant = true) {
  const lien = c.match(/#partie\/(.+)$/);
  garderCode(lien ? decodeURIComponent(lien[1]).trim() : c.trim());
  garderBase(null);
  await synchroniser(prendreDistant);
}

export const lienPartie = () => `${location.origin}${location.pathname}#partie/${encodeURIComponent(code())}`;

export function arreter() { garderCode(""); garderBase(null); dire(""); }

export function demarrer() {
  if (!actif) return;
  let envoiPrevu = null;
  abonner((e, origine) => {
    if (origine !== "local" || !code()) return;
    clearTimeout(envoiPrevu);
    envoiPrevu = setTimeout(synchroniser, 500);
  });
  // en quittant la page (retour au jeu, téléphone verrouillé) comme en y revenant
  document.addEventListener("visibilitychange", () => { clearTimeout(envoiPrevu); synchroniser(); });
  for (const evenement of ["focus", "online", "pageshow"]) window.addEventListener(evenement, () => synchroniser());
  setInterval(() => { if (!document.hidden) synchroniser(); }, 10000);
  // lien d'un autre appareil : …/#partie/CODE
  const m = location.hash.match(/^#partie\/(.+)$/);
  if (m) { utiliserCode(decodeURIComponent(m[1])); location.hash = "#maisons"; }
  else synchroniser();
}
