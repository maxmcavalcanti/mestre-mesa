// Fase D — estado determinístico do mundo (NPCs + flags) ponta a ponta.
// Um provider emite [ESTADO] com npc.*/flag.*; verificamos que vira estado e que
// reaparece injetado (## Mundo) no system do turno seguinte.
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { lerPromptBase } from "../src/estado.js";
import { criarCampanha, criarPersonagem } from "../src/dados.js";
import { processarAcao } from "../src/jogo.js";
import { textoSystem } from "../src/llm/provider.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const promptBase = await lerPromptBase();
const c = await criarCampanha({ titulo: "tmp mundo" });
const p = await criarPersonagem(c.id, { nome: "Aventureiro" });

// Turno 1: o "mestre" apresenta um NPC aliado e tranca a porta.
const provider1 = async () =>
  "Garrec, o ferreiro, se junta a você e tranca a porta atrás de vocês.\n" +
  "[ESTADO] npc.garrec.nome=Garrec; npc.garrec.natureza=humano; npc.garrec.disposicao=aliado; flag.porta=trancada";
await processarAcao({ campanha: c, personagem: p, entrada: "entro na forja", provider: provider1, promptBase });

console.log("Estado guardado:");
console.log("  npcs:", JSON.stringify(c.npcs.garrec));
console.log("  flags:", JSON.stringify(c.flags));

// Turno 2: espião captura o system pra ver o bloco ## Mundo reinjetado.
let cap = "";
const spy = async (system) => { cap = textoSystem(system); return "Você observa o ferreiro."; };
await processarAcao({ campanha: c, personagem: p, entrada: "falo com Garrec", provider: spy, promptBase });

// "NPCs conhecidos:" só aparece no bloco injetado (montarMundo), não nas instruções.
const bloco = cap.split("NPCs conhecidos:")[1]?.split("\n\n")[0] || "";
console.log("\nBloco de mundo injetado no turno seguinte:");
console.log("NPCs conhecidos:" + bloco);

const ok = cap.includes("[garrec] Garrec") && cap.includes("porta: trancada");
console.log("\n" + (ok ? "✅ NPC e flag viraram estado e foram reinjetados no prompt" : "❌ falhou"));

await rm(join(raiz, "data", "campanhas", c.id), { recursive: true, force: true });
