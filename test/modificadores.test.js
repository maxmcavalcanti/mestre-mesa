import { test } from "node:test";
import assert from "node:assert/strict";
import { modificador, comSinal, normalizaAtributo } from "../src/modificadores.js";

test("modificador segue a regra do d20 (5e)", () => {
  assert.equal(modificador(10), 0);
  assert.equal(modificador(11), 0);
  assert.equal(modificador(14), 2);
  assert.equal(modificador(8), -1);
  assert.equal(modificador(7), -2);
  assert.equal(modificador(20), 5);
});

test("comSinal formata com sinal explícito", () => {
  assert.equal(comSinal(2), "+2");
  assert.equal(comSinal(0), "+0");
  assert.equal(comSinal(-1), "-1");
});

test("normalizaAtributo remove acentos e expande apelidos", () => {
  assert.equal(normalizaAtributo("Força"), "forca");
  assert.equal(normalizaAtributo("FORCA"), "forca");
  assert.equal(normalizaAtributo("for"), "forca");
  assert.equal(normalizaAtributo("des"), "destreza");
  assert.equal(normalizaAtributo("Inteligência"), "inteligencia");
  assert.equal(normalizaAtributo("destreza"), "destreza");
});
