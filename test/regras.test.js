import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverTeste } from "../src/dominio/regras.js";

test("resolverTeste soma modificador e compara com a CD", () => {
  const p = { atributos: { forca: 14 } };
  const ok = resolverTeste(p, "forca", 10, 12); // 10 + 2 = 12 >= 12
  assert.deepEqual(ok, { mod: 2, total: 12, sucesso: true });
  const falha = resolverTeste(p, "forca", 9, 12); // 11 < 12
  assert.equal(falha.sucesso, false);
});
