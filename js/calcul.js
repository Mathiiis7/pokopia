// Calcul des maisons à part de la page, pour qu'elle reste fluide pendant qu'il tourne.
import { formerMaisons } from "./groupes.js";

let objets = null;

self.onmessage = ({ data }) => {
  if (data.objets) objets = data.objets;
  const maisons = formerMaisons(data.pokemon, objets, data.construites, data.essais);
  // on ne renvoie que des ids : la page retrouve Pokémon et objets dans ses données
  self.postMessage({
    demande: data.demande,
    maisons: maisons.map((m) => ({
      habitants: m.habitants.map((p) => p.id),
      objets: m.objets.map((o) => o.id),
      couverts: m.couverts,
      manques: m.manques,
      environnement: m.environnement,
      verrouillee: m.verrouillee,
    })),
  });
};
