import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTags,
  aplicarEstado,
  resolverTeste,
  montarContextoAventura,
  montarResumo,
  montarSystem,
  montarMundo,
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

test("montarResumo: vazio sem resumo, bloco com resumo", () => {
  assert.equal(montarResumo({ resumo: "" }), "");
  const r = montarResumo({ resumo: "O herói achou a pedra branca." });
  assert.ok(r.includes("## História até agora"));
  assert.ok(r.includes("pedra branca"));
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

test("montarMundo lista NPCs e flags", () => {
  const bloco = montarMundo({
    npcs: { garrec: { id: "garrec", nome: "Garrec", natureza: "morto-vivo", estado: "ativo", disposicao: "hostil", local: "cripta", notas: "" } },
    flags: { porta_cripta: "aberta" },
  });
  assert.ok(bloco.includes("## Mundo"));
  assert.ok(bloco.includes("Garrec"));
  assert.ok(bloco.includes("morto-vivo"));
  assert.ok(bloco.includes("porta_cripta: aberta"));
  assert.equal(montarMundo({}), ""); // sem nada -> vazio
});

test("montarSystem separa prefixo estável (cacheável) de dinâmico", () => {
  const ativo = {
    id: "a", nome: "Heroi", classe: "Mago", nivel: 1, hp: 10, hp_max: 10,
    atributos: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 },
    inventario: [], tracos: "",
  };
  const c = {
    local: "Cripta", quests: [],
    modulo: { sinopse: "SINOPSE", notas: "NOTAS", fontes: [] },
    resumo: "RESUMO",
  };
  const s = montarSystem("REGRAS", ativo, c, [ativo], [{ turno: 1, texto: "LEMBRANCA", score: 1 }]);

  // estável: regras + notas + resumo (muda raramente -> cacheável)
  assert.ok(s.estavel.includes("REGRAS"));
  assert.ok(s.estavel.includes("NOTAS"));
  assert.ok(s.estavel.includes("RESUMO"));
  // dinâmico: estado atual + lembranças (muda a cada turno -> fora do cache)
  assert.ok(s.dinamico.includes("Cripta"));
  assert.ok(s.dinamico.includes("LEMBRANCA"));
  // o dinâmico NÃO pode vazar pro prefixo estável
  assert.ok(!s.estavel.includes("LEMBRANCA"));
});
