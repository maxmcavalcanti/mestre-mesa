// Smoke test do tempo real: sobe o servidor, cria campanha+personagem, conecta um
// WebSocket e verifica o painel inicial + o push após uma ação. Auto-encerra.
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import WebSocket from "ws";

const PORTA = 3999;
const base = `http://127.0.0.1:${PORTA}`;
// OLLAMA_HOST morto: o RAG (best-effort) falha rápido em vez de esperar um Ollama
// real, mantendo o turno do mock instantâneo (mesma tática dos unit tests).
const env = { ...process.env, PORTA: String(PORTA), MESTRE_LLM: "mock", OLLAMA_HOST: "http://127.0.0.1:9" };
const srv = spawn(process.execPath, ["server.js"], { env, stdio: ["ignore", "ignore", "inherit"] });

let falhou = null;
let criada = null; // id da campanha criada, pra limpar só ela
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function ate(fn, tentativas = 50) {
  for (let i = 0; i < tentativas; i++) {
    try { if (await fn()) return true; } catch {}
    await espera(100);
  }
  throw new Error("timeout esperando condição");
}

// Fila de mensagens: um único listener bufferiza tudo, e recebe() consome por
// tipo (espera as próximas se ainda não chegaram). Evita corrida com mensagens
// que o servidor manda assim que o socket abre.
function leitor(ws) {
  const fila = [];
  const aguardando = [];
  const drena = () => {
    for (let i = aguardando.length - 1; i >= 0; i--) {
      const w = aguardando[i];
      const idx = fila.findIndex((m) => m.tipo === w.tipo);
      if (idx >= 0) { clearTimeout(w.t); aguardando.splice(i, 1); w.resolve(fila.splice(idx, 1)[0]); }
    }
  };
  ws.on("message", (d) => { try { fila.push(JSON.parse(d)); drena(); } catch {} });
  return (tipo, ms = 4000) =>
    new Promise((resolve, reject) => {
      const w = { tipo, resolve };
      w.t = setTimeout(() => {
        const i = aguardando.indexOf(w);
        if (i >= 0) aguardando.splice(i, 1);
        reject(new Error(`sem mensagem '${tipo}' em ${ms}ms`));
      }, ms);
      aguardando.push(w);
      drena();
    });
}

try {
  await ate(async () => (await fetch(base + "/").catch(() => null))?.ok);

  // cria campanha
  let r = await fetch(base + "/campanhas", {
    method: "POST", redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ titulo: "Smoke", tom: "equilibrado" }),
  });
  const id = r.headers.get("location").split("/").pop();
  criada = id;

  // cria personagem (não-HTMX): redireciona e seta cookie eu_<id>=<pid>
  r = await fetch(base + `/campanhas/${id}/personagens`, {
    method: "POST", redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ nome: "Bek", classe: "Mago", hp: "12" }),
  });
  const cookie = r.headers.get("set-cookie").split(";")[0]; // eu_<id>=<pid>
  const pid = cookie.split("=")[1];

  // conecta o WS como o personagem da vez
  const ws = new WebSocket(`ws://127.0.0.1:${PORTA}/ws?campanha=${id}&eu=${pid}`);
  const recebe = leitor(ws);
  await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });

  const inicial = await recebe("painel");
  if (!/Come.ar a aventura/.test(inicial.html))
    throw new Error("painel inicial não traz o botão de começar");

  // dispara uma ação (mock) por POST; o leitor bufferiza os pushes que chegam
  // durante o fetch (stream + painel final), então recebe() os encontra na fila.
  await fetch(base + `/campanhas/${id}/comecar`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "HX-Request": "true", cookie },
    body: "",
  });
  await recebe("stream-inicio");
  const tok = await recebe("stream-token");
  if (!tok.texto) throw new Error("stream-token veio vazio");
  const depois = await recebe("painel");
  if (!/msg mestre/.test(depois.html))
    throw new Error("push pós-ação não traz narração do mestre");

  // entra em combate: a ação "ataco" faz o mock emitir [MODO] combate
  await fetch(base + `/campanhas/${id}/turno`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "HX-Request": "true", cookie },
    body: new URLSearchParams({ entrada: "ataco a criatura" }),
  });
  const painelCombate = await recebe("painel");
  if (!/Combate/.test(painelCombate.html))
    throw new Error("entrada em combate não refletiu no painel (sem banner de combate)");

  ws.close();
  console.log("SMOKE OK: painel inicial + push pós-ação + entrada em combate pelo WebSocket");
} catch (e) {
  falhou = e;
  console.error("SMOKE FALHOU:", e.message);
} finally {
  srv.kill("SIGTERM");
  await espera(300);
  if (criada) await rm(`data/campanhas/${criada}`, { recursive: true, force: true }).catch(() => {});
  process.exit(falhou ? 1 : 0);
}
