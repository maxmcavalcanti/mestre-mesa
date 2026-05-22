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
  .dado { font-size: .85rem; padding: .4rem .7rem; border-radius: 8px; font-weight: 600; }
  .dado.ok { color: #b8d0a8; background: #1e2a1c; border-left: 3px solid #7aa05a; }
  .dado.fail { color: #d6a9a9; background: #2a1c1c; border-left: 3px solid #a05a5a; }
  .msg.sistema { background: #1c2026; border-left: 3px solid #6a7a8a; color: #b8c0c8; font-size: .85rem; text-align: center; }
  .modo.combate { display: flex; align-items: center; justify-content: space-between; gap: .6rem; margin-bottom: .8rem; padding: .5rem .8rem; border-radius: 8px; font-weight: 600; color: #e8c98a; background: #2a2418; border: 1px solid #5a4a2a; }
  .modo.combate button { font-size: .75rem; padding: .3rem .6rem; }
  .acao.teste { background: #211f2c; border: 1px solid #4a4360; border-radius: 8px; padding: .7rem .9rem; }
  .acao.teste label { color: #e6e3df; font-size: 1rem; }
  .card { background: #1d1b26; border: 1px solid #322e3f; border-radius: 8px; padding: .8rem; margin-bottom: .8rem; }
  .card.ativo { border-color: #c9a86a; }
  .card h3 { margin: 0 0 .3rem; font-size: 1rem; }
  .card .cab { display: flex; align-items: center; gap: .6rem; }
  .card .cab h3 { margin: 0; }
  .retrato { flex: none; width: 2.4rem; height: 2.4rem; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; line-height: 1; background: #14131a; border: 1px solid #322e3f; border-radius: 50%; }
  .card.ativo .retrato { border-color: #c9a86a; }
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
  .erro { margin-top: 1rem; padding: .6rem .9rem; border-radius: 8px; font-size: .9rem; color: #d6a9a9; background: #2a1c1c; border-left: 3px solid #a05a5a; }
  .desfazer { margin-top: .6rem; text-align: right; }
  .desfazer button { font-size: .8rem; padding: .35rem .7rem; opacity: .8; }
  .presenca { color: #7aa05a; font-size: .8rem; }
  .presenca.off { color: #a05a5a; }
  .digitando-aviso { color: #a8a2b8; font-size: .85rem; font-style: italic; min-height: 1.2em; margin-bottom: .4rem; }
  .digitando-aviso:empty { min-height: 0; margin: 0; }

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
<body>${corpo}
<script>
  // Mantém a última mensagem à vista (rolar pro fim), no log (desktop) ou na
  // página (celular). Só rola se o usuário já estava perto do fim, pra não puxar
  // a tela durante a leitura quando chega uma atualização.
  function rolarParaUltimo() {
    var log = document.querySelector('.log');
    var ultimo = log && log.lastElementChild;
    if (ultimo) ultimo.scrollIntoView({ block: 'end' });
  }
  function pertoDoFim() {
    var log = document.querySelector('.log');
    if (log && log.scrollHeight > log.clientHeight + 4)
      return log.scrollHeight - log.scrollTop - log.clientHeight < 120;
    return (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 120;
  }
  var estavaPerto = true;
  document.addEventListener('htmx:beforeSwap', function () { estavaPerto = pertoDoFim(); });
  document.addEventListener('htmx:afterSwap', function () { if (estavaPerto) rolarParaUltimo(); });
  document.addEventListener('DOMContentLoaded', rolarParaUltimo);

  // ---- Tempo real (WebSocket) ----
  // Conecta só na página de jogo (window.MESA presente). O servidor empurra o
  // painel (renderizado pro nosso eu), a presença e quem está digitando.
  (function () {
    if (!window.MESA) return;
    var ws = null, tentativas = 0, ultimoDigitando = false;
    var streamAcc = "", bolha = null;

    // Não troca o painel enquanto o jogador está digitando a ação/rolagem, pra
    // não apagar o que ele escreveu (espelha o antigo gate do polling).
    function editando() {
      var inp = document.querySelector('#painel .acao input[name="entrada"], #painel .acao input[name="dado"]');
      if (!inp) return false;
      return document.activeElement === inp || (inp.value && inp.value.trim().length > 0);
    }
    function aplicarPainel(html) {
      var atual = document.getElementById('painel');
      if (!atual) return;
      var perto = pertoDoFim();
      atual.outerHTML = html;
      if (window.htmx) htmx.process(document.getElementById('painel'));
      ultimoDigitando = false; // o input some no swap
      bolha = null; streamAcc = ""; // a bolha provisória foi substituída pelo log real
      if (perto) rolarParaUltimo();
    }
    // Bolha provisória do mestre durante o streaming. Mostra só o texto ANTES da
    // primeira tag [TESTE]/[ESTADO] (re-derivado do acumulado, tolera token parcial);
    // o painel final (push pós-turno) substitui a bolha pelo histórico de verdade.
    function streamInicio() {
      var log = document.querySelector('#painel .log');
      streamAcc = "";
      bolha = null;
      if (!log) return;
      bolha = document.createElement('div');
      bolha.className = 'msg mestre';
      bolha.innerHTML = '<div class="quem">Mestre</div><span class="txt"></span>';
      log.appendChild(bolha);
      if (pertoDoFim()) rolarParaUltimo();
    }
    function streamToken(texto) {
      if (!bolha) streamInicio();
      if (!bolha) return;
      streamAcc += texto;
      var visivel = streamAcc.split(/\\n?\\[(?:TESTE|ESTADO)\\]/)[0];
      var perto = pertoDoFim();
      bolha.querySelector('.txt').textContent = visivel;
      if (perto) rolarParaUltimo();
    }
    function mostrarPresenca(quem) {
      var el = document.getElementById('presenca');
      if (!el) return;
      el.textContent = (quem && quem.length) ? ('● ' + quem.join(', ')) : '';
      el.classList.toggle('off', !ws || ws.readyState !== 1);
    }
    function mostrarDigitando(quem) {
      var el = document.getElementById('digitando');
      if (!el) return;
      var outros = (quem || []).filter(function (n) { return n !== MESA.nome; });
      if (!outros.length) { el.textContent = ''; return; }
      el.textContent = outros.length === 1
        ? (outros[0] + ' está digitando…')
        : (outros.join(', ') + ' estão digitando…');
    }
    function tratar(msg) {
      if (msg.tipo === 'painel') { if (!editando()) aplicarPainel(msg.html); }
      else if (msg.tipo === 'presenca') mostrarPresenca(msg.quem);
      else if (msg.tipo === 'digitando') mostrarDigitando(msg.quem);
      else if (msg.tipo === 'stream-inicio') streamInicio();
      else if (msg.tipo === 'stream-token') streamToken(msg.texto);
    }
    function conectar() {
      var proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(proto + '://' + location.host + '/ws?campanha='
        + encodeURIComponent(MESA.campanha) + '&eu=' + encodeURIComponent(MESA.eu));
      ws.onopen = function () { tentativas = 0; var p = document.getElementById('presenca'); if (p) p.classList.remove('off'); };
      ws.onmessage = function (ev) { try { tratar(JSON.parse(ev.data)); } catch (e) {} };
      ws.onclose = function () {
        var p = document.getElementById('presenca'); if (p) p.classList.add('off');
        tentativas++;
        setTimeout(conectar, Math.min(1000 * tentativas, 5000)); // backoff até 5s
      };
      ws.onerror = function () { try { ws.close(); } catch (e) {} };
    }
    function sinalizarDigitando(on) {
      on = Boolean(on);
      if (on === ultimoDigitando) return;
      ultimoDigitando = on;
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ tipo: 'digitando', on: on }));
    }
    document.addEventListener('input', function (e) {
      if (e.target.matches && e.target.matches('#painel .acao input[name="entrada"]'))
        sinalizarDigitando(e.target.value.trim().length > 0);
    });
    document.addEventListener('htmx:afterSwap', function () { sinalizarDigitando(false); });

    // Eco otimista: ao enviar a ação/rolagem, mostra a própria mensagem no log na
    // hora — senão a narração (streaming) chega antes da fala do jogador. O painel
    // final (resposta do POST) substitui esta bolha pelo histórico de verdade.
    document.addEventListener('htmx:beforeRequest', function (e) {
      var form = (e.detail && e.detail.elt) || e.target;
      if (!form || !form.matches || !form.matches('#painel .acao')) return;
      var ent = form.querySelector('input[name="entrada"]');
      var dado = form.querySelector('input[name="dado"]');
      var texto = ent ? ent.value.trim() : (dado && dado.value ? ('🎲 rolei ' + dado.value) : '');
      if (!texto) return;
      var log = document.querySelector('#painel .log');
      if (!log) return;
      var b = document.createElement('div');
      b.className = 'msg jogador';
      var q = document.createElement('div'); q.className = 'quem'; q.textContent = 'Você';
      b.appendChild(q);
      b.appendChild(document.createTextNode(texto));
      log.appendChild(b);
      if (pertoDoFim()) rolarParaUltimo();
    });

    conectar();
  })();
</script>
</body>
</html>`;
}
