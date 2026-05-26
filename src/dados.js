import { readFile, writeFile, mkdir, readdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { ATRIBUTOS } from "./dominio/modificadores.js";
import { TONS } from "./dominio/prompt.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const dirCampanhas = join(raiz, "data", "campanhas");

function slug(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function gerarId(base) {
  const sufixo = randomBytes(3).toString("hex");
  const s = slug(base);
  return s ? `${s}-${sufixo}` : sufixo;
}

async function lerJson(caminho) {
  return JSON.parse(await readFile(caminho, "utf8"));
}

// Escrita atômica: grava num arquivo temporário e renomeia por cima. O rename é
// atômico no mesmo volume, então um leitor (ou um crash no meio) nunca vê um JSON
// parcial — vê o conteúdo antigo ou o novo, nunca metade.
async function salvarJson(caminho, dados) {
  const tmp = `${caminho}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(dados, null, 2) + "\n", "utf8");
  await rename(tmp, caminho);
}

// ---- Serialização por campanha ----
// Uma fila (corrente de promises) por id de campanha: tarefas na MESMA campanha
// rodam uma de cada vez, então um ciclo carregar→mutar→salvar termina inteiro
// antes do próximo começar. Sem isso, dois requests concorrentes (dois
// dispositivos, ou passar-a-vez correndo com uma ação) leem o mesmo estado e a
// última escrita sobrescreve a outra (lost update). Campanhas diferentes seguem
// em paralelo.
const filas = new Map();

export function comCampanha(id, tarefa) {
  const anterior = filas.get(id) || Promise.resolve();
  const atual = anterior.then(() => tarefa());
  // A cauda engole o erro pra não travar a fila; quem chamou recebe o erro real.
  const cauda = atual.catch(() => {});
  filas.set(id, cauda);
  cauda.then(() => {
    if (filas.get(id) === cauda) filas.delete(id); // limpa quando a fila esvazia
  });
  return atual;
}

const dirCampanha = (id) => join(dirCampanhas, id);
const arqCampanha = (id) => join(dirCampanha(id), "campanha.json");
const dirPersonagens = (id) => join(dirCampanha(id), "personagens");
const arqPersonagem = (campanhaId, persId) =>
  join(dirPersonagens(campanhaId), `${persId}.json`);

// ---- Campanhas ----

export async function listarCampanhas() {
  if (!existsSync(dirCampanhas)) return [];
  const ids = await readdir(dirCampanhas);
  const campanhas = [];
  for (const id of ids) {
    const arq = arqCampanha(id);
    if (!existsSync(arq)) continue;
    const c = await lerJson(arq);
    campanhas.push({ id: c.id, titulo: c.titulo, local: c.local });
  }
  return campanhas;
}

const VOZES_TTS = new Set(["masc", "fem"]);

// Normaliza o tom de voz vindo do form ou do JSON. Aceita só 'masc'/'fem';
// qualquer outra coisa (string vazia, undefined, valor desconhecido) vira null,
// que significa TTS desligado pra essa campanha.
export function normalizarVozTts(v) {
  return VOZES_TTS.has(v) ? v : null;
}

export async function criarCampanha({ titulo, local, quests, modulo, tom, tom_voz } = {}) {
  const id = gerarId(titulo || "campanha");
  const campanha = {
    id,
    titulo: titulo || "Nova Aventura",
    local: local || "Um ponto de partida ainda por definir",
    tom: TONS[tom] ? tom : "equilibrado",
    tom_voz: normalizarVozTts(tom_voz), // null = TTS off
    modo: "exploracao", // exploracao | combate
    lider: null, // personagem que pode propor ações de grupo (votação)
    quests: quests || [],
    modulo: {
      sinopse: modulo?.sinopse || "",
      notas: modulo?.notas || "",
      fontes: modulo?.fontes || [], // reservado pro RAG (Fase 3)
    },
    turno_de: null,
    historico: [],
    resumo: "", // resumo rolante da história
    resumo_ate: 0, // até qual mensagem do histórico o resumo cobre
    npcs: {}, // { id: { nome, natureza, estado, disposicao, local, notas } }
    flags: {}, // estado do mundo: { chave: valor } (portas, eventos, etc.)
    avisos: [], // avisos do sistema pro LLM corrigir no próximo turno
  };
  await mkdir(dirPersonagens(id), { recursive: true });
  await salvarJson(arqCampanha(id), campanha);
  return campanha;
}

export function carregarCampanha(id) {
  return lerJson(arqCampanha(id));
}

export function salvarCampanha(campanha) {
  return salvarJson(arqCampanha(campanha.id), campanha);
}

export async function existeCampanha(id) {
  return existsSync(arqCampanha(id));
}

// ---- Personagens ----

export async function listarPersonagens(campanhaId) {
  const dir = dirPersonagens(campanhaId);
  if (!existsSync(dir)) return [];
  const arquivos = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const personagens = [];
  for (const f of arquivos) {
    personagens.push(await lerJson(join(dir, f)));
  }
  return personagens;
}

export async function criarPersonagem(campanhaId, dados = {}) {
  const id = gerarId(dados.nome || "personagem");
  const personagem = {
    id,
    nome: dados.nome || "Aventureiro",
    classe: dados.classe || "Andarilho",
    nivel: dados.nivel || 1,
    hp: dados.hp ?? 12,
    hp_max: dados.hp_max ?? dados.hp ?? 12,
    atributos: dados.atributos || Object.fromEntries(ATRIBUTOS.map((a) => [a, 10])),
    inventario: dados.inventario || [],
    condicoes: dados.condicoes || [], // ex.: envenenado, atordoado
    tracos: dados.tracos || "",
  };
  await mkdir(dirPersonagens(campanhaId), { recursive: true });
  await salvarJson(arqPersonagem(campanhaId, id), personagem);
  return personagem;
}

export function carregarPersonagem(campanhaId, persId) {
  return lerJson(arqPersonagem(campanhaId, persId));
}

export function salvarPersonagem(campanhaId, personagem) {
  return salvarJson(arqPersonagem(campanhaId, personagem.id), personagem);
}
