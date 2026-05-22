// Desfazer o último turno via instantâneo (snapshot). Reverter as mutações de um
// turno a partir do histórico é inviável (estado vem de tags [ESTADO] aplicadas
// incrementalmente, resumo rolante, etc.), então guardamos uma cópia do estado
// ANTES do turno e restauramos por cima.
//
// Um nível só: `instantaneo` descarta o campo `desfazer` ao copiar, então o
// snapshot nunca aninha snapshots — o JSON não cresce sem limite e desfazer volta
// exatamente um beat do mestre (não dá pra desfazer duas vezes seguidas).
//
// Limitação conhecida: o índice de memória de longo prazo (RAG, memoria.js) não é
// revertido. É best-effort e só afeta quais lembranças podem ressurgir; não quebra
// o estado determinístico.

// Cópia profunda do estado pré-turno, sem o `desfazer` anterior.
export function instantaneo(campanha, personagens) {
  const { desfazer, ...semDesfazer } = campanha;
  return structuredClone({ campanha: semDesfazer, personagens });
}

export function podeDesfazer(campanha) {
  return Boolean(campanha?.desfazer);
}

// Devolve { campanha, personagens } prontos pra persistir, ou null se não há o que
// desfazer. O campanha restaurado não tem `desfazer` (foi descartado no
// instantâneo), então `podeDesfazer` volta a ser falso após restaurar.
export function restaurar(campanha) {
  if (!campanha?.desfazer) return null;
  return structuredClone(campanha.desfazer);
}
