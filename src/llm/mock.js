// Provider sem LLM: roda offline pra testar o loop (narração + teste + estado).
// `onDelta` (opcional) recebe a resposta em pedaços, pra simular streaming na web;
// sem ele, devolve o texto completo de uma vez (CLI e testes).
export async function mock(system, mensagens, onDelta) {
  const ultima = (mensagens.at(-1)?.texto || "").toLowerCase();

  let texto;
  if (ultima.startsWith("resultado do teste")) {
    const sucesso = ultima.includes("sucesso");
    texto = sucesso
      ? "Com um empurrão firme, a passagem cede e se abre à sua frente. O ar lá dentro é frio e antigo.\n[ESTADO] local=Corredor úmido sob a cripta"
      : "Você força, mas algo cede com um estalo perigoso — uma lasca de pedra raspa seu braço.\n[ESTADO] hp-=2";
  } else if (/atac|combat|luto|enfrent|saco a (espada|adaga|arma)|empunh/.test(ultima)) {
    texto = "Lâminas reluzem na escuridão — a criatura range os dentes e avança. Preparem-se!\n[MODO] combate";
  } else if (/fujo|recuo|encerr|fim do combate|paz|guardo a (espada|arma)/.test(ultima)) {
    texto = "O último inimigo tomba com um baque surdo. O silêncio volta à cripta.\n[MODO] exploracao";
  } else if (/porta|trava|empurr|for[çc]a|abrir|levant/.test(ultima)) {
    texto = "A porta de carvalho está emperrada pela umidade dos séculos. Vai precisar de força bruta.\n[TESTE] atributo=forca cd=12";
  } else if (/olh|examin|inspecion|procur|investig/.test(ultima)) {
    texto = "Você varre o ambiente com o olhar. Símbolos rasos cobrem as paredes, e há marcas de garras no chão de pedra. Algo passou por aqui — recentemente.";
  } else {
    texto = "A escuridão da cripta responde apenas com o eco dos seus passos. O que você faz?";
  }

  if (onDelta) {
    // Emite palavra a palavra com um respiro curto, pra dar a sensação de fluxo.
    for (const pedaco of texto.match(/\S+\s*/g) || [texto]) {
      onDelta(pedaco);
      await new Promise((r) => setTimeout(r, 18));
    }
  }
  return texto;
}
