// A1 — Experimento isolado de embeddings + similaridade de cosseno.
//
// Objetivo de estudo: VER a busca semântica funcionando. A gente embute algumas
// "lembranças" da campanha e algumas perguntas, e mostra que frases com SENTIDO
// parecido ficam perto — mesmo sem compartilhar nenhuma palavra.
//
// Rode com: node estudos/01-embeddings.mjs
// Requer: Ollama rodando + `ollama pull bge-m3` (multilíngue, bom em pt-BR).
// Troque MODELO por "nomic-embed-text" pra comparar com um modelo focado em inglês.

const MODELO = "bge-m3";
const URL = "http://localhost:11434/api/embeddings";

// LIÇÃO: cada modelo tem suas convenções. O nomic-embed-text espera "prefixos de
// tarefa" (search_document: / search_query:) e vai mal em pt-BR sem eles — e mal
// mesmo com eles, por ser focado em inglês. O bge-m3 é multilíngue e NÃO usa
// prefixos. Escolher o modelo certo pro idioma é metade do resultado.
const usaPrefixoNomic = MODELO.includes("nomic");

// texto -> vetor (lista de números). É o modelo que "entende" o texto e devolve
// uma posição num espaço de significado.
async function embed(texto, tipo) {
  const prefixo = !usaPrefixoNomic
    ? ""
    : tipo === "documento"
      ? "search_document: "
      : "search_query: ";
  const r = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODELO, prompt: prefixo + texto }),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status} — baixou o ${MODELO}?`);
  const j = await r.json();
  return j.embedding; // array de números (bge-m3: 1024; nomic: 768)
}

// Similaridade de cosseno: o cosseno do ângulo entre dois vetores.
// 1 = mesma direção (sentido idêntico), 0 = sem relação, -1 = oposto.
function cosseno(a, b) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// "Lembranças" da campanha (o que seria indexado do histórico).
const lembrancas = [
  "O ferreiro do vilarejo de Pedra Cinza parecia apavorado ao falar da cripta.",
  "Você abriu uma caixa de madeira e achou uma pedra branca, lisa como água.",
  "A porta de pedra da cripta estava emperrada pela umidade dos séculos.",
  "Um corpo pálido emergiu lentamente do sarcófago no salão subterrâneo.",
  "A chuva fina caía sobre as montanhas a tarde toda.",
];

// Perguntas/queries — repare que NÃO usam as mesmas palavras das lembranças.
const perguntas = [
  "quem na vila estava com medo?",
  "qual item brilhante eu encontrei?",
  "o que saiu do túmulo?",
];

console.log(`Modelo: ${MODELO}\n`);

// Pré-computa o vetor de cada lembrança (isso é a "indexação").
const indice = [];
for (const texto of lembrancas) {
  indice.push({ texto, vetor: await embed(texto, "documento") });
}
console.log(`Indexei ${indice.length} lembranças (dimensão do vetor: ${indice[0].vetor.length}).\n`);

// Para cada pergunta, embute e rankeia as lembranças por cosseno.
for (const pergunta of perguntas) {
  const q = await embed(pergunta, "consulta");
  const ranking = indice
    .map((l) => ({ texto: l.texto, score: cosseno(q, l.vetor) }))
    .sort((a, b) => b.score - a.score);

  console.log(`❓ "${pergunta}"`);
  ranking.forEach((r, i) => {
    const marca = i === 0 ? "→" : " ";
    console.log(`   ${marca} ${r.score.toFixed(3)}  ${r.texto}`);
  });
  console.log("");
}
