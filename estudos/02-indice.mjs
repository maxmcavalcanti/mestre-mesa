// A3 — smoke test do índice vetorial (src/memoria.js).
// Cria uma campanha temporária, indexa beats e faz buscas. Limpa no fim.
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { criarCampanha } from "../src/dados.js";
import { indexar, buscar } from "../src/memoria.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const c = await criarCampanha({ titulo: "tmp indice" });

const beats = [
  "Jogador: pergunto ao ferreiro sobre a cripta.\nMestre: o ferreiro de Pedra Cinza fica apavorado e se recusa a falar.",
  "Jogador: abro a caixa de madeira.\nMestre: dentro há uma pedra branca, lisa como água, com um furo no centro.",
  "Jogador: forço a porta.\nMestre: a porta de pedra range e cede; um corredor úmido se abre.",
  "Jogador: me escondo e observo.\nMestre: um corpo pálido emerge do sarcófago no salão subterrâneo.",
];

let turno = 1;
for (const texto of beats) await indexar(c.id, { turno: turno++, texto });
console.log(`Indexei ${beats.length} beats na campanha ${c.id}.\n`);

for (const q of ["por que o NPC tinha medo?", "o que achei na caixa?", "que criatura apareceu?"]) {
  const res = await buscar(c.id, q, { topK: 2 });
  console.log(`❓ ${q}`);
  for (const r of res) console.log(`   ${r.score.toFixed(3)} [t${r.turno}] ${r.texto.replace(/\n/g, " | ")}`);
  console.log("");
}

await rm(join(raiz, "data", "campanhas", c.id), { recursive: true, force: true });
console.log("(campanha temporária removida)");
