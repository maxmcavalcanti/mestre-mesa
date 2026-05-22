import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarContextoAventura,
  montarResumo,
  montarSystem,
  montarMundo,
  montarAvisos,
  montarTom,
  TONS,
} from "../src/dominio/prompt.js";

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

test("montarAvisos: vazio sem avisos, bloco com avisos", () => {
  assert.equal(montarAvisos([]), "");
  const b = montarAvisos(['Lia não tinha o item removido: "poção".']);
  assert.ok(b.includes("## Avisos do sistema"));
  assert.ok(b.includes("poção"));
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

test("montarTom: vazio no padrão e em tom desconhecido, bloco num tom válido", () => {
  assert.equal(montarTom({ tom: "equilibrado" }), "");
  assert.equal(montarTom({}), ""); // campanha antiga sem o campo
  assert.equal(montarTom({ tom: "inexistente" }), "");
  const b = montarTom({ tom: "sombrio" });
  assert.ok(b.includes("## Tom da narração"));
  assert.ok(b.includes(TONS.sombrio.instrucao));
});

test("montarSystem injeta o tom no prefixo estável (cacheável)", () => {
  const ativo = {
    id: "a", nome: "Heroi", classe: "Mago", nivel: 1, hp: 10, hp_max: 10,
    atributos: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 },
    inventario: [], tracos: "",
  };
  const c = { local: "Cripta", quests: [], modulo: { sinopse: "", notas: "", fontes: [] }, resumo: "", tom: "comico" };
  const s = montarSystem("REGRAS", ativo, c, [ativo]);
  assert.ok(s.estavel.includes("## Tom da narração"));
  assert.ok(s.estavel.includes(TONS.comico.instrucao));
  assert.ok(!s.dinamico.includes("## Tom da narração")); // não vaza pro dinâmico
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
