import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarAudio, saudavel } from "../src/tts/cliente.js";

// pequeno helper pra criar um fetch mock que captura calls
function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  fn.calls = calls;
  return fn;
}

function resposta(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
    async text() { return typeof body === "string" ? body : JSON.stringify(body); },
  };
}

test("gerarAudio: POST /tts com body voice+text e devolve json", async () => {
  const fetchFn = fakeFetch(() => resposta(200, { hash: "abc", filename: "abc.wav", cached: false }));
  const r = await gerarAudio("http://localhost:8001", "masc", "Olá.", { fetchFn });
  assert.deepEqual(r, { hash: "abc", filename: "abc.wav", cached: false });
  assert.equal(fetchFn.calls.length, 1);
  const c = fetchFn.calls[0];
  assert.equal(c.url, "http://localhost:8001/tts");
  assert.equal(c.init.method, "POST");
  assert.deepEqual(JSON.parse(c.init.body), { voice: "masc", text: "Olá." });
});

test("gerarAudio: lança erro descritivo quando resposta não-ok", async () => {
  const fetchFn = fakeFetch(() => resposta(500, "boom"));
  await assert.rejects(
    () => gerarAudio("http://x", "masc", "t", { fetchFn }),
    /TTS 500: boom/,
  );
});

test("saudavel: devolve true quando /healthz responde {ok:true}", async () => {
  const fetchFn = fakeFetch(() => resposta(200, { ok: true, vozes: ["masc", "fem"] }));
  assert.equal(await saudavel("http://x", { fetchFn }), true);
});

test("saudavel: devolve false quando fetch lança", async () => {
  const fetchFn = async () => { throw new Error("ECONNREFUSED"); };
  assert.equal(await saudavel("http://x", { fetchFn }), false);
});

test("saudavel: devolve false quando ok=false no payload", async () => {
  const fetchFn = fakeFetch(() => resposta(200, { ok: false }));
  assert.equal(await saudavel("http://x", { fetchFn }), false);
});
