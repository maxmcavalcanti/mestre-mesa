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
