import { test } from "node:test";
import assert from "node:assert/strict";
import { cosseno } from "../src/memoria.js";

const perto = (x, alvo) => assert.ok(Math.abs(x - alvo) < 1e-9, `${x} ≈ ${alvo}`);

test("cosseno: vetores idênticos = 1", () => {
  perto(cosseno([1, 2, 3], [1, 2, 3]), 1);
});

test("cosseno: mesma direção (escala diferente) = 1", () => {
  perto(cosseno([1, 2, 3], [2, 4, 6]), 1);
});

test("cosseno: ortogonais = 0", () => {
  perto(cosseno([1, 0], [0, 1]), 0);
});

test("cosseno: opostos = -1", () => {
  perto(cosseno([1, 1], [-1, -1]), -1);
});

test("cosseno: vetor zero não quebra (devolve 0)", () => {
  assert.equal(cosseno([0, 0], [1, 1]), 0);
});
