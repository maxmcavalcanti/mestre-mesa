import { criarProvider } from "./llm/provider.js";
import { lerPromptBase } from "./estado.js";

// Semente do primeiro turno: pede ao mestre que abra a cena. Igual no CLI e na web.
export const ABERTURA =
  "Comece a aventura: descreva a cena inicial em segunda pessoa e termine perguntando o que eu faço.";

// Inicialização comum aos dois entrypoints (CLI e servidor): escolhe o provider
// de LLM (via env MESTRE_LLM) e carrega o prompt base do mestre.
export async function iniciar() {
  const provider = criarProvider();
  const promptBase = await lerPromptBase();
  return { provider, promptBase };
}
