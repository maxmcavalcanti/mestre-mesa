import express from "express";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { lerPromptBase } from "./src/estado.js";
import {
  listarCampanhas,
  criarCampanha,
  carregarCampanha,
  salvarCampanha,
  existeCampanha,
  listarPersonagens,
  criarPersonagem,
  salvarPersonagem,
} from "./src/dados.js";
import { criarProvider } from "./src/llm/provider.js";
import { processarAcao, resolverRolagem } from "./src/jogo.js";
import {
  paginaInicial,
  paginaJogo,
  paginaEntrar,
  painelJogo,
} from "./src/web/render.js";

const ABERTURA =
  "Comece a aventura: descreva a cena inicial em segunda pessoa e termine perguntando o que eu faço.";
const ATRIBUTOS = ["forca", "destreza", "constituicao", "inteligencia", "sabedoria", "carisma"];

const raiz = dirname(fileURLToPath(import.meta.url));
const provider = criarProvider();
const promptBase = await lerPromptBase();

const app = express();
const PORTA = process.env.PORTA || 3000;
app.use(express.urlencoded({ extended: false }));
app.use(express.static(join(raiz, "public")));

// Qual personagem este dispositivo controla (cookie eu_<campanhaId>).
// 'tela' = só assistindo; null = ainda não entrou.
function getEu(req, id) {
  const cabecalho = req.headers.cookie || "";
  for (const par of cabecalho.split(";")) {
    const i = par.indexOf("=");
    if (i < 0) continue;
    if (par.slice(0, i).trim() === `eu_${id}`)
      return decodeURIComponent(par.slice(i + 1).trim());
  }
  return null;
}

function definirEu(res, id, eu) {
  res.cookie(`eu_${id}`, eu, { maxAge: 30 * 864e5, path: "/" });
}

// Carrega campanha + party e identifica o personagem da vez.
async function carregarSessao(id) {
  const campanha = await carregarCampanha(id);
  const personagens = await listarPersonagens(id);
  const ativo =
    personagens.find((p) => p.id === campanha.turno_de) || personagens[0] || null;
  return { campanha, personagens, ativo };
}

async function persistir(campanha, personagens, modificados) {
  await salvarCampanha(campanha);
  const ids = new Set(modificados);
  for (const p of personagens) {
    if (ids.has(p.id)) await salvarPersonagem(campanha.id, p);
  }
}

// ---- Páginas ----

app.get("/", async (req, res) => {
  res.send(paginaInicial(await listarCampanhas()));
});

app.post("/campanhas", async (req, res) => {
  const { titulo, local, sinopse, notas } = req.body;
  const campanha = await criarCampanha({
    titulo,
    local,
    modulo: { sinopse, notas },
  });
  res.redirect(`/campanhas/${campanha.id}`);
});

app.get("/campanhas/:id", async (req, res) => {
  const id = req.params.id;
  if (!(await existeCampanha(id))) return res.status(404).send("Campanha não encontrada");
  const { campanha, personagens } = await carregarSessao(id);
  const eu = getEu(req, id);
  const valido = eu === "tela" || personagens.some((p) => p.id === eu);
  if (!valido) return res.send(paginaEntrar(campanha, personagens));
  res.send(paginaJogo(campanha, personagens, eu));
});

app.post("/campanhas/:id/entrar", (req, res) => {
  definirEu(res, req.params.id, req.body.eu);
  res.redirect(`/campanhas/${req.params.id}`);
});

app.get("/campanhas/:id/trocar", (req, res) => {
  res.clearCookie(`eu_${req.params.id}`, { path: "/" });
  res.redirect(`/campanhas/${req.params.id}`);
});

// Polling de sincronização: devolve o painel conforme o eu do dispositivo.
app.get("/campanhas/:id/painel", async (req, res) => {
  const { campanha, personagens } = await carregarSessao(req.params.id);
  res.send(painelJogo(campanha, personagens, getEu(req, req.params.id)));
});

// ---- Fragmentos HTMX ----

