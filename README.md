# Mestre de Mesa

Um Mestre de RPG de mesa (estilo D&D, tom narrativo-leve) que roda no terminal e
no navegador. A narração vem de uma LLM trocável (mock, Ollama local ou Claude
via API); os dados você rola na mesa de verdade e digita o resultado — o sistema
aplica o modificador do personagem e compara com a dificuldade (CD).

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
npm run server
```

Ao subir, o servidor mostra o endereço local e o da rede (`http://SEU_IP:3000`).
Cada jogador abre o link no celular, escolhe seu personagem e joga na sua vez.
Uma tela compartilhada (TV/monitor) pode entrar como "só assistir".

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
npm test
```

## Estrutura

```
cli.js              # jogo no terminal
server.js           # servidor web (Express) + rotas
public/             # HTMX vendorizado
src/
  jogo.js           # motor de turno (compartilhado por CLI e web)
  mestre.js         # monta o prompt, interpreta tags [TESTE]/[ESTADO]
  dados.js          # persistência de campanhas e personagens
  modificadores.js  # regra de modificador do d20
  estado.js         # leitura do prompt base
  prompt-mestre.md  # personalidade e regras do mestre (edite à vontade)
  llm/              # providers de LLM (mock, ollama, claude)
  web/render.js     # renderização HTML/HTMX
test/               # testes (node:test)
data/               # campanhas salvas (não versionado)
```
