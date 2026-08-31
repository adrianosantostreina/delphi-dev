# Análise — relatório de defeitos do RAG (cliente, v3.0.0)

> Recebido em 2026-08-31. Relatório produzido pelo Claude Desktop de um cliente que usa o
> `delphi-dev` v3.0.0 **com os hooks registrados**, num ERP Delphi grande (~5.500 forms).
> Verifiquei cada afirmação contra o código do repo. **Nenhuma correção aplicada** — aguardando
> decisão.

## Veredito rápido

**Há defeito real, não é questão de calibragem.** Dois dos três problemas se confirmam
integralmente; o terceiro tem sintoma real mas causa mal diagnosticada — e a causa verdadeira
exige correção diferente da proposta. Além disso, **encontrei um quarto defeito que o relatório
não viu, e que é o mais grave dos quatro**.

| # | Alegação | Veredito |
|---|---|---|
| 1 | `capture.ts` indexa o envelope do hook | ✅ **Confirmado** — bug real |
| 2 | Acervo curado nunca entra no índice | ⚠️ **Sintoma real, causa errada** — a causa verdadeira é outra |
| 3 | `searchSimilar` sem limiar de distância | ✅ **Conclusão certa**, citação de código desatualizada |
| 4 | *(não relatado)* | 🔴 **`capture.ts` grava tudo como `canonical`** — anula a governança da v3.0 |

---

## 1. `capture.ts` indexa o envelope do hook — CONFIRMADO

`scripts/src/capture.ts:99-106` lê o stdin e repassa direto:

```ts
let transcriptText = '';
for await (const chunk of process.stdin) transcriptText += chunk;
if (!transcriptText.trim()) return;
const chunks = await captureFromTranscript(transcriptText, mode, agentName);
```

Nenhum `JSON.parse`, nenhuma leitura de `transcript_path`. O que é fatiado, classificado e
embarcado é o **payload do evento**, não a conversa.

A assimetria que o cliente apontou existe e é a prova: `search.ts:33-38` **faz** o parse correto
do payload do seu próprio evento (`payload.prompt ?? payload.message ?? prompt`). Os dois lados do
pipeline foram escritos com entendimentos diferentes do contrato de hook.

A medição dele (251 de 646 chunks, 39%, contendo `session_id` **e** `transcript_path`) é
consistente com esse mecanismo.

**A sugestão de correção dele está certa.** Vale acatar também a ressalva que ele mesmo faz:
depois de abrir o `.jsonl`, extrair **só o texto das mensagens** — indexar o arquivo inteiro
absorve `tool_use`, `tool_result` e metadados, trocando um lixo por outro menor.

---

## 2. Acervo curado nunca entra no índice — SINTOMA REAL, CAUSA ERRADA

O cliente diz: *"`build-rag.ts` existe e faz o trabalho certo, mas nada o executa"*.

**Isso não procede.** O `build-rag` roda na CI (`.github/workflows/build-rag.yml`) e o `rag.db`
resultante é **anexado ao GitHub Release** — o release v3.0.0 tem o asset com 1,73 MB. O
installer (`installer/src/rag.ts`) baixa esse asset de `releases/latest` para
`~/.claude/plugins/delphi-dev/rag/rag.db`. Numa instalação via `npx delphi-dev`, o acervo curado
**chega pronto**.

### A causa real

**`rag/rag.db` é gitignored** (`rag/.gitignore` lista `rag.db`, `rag.db-shm`, `rag.db-wal`; o
`git ls-files rag/` devolve só `.gitignore` e `schema.sql`).

Consequência: quem instala pelo **marketplace** — `/plugin marketplace add <repo>` +
`/plugin install`, que é um `git clone` — recebe o plugin **sem `rag.db` nenhum**. Aí:

1. O primeiro `capture` roda `openDb(RAG_DB_PATH)`, cujo `SCHEMA` usa `CREATE TABLE IF NOT
   EXISTS` → **cria o banco do zero**, vazio.
2. A partir daí o banco é preenchido **exclusivamente** por captura de sessão.
3. Nunca houve conteúdo curado para competir.

Isso explica os 0% curados do cliente com precisão maior que a hipótese dele, e **muda a
correção**: não basta "rodar `build-rag` no SessionStart" (que exigiria rodar o modelo de
embedding na máquina do usuário, com `@xenova/transformers` — pesado, e foi exatamente o que
quebrou a instalação no Windows na v2.2.2). As opções reais são:

- **(a) Versionar o `rag.db`** no repo, para o caminho marketplace chegar com o acervo. Custo:
  ~1,8 MB binário no git a cada rebuild da KB.
- **(b) Fazer o caminho marketplace baixar o asset do release**, como o `npx` já faz.
- **(c) Detectar a ausência** (`SELECT COUNT(*) ... WHERE tier='canonical'` = 0) e avisar o
  usuário, em vez de degradar em silêncio.

