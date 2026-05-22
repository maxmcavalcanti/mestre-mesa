import express from "express";
import { WebSocketServer } from "ws";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { iniciar } from "./src/bootstrap.js";
import { registrarRotas } from "./src/web/rotas.js";
import { criarSala } from "./src/web/sala.js";
import { difundirPresenca, difundirDigitando } from "./src/web/difusao.js";
import { carregarSessao } from "./src/web/sessao.js";
import { painelJogo } from "./src/web/componentes.js";

const raiz = dirname(fileURLToPath(import.meta.url));
const { provider, promptBase } = await iniciar();
const sala = criarSala();

const app = express();
const PORTA = process.env.PORTA || 3000;
app.use(express.urlencoded({ extended: false }));
app.use(express.static(join(raiz, "public")));

registrarRotas(app, { provider, promptBase, sala });

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

// ---- WebSocket: sincronização em tempo real ----
// O cliente conecta em /ws?campanha=<id>&eu=<eu>. O servidor empurra o painel
// (renderizado por-eu), a presença e quem está digitando. As ações em si seguem
// por POST (HTMX); o broadcast do resultado vem por aqui (ver difusao.js).
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url, "http://localhost");
  const id = url.searchParams.get("campanha");
  const eu = url.searchParams.get("eu");
  if (!id) return ws.close();

  const conn = { ws, eu, digitando: false };
  sala.entrar(id, conn);

  // Estado atual pra quem acabou de chegar + avisa a presença aos demais.
  try {
    const { campanha, personagens } = await carregarSessao(id);
    sala.enviarPara(conn, { tipo: "painel", html: painelJogo(campanha, personagens, eu) });
    difundirPresenca(sala, id, personagens);
  } catch {
    /* campanha inexistente/erro de leitura: segue conectado, sem estado */
  }

  ws.on("message", async (dados) => {
    let msg;
    try {
      msg = JSON.parse(dados);
    } catch {
      return;
    }
    if (msg.tipo === "digitando") {
      conn.digitando = Boolean(msg.on);
      try {
        const { personagens } = await carregarSessao(id);
        difundirDigitando(sala, id, personagens);
      } catch {
        /* sem nomes: ignora */
      }
    }
  });

  ws.on("close", () => {
    sala.sair(id, conn);
    carregarSessao(id)
      .then(({ personagens }) => {
        difundirPresenca(sala, id, personagens);
        difundirDigitando(sala, id, personagens);
      })
      .catch(() => {});
  });
});

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

// Só aceita upgrade de WebSocket no caminho /ws; o resto é HTTP normal.
servidor.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (pathname !== "/ws") return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

// Encerramento limpo: Ctrl+C / término do terminal fecham o servidor na hora.
for (const sinal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sinal, () => {
    console.log("\nencerrando…");
    wss.close();
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 800).unref(); // força se demorar
  });
}
