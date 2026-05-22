import { test } from "node:test";
import assert from "node:assert/strict";
import { instantaneo, podeDesfazer, restaurar } from "../src/dominio/desfazer.js";

const campanhaBase = () => ({
  id: "c1",
  local: "Cripta",
  historico: [{ papel: "jogador", texto: "olho em volta" }],
  flags: { porta: "fechada" },
});
const party = () => [{ id: "p1", nome: "Lia", hp: 10, inventario: ["adaga"] }];

test("instantaneo faz cópia profunda do estado pré-turno", () => {
  const c = campanhaBase();
  const ps = party();
  const snap = instantaneo(c, ps);
  // mutar os originais depois não afeta o snapshot
  c.local = "Outro lugar";
  ps[0].hp = 1;
  ps[0].inventario.push("tocha");
  assert.equal(snap.campanha.local, "Cripta");
  assert.equal(snap.personagens[0].hp, 10);
  assert.deepEqual(snap.personagens[0].inventario, ["adaga"]);
});

test("instantaneo descarta o desfazer anterior (um nível só)", () => {
  const c = campanhaBase();
  c.desfazer = { campanha: { local: "estado bem antigo" }, personagens: [] };
  const snap = instantaneo(c, party());
  assert.equal(snap.campanha.desfazer, undefined);
});

test("podeDesfazer reflete a presença do snapshot", () => {
  assert.equal(podeDesfazer(campanhaBase()), false);
  assert.equal(podeDesfazer({ ...campanhaBase(), desfazer: { campanha: {}, personagens: [] } }), true);
  assert.equal(podeDesfazer(undefined), false);
});

test("restaurar devolve o snapshot e não permite desfazer de novo", () => {
  const c = campanhaBase();
  const ps = party();
  c.desfazer = instantaneo(c, ps);
  // o turno muda o estado
  c.local = "Sala alagada";
  ps[0].hp = 4;

  const restaurado = restaurar(c);
  assert.equal(restaurado.campanha.local, "Cripta");
  assert.equal(restaurado.personagens[0].hp, 10);
  // o restaurado não carrega ponto de desfazer -> sem desfazer encadeado
  assert.equal(podeDesfazer(restaurado.campanha), false);
});

test("restaurar devolve null quando não há o que desfazer", () => {
  assert.equal(restaurar(campanhaBase()), null);
  assert.equal(restaurar(undefined), null);
});
