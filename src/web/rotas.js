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
import { avancarVez, encerrarCombate } from "../dominio/combate.js";
import {
  liderEfetivo,
  criarProposta,
  registrarVoto,
  todosVotaram,
  dissidentes,
} from "../dominio/votacao.js";
import { paginaInicial, paginaJogo, paginaEntrar } from "./paginas.js";
import { painelJogo } from "./componentes.js";
import { difundirPainel, difundirPresenca } from "./difusao.js";
import { getEu, definirEu, carregarSessao, persistir } from "./sessao.js";

// Registra todas as rotas HTTP no app. `provider`/`promptBase` vêm do bootstrap;
// `sala` é o registro de WebSockets, pra empurrar o painel atualizado aos demais
// dispositivos depois de cada mutação (substitui o polling).
export function registrarRotas(app, { provider, promptBase, sala }) {
  // ---- Páginas ----

  app.get("/", async (req, res) => {
    res.send(paginaInicial(await listarCampanhas()));
  });

  app.post("/campanhas", async (req, res) => {
    const { titulo, local, sinopse, notas, tom, tom_voz } = req.body;
    const campanha = await criarCampanha({
      titulo,
      local,
      tom,
      tom_voz: tom_voz || null,
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
      let mudou = false;
      if (!campanha.turno_de && personagens[0]) {
        campanha.turno_de = personagens[0].id;
        mudou = true;
      }
      if (!campanha.lider && personagens[0]) {
        campanha.lider = personagens[0].id; // primeiro a entrar vira o líder
        mudou = true;
      }
      if (mudou) await salvarCampanha(campanha);
      return { novo, campanha, personagens };
    });
    // Roster mudou: atualiza o painel e a presença de todo mundo na sala.
    difundirPainel(sala, campanha, personagens);
    difundirPresenca(sala, id, personagens);
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
        difundirPainel(sala, campanha, personagens); // a vez mudou pra todos
      }
      return painelJogo(campanha, personagens, getEu(req, id));
    });
    res.send(html);
  });

  // ---- Líder e ação de grupo (votação) ----

  app.post("/campanhas/:id/lider", async (req, res) => {
    const id = req.params.id;
    const eu = getEu(req, id);
    const html = await comCampanha(id, async () => {
      const { campanha, personagens } = await carregarSessao(id);
      if (
        personagens.some((p) => p.id === req.body.lider) &&
        !campanha.combate &&
        !campanha.proposta
      ) {
        campanha.lider = req.body.lider;
        await salvarCampanha(campanha);
        difundirPainel(sala, campanha, personagens);
      }
      return painelJogo(campanha, personagens, eu);
    });
    res.send(html);
  });

  app.post("/campanhas/:id/propor", async (req, res) => {
    const id = req.params.id;
    const eu = getEu(req, id);
    const texto = (req.body.entrada || "").trim();
    const html = await comCampanha(id, async () => {
      const { campanha, personagens } = await carregarSessao(id);
      const lider = liderEfetivo(campanha, personagens);
      if (eu === lider && texto && campanha.modo !== "combate" && !campanha.proposta) {
        campanha.proposta = criarProposta(lider, texto);
        await salvarCampanha(campanha);
        difundirPainel(sala, campanha, personagens);
      }
      return painelJogo(campanha, personagens, eu);
    });
    res.send(html);
  });

  // Resolve a proposta: roda a ação do líder no mestre (concordantes) e enfileira
  // os discordantes para agirem individualmente. Adquire o lock por conta própria
  // (não pode ser chamada de dentro de outro comCampanha da mesma campanha).
  async function resolver(id, eu) {
    return comCampanha(id, async () => {
      const { campanha, personagens } = await carregarSessao(id);
      const prop = campanha.proposta;
      if (!prop) return painelJogo(campanha, personagens, eu);
      const lider = liderEfetivo(campanha, personagens);
      if (!todosVotaram(prop, personagens) && eu !== lider)
        return painelJogo(campanha, personagens, eu);

      const persLider = personagens.find((p) => p.id === lider) || personagens[0];
      const fila = dissidentes(prop, personagens);
      const texto = prop.texto;
      campanha.proposta = null;

      let abriu = false;
      const onDelta = (t) => {
        if (!abriu) { sala.transmitir(id, { tipo: "stream-inicio" }); abriu = true; }
        sala.transmitir(id, { tipo: "stream-token", texto: t });
      };
      const snap = instantaneo(campanha, personagens);
      const tam = campanha.historico.length;
      try {
        const r = await processarAcao({
          campanha, personagem: persLider, personagens, entrada: texto, provider, promptBase, onDelta,
        });
        campanha.teste_pendente = r.teste || null;
        if (campanha.historico.length > tam) campanha.desfazer = snap;
        campanha.fila_individual = fila;
        // se a ação de grupo pediu teste, o líder rola antes de a fila começar
        campanha.turno_de = campanha.teste_pendente ? persLider.id : fila[0] || persLider.id;
        await persistir(campanha, personagens, r.modificados || []);
      } catch (err) {
        console.error(`[erro do mestre] ${err.message}`);
        return painelJogo(campanha, personagens, eu, `O mestre tropeçou: ${err.message}. Tente de novo.`);
      }
      difundirPainel(sala, campanha, personagens);
      return painelJogo(campanha, personagens, eu);
    });
  }

  app.post("/campanhas/:id/voto", async (req, res) => {
    const id = req.params.id;
    const eu = getEu(req, id);
    let resolveu = false;
    const html = await comCampanha(id, async () => {
      const { campanha, personagens } = await carregarSessao(id);
      if (campanha.proposta && personagens.some((p) => p.id === eu)) {
        registrarVoto(campanha.proposta, eu, req.body.valor);
        await salvarCampanha(campanha);
        difundirPainel(sala, campanha, personagens);
        resolveu = todosVotaram(campanha.proposta, personagens);
      }
      return painelJogo(campanha, personagens, eu);
    });
    // resolve depois do lock do voto (resolver readquire a fila da campanha).
    if (resolveu) return res.send(await resolver(id, eu));
    res.send(html);
  });

  app.post("/campanhas/:id/resolver", async (req, res) => {
    res.send(await resolver(req.params.id, getEu(req, req.params.id)));
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
      // Com votação em curso, ninguém age individualmente até resolver.
      if (campanha.proposta) return painelJogo(campanha, personagens, eu);
      const snap = instantaneo(campanha, personagens); // estado antes do turno
      const tamHist = campanha.historico.length;
      const jaEmCombate = campanha.modo === "combate"; // antes do turno
      // Streaming: repassa a narração em pedaços pra sala. O 'stream-inicio' sai
      // no 1º token (se houver), então branches no-op não disparam nada.
      let abriu = false;
      const onDelta = (texto) => {
        if (!abriu) { sala.transmitir(id, { tipo: "stream-inicio" }); abriu = true; }
        sala.transmitir(id, { tipo: "stream-token", texto });
      };
      try {
        const r = await fn({ campanha, personagens, ativo, onDelta });
        campanha.teste_pendente = r.teste || null;
        // Só registra o ponto de desfazer se um turno de fato rolou (o histórico
        // cresceu); branches no-op (sem ação / entrada vazia) não viram snapshot.
        if (campanha.historico.length > tamHist) campanha.desfazer = snap;
        // Em combate: a vez avança sozinha quando a ação concluiu (sem teste
        // pendente). Não avança no turno que INICIOU o combate (jaEmCombate=false):
        // a iniciativa já pôs a vez no primeiro combatente.
        if (jaEmCombate && campanha.modo === "combate" && !campanha.teste_pendente) {
          avancarVez(campanha, personagens);
        }
        // Fila de ações individuais (votação): quando um discordante conclui a vez
        // (sem teste pendente), passa pro próximo da fila; ao esvaziar, volta ao líder.
        else if (!campanha.combate && campanha.fila_individual?.length && !campanha.teste_pendente) {
          if (ativo.id === campanha.fila_individual[0]) campanha.fila_individual.shift();
          campanha.turno_de =
            campanha.fila_individual[0] || liderEfetivo(campanha, personagens);
        }
        await persistir(campanha, personagens, r.modificados || []);
        difundirPainel(sala, campanha, personagens); // turno resolvido pra todos
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
    await rodarTurno(req, res, req.params.id, ({ campanha, personagens, ativo, onDelta }) => {
      if (campanha.historico.length > 0) return { teste: campanha.teste_pendente };
      return processarAcao({
        campanha,
        personagem: ativo,
        personagens,
        entrada: ABERTURA,
        provider,
        promptBase,
        onDelta,
      });
    });
  });

  app.post("/campanhas/:id/turno", async (req, res) => {
    const entrada = (req.body.entrada || "").trim();
    await rodarTurno(req, res, req.params.id, ({ campanha, personagens, ativo, onDelta }) => {
      if (!entrada) return { teste: campanha.teste_pendente };
      return processarAcao({
        campanha,
        personagem: ativo,
        personagens,
        entrada,
        provider,
        promptBase,
        onDelta,
      });
    });
  });

  app.post("/campanhas/:id/rolagem", async (req, res) => {
    const dado = parseInt(req.body.dado, 10);
    await rodarTurno(req, res, req.params.id, ({ campanha, personagens, ativo, onDelta }) => {
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
        onDelta,
      });
    });
  });

  // Encerra o combate manualmente (rede de segurança, caso o mestre esqueça a
  // tag [MODO] exploracao). Qualquer jogador pode acionar.
  app.post("/campanhas/:id/encerrar-combate", async (req, res) => {
    const id = req.params.id;
    const eu = getEu(req, id);
    const html = await comCampanha(id, async () => {
      const { campanha, personagens } = await carregarSessao(id);
      if (campanha.modo === "combate") {
        const msg = encerrarCombate(campanha, personagens);
        campanha.historico.push({ papel: "sistema", texto: msg });
        await salvarCampanha(campanha);
        difundirPainel(sala, campanha, personagens);
      }
      return painelJogo(campanha, personagens, eu);
    });
    res.send(html);
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
      difundirPainel(sala, restaurado.campanha, restaurado.personagens);
      return painelJogo(restaurado.campanha, restaurado.personagens, eu);
    });
    res.send(html);
  });
}
