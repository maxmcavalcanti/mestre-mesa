// Camada de embedding: texto -> vetor. Mesma filosofia trocável do provider de
// LLM (provider.js). Hoje só temos o backend local do Ollama; quando precisar de
// um embedding via API (OpenAI/Voyage/etc.), é só adicionar outro ramo aqui sem
// mexer em quem chama.
//
// Modelo via env EMBED_MODEL (padrão bge-m3, multilíngue e bom em pt-BR — ver o
// experimento em estudos/01-embeddings.mjs pra entender por que o modelo importa).

const MODELO = process.env.EMBED_MODEL || "bge-m3";
const HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

// O nomic-embed-text exige prefixos de tarefa; o bge-m3 (e a maioria) não usa.
const usaPrefixoNomic = MODELO.includes("nomic");
function comPrefixo(texto, tipo) {
  if (!usaPrefixoNomic) return texto;
  return (tipo === "consulta" ? "search_query: " : "search_document: ") + texto;
}

// Embute um texto. `tipo` é "documento" (algo a guardar/buscar) ou "consulta"
// (a pergunta) — só muda o prefixo em modelos que pedem (ex.: nomic).
export async function embed(texto, tipo = "documento") {
  const r = await fetch(`${HOST}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODELO, prompt: comPrefixo(texto, tipo) }),
  });
  if (!r.ok) {
    throw new Error(
      `Embedding (${MODELO}) falhou: HTTP ${r.status}. O Ollama está rodando e o modelo foi baixado (ollama pull ${MODELO})?`,
    );
  }
  const j = await r.json();
  return j.embedding;
}

// Embute vários textos em sequência (útil pra indexar um lote de beats).
export async function embedVarios(textos, tipo = "documento") {
  const vetores = [];
  for (const t of textos) vetores.push(await embed(t, tipo));
  return vetores;
}

export const modeloEmbedding = MODELO;
