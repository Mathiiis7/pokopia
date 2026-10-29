// Faux Supabase pour essayer le partage sans compte : les deux fonctions de docs/supabase.sql,
// gardées en mémoire. Usage : node outils/faux-supabase.mjs   (port 8643)
// puis, le temps de l'essai, SUPABASE_URL = "http://localhost:8643" et une clé quelconque dans js/config.js.
import { createServer } from "node:http";

const parties = new Map();
createServer((req, rep) => {
  rep.setHeader("Access-Control-Allow-Origin", "*");
  rep.setHeader("Access-Control-Allow-Headers", "apikey, authorization, content-type");
  if (req.method === "OPTIONS") return rep.end();
  let corps = "";
  req.on("data", (d) => (corps += d));
  req.on("end", () => {
    const { p_code, p_etat } = JSON.parse(corps || "{}");
    rep.setHeader("Content-Type", "application/json");
    if (req.url.endsWith("/rpc/lire_partie")) return rep.end(JSON.stringify(parties.get(p_code) ?? null));
    if (req.url.endsWith("/rpc/ecrire_partie")) {
      if (!p_code || p_code.length < 24) { rep.statusCode = 400; return rep.end('{"message":"code trop court"}'); }
      parties.set(p_code, p_etat);
      rep.statusCode = 204;
      return rep.end();
    }
    rep.statusCode = 404; rep.end("{}");
  });
}).listen(8643, () => console.log("faux Supabase sur http://localhost:8643"));
