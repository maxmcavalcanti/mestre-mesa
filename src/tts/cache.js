// Espelho do cache_key do servidor Python (sha1("{voz}|{texto}")), mais
// utilitários de path. Permite curto-circuitar o spawn quando o áudio já
// existe em disco.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
export const DIR_AUDIO = resolve(REPO, "data", "audio");

export function chave(voz, texto) {
  return createHash("sha1").update(`${voz}|${texto}`, "utf8").digest("hex");
}

export function caminhoArquivo(hash) {
  return resolve(DIR_AUDIO, `${hash}.wav`);
}

export function emCache(hash) {
  return existsSync(caminhoArquivo(hash));
}
