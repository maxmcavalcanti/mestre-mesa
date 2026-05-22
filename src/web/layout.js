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
  .acao.teste { background: #211f2c; border: 1px solid #4a4360; border-radius: 8px; padding: .7rem .9rem; }
  .acao.teste label { color: #e6e3df; font-size: 1rem; }
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
<body>${corpo}
<script>
  // Mantém a última mensagem à vista (rolar pro fim), no log (desktop) ou na
  // página (celular). Só rola se o usuário já estava perto do fim, pra não puxar
  // a tela durante a leitura quando o polling atualiza.
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
</script>
</body>
</html>`;
}