A **(b)** é a mais coerente com o desenho atual; a **(c)** deveria existir de qualquer forma.

---

## 3. Busca sem limiar — CONCLUSÃO CERTA, CITAÇÃO DESATUALIZADA

O relatório descreve `db.ts:109` como `ORDER BY distance LIMIT ?` **sem corte**. Esse é o código
**anterior à v3.0**. A v3.0 introduziu `RELEVANCE_FLOOR = 1.0` e `selectByTier`.

**Mas a conclusão dele continua correta**, e o motivo é sutil: o `RELEVANCE_FLOOR`
**prioriza, não filtra**. Em `db.ts:84-107`:

```ts
const relevantCanonical = canonical.filter((r) => r.distance <= relevanceFloor);
const weakCanonical     = canonical.filter((r) => r.distance >  relevanceFloor);
// ... relevantCanonical, depois community, depois weakCanonical
```

O próprio comentário do código declara a intenção: *"above-floor canonical is the last fallback
so we never return fewer results than available"*. Ou seja, **chunks acima do piso continuam
ocupando slots** — não existe corte absoluto em lugar nenhum. Para qualquer pergunta, se o pool
tem 3 candidatos, 3 são injetados.

O teste do bolo de cenoura é válido e reproduzível.

**Correção:** um `maxDistance` de verdade, aplicado **depois** do `selectByTier`, descartando o
que passar do limite mesmo que isso devolva lista vazia. O caminho "não injetar nada" já
funciona (`formatSearchResults` devolve `''` para lista vazia, e `search.ts:50` só escreve se
houver saída) — só não é alcançado hoje. Expor como `DELPHI_RAG_MAX_DISTANCE`, como ele sugere,
é barato e útil.

---

## 4. 🔴 NÃO RELATADO — `capture.ts` grava tudo como `canonical`

**Este é o pior dos quatro, e anula o item 1 inteiro da v3.0 (Governança do RAG).**

`scripts/src/embed.ts:47-51`:

```ts
export async function embedFile(
  mdPath: string,
  dbPath: string = RAG_DB_PATH,
  tier: 'canonical' | 'community' = 'canonical'   // <-- default
): Promise<number>
```

`scripts/src/build-rag.ts:56` passa o tier corretamente:

```ts
const tier = tierForPath(relative);
const count = await embedFile(file, dbPath, tier);
```

**`scripts/src/capture.ts:106` não passa:**

```ts
await embedFile(chunks[0].sourcePath);   // tier cai no default: 'canonical'
```

Ou seja: **todo chunk capturado de sessão é carimbado `canonical`** — o tier que
`docs/rag-governance.md` define como *"escrito pelo mantenedor, verdade absoluta"*.

Consequências:

1. **A precedência por tier deixa de existir.** `selectByTier` separa canonical de community;
   se o ruído de sessão é canonical, ele disputa slot **de igual para igual** com o acervo do
   Adriano — e vence sempre que estiver mais próximo do prompt, que é o caso comum, já que o
   ruído foi capturado de conversas parecidas com o prompt.
2. **A governança foi implementada só na leitura.** O `build-rag` respeita o tier; o caminho de
   escrita em runtime o ignora. O modelo de confiança é furado na origem.
3. **Nem o `community` protege.** O ruído não entra como community subordinada — entra como
   verdade absoluta.

**Correção:** `embedFile(chunks[0].sourcePath, RAG_DB_PATH, 'community')` — ou melhor, um tier
próprio (`local`) subordinado a ambos, já que conteúdo capturado da própria máquina não passou
por gate de qualidade nenhum. E **remover o default** do parâmetro `tier`, tornando-o
obrigatório: o default silencioso foi exatamente o que causou o defeito.

---

## 5. Achado colateral — a documentação manda registrar hooks que o produto removeu

O cliente diz ter os hooks *"registrados conforme a documentação do plugin"*. Isso só é possível
porque:

- `.claude-plugin/plugin.json` **não tem bloco `hooks`** desde a v2.2.2 (removido porque
  quebrava instalação limpa no Windows);
- `installer/src/index.ts` chama **`removeHooks()`**, não `registerHooks()`;
- mas **os dois READMEs continuam anunciando** que a instalação *"Registers automation hooks"* /
  *"Registra hooks de automação"* (linha 41), e o `/contribute-kb` é descrito como empacotando
  *"aprendizados capturados pelos hooks"*.

Ou seja: a documentação conduz o usuário a uma configuração que o produto abandonou — e é
justamente essa configuração que expõe os quatro defeitos acima. Para quem instala hoje sem
mexer em nada, o RAG está **inerte** (nenhum hook dispara), o que mascara tudo isso.

