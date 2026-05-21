// Fase E — canal de avisos (correção) ponta a ponta.
// O "mestre" emite um [ESTADO] inconsistente (remove item que o personagem não
// tem). O sistema gera um aviso e o injeta no prompt do turno seguinte.
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { lerPromptBase } from "../src/estado.js";
import { criarCampanha, criarPersonagem } from "../src/dados.js";
import { processarAcao } from "../src/jogo.js";
import { textoSystem } from "../src/llm/provider.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const promptBase = await lerPromptBase();
const c = await criarCampanha({ titulo: "tmp avisos" });
const p = await criarPersonagem(c.id, { nome: "Lia" }); // inventário vazio

// Turno 1: o mestre narra usar uma poção que a Lia não tem.
const provider1 = async () =>
  "Você bebe sua última poção de cura e se sente melhor.\n[ESTADO] inventario-=poção de cura";
await processarAcao({ campanha: c, personagem: p, entrada: "uso uma poção", provider: provider1, promptBase });

console.log("Avisos gerados:", JSON.stringify(c.avisos));

// Turno 2: espião captura o system pra ver o bloco ## Avisos.
let cap = "";
const spy = async (system) => { cap = textoSystem(system); return "Você revê o que tem na bolsa."; };
await processarAcao({ campanha: c, personagem: p, entrada: "confiro minha bolsa", provider: spy, promptBase });

const ok = cap.includes("## Avisos do sistema") && cap.toLowerCase().includes("poção");
const bloco = cap.split("## Avisos do sistema")[1]?.split("\n\n")[0] || "";
console.log("\nBloco injetado:\n## Avisos do sistema" + bloco);
console.log("\n" + (ok ? "✅ inconsistência virou aviso e foi injetada pro LLM corrigir" : "❌ falhou"));
console.log("Avisos após consumo (deve ser []):", JSON.stringify(c.avisos));

await rm(join(raiz, "data", "campanhas", c.id), { recursive: true, force: true });
