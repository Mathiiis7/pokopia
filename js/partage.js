// Partage de la partie entre appareils, par un code secret (voir docs/supabase.sql).
// Envoi peu après chaque changement ; lecture au retour sur la page et toutes les 30 s.
// En cas de conflit, la version modifiée le plus récemment gagne.
import { SUPABASE_URL, SUPABASE_CLE } from "./config.js";
import { obtenir, abonner, remplacer } from "./etat.js";

const CLE_CODE = "pokopia-code";
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

export function nouveauCode() {
  const octets = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...octets)).replace(/\+/g, "-").replace(/\//g, "_"); // 24 caractères
}

async function rpc(nom, corps) {
  const rep = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: "POST",
    headers: { apikey: SUPABASE_CLE, Authorization: `Bearer ${SUPABASE_CLE}`, "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  if (!rep.ok) throw new Error(`${rep.status} ${await rep.text()}`);
  const texte = await rep.text();
  return texte ? JSON.parse(texte) : null;
}

let envoiPrevu = null, dernierEnvoye = 0;
async function envoyer() {
  const c = code();
  if (!c) return;
  const e = obtenir();
  try {
    await rpc("ecrire_partie", { p_code: c, p_etat: e });
    dernierEnvoye = e.modifie;
    dire(`Enregistré à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`);
  } catch {
    dire("Pas de connexion : ce sera envoyé plus tard");
  }
}

// prendreDistant : sur le deuxième appareil, la partie déjà enregistrée gagne toujours,
// même si on y avait coché quelque chose avant de le brancher.
export async function recevoir(prendreDistant = false) {
  const c = code();
  if (!c) return;
  try {
    const distant = await rpc("lire_partie", { p_code: c });
    const local = obtenir();
    if (!distant) {
      if (prendreDistant) { dire("Ce code ne correspond à aucune partie : vérifie-le"); garderCode(""); return; }
      await envoyer(); return;                                // partie neuve : on la crée
    }
    if (prendreDistant || (distant.modifie || 0) > (local.modifie || 0)) {
      remplacer(distant);
      dernierEnvoye = distant.modifie;
      dire("À jour avec ton autre appareil");
    } else if ((local.modifie || 0) > dernierEnvoye) {
      await envoyer();
    }
  } catch {
    dire("Pas de connexion pour l'instant");
  }
}

// Brancher le partage avec ce code (nouveau ou recopié de l'autre appareil).
export async function utiliserCode(c, prendreDistant = true) {
  garderCode(c.trim());
  dernierEnvoye = 0;
  await recevoir(prendreDistant);
}

export const lienPartie = () => `${location.origin}${location.pathname}#partie/${encodeURIComponent(code())}`;

export function arreter() { garderCode(""); dire(""); }

export function demarrer() {
  if (!actif) return;
  abonner((e, origine) => {
    if (origine !== "local" || !code()) return;
    clearTimeout(envoiPrevu);
    envoiPrevu = setTimeout(envoyer, 1500);
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) recevoir(); });
  setInterval(() => { if (!document.hidden) recevoir(); }, 30000);
  // lien d'un autre appareil : …/#partie/CODE
  const m = location.hash.match(/^#partie\/(.+)$/);
  if (m) { utiliserCode(decodeURIComponent(m[1])); location.hash = "#maisons"; }
  else recevoir();
}
