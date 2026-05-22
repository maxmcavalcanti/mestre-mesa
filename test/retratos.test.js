import { test } from "node:test";
import assert from "node:assert/strict";
import { retratoClasse } from "../src/dominio/retratos.js";

test("retratoClasse casa a classe por palavra-chave", () => {
  assert.equal(retratoClasse("Guerreiro"), "⚔️");
  assert.equal(retratoClasse("Mago"), "🧙");
  assert.equal(retratoClasse("Ladino"), "🗡️");
  assert.equal(retratoClasse("Patrulheiro"), "🏹");
});

test("retratoClasse ignora acentos e caixa", () => {
  assert.equal(retratoClasse("BÁRBARO"), "🪓");
  assert.equal(retratoClasse("clérigo"), "✨");
  assert.equal(retratoClasse("Bárbara da Montanha"), "🪓"); // casa por substring
});

test("retratoClasse cai no padrão para classe desconhecida ou vazia", () => {
  assert.equal(retratoClasse("Alquimista das Estrelas"), "🧑");
  assert.equal(retratoClasse(""), "🧑");
  assert.equal(retratoClasse(undefined), "🧑");
});

test("retratoClasse: Andarilho (classe padrão) tem retrato próprio", () => {
  assert.equal(retratoClasse("Andarilho"), "🧭");
});
