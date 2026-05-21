// Provider sem LLM: roda offline pra testar o loop (narração + teste + estado).
export async function mock(system, mensagens) {
  const ultima = (mensagens.at(-1)?.texto || "").toLowerCase();

  if (ultima.startsWith("resultado do teste")) {
    const sucesso = ultima.includes("sucesso");
    return sucesso
      ? "Com um empurrão firme, a passagem cede e se abre à sua frente. O ar lá dentro é frio e antigo.\n[ESTADO] local=Corredor úmido sob a cripta"
      : "Você força, mas algo cede com um estalo perigoso — uma lasca de pedra raspa seu braço.\n[ESTADO] hp-=2";
  }

  if (/porta|trava|empurr|for[çc]a|abrir|levant/.test(ultima)) {
    return "A porta de carvalho está emperrada pela umidade dos séculos. Vai precisar de força bruta.\n[TESTE] atributo=forca cd=12";
  }

  if (/olh|examin|inspecion|procur|investig/.test(ultima)) {
    return "Você varre o ambiente com o olhar. Símbolos rasos cobrem as paredes, e há marcas de garras no chão de pedra. Algo passou por aqui — recentemente.";
  }

  return "A escuridão da cripta responde apenas com o eco dos seus passos. O que você faz?";
}
