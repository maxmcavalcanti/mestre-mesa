import { paraMensagens } from "./provider.js";

// LLM via API da Anthropic, com prompt caching no system prompt (que é estável
// entre turnos). Requer ANTHROPIC_API_KEY no ambiente e o pacote @anthropic-ai/sdk
// instalado (npm i @anthropic-ai/sdk). Modelo via env ANTHROPIC_MODEL.
export async function claude(system, mensagens) {
  let Anthropic;
  try {
    ({ default: Anthropic } = await import("@anthropic-ai/sdk"));
  } catch {
    throw new Error(
      "Pacote @anthropic-ai/sdk não instalado. Rode: npm i @anthropic-ai/sdk",
    );
  }

  const client = new Anthropic();
  const modelo = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

  const resp = await client.messages.create({
    model: modelo,
    max_tokens: 1024,
    system: [
      { type: "text", text: system, cache_control: { type: "ephemeral" } },
    ],
    messages: paraMensagens(mensagens),
  });

  return resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}
