import { test } from "node:test";
import assert from "node:assert/strict";
import { dividirSentencas } from "../src/tts/sentenca.js";

test("divide em duas sentenças com . e ?", () => {
  const r = dividirSentencas("Olá. Como vai?");
  assert.deepEqual(r.sentencas, ["Olá.", "Como vai?"]);
  assert.equal(r.resto, "");
});

test("guarda fragmento sem terminação como resto", () => {
  const r = dividirSentencas("Frase um. Frase dois sem fim");
  assert.deepEqual(r.sentencas, ["Frase um."]);
  assert.equal(r.resto, "Frase dois sem fim");
});

test("preserva sequência de terminadores ?!", () => {
  const r = dividirSentencas("Sério?! Ok.");
  assert.deepEqual(r.sentencas, ["Sério?!", "Ok."]);
});

test("reticências contam como terminador único", () => {
  const r = dividirSentencas("Espera... E aí.");
  assert.deepEqual(r.sentencas, ["Espera...", "E aí."]);
});

test("não corta em abreviações comuns (Sr., Dr.)", () => {
  const r = dividirSentencas("Sr. Silva chegou. O Dr. Souza demorou.");
  assert.deepEqual(r.sentencas, [
    "Sr. Silva chegou.",
    "O Dr. Souza demorou.",
  ]);
});

test("não corta em decimais (3.14)", () => {
  const r = dividirSentencas("Pi vale 3.14 aproximadamente. Fim.");
  assert.deepEqual(r.sentencas, [
    "Pi vale 3.14 aproximadamente.",
    "Fim.",
  ]);
});

test("não corta quando o terminador é colado na palavra seguinte", () => {
  // "Wow!Que" sem espaço — não é separador, fica uma sentença só.
  const r = dividirSentencas("Wow!Que coisa.");
  assert.deepEqual(r.sentencas, ["Wow!Que coisa."]);
});

test("string vazia → tudo vazio", () => {
  const r = dividirSentencas("");
  assert.deepEqual(r.sentencas, []);
  assert.equal(r.resto, "");
});

test("só whitespace → resto whitespace, sem sentenças", () => {
  const r = dividirSentencas("   \n  ");
  assert.deepEqual(r.sentencas, []);
});

test("uso em streaming: chunks acumulados", () => {
  let buf = "";
  const todas = [];
  for (const delta of ["Olá. Co", "mo vai? Tudo bem.", " Ainda escr"]) {
    buf += delta;
    const { sentencas, resto } = dividirSentencas(buf);
    todas.push(...sentencas);
    buf = resto;
  }
  assert.deepEqual(todas, ["Olá.", "Como vai?", "Tudo bem."]);
  assert.equal(buf.trim(), "Ainda escr");
});

test("nova linha conta como whitespace após terminador", () => {
  const r = dividirSentencas("Frase um.\nFrase dois.");
  assert.deepEqual(r.sentencas, ["Frase um.", "Frase dois."]);
});

test("ignora etc. no meio mas corta na próxima sentença", () => {
  const r = dividirSentencas("Maçãs, peras, etc. e laranjas. Acabou.");
  assert.deepEqual(r.sentencas, [
    "Maçãs, peras, etc. e laranjas.",
    "Acabou.",
  ]);
});
