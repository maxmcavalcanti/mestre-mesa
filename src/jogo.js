import { montarSystem } from "./dominio/prompt.js";
import { parseTags, aplicarEstado } from "./dominio/protocolo.js";
import { resolverTeste } from "./dominio/regras.js";
import { comSinal } from "./dominio/modificadores.js";
import { indexar, buscar } from "./memoria.js";

const MAX_CONTEXTO = 16; // quantas mensagens recentes mandar pro LLM por turno
const TOP_K = 4; // quantas lembranças recuperar por turno
const MIN_SCORE = 0.4; // corte de relevância (calibrado pro bge-m3; ver estudos/)
const PESO_RECENCIA = 0.1; // desempate leve a favor de cenas mais recentes
const LIMIAR_RESUMO = 8; // mensagens antigas acumuladas antes de re-resumir

const PROMPT_RESUMO = `Você é um assistente que mantém o "diário" de uma campanha de RPG.
Condense a história até agora num resumo curto e fiel (no máximo ~200 palavras), em português.
Integre o resumo anterior (se houver) com os novos eventos, preservando: NPCs e suas relações,
decisões importantes, segredos revelados, itens-chave e objetivos em aberto. Não invente nada.
Responda apenas com o resumo, sem comentários.`;

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

// Quando mensagens antigas (fora da janela recente) se acumulam além do limiar,
// pede ao LLM pra condensá-las no resumo rolante. Roda só de tempos em tempos —
// na maioria dos turnos não faz nada — pra não custar caro nem quebrar o cache.
async function talvezResumir(campanha, provider) {
  const corte = campanha.historico.length - MAX_CONTEXTO;
  const inicio = campanha.resumo_ate || 0;
  if (corte - inicio < LIMIAR_RESUMO) return;

  const antigas = campanha.historico.slice(inicio, corte);
  const entrada =
    (campanha.resumo ? `Resumo anterior:\n${campanha.resumo}\n\n` : "") +
    `Novos eventos:\n${antigas.map((m) => `${m.papel}: ${m.texto}`).join("\n")}`;

  try {
    const novo = await provider(PROMPT_RESUMO, [{ papel: "jogador", texto: entrada }]);
    campanha.resumo = novo.trim();
    campanha.resumo_ate = corte; // tudo até aqui já está no resumo
  } catch {
    /* best-effort: segue sem atualizar o resumo */
  }
}

// Gera uma resposta do mestre a partir do estado atual. Não bloqueia esperando
// rolagem: se a narração pedir um teste, ele volta em `teste` e quem chama decide
// como coletar o dado (CLI no loop, web num segundo request). `personagens` é a
// party completa (default: só o ativo); `modificados` lista os ids alterados.
async function gerarTurno({ campanha, personagem, personagens, provider, promptBase, onDelta }) {
  const party = personagens || [personagem];

  // A5: recupera lembranças relevantes ANTES de montar o system (busca async).
  const entradaJogador = campanha.historico.at(-1)?.texto || "";
  const consulta = `${campanha.local}\n${entradaJogador}`;
  const lembrancas = await recuperarLembrancas(campanha, consulta);

  // E3: avisos gerados no turno anterior (aplicarEstado) são mostrados uma vez.
  const avisos = campanha.avisos || [];
  campanha.avisos = [];

  const system = montarSystem(promptBase, personagem, campanha, party, lembrancas, avisos);
  const contexto = campanha.historico.slice(-MAX_CONTEXTO);
  // onDelta (se houver) recebe a narração em pedaços pra streaming; o texto
  // completo (`bruto`) é parseado normalmente depois — as tags só valem inteiras.
  const bruto = await provider(system, contexto, onDelta);

  const { narracao, teste, estados } = parseTags(bruto);
  const modificados = aplicarEstado(estados, personagem, campanha, party);
  const textoNarracao = narracao || bruto;
  campanha.historico.push({ papel: "mestre", texto: textoNarracao });

  // A4: indexa o beat (ação do jogador + narração) pra memória de longo prazo.
  await indexarBeat(campanha, entradaJogador, textoNarracao);
  // B1: de tempos em tempos, condensa a história antiga no resumo rolante.
  await talvezResumir(campanha, provider);

  return { narracao: textoNarracao, teste, modificados: [...modificados] };
}

// Processa a ação livre de um jogador. Muta campanha/personagens em memória;
// quem chama é responsável por persistir.
export async function processarAcao({ campanha, personagem, personagens, entrada, provider, promptBase, onDelta }) {
  campanha.historico.push({ papel: "jogador", texto: entrada });
  return gerarTurno({ campanha, personagem, personagens, provider, promptBase, onDelta });
}

// Aplica o resultado de um dado físico (dado cru + modificador vs CD) e pede ao
// mestre que narre o desfecho.
export async function resolverRolagem({ campanha, personagem, personagens, teste, dado, provider, promptBase, onDelta }) {
  const { mod, total, sucesso } = resolverTeste(
    personagem,
    teste.atributo,
    dado,
    teste.cd,
  );
  campanha.historico.push({
    papel: "jogador",
    texto: `Resultado do teste de ${teste.atributo}: ${dado} ${comSinal(mod)} = ${total} vs CD ${teste.cd} (${sucesso ? "sucesso" : "falha"}). Narre o desfecho.`,
  });
  const turno = await gerarTurno({ campanha, personagem, personagens, provider, promptBase, onDelta });
  return { ...turno, dado, mod, total, sucesso };
}
