// Lifecycle do servidor Python TTS. Estados:
//   off       — nada subido ainda
//   iniciando — spawnando ou esperando /healthz
//   pronto    — saudável, atendendo
//   erro      — desistimos (sticky: nenhuma nova tentativa nesta sessão)
//
// Resiliência:
// - Em crash inesperado (proc.exit enquanto estado=pronto), tenta respawn 1x.
//   Falhou de novo: vira erro sticky.
// - Monitor periódico chama /healthz; 2 falhas seguidas → derruba o proc
//   (o handler de exit decide se respawna).
// - parar() solicitado pelo shutdown do server: não dispara respawn.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { saudavel } from "./cliente.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const PY = resolve(REPO, "tts-service", ".venv", "Scripts", "python.exe");
const SERVER = resolve(REPO, "tts-service", "server.py");

const MAX_RETRIES = 1;
const INTERVALO_MONITOR_MS = 30_000;

let estado = "off";
let proc = null;
let promessa = null;
let base = null;
let portaAtual = 8001;
let timeoutAtual = 120_000;
let retriesUsadas = 0;
let pararSolicitado = false;
let intervaloMonitor = null;

function log(...args) { console.log("[TTS]", ...args); }
function warn(...args) { console.warn("[TTS]", ...args); }

function pararMonitor() {
  if (intervaloMonitor) { clearInterval(intervaloMonitor); intervaloMonitor = null; }
}

function iniciarMonitor() {
  pararMonitor();
  let falhas = 0;
  intervaloMonitor = setInterval(async () => {
    if (estado !== "pronto" || !base) return;
    if (await saudavel(base)) {
      falhas = 0;
    } else {
      falhas++;
      warn(`healthz falhou (${falhas}/2)`);
      if (falhas >= 2) {
        warn("healthz degradou — derrubando processo pra forçar respawn");
        pararMonitor();
        try { proc?.kill(); } catch {}
      }
    }
  }, INTERVALO_MONITOR_MS);
  intervaloMonitor.unref?.(); // não impede o exit do Node
}

async function iniciarProcesso() {
  base = `http://127.0.0.1:${portaAtual}`;
  estado = "iniciando";
  log(`subindo servidor Python (porta ${portaAtual})...`);
  proc = spawn(PY, [SERVER], {
    env: { ...process.env, PORT: String(portaAtual) },
    stdio: "ignore",
  });
  proc.on("exit", onExitProcesso);

  const inicio = Date.now();
  while (Date.now() - inicio < timeoutAtual) {
    if (await saudavel(base)) {
      estado = "pronto";
      log(`pronto em ${Date.now() - inicio}ms (${base})`);
      iniciarMonitor();
      return base;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  warn(`startup falhou em ${timeoutAtual}ms`);
  estado = "erro";
  try { proc?.kill(); } catch {}
  proc = null;
  return null;
}

function onExitProcesso(code) {
  pararMonitor();
  if (pararSolicitado) {
    log(`processo encerrado (code=${code}), shutdown solicitado`);
    proc = null;
    return;
  }
  if (estado !== "pronto") {
    // Já estava em erro/iniciando: deixa o caller existente lidar.
    proc = null;
    return;
  }
  warn(`processo crashou (code=${code}) com estado=pronto`);
  if (retriesUsadas < MAX_RETRIES) {
    retriesUsadas++;
    log(`tentando reiniciar (${retriesUsadas}/${MAX_RETRIES})`);
    promessa = iniciarProcesso(); // garantir() concorrente vai esperar a nova promessa
  } else {
    warn("retries esgotadas — TTS desabilitado nesta sessão");
    estado = "erro";
    proc = null;
  }
}

export async function garantir({ porta = 8001, timeoutMs = 120_000 } = {}) {
  if (estado === "pronto") return base;
  if (estado === "erro") return null;
  if (estado === "iniciando" && promessa) return promessa;

  if (!existsSync(PY) || !existsSync(SERVER)) {
    warn(`venv ou server.py não encontrado em ${REPO}/tts-service — TTS desabilitado`);
    estado = "erro";
    return null;
  }
  pararSolicitado = false;
  portaAtual = porta;
  timeoutAtual = timeoutMs;
  promessa = iniciarProcesso();
  return promessa;
}

export async function parar() {
  pararSolicitado = true;
  pararMonitor();
  const p = proc;
  if (!p) { resetar(); return; }
  log("parando processo Python...");
  await new Promise((resolve) => {
    const t = setTimeout(() => {
      warn("timeout no shutdown — encerrando forçado");
      try { p.kill("SIGKILL"); } catch {}
      resolve();
    }, 2000);
    p.once("exit", () => { clearTimeout(t); resolve(); });
    try { p.kill(); } catch { clearTimeout(t); resolve(); }
  });
  resetar();
}

function resetar() {
  estado = "off";
  proc = null;
  promessa = null;
  base = null;
  retriesUsadas = 0;
  pararSolicitado = false;
}

// estado interno exposto pra testes / observabilidade
export function _estado() {
  return { estado, base, retriesUsadas };
}
