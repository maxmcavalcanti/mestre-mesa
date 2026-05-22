import { modificador, comSinal } from "./modificadores.js";
import { questTexto, questEstado } from "./protocolo.js";

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

  const condicoes = (p.condicoes || []).join(", ");
  const missoes =
    (c.quests || [])
      .map((q) => `${questTexto(q)} (${questEstado(q)})`)
      .join("; ") || "(nenhuma)";

  return [
    "## Estado atual",
    `Personagem: ${p.nome}, ${p.classe} nível ${p.nivel}. HP ${p.hp}/${p.hp_max}.`,
    `Atributos: ${linhasAtrib}.`,
    `Inventário: ${p.inventario.join(", ") || "(vazio)"}.`,
    `Condições: ${condicoes || "(nenhuma)"}.`,
    `Traços: ${p.tracos}.`,
    `Cena atual: ${c.local}.`,
    `Missões: ${missoes}.`,
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
    const cond = p.condicoes?.length ? ` [${p.condicoes.join(", ")}]` : "";
    return `- [${p.id}] ${p.nome}, ${p.classe} nv ${p.nivel}, HP ${p.hp}/${p.hp_max}${cond}${marca}`;
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

// Lista o estado determinístico do mundo: NPCs conhecidos e flags. Vai na parte
// dinâmica do system — é o que mantém a coerência (prevenção): o LLM lê daqui que
// o ferreiro está morto, ou que a porta já está aberta, e narra de acordo.
export function montarMundo(c) {
  const partes = [];
  const npcs = Object.values(c.npcs || {});
  if (npcs.length) {
    partes.push("NPCs conhecidos:");
    for (const n of npcs) {
      const det = [n.natureza, n.estado, n.disposicao].filter(Boolean).join(", ");
      const local = n.local ? ` @ ${n.local}` : "";
      const notas = n.notas ? ` — ${n.notas}` : "";
      partes.push(`- [${n.id}] ${n.nome}${det ? ` (${det})` : ""}${local}${notas}`);
    }
  }
  const flags = Object.entries(c.flags || {});
  if (flags.length) {
    partes.push("Estado do mundo:");
    for (const [k, v] of flags) partes.push(`- ${k}: ${v}`);
  }
  return partes.length ? ["## Mundo", ...partes].join("\n") : "";
}

// Avisos do sistema (camada de correção): inconsistências leves detectadas no
// turno anterior, pra o LLM ajustar a narração. Não bloqueia nada — só sinaliza.
export function montarAvisos(avisos) {
  if (!avisos || avisos.length === 0) return "";
  return [
    "## Avisos do sistema (ajuste a narração para bater com o estado real)",
    ...avisos.map((a) => `- ${a}`),
  ].join("\n");
}

// `lembrancas` e `avisos` chegam PRONTOS de quem chama (jogo.js), por isso esta
// função continua síncrona.
//
// Devolve { estavel, dinamico }:
// - estavel: regras + notas do módulo + resumo. Muda raramente (resumo a cada K
//   turnos), então pode ser cacheado pelo provider (ver claude.js).
// - dinamico: estado atual + party + lembranças do RAG. Muda a cada turno.
// A ordem final pro modelo é estavel + dinamico (ver textoSystem).
export function montarSystem(promptBase, ativo, c, personagens, lembrancas = [], avisos = []) {
  const estaveis = [promptBase];
  const aventura = montarContextoAventura(c);
  if (aventura) estaveis.push(aventura);
  const resumo = montarResumo(c);
  if (resumo) estaveis.push(resumo);

  const dinamicos = [resumoEstado(ativo, c)];
  const av = montarAvisos(avisos);
  if (av) dinamicos.push(av);
  const party = montarParty(personagens, ativo.id);
  if (party) dinamicos.push(party);
  const mundo = montarMundo(c);
  if (mundo) dinamicos.push(mundo);
  const mem = montarLembrancas(lembrancas);
  if (mem) dinamicos.push(mem);

  return { estavel: estaveis.join("\n\n"), dinamico: dinamicos.join("\n\n") };
}
