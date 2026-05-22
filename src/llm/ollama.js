import { paraMensagens, textoSystem } from "./provider.js";

// LLM local via Ollama (http://localhost:11434). Requer `ollama serve` rodando
// e um modelo baixado, ex: `ollama pull llama3.1`. Modelo via env OLLAMA_MODEL.
// `onDelta` (opcional): recebe a resposta em pedaços via streaming NDJSON.
export async function ollama(system, mensagens, onDelta) {
  const modelo = process.env.OLLAMA_MODEL || "llama3.1";
  const url =
    (process.env.OLLAMA_HOST || "http://localhost:11434") + "/api/chat";

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelo,
      messages: [
        { role: "system", content: textoSystem(system) },
        ...paraMensagens(mensagens),
      ],
      stream: Boolean(onDelta),
    }),
  });

  if (!resp.ok) {
    throw new Error(
      `Ollama respondeu ${resp.status}. O servidor está rodando (ollama serve) e o modelo "${modelo}" foi baixado?`,
    );
  }

  if (!onDelta) {
    const json = await resp.json();
    return json.message.content;
  }

  // Streaming: o corpo é NDJSON (um objeto por linha) com deltas em message.content.
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let texto = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const linha = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!linha) continue;
      const delta = JSON.parse(linha).message?.content || "";
      if (delta) {
        texto += delta;
        onDelta(delta);
      }
    }
  }
  return texto;
}
