import readline from "node:readline";
import { stdin, stdout } from "node:process";

import { lerPromptBase } from "./src/estado.js";
import {
  listarCampanhas,
  carregarCampanha,
  salvarCampanha,
  criarCampanha,
  listarPersonagens,
  criarPersonagem,
  salvarPersonagem,
} from "./src/dados.js";
import { criarProvider } from "./src/llm/provider.js";
import { processarAcao, resolverRolagem } from "./src/jogo.js";
import { comSinal, modificador } from "./src/dominio/modificadores.js";

const ABERTURA =
  "Comece a aventura: descreva a cena inicial em segunda pessoa e termine perguntando o que eu faço.";

// Leitor de linha com fila: trata stdin canalizado (EOF) e interativo do mesmo jeito.
const rl = readline.createInterface({ input: stdin });
const fila = [];
let aguardando = null;
let fechado = false;
rl.on("line", (linha) => {
  if (aguardando) {
    const r = aguardando;
    aguardando = null;
    r(linha);
  } else fila.push(linha);
});
rl.on("close", () => {
  fechado = true;
  if (aguardando) {
    const r = aguardando;
    aguardando = null;
    r(null);
  }
});
function pergunta(prompt) {
  stdout.write(prompt);
  if (fila.length) return Promise.resolve(fila.shift());
  if (fechado) return Promise.resolve(null);
  return new Promise((r) => (aguardando = r));
}

async function escolherCampanha() {
  const campanhas = await listarCampanhas();
  if (campanhas.length === 0) {
    console.log("Nenhuma campanha encontrada. Criando uma nova...");
    const nova = await criarCampanha({ titulo: "Nova Aventura" });
    return nova.id;
  }
  if (campanhas.length === 1) return campanhas[0].id;

  console.log("\nCampanhas:");
  campanhas.forEach((c, i) => console.log(`  ${i + 1}. ${c.titulo}`));
  while (true) {
    const resp = await pergunta("escolha (número): ");
    if (resp === null) process.exit(0);
    const i = parseInt(resp.trim(), 10) - 1;
    if (campanhas[i]) return campanhas[i].id;
  }
}

async function escolherPersonagem(campanha) {
  const personagens = await listarPersonagens(campanha.id);
  if (personagens.length === 0) {
    const novo = await criarPersonagem(campanha.id, { nome: "Aventureiro" });
    campanha.turno_de = novo.id;
    await salvarCampanha(campanha);
    return novo;
  }
  const ativo =
    personagens.find((p) => p.id === campanha.turno_de) || personagens[0];
  return ativo;
}

const provider = criarProvider();
const promptBase = await lerPromptBase();

const campanhaId = await escolherCampanha();
const campanha = await carregarCampanha(campanhaId);
const personagem = await escolherPersonagem(campanha);

function imprimirMestre(texto) {
  console.log(`\n${texto}\n`);
}

async function salvarTudo() {
  await salvarCampanha(campanha);
  await salvarPersonagem(campanha.id, personagem);
}

async function pedirRolagem(teste) {
  while (true) {
    const resp = await pergunta(
      `  rolar d20 (teste de ${teste.atributo}, CD ${teste.cd}): `,
    );
    if (resp === null) return null;
    const n = parseInt(resp.trim(), 10);
    if (!Number.isNaN(n)) return n;
    console.log("  (digite só o número que saiu no dado, ex: 14)");
  }
}

async function turno(entrada) {
  let { narracao, teste } = await processarAcao({
    campanha,
    personagem,
    entrada,
    provider,
    promptBase,
  }).catch((err) => {
    console.error(`\n[erro do mestre] ${err.message}\n`);
    return { narracao: null, teste: null };
  });
  if (narracao) imprimirMestre(narracao);
  await salvarTudo();

  while (teste) {
    const dado = await pedirRolagem(teste);
    if (dado === null) return;
    const r = await resolverRolagem({
      campanha,
      personagem,
      teste,
      dado,
      provider,
      promptBase,
    });
    console.log(
      `  ${dado} ${comSinal(r.mod)} = ${r.total} vs CD ${teste.cd} -> ${r.sucesso ? "SUCESSO" : "FALHA"}\n`,
    );
    if (r.narracao) imprimirMestre(r.narracao);
    await salvarTudo();
    teste = r.teste;
  }
}

function mostrarFicha() {
  const p = personagem;
  console.log(`\n=== ${p.nome} — ${p.classe} nível ${p.nivel} ===`);
  console.log(`HP: ${p.hp}/${p.hp_max}`);
  for (const [a, v] of Object.entries(p.atributos)) {
    console.log(`  ${a}: ${v} (${comSinal(modificador(v))})`);
  }
  console.log(`Inventário: ${p.inventario.join(", ") || "(vazio)"}`);
  console.log(`Local: ${campanha.local}`);
  console.log(`Missões: ${campanha.quests.join("; ") || "(nenhuma)"}\n`);
}

console.log(`\n*** ${campanha.titulo} ***`);
console.log(`(jogando como ${personagem.nome} | provider: ${process.env.MESTRE_LLM || "mock"})`);
console.log(`(comandos: /ficha  /salvar  /sair)\n`);

if (campanha.historico.length === 0) {
  await turno(ABERTURA);
}

while (true) {
  const linha = await pergunta("> ");
  if (linha === null) break;
  const entrada = linha.trim();
  if (!entrada) continue;

  if (entrada === "/sair") break;
  if (entrada === "/ficha") {
    mostrarFicha();
    continue;
  }
  if (entrada === "/salvar") {
    await salvarTudo();
    console.log("(jogo salvo)\n");
    continue;
  }

  await turno(entrada);
}

await salvarTudo();
rl.close();
console.log("\nAté a próxima sessão.\n");
