import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTags,
  aplicarEstado,
  resolverTeste,
  montarContextoAventura,
} from "../src/mestre.js";

test("parseTags separa narração de [TESTE]", () => {
  const r = parseTags("Você vê uma porta emperrada.\n[TESTE] atributo=forca cd=13");
  assert.equal(r.narracao, "Você vê uma porta emperrada.");
  assert.deepEqual(r.teste, { atributo: "forca", cd: 13 });
  assert.deepEqual(r.estados, []);
});

test("parseTags coleta [ESTADO] e normaliza atributo do teste", () => {
  const r = parseTags("Algo acontece.\n[ESTADO] hp-=3; local=Cripta\n[TESTE] atributo=Destreza cd=10");
  assert.equal(r.narracao, "Algo acontece.");
  assert.deepEqual(r.estados, ["hp-=3; local=Cripta"]);
  assert.equal(r.teste.atributo, "destreza");
});

test("resolverTeste soma modificador e compara com a CD", () => {
  const p = { atributos: { forca: 14 } };
  const ok = resolverTeste(p, "forca", 10, 12); // 10 + 2 = 12 >= 12
  assert.deepEqual(ok, { mod: 2, total: 12, sucesso: true });
  const falha = resolverTeste(p, "forca", 9, 12); // 11 < 12
  assert.equal(falha.sucesso, false);
});

test("aplicarEstado muda hp, inventário, local e quests do ativo", () => {
  const p = { id: "a", hp: 10, hp_max: 12, inventario: ["adaga"] };
  const c = { local: "x", quests: [] };
  const mod = aplicarEstado(
    ["hp-=3; inventario+=poção de cura; local=Cripta; quests+=achar a saída"],
    p,
    c,
    [p],
  );
  assert.equal(p.hp, 7);
  assert.deepEqual(p.inventario, ["adaga", "poção de cura"]);
  assert.equal(c.local, "Cripta");
  assert.deepEqual(c.quests, ["achar a saída"]);
  assert.ok(mod.has("a"));
});

test("aplicarEstado limita hp entre 0 e hp_max", () => {
  const p = { id: "a", hp: 10, hp_max: 12, inventario: [] };
  aplicarEstado(["hp+=99"], p, { quests: [] }, [p]);
  assert.equal(p.hp, 12);
  aplicarEstado(["hp-=999"], p, { quests: [] }, [p]);
  assert.equal(p.hp, 0);
});

test("aplicarEstado remove item do inventário", () => {
  const p = { id: "a", hp: 5, hp_max: 5, inventario: ["tocha", "adaga"] };
  aplicarEstado(["inventario-=tocha"], p, { quests: [] }, [p]);
  assert.deepEqual(p.inventario, ["adaga"]);
});

test("aplicarEstado com alvo afeta outro personagem da party", () => {
  const a = { id: "a", hp: 10, hp_max: 10, inventario: [] };
  const b = { id: "b", hp: 10, hp_max: 10, inventario: [] };
  const c = { local: "", quests: [] };
  const mod = aplicarEstado(["alvo=b; hp-=4"], a, c, [a, b]);
  assert.equal(a.hp, 10);
  assert.equal(b.hp, 6);
  assert.ok(mod.has("b"));
  assert.ok(!mod.has("a"));
});

test("montarContextoAventura vazio quando não há módulo", () => {
  assert.equal(montarContextoAventura({ modulo: { sinopse: "", notas: "", fontes: [] } }), "");
});

test("montarContextoAventura inclui sinopse e notas", () => {
  const ctx = montarContextoAventura({
    modulo: { sinopse: "Vilarejo amaldiçoado", notas: "NPC: ferreiro", fontes: [] },
  });
  assert.ok(ctx.includes("## Aventura"));
  assert.ok(ctx.includes("Vilarejo amaldiçoado"));
  assert.ok(ctx.includes("NPC: ferreiro"));
});
