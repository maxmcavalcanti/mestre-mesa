import { modificador, comSinal } from "../modificadores.js";
import { questTexto, questEstado } from "../mestre.js";

export function esc(s) {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

const CSS = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; background: #14131a; color: #e6e3df; line-height: 1.5; }
  a { color: #c9a86a; }
  header.topo { display: flex; align-items: baseline; gap: 1rem; padding: .8rem 1.2rem; background: #1d1b26; border-bottom: 1px solid #322e3f; }
  header.topo h1 { font-size: 1.1rem; margin: 0; }
  header.topo .local { color: #a8a2b8; font-size: .9rem; }
  .container { max-width: 1100px; margin: 0 auto; padding: 1.2rem; }
  .jogo { display: flex; gap: 1.2rem; align-items: flex-start; }
  .col-log { flex: 2; min-width: 0; }
  .col-party { flex: 1; min-width: 260px; }
  .log { display: flex; flex-direction: column; gap: .8rem; max-height: 70vh; overflow-y: auto; padding-right: .5rem; }
  .msg { padding: .7rem .9rem; border-radius: 8px; white-space: pre-wrap; word-wrap: break-word; }
  .msg.mestre { background: #211f2c; border-left: 3px solid #c9a86a; }
  .msg.jogador { background: #1a2630; border-left: 3px solid #5b8aa6; }
  .msg .quem { font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; color: #8a8499; margin-bottom: .2rem; }
  .dado { font-size: .85rem; color: #b8d0a8; background: #1e2a1c; border-left: 3px solid #7aa05a; padding: .4rem .7rem; border-radius: 8px; }
  .card { background: #1d1b26; border: 1px solid #322e3f; border-radius: 8px; padding: .8rem; margin-bottom: .8rem; }
  .card.ativo { border-color: #c9a86a; }
  .card h3 { margin: 0 0 .3rem; font-size: 1rem; }
  .card .meta { color: #a8a2b8; font-size: .85rem; }
  .atributos { display: grid; grid-template-columns: repeat(3, 1fr); gap: .2rem .6rem; font-size: .8rem; margin: .5rem 0; }
  input, textarea, select, button { font: inherit; }
  input[type=text], input[type=number], textarea, select { width: 100%; padding: .5rem; background: #14131a; border: 1px solid #3a3550; border-radius: 6px; color: #e6e3df; }
  textarea { resize: vertical; min-height: 4rem; }
  button { padding: .5rem 1rem; background: #c9a86a; color: #14131a; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
  button.sec { background: #322e3f; color: #e6e3df; }
  form { margin: 0; }
  .acao { margin-top: 1rem; }
  .acao .linha { display: flex; gap: .5rem; }
  .acao .linha input { flex: 1; }
  fieldset { border: 1px solid #322e3f; border-radius: 6px; margin: 0 0 .6rem; }
  label { font-size: .85rem; color: #a8a2b8; }
  details summary { cursor: pointer; color: #c9a86a; margin-bottom: .5rem; }
  .grid6 { display: grid; grid-template-columns: repeat(3, 1fr); gap: .4rem; }
  ul.lista { list-style: none; padding: 0; margin: .3rem 0 .8rem; }
  ul.lista li { padding: .15rem 0; font-size: .9rem; }
  .col-party h2 { margin: 1rem 0 .3rem; border-top: 1px solid #322e3f; padding-top: .6rem; }
  .col-party h2:first-child { border-top: none; padding-top: 0; margin-top: 0; }
  ul.campanhas { list-style: none; padding: 0; }
  ul.campanhas li { background: #1d1b26; border: 1px solid #322e3f; border-radius: 8px; padding: .8rem 1rem; margin-bottom: .6rem; }
  .htmx-indicator { opacity: 0; transition: opacity .2s; }
  .htmx-request .htmx-indicator { opacity: 1; }

  /* Celular: empilha em uma coluna e deixa a página rolar naturalmente. */
  @media (max-width: 720px) {
    .container { padding: .8rem; }
    .jogo { flex-direction: column; gap: .8rem; }
    .col-log, .col-party { flex: none; width: 100%; min-width: 0; }
    /* sem scroll interno no celular: uma rolagem só, a da página */
    .log { max-height: none; overflow: visible; }
    header.topo { flex-wrap: wrap; gap: .2rem .8rem; }
    header.topo h1 { font-size: 1rem; }
    .acao .linha { flex-wrap: wrap; }
    .acao .linha input { flex: 1 1 100%; }
  }
`;

export function layout({ titulo, corpo }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titulo)}</title>
  <script src="/htmx.min.js"></script>
  <style>${CSS}</style>
</head>
<body>${corpo}</body>
</html>`;
}

const ATRIBUTOS = ["forca", "destreza", "constituicao", "inteligencia", "sabedoria", "carisma"];

export function paginaInicial(campanhas) {
  const itens =
    campanhas
      .map(
        (c) =>
          `<li><a href="/campanhas/${esc(c.id)}"><strong>${esc(c.titulo)}</strong></a><br><span class="meta">${esc(c.local)}</span></li>`,
      )
      .join("") || "<li><em>Nenhuma campanha ainda. Crie a primeira abaixo.</em></li>";

  const corpo = `
  <header class="topo"><h1>Mestre de Mesa</h1></header>
  <div class="container">
    <h2>Campanhas</h2>
    <ul class="campanhas">${itens}</ul>

    <h2>Nova campanha</h2>
    <form method="post" action="/campanhas" class="card">
      <fieldset style="padding:.6rem">
        <label>Título</label>
        <input type="text" name="titulo" required placeholder="A Cripta Esquecida">
        <label>Cena inicial</label>
        <input type="text" name="local" placeholder="Entrada da cripta, sob uma chuva fina">
        <label>Sinopse (opcional)</label>
        <textarea name="sinopse" placeholder="Resumo curto da aventura"></textarea>
        <label>Notas do mestre — locais, NPCs, segredos, ganchos (opcional)</label>
        <textarea name="notas" placeholder="O que o mestre deve saber para conduzir a história"></textarea>
      </fieldset>
      <button type="submit">Criar campanha</button>
    </form>
  </div>`;
  return layout({ titulo: "Mestre de Mesa", corpo });
}

function cardPersonagem(p, ativoId, campanhaId) {
  const atrib = ATRIBUTOS.map(
    (a) => `<span>${a.slice(0, 3)} ${comSinal(modificador(p.atributos[a] ?? 10))}</span>`,
  ).join("");
  const botaoVez =
    p.id === ativoId
      ? `<span class="meta">jogando agora</span>`
      : `<form hx-post="/campanhas/${esc(campanhaId)}/vez" hx-target="#painel" hx-swap="outerHTML">
           <input type="hidden" name="turno_de" value="${esc(p.id)}">
           <button class="sec" type="submit">Passar a vez</button>
         </form>`;
  const cond = p.condicoes?.length
    ? `<div class="meta">Condições: ${esc(p.condicoes.join(", "))}</div>`
    : "";
  return `<div class="card ${p.id === ativoId ? "ativo" : ""}">
    <h3>${esc(p.nome)}</h3>
    <div class="meta">${esc(p.classe)} • nível ${p.nivel} • HP ${p.hp}/${p.hp_max}</div>
    <div class="atributos">${atrib}</div>
    <div class="meta">Itens: ${esc(p.inventario.join(", ") || "—")}</div>
    ${cond}
    ${botaoVez}
  </div>`;
}

// Missões com estado: concluídas riscadas, falhas em destaque.
function blocoMissoes(campanha) {
  const quests = campanha.quests || [];
  if (!quests.length) return "";
  const icone = { ativa: "•", concluida: "✓", falhou: "✗" };
  const itens = quests
    .map((q) => {
      const est = questEstado(q);
      const estilo =
        est === "concluida"
          ? "opacity:.55;text-decoration:line-through"
          : est === "falhou"
            ? "opacity:.7;color:#c98a8a"
            : "";
      return `<li style="${estilo}">${icone[est] || "•"} ${esc(questTexto(q))}</li>`;
    })
    .join("");
  return `<h2 style="font-size:1rem">Missões</h2><ul class="lista">${itens}</ul>`;
}

// Estado determinístico do mundo: NPCs conhecidos + flags.
function blocoMundo(campanha) {
  const npcs = Object.values(campanha.npcs || {});
  const flags = Object.entries(campanha.flags || {});
  if (!npcs.length && !flags.length) return "";
  const npcItens = npcs
    .map((n) => {
      const det = [n.natureza, n.estado, n.disposicao].filter(Boolean).join(" · ");
      const local = n.local ? ` <span class="meta">@ ${esc(n.local)}</span>` : "";
      return `<li><strong>${esc(n.nome)}</strong>${det ? ` <span class="meta">(${esc(det)})</span>` : ""}${local}</li>`;
    })
    .join("");
  const flagItens = flags
    .map(([k, v]) => `<li class="meta">${esc(k)}: ${esc(v)}</li>`)
    .join("");
  return (
    `<h2 style="font-size:1rem">Mundo</h2>` +
    (npcItens ? `<ul class="lista">${npcItens}</ul>` : "") +
    (flagItens ? `<ul class="lista">${flagItens}</ul>` : "")
  );
}

function areaAcao(campanha, ativo, eu) {
  const minhaVez = eu && ativo && eu === ativo.id;
  if (!minhaVez) {
    if (!ativo)
      return `<div class="acao meta">Crie um personagem para começar.</div>`;
    return `<div class="acao meta">⏳ Aguardando <strong>${esc(ativo.nome)}</strong> agir…</div>`;
  }
  if (campanha.historico.length === 0) {
    return `<form class="acao" hx-post="/campanhas/${esc(campanha.id)}/comecar" hx-target="#painel" hx-swap="outerHTML">
      <button type="submit">Começar a aventura</button>
    </form>`;
  }
  if (campanha.teste_pendente) {
    const t = campanha.teste_pendente;
    return `<form class="acao" hx-post="/campanhas/${esc(campanha.id)}/rolagem" hx-target="#painel" hx-swap="outerHTML">
      <label>O mestre pediu um teste de <strong>${esc(t.atributo)}</strong> (CD ${t.cd}). Role um d20 na mesa e digite o número:</label>
      <div class="linha">
        <input type="number" name="dado" min="1" max="20" required autofocus>
        <button type="submit">Enviar rolagem</button>
      </div>
    </form>`;
  }
  return `<form class="acao" hx-post="/campanhas/${esc(campanha.id)}/turno" hx-target="#painel" hx-swap="outerHTML" hx-on::after-request="this.reset()">
    <label>O que <strong>${esc(ativo?.nome || "você")}</strong> faz?</label>
    <div class="linha">
      <input type="text" name="entrada" required autofocus autocomplete="off">
      <button type="submit">Agir</button>
    </div>
    <span class="htmx-indicator meta">o mestre está pensando…</span>
  </form>`;
}

function logHistorico(historico) {
  const blocos = [];
  for (const m of historico) {
    if (m.papel === "mestre") {
      blocos.push(`<div class="msg mestre"><div class="quem">Mestre</div>${esc(m.texto)}</div>`);
    } else if (m.texto.startsWith("Resultado do teste")) {
      blocos.push(`<div class="dado">🎲 ${esc(m.texto.replace(/\. Narre.*$/, ""))}</div>`);
    } else if (m.texto.startsWith("Comece a aventura")) {
      // semente da abertura — não mostra
    } else {
      blocos.push(`<div class="msg jogador"><div class="quem">Jogador</div>${esc(m.texto)}</div>`);
    }
  }
  return blocos.join("");
}

function formNovoPersonagem(campanhaId) {
  const campos = ATRIBUTOS.map(
    (a) =>
      `<label>${a.slice(0, 3)}<input type="number" name="${a}" value="10" min="1" max="20"></label>`,
  ).join("");
  return `<details>
    <summary>+ Novo personagem</summary>
    <form class="card" hx-post="/campanhas/${esc(campanhaId)}/personagens" hx-target="#painel" hx-swap="outerHTML">
      <label>Nome</label><input type="text" name="nome" required>
      <label>Classe</label><input type="text" name="classe" value="Andarilho">
      <label>HP</label><input type="number" name="hp" value="12" min="1">
      <label>Atributos</label>
      <div class="grid6">${campos}</div>
      <div style="margin-top:.6rem"><button type="submit">Criar personagem</button></div>
    </form>
  </details>`;
}

// Fragmento trocável pelo HTMX: log + party + área de ação. `eu` é o id do
// personagem que ESTE dispositivo controla ('tela' = só assistindo, null = sem
// identidade). O polling (every 3s) só é injetado quando NÃO é a vez deste
// dispositivo, pra não apagar o input de quem está agindo.
export function painelJogo(campanha, personagens, eu) {
  const ativo =
    personagens.find((p) => p.id === campanha.turno_de) || personagens[0] || null;
  const cards = personagens.map((p) => cardPersonagem(p, ativo?.id, campanha.id)).join("");
  const minhaVez = eu && ativo && eu === ativo.id;
  const poll = minhaVez
    ? ""
    : `<div hx-get="/campanhas/${esc(campanha.id)}/painel" hx-trigger="every 3s" hx-target="#painel" hx-swap="outerHTML" style="display:none"></div>`;

  return `<div id="painel" class="jogo">
    <div class="col-log">
      <div class="log">${logHistorico(campanha.historico) || '<div class="meta">A aventura ainda não começou.</div>'}</div>
      ${areaAcao(campanha, ativo, eu)}
    </div>
    <aside class="col-party">
      <h2 style="font-size:1rem">Party</h2>
      ${cards || '<div class="meta">Nenhum personagem ainda.</div>'}
      ${formNovoPersonagem(campanha.id)}
      ${blocoMissoes(campanha)}
      ${blocoMundo(campanha)}
    </aside>
    ${poll}
  </div>`;
}

export function paginaJogo(campanha, personagens, eu) {
  const euNome =
    eu === "tela"
      ? "tela (assistindo)"
      : personagens.find((p) => p.id === eu)?.nome || "?";
  const corpo = `
  <header class="topo">
    <h1><a href="/" style="text-decoration:none;color:inherit">←</a> ${esc(campanha.titulo)}</h1>
    <span class="local">${esc(campanha.local)}</span>
    <span class="local" style="margin-left:auto">você: <strong>${esc(euNome)}</strong> · <a href="/campanhas/${esc(campanha.id)}/trocar">trocar</a></span>
  </header>
  <div class="container">
    ${painelJogo(campanha, personagens, eu)}
  </div>`;
  return layout({ titulo: campanha.titulo, corpo });
}

// Tela de entrada: cada dispositivo escolhe qual personagem controla.
export function paginaEntrar(campanha, personagens) {
  const opcoes =
    personagens
      .map(
        (p) =>
          `<form method="post" action="/campanhas/${esc(campanha.id)}/entrar" style="display:inline-block;margin:.3rem">
             <input type="hidden" name="eu" value="${esc(p.id)}">
             <button type="submit">${esc(p.nome)} <span style="opacity:.7">· ${esc(p.classe)}</span></button>
           </form>`,
      )
      .join("") || '<p class="meta">Nenhum personagem ainda. Crie o seu abaixo.</p>';

  const corpo = `
  <header class="topo">
    <h1><a href="/" style="text-decoration:none;color:inherit">←</a> ${esc(campanha.titulo)}</h1>
    <span class="local">${esc(campanha.local)}</span>
  </header>
  <div class="container">
    <h2>Quem é você?</h2>
    <p class="meta">Escolha o personagem que vai jogar neste aparelho.</p>
    <div>${opcoes}</div>
    <form method="post" action="/campanhas/${esc(campanha.id)}/entrar" style="margin-top:1rem">
      <input type="hidden" name="eu" value="tela">
      <button class="sec" type="submit">Só assistir (tela compartilhada)</button>
    </form>
    <h2 style="margin-top:1.5rem">Criar um personagem novo</h2>
    <form method="post" action="/campanhas/${esc(campanha.id)}/personagens" class="card">
      <label>Nome</label><input type="text" name="nome" required>
      <label>Classe</label><input type="text" name="classe" value="Andarilho">
      <label>HP</label><input type="number" name="hp" value="12" min="1">
      <label>Atributos</label>
      <div class="grid6">${ATRIBUTOS.map((a) => `<label>${a.slice(0, 3)}<input type="number" name="${a}" value="10" min="1" max="20"></label>`).join("")}</div>
      <div style="margin-top:.6rem"><button type="submit">Criar e jogar como ele</button></div>
    </form>
  </div>`;
  return layout({ titulo: campanha.titulo, corpo });
}
