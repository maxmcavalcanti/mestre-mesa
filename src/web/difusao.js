import { painelJogo } from "./componentes.js";

// Empurra o painel pra todos os conectados na campanha. O painel é renderizado
// POR conexão, porque o HTML depende do `eu` de cada uma (de quem é a vez, botão
// de desfazer, área de ação). É só montagem de string + send, sem I/O.
export function difundirPainel(sala, campanha, personagens) {
  for (const conn of sala.conexoes(campanha.id)) {
    sala.enviarPara(conn, {
      tipo: "painel",
      html: painelJogo(campanha, personagens, conn.eu),
    });
  }
}

// Mapeia um `eu` (id de personagem ou 'tela') pra um nome exibível.
function nomeDe(eu, personagens) {
  if (eu === "tela") return "tela";
  return personagens.find((p) => p.id === eu)?.nome || eu;
}

export function difundirPresenca(sala, id, personagens) {
  sala.transmitir(id, {
    tipo: "presenca",
    quem: sala.presenca(id).map((eu) => nomeDe(eu, personagens)),
  });
}

export function difundirDigitando(sala, id, personagens) {
  // 'tela' não age, então não entra no aviso de "digitando".
  const quem = sala
    .digitando(id)
    .filter((eu) => eu !== "tela")
    .map((eu) => nomeDe(eu, personagens));
  sala.transmitir(id, { tipo: "digitando", quem });
}
