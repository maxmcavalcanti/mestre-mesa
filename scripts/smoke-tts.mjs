#!/usr/bin/env node
// Smoke do servico TTS standalone.
// Sobe o servidor Python, espera saudavel, faz 2 chamadas + 2 repetidas pra testar cache.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const pyExe = resolve(repo, 'tts-service', '.venv', 'Scripts', 'python.exe');
const serverPy = resolve(repo, 'tts-service', 'server.py');
const audioDir = resolve(repo, 'data', 'audio');
const port = Number(process.env.TTS_PORT || 8001);
const base = `http://127.0.0.1:${port}`;

function morrer(msg) {
  console.error('!!', msg);
  process.exit(1);
}

async function aguardarSaudavel(timeoutMs = 90_000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    try {
      const r = await fetch(`${base}/healthz`);
      const j = await r.json();
      if (j.ok) return j;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`healthz nao OK em ${timeoutMs}ms`);
}

async function chamarTts(voice, text) {
  const t0 = Date.now();
  const r = await fetch(`${base}/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ voice, text }),
  });
  const dur = Date.now() - t0;
  if (!r.ok) throw new Error(`tts ${r.status} ${await r.text()}`);
  return { ...(await r.json()), dur };
}

async function main() {
  if (!existsSync(pyExe)) morrer(`venv nao existe em ${pyExe}. Rode tts-service/setup.ps1`);
  if (!existsSync(serverPy)) morrer(`server.py nao existe em ${serverPy}`);

  console.log('subindo Python...');
  const proc = spawn(pyExe, [serverPy], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'inherit',
  });
  const matar = () => { try { proc.kill(); } catch {} };
  process.on('exit', matar);
  process.on('SIGINT', () => { matar(); process.exit(130); });
  proc.on('exit', code => {
    if (code !== 0 && code !== null) console.log(`(python saiu com ${code})`);
  });

  const t0 = Date.now();
  const saude = await aguardarSaudavel();
  console.log(`saudavel em ${Date.now() - t0}ms`, saude);

  const texto = 'O guerreiro avança pela floresta sombria, espada em punho.';

  console.log('\n--- 1a rodada (sem cache, gera audio) ---');
  for (const voz of ['masc', 'fem']) {
    const r = await chamarTts(voz, texto);
    const path = resolve(audioDir, r.filename);
    if (!existsSync(path)) morrer(`WAV nao encontrado em ${path}`);
    console.log(`  voz=${voz} dur=${r.dur}ms cached=${r.cached} -> ${r.filename}`);
  }

  console.log('\n--- 2a rodada (mesmo texto, deve cachear) ---');
  for (const voz of ['masc', 'fem']) {
    const r = await chamarTts(voz, texto);
    if (!r.cached) morrer(`esperava cache=true pra voz=${voz}`);
    console.log(`  voz=${voz} dur=${r.dur}ms cached=${r.cached}`);
  }

  console.log('\nOK.');
  matar();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
