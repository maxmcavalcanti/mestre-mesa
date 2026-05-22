// Retratos pré-definidos por classe (emoji). A classe é texto livre, então
// casamos por palavra-chave no nome normalizado (minúsculo, sem acento) — assim
// "Bárbaro", "barbaro" e "Bárbara da Montanha" caem no mesmo retrato. Fallback
// genérico para classes desconhecidas; o retrato por IA opt-in vem depois (Fase 3).
const RETRATOS = [
  [["guerreiro", "lutador", "soldado", "cavaleiro"], "⚔️"],
  [["paladin"], "🛡️"],
  [["barbar"], "🪓"],
  [["mago", "feiticeir", "arcanist", "elementalist"], "🧙"],
  [["bruxo", "ocultis", "necromant"], "🔮"],
  [["cleri", "sacerdot", "padre", "templari"], "✨"],
  [["druid", "xama", "naturalist"], "🌿"],
  [["ladin", "ladr", "picaro", "assassin", "trapace"], "🗡️"],
  [["bardo", "menestrel", "trovador"], "🎵"],
  [["patrulheir", "arqueir", "cacador", "ranger", "batedor"], "🏹"],
  [["monge", "lutadora", "marcial"], "👊"],
  [["andarilh", "aventureir", "viajant", "explorador"], "🧭"],
];

const PADRAO = "🧑"; // classe desconhecida

export function retratoClasse(classe) {
  const n = (classe || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  for (const [chaves, emoji] of RETRATOS) {
    if (chaves.some((k) => n.includes(k))) return emoji;
  }
  return PADRAO;
}
