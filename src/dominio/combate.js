import { modificador, comSinal } from "./modificadores.js";

const d20 = () => 1 + Math.floor(Math.random() * 20);

// Rola iniciativa (d20 + mod de destreza) para cada personagem com id (exclui a
// 'tela'). `rolar` é injetável para testes determinísticos. Devolve a ordem (ids,
// do maior total ao menor) e os detalhes de cada rolagem (para exibir no log).
export function rolarIniciativa(party, rolar = d20) {
  const rolagens = party
    .filter((p) => p.id)
    .map((p) => {
      const mod = modificador(p.atributos?.destreza ?? 10);
      const dado = rolar();
      return { id: p.id, nome: p.nome, dado, mod, total: dado + mod };
    });
  // desc por total; empate -> maior mod; persiste a ordem de entrada nos demais.
  rolagens.sort((a, b) => b.total - a.total || b.mod - a.mod);
  return { ordem: rolagens.map((r) => r.id), rolagens };
}

// Mensagem de sistema com a tabela de iniciativa.
export function textoIniciativa(rolagens) {
  const det = rolagens
    .map((r) => `${r.nome} d20${comSinal(r.mod)}=${r.total}`)
    .join(", ");
  const ordem = rolagens.map((r) => r.nome).join(" → ");
  return `⚔️ Combate! Iniciativa: ${det}. Ordem: ${ordem}.`;
}

// Inicia o combate na campanha: rola iniciativa, monta a ordem e põe a vez no
// primeiro. Muta a campanha; devolve a mensagem de sistema para o histórico.
export function iniciarCombate(campanha, party, rolar = d20) {
  const { ordem, rolagens } = rolarIniciativa(party, rolar);
  campanha.modo = "combate";
  campanha.combate = { ordem, indice: 0, rodada: 1 };
  if (ordem.length) campanha.turno_de = ordem[0];
  return textoIniciativa(rolagens);
}

// Avança a vez no combate, pulando caídos (hp <= 0). Vira a rodada ao dar a
// volta. Muta campanha.combate e campanha.turno_de. Devolve true se virou a rodada.
export function avancarVez(campanha, party) {
  const c = campanha.combate;
  if (!c || !c.ordem.length) return false;
  const vivo = (id) => {
    const p = party.find((x) => x.id === id);
    return p && p.hp > 0;
  };
  let virou = false;
  for (let passo = 0; passo < c.ordem.length; passo++) {
    c.indice++;
    if (c.indice >= c.ordem.length) {
      c.indice = 0;
      c.rodada++;
      virou = true;
    }
    if (vivo(c.ordem[c.indice])) break; // achou o próximo de pé
  }
  campanha.turno_de = c.ordem[c.indice];
  return virou;
}

// Encerra o combate: volta para exploração e devolve a vez ao líder (ou ao
// primeiro personagem). Muta a campanha; devolve a mensagem de sistema.
export function encerrarCombate(campanha, party) {
  campanha.modo = "exploracao";
  campanha.combate = null;
  const lider = campanha.lider && party.find((p) => p.id === campanha.lider);
  campanha.turno_de = lider?.id || party[0]?.id || campanha.turno_de;
  return "🗺️ O combate termina. Vocês retomam o fôlego.";
}
