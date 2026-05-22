import { modificador } from "./modificadores.js";

// Resolve um teste: dado cru + modificador do atributo vs CD.
export function resolverTeste(p, atributo, dado, cd) {
  const score = p.atributos[atributo];
  const mod = score === undefined ? 0 : modificador(score);
  const total = dado + mod;
  return { mod, total, sucesso: total >= cd };
}
