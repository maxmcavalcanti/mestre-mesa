// Narrador: consome o stream de texto do mestre token-a-token, descarta tags
// de protocolo ([TESTE]/[ESTADO]/[MODO]), divide em sentenças e enfileira
// chamadas ao TTS. Cada sentença gera 1 evento de áudio na sala, transmitido
// na ordem em que apareceu (geração é sequencial pra evitar pisar no GPU).
//
// O narrador tem dois loops:
// 1. máquina de estado char-a-char: "prose" vs "intag" — só prose vai pro buffer.
// 2. cauda de promessas: a próxima chamada de narrar() só começa depois da
//    anterior resolver (e só então emite o audio event).
import { dividirSentencas } from "./sentenca.js";
import { narrar as narrarPadrao } from "./index.js";

const TAGS_VALIDAS = /^\[(TESTE|ESTADO|MODO)\b/i;
const LIMITE_PENDENTE = 32; // se passar disso sem newline e sem casar TAG, não era tag

export function criarNarrador({ sala, campanhaId, voz, narrar = narrarPadrao }) {
  let estado = "prose"; // "prose" | "intag"
  let pendente = "";     // chars desde o último '[' enquanto avaliamos se é tag
  let buffer = "";       // prosa limpa aguardando split em sentenças
  let cauda = Promise.resolve();
  let total = 0;         // sentenças enfileiradas (pra observabilidade/teste)

  const enfileirar = (texto) => {
    total++;
    const gerar = narrar(texto, voz); // dispara fora da cauda; cauda só ordena emissão
    cauda = cauda.then(async () => {
      try {
        const r = await gerar;
        if (r) sala.transmitir(campanhaId, { tipo: "audio", url: r.url });
      } catch {
        // áudio é best-effort: nunca derruba o turno
      }
    });
  };

  const consumirChar = (ch) => {
    if (estado === "prose") {
      if (ch === "[") { estado = "intag"; pendente = "["; }
      else buffer += ch;
    } else {
      pendente += ch;
      if (ch === "\n") { estado = "prose"; pendente = ""; }
      else if (pendente.length >= LIMITE_PENDENTE && !TAGS_VALIDAS.test(pendente)) {
        // não era tag — devolve pra prosa
        estado = "prose";
        buffer += pendente;
        pendente = "";
      }
    }
  };

  return {
    onDelta(delta) {
      for (const ch of delta) consumirChar(ch);
      const { sentencas, resto } = dividirSentencas(buffer);
      buffer = resto;
      for (const s of sentencas) enfileirar(s);
    },
    async fim() {
      // tag parcial sem newline: descarta (LLM provavelmente cortou).
      if (estado === "intag") { estado = "prose"; pendente = ""; }
      // resto sem terminador (sentença incompleta) ainda vai pra leitura.
      const final = buffer.trim();
      buffer = "";
      if (final) enfileirar(final);
      await cauda;
    },
    _total: () => total, // só pra teste
  };
}
