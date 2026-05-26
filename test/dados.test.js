import { test } from "node:test";
import assert from "node:assert/strict";
import { comCampanha, normalizarVozTts } from "../src/dados.js";

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test("comCampanha serializa o read-modify-write na mesma campanha (sem lost update)", async () => {
  let valor = 0;
  // Cada tarefa lê, espera um tick e escreve lido+1. Sem o lock, as três leriam
  // 0 e o resultado final seria 1; com o lock, rodam em sequência -> 3.
  const incr = () =>
    comCampanha("a", async () => {
      const lido = valor;
      await tick();
      valor = lido + 1;
    });
  await Promise.all([incr(), incr(), incr()]);
  assert.equal(valor, 3);
});

test("comCampanha roda campanhas diferentes em paralelo", async () => {
  const ordem = [];
  const lenta = comCampanha("x", async () => {
    await tick(20);
    ordem.push("x");
  });
  const rapida = comCampanha("y", async () => {
    await tick(1);
    ordem.push("y");
  });
  await Promise.all([lenta, rapida]);
  // y é mais rápida e, por ser outra campanha, não espera x -> termina antes.
  assert.deepEqual(ordem, ["y", "x"]);
});

test("comCampanha devolve o valor da tarefa", async () => {
  const r = await comCampanha("a", async () => 42);
  assert.equal(r, 42);
});

test("comCampanha propaga o erro ao chamador, mas não trava a fila", async () => {
  await assert.rejects(
    comCampanha("z", async () => {
      throw new Error("boom");
    }),
    /boom/,
  );
  let rodou = false;
  await comCampanha("z", async () => {
    rodou = true;
  });
  assert.equal(rodou, true);
});

test("normalizarVozTts aceita masc e fem", () => {
  assert.equal(normalizarVozTts("masc"), "masc");
  assert.equal(normalizarVozTts("fem"), "fem");
});

test("normalizarVozTts vira null para qualquer outro valor", () => {
  assert.equal(normalizarVozTts(""), null);
  assert.equal(normalizarVozTts(null), null);
  assert.equal(normalizarVozTts(undefined), null);
  assert.equal(normalizarVozTts("MASC"), null); // case-sensitive
  assert.equal(normalizarVozTts("xyz"), null);
});