app.post("/campanhas/:id/personagens", async (req, res) => {
  const id = req.params.id;
  const b = req.body;
  const atributos = {};
  for (const a of ATRIBUTOS) atributos[a] = parseInt(b[a], 10) || 10;
  const novo = await criarPersonagem(id, {
    nome: b.nome,
    classe: b.classe,
    hp: parseInt(b.hp, 10) || 12,
    atributos,
  });
  const { campanha, personagens } = await carregarSessao(id);
  if (!campanha.turno_de && personagens[0]) {
    campanha.turno_de = personagens[0].id;
    await salvarCampanha(campanha);
  }
  // Criado pela tela de entrada (não-HTMX): vira esse personagem e entra no jogo.
  if (!req.get("HX-Request")) {
    definirEu(res, id, novo.id);
    return res.redirect(`/campanhas/${id}`);
  }
  res.send(painelJogo(campanha, personagens, getEu(req, id)));
});

app.post("/campanhas/:id/vez", async (req, res) => {
  const id = req.params.id;
  const { campanha, personagens } = await carregarSessao(id);
  if (personagens.some((p) => p.id === req.body.turno_de)) {
    campanha.turno_de = req.body.turno_de;
    await salvarCampanha(campanha);
  }
  res.send(painelJogo(campanha, personagens, getEu(req, id)));
});

async function rodarTurno(req, res, id, fn) {
  const { campanha, personagens, ativo } = await carregarSessao(id);
  const eu = getEu(req, id);
  // Só o dispositivo do personagem da vez pode agir.
  if (!ativo || eu !== ativo.id)
    return res.send(painelJogo(campanha, personagens, eu));
  try {
    const r = await fn({ campanha, personagens, ativo });
    campanha.teste_pendente = r.teste || null;
    await persistir(campanha, personagens, r.modificados || []);
  } catch (err) {
    console.error(`[erro do mestre] ${err.message}`);
  }
  res.send(painelJogo(campanha, personagens, eu));
}

app.post("/campanhas/:id/comecar", async (req, res) => {
  await rodarTurno(req, res, req.params.id, ({ campanha, personagens, ativo }) => {
    if (campanha.historico.length > 0) return { teste: campanha.teste_pendente };
    return processarAcao({
      campanha,
      personagem: ativo,
      personagens,
      entrada: ABERTURA,
      provider,
      promptBase,
    });
  });
});

app.post("/campanhas/:id/turno", async (req, res) => {
  const entrada = (req.body.entrada || "").trim();
  await rodarTurno(req, res, req.params.id, ({ campanha, personagens, ativo }) => {
    if (!entrada) return { teste: campanha.teste_pendente };
    return processarAcao({
      campanha,
      personagem: ativo,
      personagens,
      entrada,
      provider,
      promptBase,
    });
  });
});

app.post("/campanhas/:id/rolagem", async (req, res) => {
  const dado = parseInt(req.body.dado, 10);
  await rodarTurno(req, res, req.params.id, ({ campanha, personagens, ativo }) => {
    if (!campanha.teste_pendente || Number.isNaN(dado))
      return { teste: campanha.teste_pendente };
    return resolverRolagem({
      campanha,
      personagem: ativo,
      personagens,
      teste: campanha.teste_pendente,
      dado,
      provider,
      promptBase,
    });
  });
});

// Rede de segurança: nada de derrubar o servidor por um erro de rota.
app.use((err, req, res, next) => {
  console.error(`[erro] ${req.method} ${req.url}: ${err.message}`);
  if (!res.headersSent) res.status(500).send("Erro no servidor.");
});
process.on("unhandledRejection", (e) =>
  console.error(`[unhandledRejection] ${e?.message || e}`),
);

function ipsLocais() {
  const ips = [];
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === "IPv4" && !i.internal) ips.push(i.address);
    }
  }
  return ips;
}

const servidor = app.listen(PORTA, "0.0.0.0", () => {
  console.log(`\nMestre de Mesa no ar:`);
  console.log(`  neste PC:        http://localhost:${PORTA}`);
  for (const ip of ipsLocais()) {
    console.log(`  na rede local:   http://${ip}:${PORTA}  (abra no celular)`);
  }
  console.log(`\nCtrl+C para encerrar.`);
  console.log(
    `Dica: se o celular não abrir, libere a porta ${PORTA} no Firewall do Windows`,
  );
  console.log(`(Painel de Controle > Firewall > Regras de Entrada > Nova Regra > Porta TCP ${PORTA}).\n`);
});

// Encerramento limpo: Ctrl+C / término do terminal fecham o servidor na hora.
for (const sinal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sinal, () => {
    console.log("\nencerrando…");
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 800).unref(); // força se demorar
  });
}
