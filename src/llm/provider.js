import { mock } from "./mock.js";
import { ollama } from "./ollama.js";
import { claude } from "./claude.js";

// Escolhe o provider via env MESTRE_LLM (mock | ollama | claude). Padrão: mock.
export function criarProvider(nome = process.env.MESTRE_LLM || "mock") {
  switch (nome) {
    case "mock":
      return mock;
    case "ollama":
      return ollama;
    case "claude":
      return claude;
    default:
      throw new Error(`Provider de LLM desconhecido: ${nome}`);
  }
}

// Converte o histórico interno ({papel, texto}) para o formato role/content.
export function paraMensagens(historico) {
  return historico.map((m) => ({
    role: m.papel === "jogador" ? "user" : "assistant",
    content: m.texto,
  }));
}

// O system pode ser uma string ou { estavel, dinamico } (prefixo cacheável +
// parte que muda a cada turno). Providers que não cacheiam usam isto pra
// achatar tudo num texto só.
export function textoSystem(system) {
  if (typeof system === "string") return system;
  return [system.estavel, system.dinamico].filter(Boolean).join("\n\n");
}
