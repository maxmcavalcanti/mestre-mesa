// Divide um buffer de texto em sentenças completas + resto. Para uso com
// streaming: a cada delta, chama dividirSentencas no acumulado, envia as
// sentenças completas pro TTS e mantém o resto pra próxima rodada.
//
// Considera ".", "!" e "?" como terminadores quando seguidos de espaço,
// quebra ou fim do buffer. Evita falsos cortes em abreviações comuns
// (Sr., Dr., etc.) e em números decimais (3.14).

const ABREVIACOES = new Set([
  "sr", "sra", "srta", "dr", "dra", "prof", "profa",
  "etc", "vs", "ex", "obs", "p", "pp", "fig", "vol",
]);

const TERMINADOR = /[.!?]/;

export function dividirSentencas(buffer) {
  const sentencas = [];
  let inicio = 0;
  let i = 0;
  while (i < buffer.length) {
    const ch = buffer[i];
    if (!TERMINADOR.test(ch)) { i++; continue; }

    if (ch === ".") {
      const anterior = palavraAntes(buffer, i);
      if (anterior && ABREVIACOES.has(anterior.toLowerCase())) { i++; continue; }
      // número decimal: dígito antes e dígito depois → não corta.
      if (/\d/.test(buffer[i - 1] || "") && /\d/.test(buffer[i + 1] || "")) {
        i++; continue;
      }
    }

    // engole terminadores consecutivos (?!, ..., ?!?)
    let fim = i + 1;
    while (fim < buffer.length && TERMINADOR.test(buffer[fim])) fim++;

    // precisa ser fim do buffer ou seguido de whitespace pra cortar
    if (fim < buffer.length && !/\s/.test(buffer[fim])) { i = fim; continue; }

    const s = buffer.slice(inicio, fim).trim();
    if (s) sentencas.push(s);
    while (fim < buffer.length && /\s/.test(buffer[fim])) fim++;
    inicio = fim;
    i = fim;
  }
  return { sentencas, resto: buffer.slice(inicio) };
}

function palavraAntes(buf, pos) {
  let j = pos - 1;
  const chars = [];
  while (j >= 0 && /[A-Za-zÀ-ÿ]/.test(buf[j])) {
    chars.push(buf[j]);
    j--;
  }
  return chars.reverse().join("");
}
