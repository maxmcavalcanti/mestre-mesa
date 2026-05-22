import express from "express";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { iniciar } from "./src/bootstrap.js";
import { registrarRotas } from "./src/web/rotas.js";

const raiz = dirname(fileURLToPath(import.meta.url));
const { provider, promptBase } = await iniciar();

const app = express();
const PORTA = process.env.PORTA || 3000;
app.use(express.urlencoded({ extended: false }));
app.use(express.static(join(raiz, "public")));

registrarRotas(app, { provider, promptBase });

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
