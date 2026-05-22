import { modificador, comSinal, ATRIBUTOS } from "../dominio/modificadores.js";
import { questTexto, questEstado } from "../dominio/protocolo.js";
import { retratoClasse } from "../dominio/retratos.js";
import { podeDesfazer } from "../dominio/desfazer.js";
import { esc } from "./layout.js";

function cardPersonagem(p, ativoId, campanhaId, emCombate) {
  const atrib = ATRIBUTOS.map(
    (a) => `<span>${a.slice(0, 3)} ${comSinal(modificador(p.atributos[a] ?? 10))}</span>`,
  ).join("");
  // Em combate a vez é automática (rodízio por iniciativa): sem "passar a vez".
  const botaoVez =
    p.id === ativoId
      ? `<span class="meta">jogando agora</span>`
      : emCombate
        ? `<span class="meta">${p.hp > 0 ? "aguardando" : "fora de combate"}</span>`
        : `<form hx-post="/campanhas/${esc(campanhaId)}/vez" hx-target="#painel" hx-swap="outerHTML">
           <input type="hidden" name="turno_de" value="${esc(p.id)}">
           <button class="sec" type="submit">Passar a vez</button>
         </form>`;
  const cond = p.condicoes?.length
    ? `<div class="meta">Condições: ${esc(p.condicoes.join(", "))}</div>`
    : "";
  return `<div class="card ${p.id === ativoId ? "ativo" : ""}">
    <div class="cab">
      <div class="retrato" aria-hidden="true">${retratoClasse(p.classe)}</div>
      <div>
        <h3>${esc(p.nome)}</h3>
        <div class="meta">${esc(p.classe)} • nível ${p.nivel} • HP ${p.hp}/${p.hp_max}</div>
      </div>
    </div>
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
    const mod = modificador(ativo?.atributos?.[t.atributo] ?? 10);
    return `<form class="acao teste" hx-post="/campanhas/${esc(campanha.id)}/rolagem" hx-target="#painel" hx-swap="outerHTML">
      <label>🎲 Teste de <strong>${esc(t.atributo)}</strong> · CD ${t.cd}</label>
      <div class="meta">Role um d20 na mesa e digite o resultado. Seu modificador de ${esc(t.atributo)} (${comSinal(mod)}) é somado automaticamente.</div>
      <div class="linha">
        <input type="number" name="dado" min="1" max="20" required autofocus placeholder="d20">
        <button type="submit">Rolar</button>
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
    if (m.papel === "sistema") {
      blocos.push(`<div class="msg sistema">${esc(m.texto)}</div>`);
    } else if (m.papel === "mestre") {
      blocos.push(`<div class="msg mestre"><div class="quem">Mestre</div>${esc(m.texto)}</div>`);
    } else if (m.texto.startsWith("Resultado do teste")) {
      const txt = m.texto.replace(/\.\s*Narre.*$/i, "");
      const ok = /\(sucesso\)/i.test(txt);
      blocos.push(
        `<div class="dado ${ok ? "ok" : "fail"}">🎲 ${esc(txt)} ${ok ? "✓" : "✗"}</div>`,
      );
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

// Fragmento sincronizado por WebSocket: log + party + área de ação. `eu` é o id do
// personagem que ESTE dispositivo controla ('tela' = só assistindo, null = sem
// identidade). O servidor empurra este painel (renderizado por-eu) a cada mudança
// de estado; o cliente ignora o push enquanto o input de ação está em edição, pra
// não apagar o que o jogador da vez está digitando. `erro` é uma mensagem
// transitória (turno que falhou): aparece só pra quem agiu, na resposta do POST,
// e some no próximo push/ação — não é persistida.
export function painelJogo(campanha, personagens, eu, erro = null) {
  const ativo =
    personagens.find((p) => p.id === campanha.turno_de) || personagens[0] || null;
  const emCombate = campanha.modo === "combate";
  const cards = personagens.map((p) => cardPersonagem(p, ativo?.id, campanha.id, emCombate)).join("");
  const minhaVez = eu && ativo && eu === ativo.id;
  // Banner de combate: rodada + botão de encerrar (rede de segurança).
  const banner = emCombate
    ? `<div class="modo combate">⚔️ Combate — rodada ${campanha.combate?.rodada || 1}
         <form hx-post="/campanhas/${esc(campanha.id)}/encerrar-combate" hx-target="#painel" hx-swap="outerHTML" style="display:inline">
           <button class="sec" type="submit">encerrar combate</button>
         </form>
       </div>`
    : "";
  const aviso = erro ? `<div class="erro">⚠️ ${esc(erro)}</div>` : "";
  // Desfazer só pra quem está na vez (gerou o beat) e quando há ponto salvo.
  const desfazer =
    minhaVez && podeDesfazer(campanha) && campanha.historico.length
      ? `<form class="desfazer" hx-post="/campanhas/${esc(campanha.id)}/desfazer" hx-target="#painel" hx-swap="outerHTML">
           <button class="sec" type="submit">↩ Desfazer último turno</button>
         </form>`
      : "";

  return `<div id="painel" class="jogo">
    <div class="col-log">
      ${banner}
      <div class="log">${logHistorico(campanha.historico) || '<div class="meta">A aventura ainda não começou.</div>'}</div>
      ${aviso}
      ${areaAcao(campanha, ativo, eu)}
      ${desfazer}
    </div>
    <aside class="col-party">
      <h2 style="font-size:1rem">Party</h2>
      ${cards || '<div class="meta">Nenhum personagem ainda.</div>'}
      ${formNovoPersonagem(campanha.id)}
      ${blocoMissoes(campanha)}
      ${blocoMundo(campanha)}
    </aside>
  </div>`;
}
