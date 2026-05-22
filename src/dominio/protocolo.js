import { normalizaAtributo } from "./modificadores.js";

// Separa a narração das tags de protocolo [TESTE] e [ESTADO]. As tags são
// reconhecidas em QUALQUER posição (inline ou em linha própria) — modelos locais
// costumam grudá-las no fim da frase — e cada uma vale até o fim da sua linha.
export function parseTags(texto) {
  let teste = null;
  const estados = [];

  const mTeste = texto.match(/\[TESTE\]([^\n]*)/i);
  if (mTeste) {
    const atrib = mTeste[1].match(/atributo\s*=\s*([^\s;]+)/i);
    const cd = mTeste[1].match(/cd\s*=\s*(\d+)/i);
    teste = {
      atributo: normalizaAtributo(atrib?.[1] || ""),
      cd: cd ? parseInt(cd[1], 10) : 10,
    };
  }

  for (const m of texto.matchAll(/\[ESTADO\]([^\n]*)/gi)) {
    estados.push(m[1].trim());
  }

  const narracao = texto
    .replace(/\[TESTE\][^\n]*/gi, "")
    .replace(/\[ESTADO\][^\n]*/gi, "")
    .replace(/[ \t]+\n/g, "\n") // sobras de espaço antes da quebra
    .replace(/\n{3,}/g, "\n\n") // colapsa linhas em branco extras
    .trim();

  return { narracao, teste, estados };
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
