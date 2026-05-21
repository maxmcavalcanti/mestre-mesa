// B1 — resumo rolante.
// Joga turnos suficientes pra disparar a sumarização e mostra (1) o resumo sendo
// gerado e (2) ele injetado no system dos turnos seguintes.
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { lerPromptBase } from "../src/estado.js";
import { criarCampanha, criarPersonagem } from "../src/dados.js";
import { processarAcao } from "../src/jogo.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const promptBase = await lerPromptBase();

// Provider fake: distingue pedido de resumo (system tem "diário") de narração.
const ref = { resumosPedidos: 0, ultimoSystemNarracao: "" };
const provider = async (system) => {
  if (system.includes("diário")) {
    ref.resumosPedidos++;
    return "RESUMO: o herói falou com o ferreiro assustado, achou a pedra branca e desceu ao salão do sarcófago.";
  }
  ref.ultimoSystemNarracao = system;
  return "A cena avança um pouco.";
};

const c = await criarCampanha({ titulo: "tmp resumo" });
const p = await criarPersonagem(c.id, { nome: "Aventureiro" });

// 16 ações -> 32 mensagens; passa do limiar e dispara o resumo.
for (let i = 1; i <= 16; i++) {
  await processarAcao({ campanha: c, personagem: p, entrada: `ação número ${i} na cripta`, provider, promptBase });
}

console.log(`Mensagens no histórico: ${c.historico.length}`);
console.log(`Pedidos de resumo disparados: ${ref.resumosPedidos}`);
console.log(`resumo_ate: ${c.resumo_ate}`);
console.log(`resumo guardado: ${c.resumo ? "SIM" : "NÃO"}`);
console.log(`  "${c.resumo}"`);

const injetado =
  ref.ultimoSystemNarracao.includes("## História até agora") &&
  ref.ultimoSystemNarracao.includes("RESUMO:");
console.log(`\nResumo injetado no system dos turnos seguintes? ${injetado ? "SIM ✅" : "NÃO ❌"}`);

await rm(join(raiz, "data", "campanhas", c.id), { recursive: true, force: true });
console.log("(campanha temporária removida)");
