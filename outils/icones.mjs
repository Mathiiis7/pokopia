// Fabrique les icônes de l'appli : une maison blanche sur vert forêt (même méthode que l'appli QG :
// dessin SVG photographié par Edge sans fenêtre). Usage : node outils/icones.mjs
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const racine = new URL("../", import.meta.url);

// La maison tient dans la zone sûre du téléphone (cercle de 40 % du bord), qui découpe l'icône lui-même.
const dessin = (rx) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${rx}" fill="#1d6b4f"/>
  <path d="M50 27 L74 47 V73 H58 V58 H42 V73 H26 V47 Z" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;

const dossier = new URL("icones/", racine);
mkdirSync(dossier, { recursive: true });
writeFileSync(new URL("icone.svg", dossier), dessin(22));

const page = (t, rond) => `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; width: ${t}px; height: ${t}px; overflow: hidden; background: ${rond ? "transparent" : "#1d6b4f"}; }
svg { display: block; width: ${t}px; height: ${t}px; }
</style></head><body>${dessin(rond ? 22 : 0)}</body></html>`;

const brouillon = new URL("outils/icone-temp.html", racine);
for (const [t, rond] of [[180], [192], [512], [192, true], [512, true]]) {
  writeFileSync(brouillon, page(t, rond));
  execFileSync(EDGE, [
    "--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--virtual-time-budget=1000", "--default-background-color=00000000", `--window-size=${t},${t}`,
    `--screenshot=${fileURLToPath(new URL(`icone-${rond ? "rond-" : ""}${t}.png`, dossier))}`, brouillon.href,
  ], { stdio: "ignore" });
}
rmSync(brouillon);
console.log("icônes écrites");
