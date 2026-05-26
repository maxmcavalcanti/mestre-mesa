// Lazy spawn singleton do servidor Python TTS. Subsequentes chamadas a
// garantir() durante o startup compartilham a mesma promessa. Crash
// recovery e monitoramento ficam para a Fatia E.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { saudavel } from "./cliente.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const PY = resolve(REPO, "tts-service", ".venv", "Scripts", "python.exe");
const SERVER = resolve(REPO, "tts-service", "server.py");

let estado = "off"; // "off" | "iniciando" | "pronto" | "erro"
let proc = null;
let promessa = null;
let base = null;

export async function garantir({ porta = 8001, timeoutMs = 120_000 } = {}) {
  if (estado === "pronto") return base;
  if (estado === "erro") return null;
  if (estado === "iniciando" && promessa) return promessa;

  if (!existsSync(PY) || !existsSync(SERVER)) {
    estado = "erro";
    return null;
  }
  base = `http://127.0.0.1:${porta}`;
  estado = "iniciando";

  promessa = (async () => {
    proc = spawn(PY, [SERVER], {
      env: { ...process.env, PORT: String(porta) },
      stdio: "ignore",
    });
    proc.on("exit", () => {
      estado = "erro";
      proc = null;
    });

    const inicio = Date.now();
    while (Date.now() - inicio < timeoutMs) {
      if (await saudavel(base)) {
        estado = "pronto";
        return base;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    estado = "erro";
    try { proc?.kill(); } catch {}
    proc = null;
    return null;
  })();

  return promessa;
}

export function parar() {
  try { proc?.kill(); } catch {}
  proc = null;
  estado = "off";
  promessa = null;
  base = null;
}

// estado interno exposto pra testes / observabilidade
export function _estado() {
  return { estado, base };
}