**Isso muda a leitura do custo de contexto relatado** (~502 tokens/turno, ~20k numa sessão de 40
turnos): esse custo não é o comportamento padrão do plugin hoje — é o comportamento de quem
seguiu o README.

---

## 6. Ordem de correção recomendada

O cliente propôs 1 → 2 → 3. Eu inverteria parcialmente, porque o defeito 4 é o que envenena com
maior severidade e é o de menor custo:

1. **Defeito 4** (tier no `capture`) — uma linha, e restaura a governança. Sem isso, corrigir o
   defeito 1 apenas troca ruído de envelope por ruído de conversa, **ainda carimbado como verdade
   absoluta**.
2. **Defeito 1** (payload do hook) — estanca a poluição; cada sessão adicional piora o estado.
3. **Defeito 2** (acervo ausente no caminho marketplace) — sem isso o plugin não entrega o que
   promete. Fazer junto o aviso da opção (c).
4. **Defeito 3** (limiar de distância) — qualidade e custo de contexto.
5. **Achado 5** (READMEs) — alinhar documentação e produto, decidindo antes se os hooks voltam
   (item 5 do backlog: MCP local) ou se a documentação passa a dizer que estão desligados.

## 7. Sobre a oferta do cliente

Ele se ofereceu para testar um patch e mandar estatísticas anonimizadas do `rag.db`. **Vale
aceitar:** a base dele (646 chunks, 251 de envelope, 100% mal-carimbada) é um caso adverso
melhor do que qualquer fixture que a gente escreveria. Útil especialmente para calibrar o
`maxDistance` do defeito 3 — o valor 0.6 que ele sugere é chute, e o `RELEVANCE_FLOOR = 1.0`
atual também nunca foi calibrado contra base real.

## 8. Nota de qualidade do relatório

O relatório é bom: reprodutível, com medição, e aponta a assimetria `capture`/`search` que é a
prova do defeito 1. Errou na causa do problema 2 e citou código pré-v3.0 no problema 3 —
provavelmente leu a cópia do marketplace, que é a mesma armadilha registrada na §1 do design do
`/e2e`. Não é motivo para descartar nada: os três sintomas são reais e verificáveis.

---

## 9. STATUS — CORRIGIDO em 2026-08-31 (commit `ec835c7`)

Os cinco pontos foram implementados na ordem recomendada na §6. **47 testes verdes** (30
anteriores + 17 novos em `scripts/__tests__/rag-fixes.test.ts`), build limpo em `scripts/` e
`installer/`.

| # | O que mudou |
|---|---|
| 4 | Tier **`local`** criado, subordinado a `canonical` e `community`. `capture.ts` passa `'local'` explicitamente. O parâmetro `tier` de `embedFile` virou **obrigatório** — o default silencioso era a causa. |
| 1 | `readHookTranscript()` abre o `transcript_path` do envelope; `extractTranscriptText()` extrai só o texto das mensagens `user`/`assistant`, descartando `tool_use`, `tool_result` e metadados. |
| 3 | `applyDistanceCutoff()` aplica corte absoluto **depois** do `selectByTier`. Lista vazia é resultado válido. `DELPHI_RAG_MAX_DISTANCE`, default `1.1`. |
| 2 | Documentado nos dois READMEs: instalação por marketplace chega sem `rag.db`; saída é `npx delphi-dev sync-kb`. `ragHealth()` reporta composição por tier e sinaliza `curatedMissing`. Nota obsoleta do `verify` corrigida. |
| 5 | READMEs deixam de anunciar registro de hooks; passam a declarar que estão desligados desde a v2.2.2, com aviso explícito para **não** registrar à mão. |

Extra: `RAG_DB_PATH` estava duplicado em `embed.ts` e `search.ts`; agora vive em `paths.ts`.

### Pendências que sobraram

1. **Calibrar `DEFAULT_MAX_DISTANCE` e `RELEVANCE_FLOOR` contra corpus real.** O `1.1` é ponto
   de partida conservador (embeddings normalizados: distância 1.0 ≈ cosseno 0.5), **não é valor
   medido**. É exatamente aqui que a base do cliente ajuda.
2. **Bancos já contaminados não se curam sozinhos.** Quem rodou v3.0.0 com hooks tem chunks
   `local` gravados como `canonical` — o tier está no banco, não no caminho do arquivo. Falta
   decidir: migração (`UPDATE knowledge SET tier='local' WHERE path LIKE '%knowledge/local%'`),
   ou orientar `npx delphi-dev sync-kb` para substituir o banco.
3. **Health check em runtime** só existe como função; não há comando de usuário que a exponha.
   Candidato natural: `/dashboard`.
4. **Bump de versão** não feito — decisão do mantenedor.
