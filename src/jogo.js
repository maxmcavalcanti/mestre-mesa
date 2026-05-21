import { montarSystem, parseTags, aplicarEstado, resolverTeste } from "./mestre.js";
import { indexar, buscar } from "./memoria.js";

const MAX_CONTEXTO = 16; // quantas mensagens recentes mandar pro LLM por turno
const TOP_K = 4; // quantas lembranças recuperar por turno
const MIN_SCORE = 0.4; // corte de relevância (calibrado pro bge-m3; ver estudos/)
const PESO_RECENCIA = 0.1; // desempate leve a favor de cenas mais recentes

// RAG é best-effort: se o embedding/Ollama falhar, o jogo segue sem memória nova.
async function recuperarLembrancas(campanha, consulta) {
  try {
    // dedup: o que está nas últimas MAX_CONTEXTO mensagens já vai no contexto.
    const corte = campanha.historico.length - MAX_CONTEXTO;
    return await buscar(campanha.id, consulta, {
      topK: TOP_K,
      minScore: MIN_SCORE,
      pesoRecencia: PESO_RECENCIA,
      excluirDesdeTurno: corte,
    });
  } catch {
    return [];
  }
}

async function indexarBeat(campanha, entradaJogador, narracao) {
  if (!narracao.trim()) return; // pula respostas que são só [TESTE], sem narração
  try {
    const texto = `${entradaJogador}\n${narracao}`.trim();
    await indexar(campanha.id, { turno: campanha.historico.length, texto });
  } catch {
    /* best-effort: sem memória nova se o embedding falhar */
  }
}

// Gera uma resposta do mestre a partir do estado atual. Não bloqueia esperando
// rolagem: se a narração pedir um teste, ele volta em `teste` e quem chama decide
// como coletar o dado (CLI no loop, web num segundo request). `personagens` é a
// party completa (default: só o ativo); `modificados` lista os ids alterados.
async function gerarTurno({ campanha, personagem, personagens, provider, promptBase }) {
  const party = personagens || [personagem];

  // A5: recupera lembranças relevantes ANTES de montar o system (busca async).
  const entradaJogador = campanha.historico.at(-1)?.texto || "";
  const consulta = `${campanha.local}\n${entradaJogador}`;
  const lembrancas = await recuperarLembrancas(campanha, consulta);

  const system = montarSystem(promptBase, personagem, campanha, party, lembrancas);
  const contexto = campanha.historico.slice(-MAX_CONTEXTO);
  const bruto = await provider(system, contexto);

  const { narracao, teste, estados } = parseTags(bruto);
  const modificados = aplicarEstado(estados, personagem, campanha, party);
  const textoNarracao = narracao || bruto;
  campanha.historico.push({ papel: "mestre", texto: textoNarracao });

  // A4: indexa o beat (ação do jogador + narração) pra memória de longo prazo.
  await indexarBeat(campanha, entradaJogador, textoNarracao);

  return { narracao: textoNarracao, teste, modificados: [...modificados] };
}

// Processa a ação livre de um jogador. Muta campanha/personagens em memória;
// quem chama é responsável por persistir.
export async function processarAcao({ campanha, personagem, personagens, entrada, provider, promptBase }) {
  campanha.historico.push({ papel: "jogador", texto: entrada });
  return gerarTurno({ campanha, personagem, personagens, provider, promptBase });
}

// Aplica o resultado de um dado físico (dado cru + modificador vs CD) e pede ao
// mestre que narre o desfecho.
export async function resolverRolagem({ campanha, personagem, personagens, teste, dado, provider, promptBase }) {
  const { mod, total, sucesso } = resolverTeste(
    personagem,
    teste.atributo,
    dado,
    teste.cd,
  );
  campanha.historico.push({
    papel: "jogador",
    texto: `Resultado do teste de ${teste.atributo}: ${total} contra CD ${teste.cd} (${sucesso ? "sucesso" : "falha"}). Narre o que acontece.`,
  });
  const turno = await gerarTurno({ campanha, personagem, personagens, provider, promptBase });
  return { ...turno, dado, mod, total, sucesso };
}
