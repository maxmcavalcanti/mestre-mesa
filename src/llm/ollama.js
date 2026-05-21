import { paraMensagens } from "./provider.js";

// LLM local via Ollama (http://localhost:11434). Requer `ollama serve` rodando
// e um modelo baixado, ex: `ollama pull llama3.1`. Modelo via env OLLAMA_MODEL.
export async function ollama(system, mensagens) {
  const modelo = process.env.OLLAMA_MODEL || "llama3.1";
  const url =
    (process.env.OLLAMA_HOST || "http://localhost:11434") + "/api/chat";

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelo,
      messages: [{ role: "system", content: system }, ...paraMensagens(mensagens)],
      stream: false,
    }),
  });

  if (!resp.ok) {
    throw new Error(
      `Ollama respondeu ${resp.status}. O servidor está rodando (ollama serve) e o modelo "${modelo}" foi baixado?`,
    );
  }

  const json = await resp.json();
  return json.message.content;
}
