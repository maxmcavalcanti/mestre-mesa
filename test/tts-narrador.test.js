import { test } from "node:test";
import assert from "node:assert/strict";
import { criarNarrador } from "../src/tts/narrador.js";

// sala fake que captura mensagens transmitidas
function salaFake() {
  const mensagens = [];
  return {
    mensagens,
    transmitir(id, obj) { mensagens.push({ id, ...obj }); },
  };
}

// narrar fake: resolve com url = `voz/<texto>` pra ficar fácil de assertar
function narrarFake() {
  const calls = [];
  const fn = async (texto, voz) => {
    calls.push({ texto, voz });
    return { hash: "h-" + calls.length, url: `/audio/${voz}-${calls.length}.wav`, cached: false };
  };
  fn.calls = calls;
  return fn;
}

async function alimentar(n, deltas) {
  for (const d of deltas) n.onDelta(d);
  await n.fim();
}

test("prosa pura sai em sentenças, com 1 audio event por sentença", async () => {
  const sala = salaFake();
  const narrar = narrarFake();
  const n = criarNarrador({ sala, campanhaId: "c1", voz: "masc", narrar });
  await alimentar(n, ["Você abre a porta. ", "Lá dentro, escuro."]);
  assert.equal(narrar.calls.length, 2);
  assert.deepEqual(narrar.calls.map((c) => c.texto), [
    "Você abre a porta.",
    "Lá dentro, escuro.",
  ]);
  // todas as msgs são audio events, na ordem
  assert.deepEqual(
    sala.mensagens.map((m) => m.url),
    ["/audio/masc-1.wav", "/audio/masc-2.wav"],
  );
});

test("remove [TESTE] inline antes da sentença", async () => {
  const sala = salaFake();
  const narrar = narrarFake();
  const n = criarNarrador({ sala, campanhaId: "c1", voz: "fem", narrar });
  await alimentar(n, [
    "A porta range. [TESTE] atributo=destreza cd=12\n",
    "Você esquiva no último segundo.",
  ]);
  assert.deepEqual(narrar.calls.map((c) => c.texto), [
    "A porta range.",
    "Você esquiva no último segundo.",
  ]);
});

test("remove [ESTADO] no fim de linha", async () => {
  const sala = salaFake();
  const narrar = narrarFake();
  const n = criarNarrador({ sala, campanhaId: "c1", voz: "masc", narrar });
  await alimentar(n, ["Você bebe a poção. [ESTADO] hp += 5\nVoltando ao caminho."]);
  assert.deepEqual(narrar.calls.map((c) => c.texto), [
    "Você bebe a poção.",
    "Voltando ao caminho.",
  ]);
});

test("preserva colchetes em prosa quando não casam tags conhecidas", async () => {
  const sala = salaFake();
  const narrar = narrarFake();
  const n = criarNarrador({ sala, campanhaId: "c1", voz: "fem", narrar });
  // o [tropeço] é texto comum, supera o limite sem casar TAG -> devolve pra prosa
  await alimentar(n, ["Algum aviso [tropeço] aparece sem motivo aqui. Pronto."]);
  assert.ok(
    narrar.calls.some((c) => /tropeço/.test(c.texto)),
    `esperava ver [tropeço] preservado, vi: ${JSON.stringify(narrar.calls)}`,
  );
});

test("ordem dos audio events é preservada mesmo com TTS resolvendo fora de ordem", async () => {
  const sala = salaFake();
  // narrar fake com latência inversa: 1a chamada demora 20ms, 2a 5ms
  let i = 0;
  const narrar = async (texto, voz) => {
    const k = ++i;
    await new Promise((r) => setTimeout(r, k === 1 ? 20 : 5));
    return { hash: "h" + k, url: `/audio/${voz}-${k}.wav`, cached: false };
  };
  const n = criarNarrador({ sala, campanhaId: "c1", voz: "masc", narrar });
  await alimentar(n, ["Primeira. Segunda."]);
  assert.deepEqual(
    sala.mensagens.map((m) => m.url),
    ["/audio/masc-1.wav", "/audio/masc-2.wav"],
  );
});

test("fim() flushea o resto sem terminador final", async () => {
  const sala = salaFake();
  const narrar = narrarFake();
  const n = criarNarrador({ sala, campanhaId: "c1", voz: "fem", narrar });
  // último pedaço sem ponto final — fim() ainda envia
  await alimentar(n, ["Primeiro. ", "Sem terminar"]);
  assert.deepEqual(narrar.calls.map((c) => c.texto), [
    "Primeiro.",
    "Sem terminar",
  ]);
});

test("descarta tag parcial sem newline ao chamar fim()", async () => {
  const sala = salaFake();
  const narrar = narrarFake();
  const n = criarNarrador({ sala, campanhaId: "c1", voz: "masc", narrar });
  await alimentar(n, ["Texto bom. [TESTE atributo="]);
  // só "Texto bom." vira áudio; o resto (tag parcial) é descartado
  assert.deepEqual(narrar.calls.map((c) => c.texto), ["Texto bom."]);
});

test("retorna nulo do narrar não quebra o fluxo", async () => {
  const sala = salaFake();
  const narrar = async () => null; // simula TTS desabilitado/erro
  const n = criarNarrador({ sala, campanhaId: "c1", voz: "masc", narrar });
  await alimentar(n, ["Frase um. Frase dois."]);
  // nenhuma msg transmitida — narrar devolveu null
  assert.equal(sala.mensagens.length, 0);
});
