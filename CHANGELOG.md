# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o projeto adota [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Adicionado

- **Multiplayer em tempo real (WebSocket):** o servidor empurra o estado para
  todos os aparelhos sem recarregar; barra de presença (quem está conectado) e
  aviso de "fulano está digitando".
- **Streaming da narração:** a resposta do mestre aparece palavra a palavra
  conforme é gerada. As tags `[TESTE]`/`[ESTADO]` continuam sendo interpretadas
  só no texto completo.
- **Tom de narração por campanha:** equilibrado, sombrio, heroico, cômico ou
  misterioso, escolhido na criação. Entra no prefixo cacheável do prompt.
- **Retratos por classe:** emoji por classe nos cards da party e na tela de
  entrada (parte híbrida; o retrato por IA fica para depois).
- **Desfazer o último turno:** restaura o estado anterior à jogada (um nível).
- **Feedback de erro no turno:** banner transitório quando o mestre falha, sem
  derrubar a sessão.
- **Log de uso/custo de tokens** no provider Claude (separa cache de entrada).
- **Testes:** cobertura do motor de turno e dos módulos de domínio
  (`npm test`) e um teste e2e do WebSocket (`npm run smoke`).

### Alterado

- **`server.js` modularizado:** identidade/sessão em `src/web/sessao.js`, rotas
  em `src/web/rotas.js`, registro de conexões em `src/web/sala.js` e broadcast em
  `src/web/difusao.js`. O `server.js` virou só composição.
- **Escrita de dados serializada por campanha** (`comCampanha`) e **atômica**
  (arquivo temporário + rename), evitando _lost update_ e JSON corrompido.
- **Sincronização passou de polling (3s) para WebSocket.** Não há mais fallback
  sem JavaScript no navegador.

### Notas

- O **desfazer não reverte o índice RAG** (memória de longo prazo); é
  best-effort e não afeta o estado determinístico.
- Pendências e próximas fases (TTS, retrato por IA): ver `docs/PENDENTE.md`
  (não versionado).
