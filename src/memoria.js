// Memória de longo prazo da campanha: um índice vetorial simples (RAG sobre o
// histórico). Em escala pequena, "banco vetorial" é só um array de vetores +
// produto escalar — é exatamente isso aqui. O índice fica em
// data/campanhas/<id>/indice.json (não versionado; é dado derivado).

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { embed } from "./llm/embeddings.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const arqIndice = (campanhaId) =>
  join(raiz, "data", "campanhas", campanhaId, "indice.json");

export async function carregarIndice(campanhaId) {
  const arq = arqIndice(campanhaId);
  if (!existsSync(arq)) return [];
  return JSON.parse(await readFile(arq, "utf8"));
}

// Sem indentação: cada vetor tem ~1024 números; pretty-print explodiria o arquivo.
async function salvarIndice(campanhaId, indice) {
  await writeFile(arqIndice(campanhaId), JSON.stringify(indice) + "\n", "utf8");
}

// Similaridade de cosseno: 1 = mesmo sentido, 0 = sem relação, -1 = oposto.
export function cosseno(a, b) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

// Indexa um beat: embute o texto e guarda {turno, texto, vetor}.
export async function indexar(campanhaId, { turno, texto }) {
  const indice = await carregarIndice(campanhaId);
  const vetor = await embed(texto, "documento");
  indice.push({ turno, texto, vetor });
  await salvarIndice(campanhaId, indice);
  return indice.length;
}

// Busca os beats mais relevantes para uma consulta. Opções:
// - topK: quantos devolver
// - minScore: corta lembranças com similaridade abaixo do limiar (relevância fraca)
// - pesoRecencia: desempate a favor de cenas mais recentes (0 = desliga)
// - excluirDesdeTurno: ignora beats cujo turno >= este valor (dedup com a janela
//   recente — não adianta recuperar o que já está no contexto)
// Devolve [{ turno, texto, score, scoreFinal }] ordenado por scoreFinal.
export async function buscar(campanhaId, consulta, opts = {}) {
  const {
    topK = 4,
    minScore = 0,
    pesoRecencia = 0,
    excluirDesdeTurno = Infinity,
  } = opts;

  const indice = await carregarIndice(campanhaId);
  if (indice.length === 0) return [];
  const q = await embed(consulta, "consulta");
  const maxTurno = Math.max(1, ...indice.map((c) => c.turno));

  return indice
    .filter((c) => c.turno < excluirDesdeTurno)
    .map((c) => {
      const score = cosseno(q, c.vetor); // similaridade semântica pura
      const recencia = c.turno / maxTurno; // 0 (antigo) .. 1 (recente)
      return {
        turno: c.turno,
        texto: c.texto,
        score,
        scoreFinal: score + pesoRecencia * recencia,
      };
    })
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.scoreFinal - a.scoreFinal)
    .slice(0, topK);
}
