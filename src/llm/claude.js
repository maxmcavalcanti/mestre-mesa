import { paraMensagens } from "./provider.js";

// LLM via API da Anthropic. Requer ANTHROPIC_API_KEY no ambiente e o pacote
// @anthropic-ai/sdk instalado (npm i @anthropic-ai/sdk). Modelo via ANTHROPIC_MODEL.
//
// Prompt caching: o system vem como { estavel, dinamico }. Só o bloco `estavel`
// (regras + notas + resumo) leva cache_control — ele muda raramente, então a
// Anthropic relê esse prefixo a uma fração do custo. O bloco `dinamico` (estado,
// party, lembranças do RAG) muda a cada turno e fica FORA do cache, depois do
// breakpoint. Caching exige um prefixo estável; misturar o dinâmico nele zeraria
// o ganho.
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

  const partes =
    typeof system === "string" ? { estavel: system, dinamico: "" } : system;
  const blocosSystem = [
    { type: "text", text: partes.estavel, cache_control: { type: "ephemeral" } },
  ];
  if (partes.dinamico) blocosSystem.push({ type: "text", text: partes.dinamico });

  const resp = await client.messages.create({
    model: modelo,
    max_tokens: 1024,
    system: blocosSystem,
    messages: paraMensagens(mensagens),
  });

  return resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}
