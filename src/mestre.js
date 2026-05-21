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

const CAMPOS_NPC = ["nome", "natureza", "estado", "disposicao", "local", "notas"];
const ESTADOS_QUEST = ["ativa", "concluida", "falhou"];

// Cria o NPC sob demanda (entidades emergentes) com defaults sensatos.
function garantirNpc(c, id) {
  if (!c.npcs) c.npcs = {};
  if (!c.npcs[id]) {
    c.npcs[id] = {
      id,
      nome: id,
      natureza: "",
      estado: "ativo",
      disposicao: "neutro",
      local: "",
      notas: "",
    };
  }
  return c.npcs[id];
}

// Quests podem ser strings (formato antigo) ou { texto, estado }. Helpers que
// lidam com os dois, e normalização pra objeto quando vamos mutar.
export const questTexto = (q) => (typeof q === "string" ? q : q.texto);
export const questEstado = (q) => (typeof q === "string" ? "ativa" : q.estado || "ativa");
function normalizarQuests(c) {
  if (!Array.isArray(c.quests)) c.quests = [];
  c.quests = c.quests.map((q) =>
    typeof q === "string" ? { texto: q, estado: "ativa" } : q,
  );
}

// Aplica as mudanças de estado. Ops de personagem (hp, inventario, condicao)
// afetam o jogador ativo, ou outro via 'alvo=<id>'. Ops de mundo (local, quests,
// npc.*, flag.*) afetam a campanha. Coleta avisos de inconsistências leves em
// c.avisos (pro LLM corrigir no próximo turno). Devolve os ids de personagens
// modificados, pra quem chama saber o que persistir.
export function aplicarEstado(estados, ativo, c, personagens = [ativo]) {
  const porId = new Map(personagens.filter((p) => p.id).map((p) => [p.id, p]));
  const modificados = new Set();
  const avisos = [];
  const nomeDe = (p) => p.nome || p.id || "personagem";

  for (const bloco of estados) {
    let alvo = ativo;
    for (const seg of bloco.split(";")) {
      const m = seg.trim().match(/^([\w.çãáéíóú]+)\s*(\+=|-=|=)\s*(.+)$/i);
      if (!m) continue;
      const [, chaveRaw, op, valor] = m;
      const chave = chaveRaw.toLowerCase();
      const val = valor.trim();

      if (chave === "alvo") {
        const achado =
          porId.get(val) ||
          personagens.find((p) => p.nome.toLowerCase() === val.toLowerCase());
        if (achado) alvo = achado;
        else avisos.push(`Alvo desconhecido: "${val}".`);
      } else if (chave.startsWith("npc.")) {
        // npc.<id>.<campo>=valor — cria o NPC se ainda não existe.
        const [, id, campo] = chave.split(".");
        if (id && CAMPOS_NPC.includes(campo)) garantirNpc(c, id)[campo] = val;
      } else if (chave.startsWith("flag.")) {
        // flag.<chave>=valor — bag genérico de estado do mundo.
        if (!c.flags) c.flags = {};
        const nome = chave.slice("flag.".length);
        if (nome) c.flags[nome] = val;
      } else if (chave.startsWith("quest.")) {
        // quest.<estado>=<texto> — marca uma quest existente (match por texto).
        const estado = chave.split(".")[1];
        if (ESTADOS_QUEST.includes(estado)) {
          normalizarQuests(c);
          const q = c.quests.find((x) =>
            x.texto.toLowerCase().includes(val.toLowerCase()),
          );
          if (q) q.estado = estado;
          else avisos.push(`Quest inexistente para marcar como ${estado}: "${val}".`);
        }
      } else if (chave === "hp") {
        const n = parseInt(val, 10);
        if (Number.isNaN(n)) continue;
        if (op === "+=") alvo.hp += n;
        else if (op === "-=") alvo.hp -= n;
        else alvo.hp = n;
        alvo.hp = Math.max(0, Math.min(alvo.hp, alvo.hp_max)); // clamp duro
        if (alvo.id) modificados.add(alvo.id);
      } else if (chave === "inventario") {
        if (op === "+=") alvo.inventario.push(val);
        else if (op === "-=") {
          const tinha = alvo.inventario.some((i) =>
            i.toLowerCase().includes(val.toLowerCase()),
          );
          if (!tinha)
            avisos.push(`${nomeDe(alvo)} não tinha o item removido: "${val}".`);
          alvo.inventario = alvo.inventario.filter(
            (i) => !i.toLowerCase().includes(val.toLowerCase()),
          );
        }
        if (alvo.id) modificados.add(alvo.id);
      } else if (chave === "condicao") {
        if (!alvo.condicoes) alvo.condicoes = [];
        if (op === "+=") {
          if (!alvo.condicoes.includes(val)) alvo.condicoes.push(val);
        } else if (op === "-=") {
          if (!alvo.condicoes.includes(val))
            avisos.push(`${nomeDe(alvo)} não tinha a condição removida: "${val}".`);
          alvo.condicoes = alvo.condicoes.filter((x) => x !== val);
        }
        if (alvo.id) modificados.add(alvo.id);
      } else if (chave === "local") {
        c.local = val;
      } else if (chave === "quests") {
        normalizarQuests(c);
        if (op === "+=") c.quests.push({ texto: val, estado: "ativa" });
        else if (op === "-=")
          c.quests = c.quests.filter(
            (q) => !q.texto.toLowerCase().includes(val.toLowerCase()),
          );
      }
    }
  }
  c.avisos = avisos; // consumidos (e limpos) pelo jogo.js no próximo turno
  return modificados;
}

// Resolve um teste: dado cru + modificador do atributo vs CD.
export function resolverTeste(p, atributo, dado, cd) {
  const score = p.atributos[atributo];
  const mod = score === undefined ? 0 : modificador(score);
  const total = dado + mod;
  return { mod, total, sucesso: total >= cd };
}
