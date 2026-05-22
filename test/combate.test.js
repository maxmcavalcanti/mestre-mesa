import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rolarIniciativa,
  avancarVez,
  iniciarCombate,
  encerrarCombate,
} from "../src/dominio/combate.js";

const pers = (id, destreza, hp = 10) => ({
  id,
  nome: id.toUpperCase(),
  hp,
  hp_max: 10,
  atributos: { destreza },
});

// rolar determinístico: consome uma fila de valores de d20.
const rolarFila = (valores) => {
  let i = 0;
  return () => valores[i++];
};

test("rolarIniciativa ordena por total (d20 + mod de destreza), desc", () => {
  const party = [pers("a", 10), pers("b", 16), pers("c", 12)]; // mods: 0, +3, +1
  // dados: a=10(=10), b=10(=13), c=10(=11) -> ordem b, c, a
  const { ordem, rolagens } = rolarIniciativa(party, rolarFila([10, 10, 10]));
  assert.deepEqual(ordem, ["b", "c", "a"]);
  assert.equal(rolagens[0].total, 13);
});

test("rolarIniciativa ignora quem não tem id (tela)", () => {
  const party = [pers("a", 10), { nome: "Tela", atributos: {} }];
  const { ordem } = rolarIniciativa(party, rolarFila([15, 20]));
  assert.deepEqual(ordem, ["a"]);
});

test("iniciarCombate monta o estado e põe a vez no primeiro da ordem", () => {
  const c = { modo: "exploracao", turno_de: "a" };
  iniciarCombate(c, [pers("a", 10), pers("b", 16)], rolarFila([5, 18]));
  assert.equal(c.modo, "combate");
  assert.deepEqual(c.combate, { ordem: ["b", "a"], indice: 0, rodada: 1 });
  assert.equal(c.turno_de, "b");
});

test("avancarVez gira a ordem e vira a rodada ao dar a volta", () => {
  const party = [pers("a", 10), pers("b", 10), pers("c", 10)];
  const c = { combate: { ordem: ["a", "b", "c"], indice: 0, rodada: 1 }, turno_de: "a" };
  assert.equal(avancarVez(c, party), false);
  assert.equal(c.turno_de, "b");
  avancarVez(c, party);
  assert.equal(c.turno_de, "c");
  assert.equal(avancarVez(c, party), true); // voltou ao início -> nova rodada
  assert.equal(c.turno_de, "a");
  assert.equal(c.combate.rodada, 2);
});

test("avancarVez pula caídos (hp <= 0)", () => {
  const party = [pers("a", 10), pers("b", 10, 0), pers("c", 10)]; // b caído
  const c = { combate: { ordem: ["a", "b", "c"], indice: 0, rodada: 1 }, turno_de: "a" };
  avancarVez(c, party); // pula b -> c
  assert.equal(c.turno_de, "c");
});

test("encerrarCombate volta pra exploração e devolve a vez ao líder", () => {
  const party = [pers("a", 10), pers("b", 10)];
  const c = { modo: "combate", combate: { ordem: ["b", "a"], indice: 1, rodada: 3 }, lider: "a", turno_de: "b" };
  encerrarCombate(c, party);
  assert.equal(c.modo, "exploracao");
  assert.equal(c.combate, null);
  assert.equal(c.turno_de, "a"); // líder
});
