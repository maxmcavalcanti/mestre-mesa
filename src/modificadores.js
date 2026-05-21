// Modificador padrão de D&D 5e: (atributo - 10) arredondado pra baixo, dividido por 2.
export function modificador(score) {
  return Math.floor((score - 10) / 2);
}

// Formata um modificador com sinal: 2 -> "+2", -1 -> "-1".
export function comSinal(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

const APELIDOS = {
  for: "forca",
  des: "destreza",
  con: "constituicao",
  int: "inteligencia",
  sab: "sabedoria",
  car: "carisma",
};

// Normaliza o nome do atributo: remove acentos, minúsculas, expande apelidos.
export function normalizaAtributo(nome) {
  const n = (nome || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  return APELIDOS[n] || n;
}
