import {
  carregarCampanha,
  listarPersonagens,
  salvarCampanha,
  salvarPersonagem,
} from "../dados.js";

// Identidade do dispositivo: qual personagem ele controla, num cookie eu_<id>.
// 'tela' = só assistindo; null = ainda não entrou.
export function getEu(req, id) {
  const cabecalho = req.headers.cookie || "";
  for (const par of cabecalho.split(";")) {
    const i = par.indexOf("=");
    if (i < 0) continue;
    if (par.slice(0, i).trim() === `eu_${id}`)
      return decodeURIComponent(par.slice(i + 1).trim());
  }
  return null;
}

export function definirEu(res, id, eu) {
  res.cookie(`eu_${id}`, eu, { maxAge: 30 * 864e5, path: "/" });
}

// Carrega campanha + party e identifica o personagem da vez.
export async function carregarSessao(id) {
  const campanha = await carregarCampanha(id);
  const personagens = await listarPersonagens(id);
  const ativo =
    personagens.find((p) => p.id === campanha.turno_de) || personagens[0] || null;
  return { campanha, personagens, ativo };
}

export async function persistir(campanha, personagens, modificados) {
  await salvarCampanha(campanha);
  const ids = new Set(modificados);
  for (const p of personagens) {
    if (ids.has(p.id)) await salvarPersonagem(campanha.id, p);
  }
}
