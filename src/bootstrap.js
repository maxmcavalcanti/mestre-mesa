import { criarProvider } from "./llm/provider.js";
import { lerPromptBase } from "./estado.js";

// Semente do primeiro turno: pede ao mestre que abra a cena. Igual no CLI e na web.
export const ABERTURA =
  "Comece a aventura: descreva a cena inicial em segunda pessoa e termine perguntando o que eu faço.";

// Inicialização comum aos dois entrypoints (CLI e servidor): escolhe o provider
// de LLM (via env MESTRE_LLM) e carrega o prompt base do mestre.
export async function iniciar() {
  const nome = process.env.MESTRE_LLM || "mock";
  const provider = criarProvider(nome);
  const promptBase = await lerPromptBase();
  console.log(`[LLM] provider=${nome}${nome === "ollama" ? ` modelo=${process.env.OLLAMA_MODEL || "llama3.1"} host=${process.env.OLLAMA_HOST || "http://localhost:11434"}` : ""}`);
  return { provider, promptBase };
}
