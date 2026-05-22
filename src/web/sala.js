// Registro de conexões WebSocket por campanha (a "sala"). Mantém quem está
// conectado, calcula presença e quem está digitando, e transmite mensagens.
// É uma fábrica (não estado de módulo) pra cada teste ter uma sala limpa.
//
// Uma conexão é { ws, eu, digitando }. `ws` precisa só de .readyState e .send —
// nos testes basta um objeto falso com esses campos.

const OPEN = 1; // WebSocket.OPEN

function enviar(conn, texto) {
  try {
    if (conn.ws.readyState === OPEN) conn.ws.send(texto);
  } catch {
    /* socket morto: o handler de close limpa o registro */
  }
}

export function criarSala() {
  const salas = new Map(); // campanhaId -> Set<conn>

  const conjunto = (id) => {
    let s = salas.get(id);
    if (!s) salas.set(id, (s = new Set()));
    return s;
  };

  return {
    entrar(id, conn) {
      conjunto(id).add(conn);
    },
    sair(id, conn) {
      const s = salas.get(id);
      if (!s) return;
      s.delete(conn);
      if (s.size === 0) salas.delete(id);
    },
    conexoes(id) {
      return [...(salas.get(id) || [])];
    },
    // eu distintos conectados (ignora null = ainda não escolheu personagem).
    presenca(id) {
      return [...new Set(this.conexoes(id).map((c) => c.eu).filter(Boolean))];
    },
    // eu distintos com flag de digitando ligada.
    digitando(id) {
      return [
        ...new Set(
          this.conexoes(id)
            .filter((c) => c.digitando)
            .map((c) => c.eu)
            .filter(Boolean),
        ),
      ];
    },
    enviarPara(conn, obj) {
      enviar(conn, JSON.stringify(obj));
    },
    transmitir(id, obj) {
      const txt = JSON.stringify(obj);
      for (const c of this.conexoes(id)) enviar(c, txt);
    },
  };
}
