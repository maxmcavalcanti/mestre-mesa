// Fachada do TTS para o resto da aplicação. Outras camadas só importam daqui.
import { garantir } from "./processo.js";
import { gerarAudio } from "./cliente.js";
import { chave, emCache } from "./cache.js";

// Gera/recupera o audio de um trecho. Retorna { hash, url, cached } ou null
// se TTS está desabilitado (voz nula) ou indisponível.
// `voz` ∈ { null, 'masc', 'fem' }.
export async function narrar(texto, voz) {
  if (!voz || !texto?.trim()) return null;
  const hash = chave(voz, texto);
  if (emCache(hash)) {
    return { hash, url: `/audio/${hash}.wav`, cached: true };
  }
  const base = await garantir();
  if (!base) return null;
  try {
    const r = await gerarAudio(base, voz, texto);
    return { hash: r.hash, url: `/audio/${r.filename}`, cached: r.cached };
  } catch {
    return null;
  }
}
