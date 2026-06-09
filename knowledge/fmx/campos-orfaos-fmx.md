# Campos órfãos entre `.pas` e `.fmx`/`.dfm` (FMX e VCL)

## Os dois cenários

### A) Campo no `.pas` sem componente no `.fmx`

Diálogo do IDE ao abrir o form:

```
Field <Form>.<Nome> does not have a corresponding component.
Remove the declaration?
[Yes] [No] [Cancel] [Help]
```

**Causa:** a classe declarou `X: TLabel` (ou qualquer componente) como field público no `type`, mas não existe `object X: TLabel` correspondente no `.fmx`.

**Quando escolher cada opção:**
- **Yes** — se o campo é sobra de refactor. Remove linha do `.pas`.
- **No** — se você pretende instanciar o componente em **runtime** via código (`X := TLabel.Create(Self)` + `X.Parent := ...`). O IDE aceita manter a declaração.
- **Cancel** — fecha o diálogo sem ação; volta quando abrir o form de novo.

### B) Componente no `.fmx` sem campo no `.pas`

Isso **não** dá o diálogo. O componente é criado normalmente (acessível via `FindComponent('Nome')`), mas não fica disponível por dot-notation (`Self.Nome`). Dá erro de compilação `E2003 Undeclared identifier 'Nome'` se o código tentar referenciar.

**Fix:** adicionar ao `type` o campo com mesmo nome e tipo do `.fmx`.

## Como ocorre o cenário A sem querer

- Refactor: apagou `object LblX` do `.fmx` mas esqueceu de apagar `LblX: TLabel` do `.pas`.
- Geração automática (agent de IA ou template): declarou campos no `.pas` que ainda não existem no `.fmx`.
- Paste errado do Designer.

## Validação estática antes do IDE reclamar

Em projetos grandes, vale um script que compara os `object X:` do `.fmx`/`.dfm` com os campos declarados entre `type` e `private` no `.pas`. Qualquer assimetria aparece antes do próximo Open-Form.

## Sobre `__history/` e `__recovery/`

**Não confiar no conteúdo desses arquivos** — são rascunhos do IDE, podem ter sintaxe quebrada mid-edit. Erros mostrados por ferramentas externas (grep, busca de texto) em `__recovery\*.pas` ou `__history\*.pas.~1~` **não afetam o build** — o compilador só lê os arquivos listados no `.dpr`/`.dproj`.

Regra prática:
1. Sempre incluir `__history/` e `__recovery/` em `.gitignore` e `.claudeignore`.
2. Quando debugar um erro, ignorar hits nessas pastas.
3. Pode deletá-las a qualquer momento — IDE recria conforme edita.
4. Adicionar `find . -type d \( -name "__recovery" -o -name "__history" \) -exec rm -rf {} +` em um hook ou task de limpeza é seguro.
