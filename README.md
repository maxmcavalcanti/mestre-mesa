# Mestre de Mesa

Um Mestre de RPG de mesa (estilo D&D, tom narrativo-leve) que roda no terminal e
no navegador. A narração vem de uma LLM trocável (mock, Ollama local ou Claude
via API); os dados você rola na mesa de verdade e digita o resultado — o sistema
aplica o modificador do personagem e compara com a dificuldade (CD).

## Recursos

- **Multiplayer em tempo real** no navegador (WebSocket): narração em streaming,
  estado sincronizado em todos os aparelhos, presença e aviso de "digitando".
- **Tom de narração por campanha** (equilibrado, sombrio, heroico, cômico,
  misterioso) — entra no prefixo cacheável do prompt.
- **Retratos por classe** (emoji) nos cards e na tela de entrada.
- **Desfazer o último turno** (restaura o estado anterior à jogada).
- **LLM trocável** (mock / Ollama / Claude) e **memória de longo prazo (RAG)**.

## Requisitos

- Node.js >= 20
- Opcional: [Ollama](https://ollama.com) para rodar uma LLM local de graça
- Opcional: chave da API da Anthropic para usar o Claude

## Instalação

```bash
npm install
```

## Como jogar

### No navegador (recomendado, joga com amigos)

```bash
node server.js
```

Rode o `node` direto (e não `npm run server`): assim o processo fica anexado ao
terminal, `Ctrl+C` encerra na hora e fechar o terminal fecha o servidor. Via npm,
o Windows interpõe um `cmd` que pode deixar o node pendurado no Ctrl+C.

Ao subir, o servidor mostra o endereço local e o da rede (`http://SEU_IP:3000`).
Cada jogador abre o link no celular, escolhe seu personagem e joga na sua vez.
Uma tela compartilhada (TV/monitor) pode entrar como "só assistir".

A sincronização é em **tempo real** (WebSocket): a narração aparece em
streaming, o estado se atualiza em todos os aparelhos sem recarregar, e a barra
mostra quem está conectado e quem está digitando.

### No terminal

```bash
npm start
```

## Escolhendo a LLM

Defina a variável `MESTRE_LLM`:

| Valor    | O que faz                                   | Requer                          |
| -------- | ------------------------------------------- | ------------------------------- |
| `mock`   | Respostas fixas, sem LLM (padrão; p/ testes) | nada                            |
| `ollama` | LLM local                                   | Ollama rodando + modelo baixado |
| `claude` | API da Anthropic                            | `ANTHROPIC_API_KEY` + SDK       |

```bash
# exemplo (PowerShell)
$env:MESTRE_LLM = 'ollama'; npm run server
```

Outras variáveis: `OLLAMA_MODEL` (padrão `llama3.1`), `ANTHROPIC_MODEL`
(padrão `claude-sonnet-4-6`), `PORTA` (padrão `3000`).

## Material da aventura

Ao criar uma campanha, você preenche a sinopse e as notas do mestre (locais,
NPCs, segredos, ganchos), que são injetadas no contexto da LLM a cada turno.

## Memória de longo prazo (RAG)

Como só as últimas mensagens vão no contexto, o mestre poderia "esquecer" cenas
antigas numa campanha longa. Para evitar isso, cada turno é indexado num índice
vetorial por campanha (`data/campanhas/<id>/indice.json`) e, antes de cada
resposta, as cenas passadas mais relevantes são recuperadas por busca semântica
e injetadas no prompt. É best-effort: se o embedding falhar, o jogo segue normal.

Requer um modelo de embedding no Ollama (multilíngue, bom em pt-BR):

```bash
ollama pull bge-m3
```

Modelo via env `EMBED_MODEL` (padrão `bge-m3`). Os scripts em `estudos/` mostram
embeddings e busca semântica passo a passo, para fins de estudo.

## Testes

```bash
npm test          # testes unitários (node:test)
npm run smoke     # teste e2e do WebSocket (sobe o servidor e se autoencerra)
```

## Estrutura

```
cli.js                 # jogo no terminal
server.js              # servidor web (Express) + WebSocket + composição
public/                # HTMX vendorizado
src/
  jogo.js              # motor de turno (compartilhado por CLI e web)
  bootstrap.js         # inicialização comum (provider + prompt base)
  dados.js             # persistência atômica + serialização por campanha
  estado.js            # leitura do prompt base
  memoria.js           # memória de longo prazo (RAG): indexar/buscar
  prompt-mestre.md     # personalidade e regras do mestre (edite à vontade)
  dominio/             # regras puras (sem I/O)
    prompt.js          #   monta o system prompt + catálogo de tons
    protocolo.js       #   interpreta as tags [TESTE]/[ESTADO]
    regras.js          #   resolução de testes (d20 + modificador vs CD)
    modificadores.js   #   regra de modificador de atributo
    retratos.js        #   emoji por classe
    desfazer.js        #   snapshot/restaurar (desfazer turno)
  llm/                 # providers de LLM (mock, ollama, claude) + embeddings
  web/                 # camada HTTP/HTML/WebSocket
    rotas.js           #   rotas HTTP
    sessao.js          #   identidade do dispositivo + carregar/persistir
    sala.js            #   registro de conexões WebSocket por campanha
    difusao.js         #   broadcast do painel/presença/streaming
    paginas.js         #   páginas completas
    componentes.js     #   o painel de jogo (fragmento sincronizado)
    layout.js          #   HTML base, CSS e o cliente WebSocket
test/                  # testes (node:test)
data/                  # campanhas salvas (não versionado)
```
