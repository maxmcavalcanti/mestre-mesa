import { test } from "node:test";
import assert from "node:assert/strict";
import { getEu } from "../src/web/sessao.js";

const req = (cookie) => ({ headers: cookie ? { cookie } : {} });

test("getEu lê o cookie eu_<id> da campanha certa", () => {
  assert.equal(getEu(req("eu_cripta-1=lia"), "cripta-1"), "lia");
});

test("getEu isola por campanha: ignora cookies de outras campanhas", () => {
  const c = "eu_outra=garrec; eu_cripta-1=lia; tema=escuro";
  assert.equal(getEu(req(c), "cripta-1"), "lia");
  assert.equal(getEu(req(c), "outra"), "garrec");
});

test("getEu decodifica o valor (URL-encoded)", () => {
  assert.equal(getEu(req("eu_c1=tela%20grande"), "c1"), "tela grande");
});

test("getEu devolve null sem cookie ou sem o cookie da campanha", () => {
  assert.equal(getEu(req(""), "c1"), null);
  assert.equal(getEu(req("eu_outra=x"), "c1"), null);
});
