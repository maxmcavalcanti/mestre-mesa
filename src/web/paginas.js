import { layout, esc } from "./layout.js";
import { ATRIBUTOS, painelJogo } from "./componentes.js";

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
