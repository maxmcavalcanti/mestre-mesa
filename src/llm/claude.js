import { paraMensagens } from "./provider.js";

// Acumulado de tokens da sessão (zera a cada reinício do processo).
const totaisSessao = { entrada: 0, saida: 0, cacheEscrito: 0, cacheLido: 0 };

// Formata o uso de uma resposta e soma no acumulado da sessão. A Anthropic
// reporta os tokens de cache à parte de input_tokens, então "cache leu" alto com
// "entrada" baixa é a prova de que o prefixo estável está sendo reaproveitado.
// Separado da chamada à API pra ser testável sem o SDK. `totais` é mutado.
export function resumoUso(usage, totais) {
  const entrada = usage?.input_tokens || 0;
  const saida = usage?.output_tokens || 0;
  const cacheEscrito = usage?.cache_creation_input_tokens || 0;
  const cacheLido = usage?.cache_read_input_tokens || 0;
  totais.entrada += entrada;
  totais.saida += saida;
  totais.cacheEscrito += cacheEscrito;
  totais.cacheLido += cacheLido;
  return (
    `entrada ${entrada} (cache: escreveu ${cacheEscrito}, leu ${cacheLido}), saída ${saida}` +
    ` | sessão: entrada ${totais.entrada}, saída ${totais.saida}, cache lido ${totais.cacheLido}`
  );
}

// LLM via API da Anthropic. Requer ANTHROPIC_API_KEY no ambiente e o pacote
// @anthropic-ai/sdk instalado (npm i @anthropic-ai/sdk). Modelo via ANTHROPIC_MODEL.
//
// Prompt caching: o system vem como { estavel, dinamico }. Só o bloco `estavel`
// (regras + notas + resumo) leva cache_control — ele muda raramente, então a
// Anthropic relê esse prefixo a uma fração do custo. O bloco `dinamico` (estado,
// party, lembranças do RAG) muda a cada turno e fica FORA do cache, depois do
// breakpoint. Caching exige um prefixo estável; misturar o dinâmico nele zeraria
// o ganho.
export async function claude(system, mensagens, onDelta) {
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

  // Sempre via stream: quando há onDelta, repassa os deltas de texto; de qualquer
  // forma, finalMessage() dá a mensagem completa + usage (inclui tokens de cache).
  const stream = client.messages.stream({
    model: modelo,
    max_tokens: 1024,
    system: blocosSystem,
    messages: paraMensagens(mensagens),
  });
  if (onDelta) stream.on("text", (delta) => onDelta(delta));

  const resp = await stream.finalMessage();
  console.log(`[claude] ${modelo} • ${resumoUso(resp.usage, totaisSessao)}`);

  return resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}
