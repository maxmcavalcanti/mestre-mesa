// A6 — dedup por janela + recência.
// Mostra dois comportamentos:
//   (1) campanha CURTA (cabe na janela): RAG não recupera nada — tudo já está no contexto.
//   (2) campanha LONGA: um beat ANTIGO (fora da janela) é recuperado por sentido.
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { lerPromptBase } from "../src/estado.js";
import { criarCampanha, criarPersonagem } from "../src/dados.js";
import { processarAcao } from "../src/jogo.js";
import { mock } from "../src/llm/mock.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const promptBase = await lerPromptBase();

async function novaCampanha(titulo) {
  const c = await criarCampanha({ titulo });
  const p = await criarPersonagem(c.id, { nome: "Aventureiro" });
  return { c, p };
}
const limpar = (id) => rm(join(raiz, "data", "campanhas", id), { recursive: true, force: true });

// Provider espião: captura o system enviado ao mestre e devolve algo neutro.
function espiao() {
  const ref = { system: "" };
  const fn = async (system) => {
    ref.system = system;
    return "Você prossegue com cautela.";
  };
  return { fn, ref };
}
const temLembrancas = (system) => system.includes("## Lembranças");

const fillers = [
  "subo a escada de pedra", "acendo a tocha", "bebo água do cantil",
  "examino o teto abobadado", "ando pelo corredor", "afio minha adaga",
  "escuto os sons ao redor", "verifico o chão", "respiro fundo",
  "ajusto a mochila",
];

// --- (1) Campanha curta: 3 turnos ---
{
  const { c, p } = await novaCampanha("curta");
  await processarAcao({ campanha: c, personagem: p, entrada: "falo com o ferreiro sobre a maldição", provider: mock, promptBase });
  await processarAcao({ campanha: c, personagem: p, entrada: fillers[0], provider: mock, promptBase });
  const { fn, ref } = espiao();
  await processarAcao({ campanha: c, personagem: p, entrada: "o que o artesão do metal disse?", provider: fn, promptBase });
  console.log(`Campanha CURTA → bloco de lembranças no system? ${temLembrancas(ref.system) ? "SIM" : "NÃO"}`);
  console.log(temLembrancas(ref.system) ? "❌ esperava NÃO (tudo já está na janela)" : "✅ correto: nada recuperado, tudo já está no contexto");
  await limpar(c.id);
}

console.log("");

// --- (2) Campanha longa: ferreiro no início, depois muitos fillers ---
{
  const { c, p } = await novaCampanha("longa");
  await processarAcao({ campanha: c, personagem: p, entrada: "falo com o ferreiro sobre a maldição", provider: mock, promptBase });
  for (const f of fillers) {
    await processarAcao({ campanha: c, personagem: p, entrada: f, provider: mock, promptBase });
  }
  const { fn, ref } = espiao();
  await processarAcao({ campanha: c, personagem: p, entrada: "tento lembrar o que o artesão do metal me contou", provider: fn, promptBase });

  const bloco = ref.system.split("## Lembranças")[1]?.split("\n\n")[0] || "";
  console.log("Campanha LONGA → bloco recuperado:");
  console.log(bloco ? "## Lembranças" + bloco : "(vazio)");
  const ok = temLembrancas(ref.system) && bloco.toLowerCase().includes("ferreiro");
  console.log("\n" + (ok ? "✅ correto: o beat ANTIGO do ferreiro (fora da janela) foi recuperado por sentido" : "❌ não recuperou o beat esperado"));
  await limpar(c.id);
}
