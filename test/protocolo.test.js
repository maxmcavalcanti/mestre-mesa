import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTags, aplicarEstado } from "../src/dominio/protocolo.js";

test("parseTags separa narração de [TESTE]", () => {
  const r = parseTags("Você vê uma porta emperrada.\n[TESTE] atributo=forca cd=13");
  assert.equal(r.narracao, "Você vê uma porta emperrada.");
  assert.deepEqual(r.teste, { atributo: "forca", cd: 13 });
  assert.deepEqual(r.estados, []);
});

test("parseTags detecta [TESTE] inline (grudado no fim da frase)", () => {
  const r = parseTags("A sombra começa a se mover... [TESTE] atributo=destreza cd=13");
  assert.deepEqual(r.teste, { atributo: "destreza", cd: 13 });
  assert.ok(!r.narracao.includes("[TESTE]"));
  assert.ok(r.narracao.includes("A sombra começa a se mover"));
});

test("parseTags detecta [ESTADO] inline e tira da narração", () => {
  const r = parseTags("Você pega a chave enferrujada. [ESTADO] inventario+=chave enferrujada");
  assert.deepEqual(r.estados, ["inventario+=chave enferrujada"]);
  assert.equal(r.narracao, "Você pega a chave enferrujada.");
});

test("parseTags coleta [ESTADO] e normaliza atributo do teste", () => {
  const r = parseTags("Algo acontece.\n[ESTADO] hp-=3; local=Cripta\n[TESTE] atributo=Destreza cd=10");
  assert.equal(r.narracao, "Algo acontece.");
  assert.deepEqual(r.estados, ["hp-=3; local=Cripta"]);
  assert.equal(r.teste.atributo, "destreza");
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
  assert.deepEqual(c.quests, [{ texto: "achar a saída", estado: "ativa" }]);
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

test("aplicarEstado cria e atualiza NPC (sob demanda)", () => {
  const c = { local: "x", quests: [], npcs: {}, flags: {} };
  const ativo = { id: "a", hp: 5, hp_max: 5, inventario: [] };
  aplicarEstado(
    ["npc.garrec.nome=Garrec; npc.garrec.natureza=humano; npc.garrec.estado=morto"],
    ativo, c, [ativo],
  );
  assert.equal(c.npcs.garrec.nome, "Garrec");
  assert.equal(c.npcs.garrec.natureza, "humano");
  assert.equal(c.npcs.garrec.estado, "morto");
  assert.equal(c.npcs.garrec.disposicao, "neutro"); // default

  // reanimado: humano morto vira morto-vivo ativo
  aplicarEstado(["npc.garrec.natureza=morto-vivo; npc.garrec.estado=ativo"], ativo, c, [ativo]);
  assert.equal(c.npcs.garrec.natureza, "morto-vivo");
  assert.equal(c.npcs.garrec.estado, "ativo");
});

test("aplicarEstado grava flags do mundo", () => {
  const c = { local: "x", quests: [], npcs: {}, flags: {} };
  const ativo = { id: "a", hp: 5, hp_max: 5, inventario: [] };
  aplicarEstado(["flag.porta_cripta=aberta; flag.ritual=interrompido"], ativo, c, [ativo]);
  assert.equal(c.flags.porta_cripta, "aberta");
  assert.equal(c.flags.ritual, "interrompido");
});

test("aplicarEstado funciona em campanha antiga (sem npcs/flags) e não quebra hp", () => {
  const c = { local: "x", quests: [] }; // sem npcs/flags (campanha migrada)
  const ativo = { id: "a", hp: 10, hp_max: 10, inventario: ["adaga"] };
  aplicarEstado(["npc.x.estado=ativo; flag.y=1; hp-=3; inventario+=tocha"], ativo, c, [ativo]);
  assert.equal(c.npcs.x.estado, "ativo");
  assert.equal(c.flags.y, "1");
  assert.equal(ativo.hp, 7); // regressão: hp continua funcionando
  assert.deepEqual(ativo.inventario, ["adaga", "tocha"]);
});

test("aplicarEstado: condições add/remove respeitam alvo", () => {
  const a = { id: "a", hp: 5, hp_max: 5, inventario: [], condicoes: [] };
  const b = { id: "b", hp: 5, hp_max: 5, inventario: [], condicoes: [] };
  const c = { local: "x", quests: [] };
  aplicarEstado(["condicao+=envenenado"], a, c, [a, b]);
  assert.deepEqual(a.condicoes, ["envenenado"]);
  aplicarEstado(["alvo=b; condicao+=atordoado"], a, c, [a, b]);
  assert.deepEqual(b.condicoes, ["atordoado"]);
  aplicarEstado(["condicao-=envenenado"], a, c, [a, b]);
  assert.deepEqual(a.condicoes, []);
});

test("aplicarEstado: quests ganham estado e migram de string antiga", () => {
  const c = { local: "x", quests: ["achar a saída"] }; // formato antigo
  const a = { id: "a", hp: 5, hp_max: 5, inventario: [] };
  aplicarEstado(["quests+=derrotar o lich"], a, c, [a]);
  aplicarEstado(["quest.concluida=achar a saída"], a, c, [a]);
  const porTexto = Object.fromEntries(c.quests.map((q) => [q.texto, q.estado]));
  assert.equal(porTexto["achar a saída"], "concluida");
  assert.equal(porTexto["derrotar o lich"], "ativa");
});

test("aplicarEstado: gera avisos para remoções/marcas inexistentes", () => {
  const c = { local: "x", quests: [] };
  const a = { id: "a", nome: "Lia", hp: 5, hp_max: 5, inventario: ["adaga"] };
  aplicarEstado(["inventario-=poção; quest.concluida=missão fantasma"], a, c, [a]);
  assert.equal(c.avisos.length, 2);
  assert.ok(c.avisos.some((x) => x.includes("poção")));
  assert.ok(c.avisos.some((x) => x.toLowerCase().includes("quest")));
});
