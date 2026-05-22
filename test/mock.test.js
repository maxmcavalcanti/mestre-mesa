import { test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "../src/llm/mock.js";

const msgs = (texto) => [{ papel: "jogador", texto }];

test("mock sem onDelta devolve o texto completo de uma vez", async () => {
  const r = await mock("sys", msgs("eu olho em volta"));
  assert.match(r, /símbolos|Símbolos/i);
});

test("mock com onDelta emite em pedaços que somam o texto completo", async () => {
  const pedacos = [];
  const r = await mock("sys", msgs("eu empurro a porta"), (t) => pedacos.push(t));
  assert.ok(pedacos.length > 1, "deveria emitir vários pedaços");
  assert.equal(pedacos.join(""), r); // os deltas reconstroem o texto final
  assert.match(r, /\[TESTE\]/); // a tag continua no texto completo (parseada depois)
});

test("mock dispara [MODO] combate ao atacar e exploracao ao encerrar", async () => {
  assert.match(await mock("sys", msgs("ataco a criatura")), /\[MODO\] combate/);
  assert.match(await mock("sys", msgs("fujo da luta")), /\[MODO\] exploracao/);
});
