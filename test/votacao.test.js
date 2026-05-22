import { test } from "node:test";
import assert from "node:assert/strict";
import {
  liderEfetivo,
  criarProposta,
  registrarVoto,
  todosVotaram,
  dissidentes,
  placar,
} from "../src/dominio/votacao.js";

const party = (...ids) => ids.map((id) => ({ id, nome: id.toUpperCase() }));

test("liderEfetivo usa o designado, ou cai no primeiro da party", () => {
  const ps = party("a", "b");
  assert.equal(liderEfetivo({ lider: "b" }, ps), "b");
  assert.equal(liderEfetivo({ lider: null }, ps), "a");
  assert.equal(liderEfetivo({ lider: "fantasma" }, ps), "a"); // líder não existe mais
  assert.equal(liderEfetivo({}, []), null);
});

test("criarProposta já registra o autor como 'sim'", () => {
  const p = criarProposta("a", "abrir o portão");
  assert.equal(p.autor, "a");
  assert.equal(p.texto, "abrir o portão");
  assert.deepEqual(p.votos, { a: "sim" });
});

test("registrarVoto aceita só sim/não e ignora pid vazio", () => {
  const p = criarProposta("a", "x");
  registrarVoto(p, "b", "nao");
  registrarVoto(p, "c", "talvez"); // inválido -> ignora
  registrarVoto(p, "", "sim"); // sem pid -> ignora
  assert.deepEqual(p.votos, { a: "sim", b: "nao" });
});

test("todosVotaram só quando cada personagem tem voto", () => {
  const ps = party("a", "b", "c");
  const p = criarProposta("a", "x"); // a=sim
  assert.equal(todosVotaram(p, ps), false);
  registrarVoto(p, "b", "sim");
  assert.equal(todosVotaram(p, ps), false);
  registrarVoto(p, "c", "nao");
  assert.equal(todosVotaram(p, ps), true);
});

test("dissidentes lista quem votou não, na ordem da party", () => {
  const ps = party("a", "b", "c");
  const p = criarProposta("a", "x");
  registrarVoto(p, "c", "nao");
  registrarVoto(p, "b", "nao");
  assert.deepEqual(dissidentes(p, ps), ["b", "c"]); // ordem da party, não do voto
});

test("placar separa sim/não/pendente", () => {
  const ps = party("a", "b", "c");
  const p = criarProposta("a", "x");
  registrarVoto(p, "b", "nao");
  assert.deepEqual(placar(p, ps), { sim: ["a"], nao: ["b"], pendente: ["c"] });
});
