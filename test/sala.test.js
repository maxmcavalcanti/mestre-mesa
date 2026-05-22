import { test } from "node:test";
import assert from "node:assert/strict";
import { criarSala } from "../src/web/sala.js";

// ws falso: guarda o que foi enviado; readyState 1 = OPEN.
const fakeWs = (readyState = 1) => ({ readyState, enviados: [], send(t) { this.enviados.push(t); } });
const conn = (eu, readyState) => ({ ws: fakeWs(readyState), eu, digitando: false });

test("entrar/sair mantêm o conjunto de conexões por campanha", () => {
  const sala = criarSala();
  const a = conn("lia"), b = conn("tela");
  sala.entrar("c1", a);
  sala.entrar("c1", b);
  assert.equal(sala.conexoes("c1").length, 2);
  sala.sair("c1", a);
  assert.deepEqual(sala.conexoes("c1").map((c) => c.eu), ["tela"]);
  sala.sair("c1", b);
  assert.equal(sala.conexoes("c1").length, 0);
});

test("campanhas são isoladas entre si", () => {
  const sala = criarSala();
  sala.entrar("c1", conn("lia"));
  sala.entrar("c2", conn("garrec"));
  assert.equal(sala.conexoes("c1").length, 1);
  assert.deepEqual(sala.presenca("c2"), ["garrec"]);
});

test("presenca lista eu distintos e ignora null", () => {
  const sala = criarSala();
  sala.entrar("c1", conn("lia"));
  sala.entrar("c1", conn("lia")); // mesmo eu em dois aparelhos -> conta 1
  sala.entrar("c1", conn(null)); // ainda não escolheu -> ignora
  assert.deepEqual(sala.presenca("c1"), ["lia"]);
});

test("digitando lista só quem está com a flag ligada", () => {
  const sala = criarSala();
  const a = conn("lia"), b = conn("bek");
  a.digitando = true;
  sala.entrar("c1", a);
  sala.entrar("c1", b);
  assert.deepEqual(sala.digitando("c1"), ["lia"]);
});

test("transmitir envia o JSON só pros sockets abertos", () => {
  const sala = criarSala();
  const aberto = conn("lia", 1), fechado = conn("bek", 3 /* CLOSED */);
  sala.entrar("c1", aberto);
  sala.entrar("c1", fechado);
  sala.transmitir("c1", { tipo: "ping" });
  assert.deepEqual(aberto.ws.enviados, ['{"tipo":"ping"}']);
  assert.deepEqual(fechado.ws.enviados, []);
});
