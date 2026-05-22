import { test } from "node:test";
import assert from "node:assert/strict";

// O RAG (memoria.js -> embeddings.js) lê OLLAMA_HOST no carregamento do módulo e
// é best-effort (try/catch em jogo.js). Apontamos pra um host morto ANTES de
// importar jogo.js para que recuperarLembrancas/indexarBeat virem no-op na hora
// (ECONNREFUSED), isolando o teste na orquestração + provider mock — sem rede.
process.env.OLLAMA_HOST = "http://127.0.0.1:9";
const { processarAcao, resolverRolagem } = await import("../src/jogo.js");
const { mock } = await import("../src/llm/mock.js");

const promptBase = "Você é o mestre.";

function novaCampanha() {
  return {
    id: "teste-jogo",
    titulo: "Teste",
    local: "Entrada da cripta",
    quests: [],
    modulo: { sinopse: "", notas: "", fontes: [] },
    turno_de: null,
    historico: [],
    resumo: "",
    resumo_ate: 0,
    npcs: {},
    flags: {},
    avisos: [],
  };
}

function novoPersonagem(atributos = {}) {
  return {
    id: "lia",
    nome: "Lia",
    classe: "Andarilha",
    nivel: 1,
    hp: 12,
    hp_max: 12,
    atributos: {
      forca: 10,
      destreza: 10,
      constituicao: 10,
      inteligencia: 10,
      sabedoria: 10,
      carisma: 10,
      ...atributos,
    },
    inventario: ["adaga"],
    condicoes: [],
    tracos: "",
  };
}

function ctx(campanha, personagem) {
  return { campanha, personagem, provider: mock, promptBase };
}

test("processarAcao registra a ação do jogador e a narração do mestre no histórico", async () => {
  const campanha = novaCampanha();
  const personagem = novoPersonagem();
  const r = await processarAcao({ ...ctx(campanha, personagem), entrada: "olho ao redor" });

  assert.equal(r.teste, null);
  assert.deepEqual(r.modificados, []);
  assert.equal(campanha.historico.length, 2);
  assert.deepEqual(campanha.historico[0], { papel: "jogador", texto: "olho ao redor" });
  assert.equal(campanha.historico[1].papel, "mestre");
  assert.equal(campanha.historico[1].texto, r.narracao);
});

test("processarAcao extrai um [TESTE] e tira a tag da narração guardada", async () => {
  const campanha = novaCampanha();
  const personagem = novoPersonagem();
  const r = await processarAcao({ ...ctx(campanha, personagem), entrada: "empurro a porta" });

  assert.deepEqual(r.teste, { atributo: "forca", cd: 12 });
  assert.ok(!r.narracao.includes("[TESTE]"));
  assert.ok(!campanha.historico.at(-1).texto.includes("[TESTE]"));
});

test("resolverRolagem em sucesso aplica [ESTADO] e atualiza a campanha", async () => {
  const campanha = novaCampanha();
  const personagem = novoPersonagem();
  const teste = { atributo: "forca", cd: 12 };
  const r = await resolverRolagem({ ...ctx(campanha, personagem), teste, dado: 15 });

  assert.equal(r.sucesso, true);
  assert.equal(r.dado, 15);
  assert.equal(r.mod, 0); // força 10 -> +0
  assert.equal(r.total, 15);
  assert.equal(campanha.local, "Corredor úmido sob a cripta"); // [ESTADO] aplicado
  // registrou a linha de resultado do teste antes de narrar o desfecho
  assert.ok(campanha.historico.some((m) => m.texto.startsWith("Resultado do teste de forca")));
});

test("resolverRolagem em falha tira hp e reporta o personagem em modificados", async () => {
  const campanha = novaCampanha();
  const personagem = novoPersonagem();
  const teste = { atributo: "forca", cd: 12 };
  const r = await resolverRolagem({ ...ctx(campanha, personagem), teste, dado: 3 });

  assert.equal(r.sucesso, false);
  assert.equal(r.total, 3);
  assert.equal(personagem.hp, 10); // hp-=2
  assert.ok(r.modificados.includes("lia"));
});

test("resolverRolagem usa o modificador do atributo, não só o dado cru", async () => {
  const campanha = novaCampanha();
  const personagem = novoPersonagem({ forca: 16 }); // modificador +3
  const teste = { atributo: "forca", cd: 12 };
  // dado 10 sozinho falharia (10 < 12); com +3 vira 13 e passa.
  const r = await resolverRolagem({ ...ctx(campanha, personagem), teste, dado: 10 });

  assert.equal(r.mod, 3);
  assert.equal(r.total, 13);
  assert.equal(r.sucesso, true);
});

test("loop completo: ação -> teste -> rolagem encadeia o histórico na ordem certa", async () => {
  const campanha = novaCampanha();
  const personagem = novoPersonagem();

  const t1 = await processarAcao({ ...ctx(campanha, personagem), entrada: "forço a porta" });
  assert.deepEqual(t1.teste, { atributo: "forca", cd: 12 });

  const t2 = await resolverRolagem({ ...ctx(campanha, personagem), teste: t1.teste, dado: 18 });
  assert.equal(t2.sucesso, true);

  const papeis = campanha.historico.map((m) => m.papel);
  assert.deepEqual(papeis, ["jogador", "mestre", "jogador", "mestre"]);
  assert.equal(campanha.historico[0].texto, "forço a porta");
  assert.equal(campanha.local, "Corredor úmido sob a cripta");
});
