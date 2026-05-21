import { montarSystem, parseTags, aplicarEstado, resolverTeste } from "./mestre.js";

const MAX_CONTEXTO = 16; // quantas mensagens recentes mandar pro LLM por turno

// Gera uma resposta do mestre a partir do estado atual. Não bloqueia esperando
// rolagem: se a narração pedir um teste, ele volta em `teste` e quem chama decide
// como coletar o dado (CLI no loop, web num segundo request). `personagens` é a
// party completa (default: só o ativo); `modificados` lista os ids alterados.
async function gerarTurno({ campanha, personagem, personagens, provider, promptBase }) {
  const party = personagens || [personagem];
  const system = montarSystem(promptBase, personagem, campanha, party);
  const contexto = campanha.historico.slice(-MAX_CONTEXTO);
  const bruto = await provider(system, contexto);

  const { narracao, teste, estados } = parseTags(bruto);
  const modificados = aplicarEstado(estados, personagem, campanha, party);
  campanha.historico.push({ papel: "mestre", texto: narracao || bruto });

  return { narracao: narracao || bruto, teste, modificados: [...modificados] };
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
