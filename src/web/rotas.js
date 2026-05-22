import { ABERTURA } from "../bootstrap.js";
import {
  listarCampanhas,
  criarCampanha,
  criarPersonagem,
  salvarCampanha,
  salvarPersonagem,
  existeCampanha,
  comCampanha,
} from "../dados.js";
import { ATRIBUTOS } from "../dominio/modificadores.js";
import { processarAcao, resolverRolagem } from "../jogo.js";
import { instantaneo, restaurar } from "../dominio/desfazer.js";
import { paginaInicial, paginaJogo, paginaEntrar } from "./paginas.js";
import { painelJogo } from "./componentes.js";
import { getEu, definirEu, carregarSessao, persistir } from "./sessao.js";

// Registra todas as rotas HTTP no app. `provider`/`promptBase` vêm do bootstrap.
export function registrarRotas(app, { provider, promptBase }) {
  // ---- Páginas ----

  app.get("/", async (req, res) => {
    res.send(paginaInicial(await listarCampanhas()));
  });

  app.post("/campanhas", async (req, res) => {
    const { titulo, local, sinopse, notas, tom } = req.body;
    const campanha = await criarCampanha({
      titulo,
      local,
      tom,
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
    const { novo, campanha, personagens } = await comCampanha(id, async () => {
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
      return { novo, campanha, personagens };
    });
    // Criado pela tela de entrada (não-HTMX): vira esse personagem e entra no jogo.
    if (!req.get("HX-Request")) {
      definirEu(res, id, novo.id);
      return res.redirect(`/campanhas/${id}`);
    }
    res.send(painelJogo(campanha, personagens, getEu(req, id)));
  });

  app.post("/campanhas/:id/vez", async (req, res) => {
    const id = req.params.id;
    const html = await comCampanha(id, async () => {
      const { campanha, personagens } = await carregarSessao(id);
      if (personagens.some((p) => p.id === req.body.turno_de)) {
        campanha.turno_de = req.body.turno_de;
        await salvarCampanha(campanha);
      }
      return painelJogo(campanha, personagens, getEu(req, id));
    });
    res.send(html);
  });

  async function rodarTurno(req, res, id, fn) {
    const eu = getEu(req, id);
    // Serializa o ciclo carregar→agir→salvar: dois requests na mesma campanha não
    // se intercalam (a renderização é só montagem de string, fica dentro; o envio
    // pela rede fica fora pra não segurar o lock durante I/O.)
    const html = await comCampanha(id, async () => {
      const { campanha, personagens, ativo } = await carregarSessao(id);
      // Só o dispositivo do personagem da vez pode agir.
      if (!ativo || eu !== ativo.id) return painelJogo(campanha, personagens, eu);
      const snap = instantaneo(campanha, personagens); // estado antes do turno
      const tamHist = campanha.historico.length;
      try {
        const r = await fn({ campanha, personagens, ativo });
        campanha.teste_pendente = r.teste || null;
        // Só registra o ponto de desfazer se um turno de fato rolou (o histórico
        // cresceu); branches no-op (sem ação / entrada vazia) não viram snapshot.
        if (campanha.historico.length > tamHist) campanha.desfazer = snap;
        await persistir(campanha, personagens, r.modificados || []);
      } catch (err) {
        console.error(`[erro do mestre] ${err.message}`);
        // Nada persistido: banner de erro pra quem agiu. O estado em memória (inclui
        // a ação não-salva) some no próximo polling/ação.
        return painelJogo(campanha, personagens, eu, `O mestre tropeçou: ${err.message}. Tente de novo.`);
      }
      return painelJogo(campanha, personagens, eu);
    });
    res.send(html);
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

  // Desfaz o último turno: restaura o instantâneo salvo antes dele. Só o
  // dispositivo do personagem da vez (quem gerou o beat) pode desfazer.
  app.post("/campanhas/:id/desfazer", async (req, res) => {
    const id = req.params.id;
    const eu = getEu(req, id);
    const html = await comCampanha(id, async () => {
      const { campanha, personagens, ativo } = await carregarSessao(id);
      const restaurado = restaurar(campanha);
      if (!ativo || eu !== ativo.id || !restaurado)
        return painelJogo(campanha, personagens, eu);
      await salvarCampanha(restaurado.campanha);
      for (const p of restaurado.personagens) await salvarPersonagem(id, p);
      return painelJogo(restaurado.campanha, restaurado.personagens, eu);
    });
    res.send(html);
  });
}
