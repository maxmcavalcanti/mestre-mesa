import { test } from "node:test";
import assert from "node:assert/strict";
import { painelJogo } from "../src/web/componentes.js";

function campanha() {
  return {
    id: "c1",
    local: "Cripta",
    quests: [],
    historico: [{ papel: "jogador", texto: "abro a porta" }],
    npcs: {},
    flags: {},
    turno_de: "lia",
  };
}

function personagem() {
  return {
    id: "lia",
    nome: "Lia",
    classe: "Andarilha",
    nivel: 1,
    hp: 12,
    hp_max: 12,
    atributos: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 },
    inventario: [],
    condicoes: [],
  };
}

test("painelJogo mostra o banner de erro quando recebe uma mensagem", () => {
  const html = painelJogo(campanha(), [personagem()], "lia", "O mestre tropeçou: timeout. Tente de novo.");
  assert.match(html, /class="erro"/);
  assert.match(html, /O mestre tropeçou: timeout/);
});

test("painelJogo não mostra banner de erro sem mensagem", () => {
  const html = painelJogo(campanha(), [personagem()], "lia");
  assert.ok(!html.includes('class="erro"'));
});

test("painelJogo escapa HTML na mensagem de erro", () => {
  const html = painelJogo(campanha(), [personagem()], "lia", "falhou <script>alert(1)</script>");
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.match(html, /&lt;script&gt;/);
});
