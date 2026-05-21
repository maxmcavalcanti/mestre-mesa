import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

export function lerPromptBase() {
  return readFile(join(raiz, "src", "prompt-mestre.md"), "utf8");
}
