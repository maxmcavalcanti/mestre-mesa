import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

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

async function salvarJson(caminho, dados) {
  await writeFile(caminho, JSON.stringify(dados, null, 2) + "\n", "utf8");
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

export async function criarCampanha({ titulo, local, quests, modulo } = {}) {
  const id = gerarId(titulo || "campanha");
  const campanha = {
    id,
    titulo: titulo || "Nova Aventura",
    local: local || "Um ponto de partida ainda por definir",
    quests: quests || [],
    modulo: {
      sinopse: modulo?.sinopse || "",
      notas: modulo?.notas || "",
      fontes: modulo?.fontes || [], // reservado pro RAG (Fase 3)
    },
    turno_de: null,
    historico: [],
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
    atributos: dados.atributos || {
      forca: 10,
      destreza: 10,
      constituicao: 10,
      inteligencia: 10,
      sabedoria: 10,
      carisma: 10,
    },
    inventario: dados.inventario || [],
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
