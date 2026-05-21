import { modificador, comSinal, normalizaAtributo } from "./modificadores.js";

const ATRIBUTOS = [
  "forca",
  "destreza",
  "constituicao",
  "inteligencia",
  "sabedoria",
  "carisma",
];

// Resumo compacto do estado, injetado no system prompt a cada turno.
export function resumoEstado(p, c) {
  const linhasAtrib = ATRIBUTOS.map((a) => {
    const v = p.atributos[a];
    return `${a} ${v} (${comSinal(modificador(v))})`;
  }).join(", ");

  return [
    "## Estado atual",
    `Personagem: ${p.nome}, ${p.classe} nível ${p.nivel}. HP ${p.hp}/${p.hp_max}.`,
    `Atributos: ${linhasAtrib}.`,
    `Inventário: ${p.inventario.join(", ") || "(vazio)"}.`,
    `Traços: ${p.tracos}.`,
    `Cena atual: ${c.local}.`,
    `Missões: ${c.quests.join("; ") || "(nenhuma)"}.`,
  ].join("\n");
}

// Contexto da aventura injetado no prompt. HOJE: notas estruturadas do módulo.
// Costura do RAG (Fase 3): no futuro, em vez das notas fixas, buscar trechos
// relevantes das fontes indexadas (c.modulo.fontes) conforme a cena atual e
// devolvê-los aqui — sem mudar quem chama esta função.
export function montarContextoAventura(c) {
  const m = c.modulo;
  if (!m) return "";
  const partes = [];
  if (m.sinopse) partes.push(`Sinopse: ${m.sinopse}`);
  if (m.notas)
    partes.push(`Notas do mestre (locais, NPCs, segredos, ganchos):\n${m.notas}`);
  return partes.length ? ["## Aventura", ...partes].join("\n") : "";
}

// Lista a party (quando há mais de um personagem), com ids pra mira via alvo=.
export function montarParty(personagens, ativoId) {
  if (!personagens || personagens.length <= 1) return "";
  const linhas = personagens.map((p) => {
    const marca = p.id === ativoId ? "  <- jogando agora" : "";
    return `- [${p.id}] ${p.nome}, ${p.classe} nv ${p.nivel}, HP ${p.hp}/${p.hp_max}${marca}`;
  });
  return [
    "## Party",
    "Para afetar um personagem específico, use 'alvo=<id>' antes das mudanças numa linha [ESTADO]. Sem alvo, aplica-se a quem está jogando agora.",
    ...linhas,
  ].join("\n");
}

// Bloco DINÂMICO (muda a cada turno) com as lembranças recuperadas pelo RAG.
// Fica por último no system — assim o prefixo estável (regras + notas) pode ser
// cacheado depois (Fase C1) sem que estas linhas invalidem o cache.
export function montarLembrancas(lembrancas) {
  if (!lembrancas || lembrancas.length === 0) return "";
  const linhas = lembrancas.map((l) => `- ${l.texto.replace(/\n/g, " ")}`);
  return [
    "## Lembranças de cenas passadas (use para manter a coerência da história)",
    ...linhas,
  ].join("\n");
}

// Resumo rolante da história ("história até agora"). Muda só a cada K turnos
// (ver jogo.js), então é semi-estável — bom candidato a ficar no prefixo cacheável.
export function montarResumo(c) {
  if (!c.resumo) return "";
  return `## História até agora\n${c.resumo}`;
}

// `lembrancas` chega PRONTA de quem chama (jogo.js faz a busca async antes), por
// isso esta função continua síncrona.
export function montarSystem(promptBase, ativo, c, personagens, lembrancas = []) {
  const blocos = [promptBase];
  const resumo = montarResumo(c);
  if (resumo) blocos.push(resumo);
  blocos.push(resumoEstado(ativo, c));
  const party = montarParty(personagens, ativo.id);
  if (party) blocos.push(party);
  const aventura = montarContextoAventura(c);
  if (aventura) blocos.push(aventura);
  const mem = montarLembrancas(lembrancas);
  if (mem) blocos.push(mem);
  return blocos.join("\n\n");
}

// Separa a narração das linhas de protocolo [TESTE] e [ESTADO].
export function parseTags(texto) {
  const narracao = [];
  let teste = null;
  const estados = [];

  for (const linha of texto.split("\n")) {
    const t = linha.trim();
    if (t.startsWith("[TESTE]")) {
      const atrib = t.match(/atributo\s*=\s*([^\s]+)/i);
      const cd = t.match(/cd\s*=\s*(\d+)/i);
      teste = {
        atributo: normalizaAtributo(atrib?.[1] || ""),
        cd: cd ? parseInt(cd[1], 10) : 10,
      };
    } else if (t.startsWith("[ESTADO]")) {
      estados.push(t.slice("[ESTADO]".length).trim());
    } else {
      narracao.push(linha);
    }
  }

  return { narracao: narracao.join("\n").trim(), teste, estados };
}

// Aplica as mudanças de estado. Ops de personagem (hp, inventario) afetam o
// jogador ativo, ou outro personagem se a linha tiver 'alvo=<id>'. Ops de mundo
// (local, quests) afetam a campanha. Devolve o conjunto de ids de personagens
// modificados, pra quem chama saber o que persistir.
export function aplicarEstado(estados, ativo, c, personagens = [ativo]) {
  const porId = new Map(personagens.filter((p) => p.id).map((p) => [p.id, p]));
  const modificados = new Set();

  for (const bloco of estados) {
    let alvo = ativo;
    for (const seg of bloco.split(";")) {
      const m = seg.trim().match(/^([\wçãáéíóú]+)\s*(\+=|-=|=)\s*(.+)$/i);
      if (!m) continue;
      const [, chaveRaw, op, valor] = m;
      const chave = chaveRaw.toLowerCase();
      const val = valor.trim();

      if (chave === "alvo") {
        const achado =
          porId.get(val) ||
          personagens.find((p) => p.nome.toLowerCase() === val.toLowerCase());
        if (achado) alvo = achado;
      } else if (chave === "hp") {
        const n = parseInt(val, 10);
        if (Number.isNaN(n)) continue;
        if (op === "+=") alvo.hp += n;
        else if (op === "-=") alvo.hp -= n;
        else alvo.hp = n;
        alvo.hp = Math.max(0, Math.min(alvo.hp, alvo.hp_max));
        if (alvo.id) modificados.add(alvo.id);
      } else if (chave === "inventario") {
        if (op === "+=") alvo.inventario.push(val);
        else if (op === "-=")
          alvo.inventario = alvo.inventario.filter(
            (i) => !i.toLowerCase().includes(val.toLowerCase()),
          );
        if (alvo.id) modificados.add(alvo.id);
      } else if (chave === "local") {
        c.local = val;
      } else if (chave === "quests") {
        if (op === "+=") c.quests.push(val);
        else if (op === "-=")
          c.quests = c.quests.filter(
            (q) => !q.toLowerCase().includes(val.toLowerCase()),
          );
      }
    }
  }
  return modificados;
}

// Resolve um teste: dado cru + modificador do atributo vs CD.
export function resolverTeste(p, atributo, dado, cd) {
  const score = p.atributos[atributo];
  const mod = score === undefined ? 0 : modificador(score);
  const total = dado + mod;
  return { mod, total, sucesso: total >= cd };
}
