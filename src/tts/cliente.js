// Cliente HTTP fino do servico TTS. fetchFn injetavel pra teste.

export async function gerarAudio(base, voz, texto, opts = {}) {
  const { timeoutMs = 30_000, fetchFn = fetch } = opts;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetchFn(`${base}/tts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voice: voz, text: texto }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const corpo = await r.text().catch(() => "");
      throw new Error(`TTS ${r.status}: ${corpo.slice(0, 200)}`);
    }
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

export async function saudavel(base, opts = {}) {
  const { timeoutMs = 1500, fetchFn = fetch } = opts;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetchFn(`${base}/healthz`, { signal: ctrl.signal });
    if (!r.ok) return false;
    const j = await r.json();
    return !!j.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
