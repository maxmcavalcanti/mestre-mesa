// Votação de ação de grupo (exploração). O líder propõe uma ação; o grupo vota.
// Concordantes seguem na ação coletiva (que vai ao mestre); discordantes entram
// numa fila de ações individuais, agindo um por um depois. Funções puras —
// quem chama (rotas.js) é que roda a ação no mestre e persiste.

// Líder efetivo: o designado (se ainda existe na party) ou, na falta, o primeiro
// personagem. Garante que sempre haja alguém apto a propor.
export function liderEfetivo(campanha, personagens) {
  if (campanha.lider && personagens.some((p) => p.id === campanha.lider))
    return campanha.lider;
  return personagens[0]?.id || null;
}

// O autor (líder) já entra concordando com a própria proposta.
export function criarProposta(autorId, texto) {
  return { autor: autorId, texto, votos: autorId ? { [autorId]: "sim" } : {} };
}

export function registrarVoto(proposta, pid, valor) {
  if (!proposta || !pid) return;
  if (valor !== "sim" && valor !== "nao") return;
  proposta.votos[pid] = valor;
}

// Todos votaram quando cada personagem da party tem um voto registrado.
export function todosVotaram(proposta, personagens) {
  return personagens.length > 0 && personagens.every((p) => proposta.votos[p.id]);
}

// Ids de quem discordou (entram na fila de ações individuais), na ordem da party.
export function dissidentes(proposta, personagens) {
  return personagens.filter((p) => proposta.votos[p.id] === "nao").map((p) => p.id);
}

// Placar para a UI: quem concordou, discordou e ainda não votou.
export function placar(proposta, personagens) {
  const sim = [], nao = [], pendente = [];
  for (const p of personagens) {
    const v = proposta.votos[p.id];
    if (v === "sim") sim.push(p.id);
    else if (v === "nao") nao.push(p.id);
    else pendente.push(p.id);
  }
  return { sim, nao, pendente };
}
