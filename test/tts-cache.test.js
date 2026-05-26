import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chave, caminhoArquivo } from "../src/tts/cache.js";

test("chave é sha1(voz|texto), espelhando o servidor Python", () => {
  const esperado = createHash("sha1").update("masc|Olá mundo", "utf8").digest("hex");
  assert.equal(chave("masc", "Olá mundo"), esperado);
});

test("chave varia entre vozes diferentes", () => {
  const a = chave("masc", "Mesma frase.");
  const b = chave("fem", "Mesma frase.");
  assert.notEqual(a, b);
});

test("chave varia entre textos diferentes", () => {
  const a = chave("masc", "Frase A.");
  const b = chave("masc", "Frase B.");
  assert.notEqual(a, b);
});

test("caminhoArquivo aponta pra data/audio/<hash>.wav", () => {
  const p = caminhoArquivo("abcdef");
  assert.ok(p.endsWith("data\\audio\\abcdef.wav") || p.endsWith("data/audio/abcdef.wav"),
    `path inesperado: ${p}`);
});
