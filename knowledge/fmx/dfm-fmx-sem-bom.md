# `.dfm`/`.fmx` com BOM UTF-8 → `Invalid stream format`

## Sintoma

Ao **abrir um form no designer do IDE** (ou ao instanciar em runtime):

```
Error creating form: Invalid stream format.
```

Acontece "sempre" ao abrir aquele(s) form(s). Comum em **Delphi 10.3.3** (e versões antigas);
o Delphi 12 às vezes tolerava, mascarando o problema até o downgrade.

## Causa

O arquivo `.dfm`/`.fmx` está salvo como **UTF-8 com BOM** (`EF BB BF` nos 3 primeiros bytes,
antes de `object`). O leitor de forms do IDE (`ObjectTextToBinary`) espera o stream começando
em `object`/whitespace (texto) ou na assinatura binária — o BOM no início **não é reconhecido**
e dispara `Invalid stream format`.

Origem típica: um **script de conversão de encoding** que adicionou BOM em todos os fontes,
incluindo os `.fmx`/`.dfm` (correto para `.pas`, errado para forms).

## Diagnóstico

```bash
# lista .fmx/.dfm que comecam com BOM (EF BB BF)
for f in $(find . -iname "*.fmx" -o -iname "*.dfm"); do \
  [ "$(head -c3 "$f" | od -An -tx1 | tr -d ' \n')" = "efbbbf" ] && echo "BOM: $f"; done
```
Forms que abrem normalmente começam direto em `6F 62 6A` (`obj`).

## Correção — remover o BOM (só os 3 bytes iniciais)

```bash
find . -iname "*.fmx" -o -iname "*.dfm" | while IFS= read -r f; do
  if [ "$(head -c3 "$f" | od -An -tx1 | tr -d ' \n')" = "efbbbf" ]; then
    tail -c +4 "$f" > "$f.tmp" && mv "$f.tmp" "$f"   # fazer backup antes
  fi
done
```

O conteúdo após o BOM continua válido (UTF-8 sem BOM, ou ASCII com escapes `#NNN` que o
designer FMX usa para acentos). **Fazer backup antes.**

## Regra

- **`.pas`/`.dpr`/`.dpk`** → UTF-8 **com** BOM (Delphi precisa do BOM para tratar como Unicode).
- **`.dfm`/`.fmx`** → UTF-8 **sem** BOM. Nunca aplicar o script de "UTF-8 com BOM" sobre forms.

## ⚠️ Exceção: BOM *load-bearing* quando há identificador não-ASCII no form

Antes de remover o BOM, **procurar caractere não-ASCII em nome de objeto**. Se o `.dfm`/`.fmx`
contém uma linha como

```
object mnItOpções: TMenuItem      { ç literal DENTRO do identificador }
```

remover o BOM **quebra o build** com:

```
error E2161: Error: RLINK32: Error opening file "...\unPrincipal.dfm"
```

em **qualquer** versão do Delphi (reproduzido em 10.3 Rio / CV 33 e 12 Athens / CV 36).

**Por que:** sem BOM o compilador de recursos lê o arquivo como ANSI; o `ç` gravado em UTF-8
(`C3 A7`) vira dois caracteres lixo e o identificador do objeto deixa de casar com o field do
`.pas`. Com BOM o arquivo era decodificado como UTF-8 e casava — ou seja, **o BOM estava
mascarando um identificador inválido**. A mensagem "Error opening file" é enganosa: o arquivo
abre, o que falha é o parse.

**Correção certa: renomear o identificador para ASCII** (`mnItOpções` → `mnItOpcoes`), no `.dfm`
e no `.pas`, e manter o form sem BOM. Recolocar o BOM só devolve o problema do leitor de forms.

> **Escape `#NNN` não resolve aqui.** `#231` funciona para **valor de string**
> (`Caption = 'Servi'#231'o'`) — é assim que o designer grava acento, e por isso a maioria dos
> `.dfm` é ASCII puro. Mas **identificador não aceita escape**: `object mnItOp#231oes` é inválido.
> Renomear é a única saída.

### Diagnóstico antes de mexer no BOM

```bash
# identificador de objeto com byte nao-ASCII (rodar ANTES de remover BOM)
python -c "
import os,re
for n in os.listdir('.'):
    if os.path.splitext(n)[1].lower() not in ('.dfm','.fmx'): continue
    raw=open(n,'rb').read()
    t=(raw[3:] if raw[:3]==b'\xef\xbb\xbf' else raw).decode('utf-8',errors='replace')
    for i,l in enumerate(t.splitlines(),1):
        if re.search(r'object\s+\w*[^\x00-\x7F]\w*\s*:', l):
            print('%s:%d %r' % (n,i,l.strip()))
"
```

Se o comando não retorna nada, remover o BOM é seguro.

## Relacionado
- [encoding-utf8-bom.md](encoding-utf8-bom.md) — convenção de BOM em `.pas`.
- [fmx-stylebook-resourcesbin-versao.md](fmx-stylebook-resourcesbin-versao.md), [string-literal-255-limite.md](string-literal-255-limite.md) — outros erros de downgrade de versão.
