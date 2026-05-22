import { test } from "node:test";
import assert from "node:assert/strict";
import { resumoUso } from "../src/llm/claude.js";

const zerado = () => ({ entrada: 0, saida: 0, cacheEscrito: 0, cacheLido: 0 });

test("resumoUso formata os tokens da resposta e separa cache de entrada", () => {
  const s = resumoUso(
    { input_tokens: 30, output_tokens: 120, cache_creation_input_tokens: 0, cache_read_input_tokens: 800 },
    zerado(),
  );
  assert.match(s, /entrada 30/);
  assert.match(s, /leu 800/);
  assert.match(s, /saída 120/);
});

test("resumoUso acumula no total da sessão entre chamadas", () => {
  const totais = zerado();
  resumoUso({ input_tokens: 10, output_tokens: 50, cache_read_input_tokens: 100 }, totais);
  resumoUso({ input_tokens: 20, output_tokens: 30, cache_read_input_tokens: 200 }, totais);
  assert.equal(totais.entrada, 30);
  assert.equal(totais.saida, 80);
  assert.equal(totais.cacheLido, 300);
});

test("resumoUso conta a escrita do cache separada da leitura", () => {
  const totais = zerado();
  resumoUso({ input_tokens: 5, output_tokens: 10, cache_creation_input_tokens: 900 }, totais);
  assert.equal(totais.cacheEscrito, 900);
  assert.equal(totais.cacheLido, 0);
});

test("resumoUso tolera usage ausente (não quebra, conta zero)", () => {
  const totais = zerado();
  const s = resumoUso(undefined, totais);
  assert.match(s, /entrada 0/);
  assert.deepEqual(totais, zerado());
});
