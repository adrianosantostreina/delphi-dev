# E2001 `Ordinal type required` em `for X in [a, b, c]` de objetos (downgrade)

## Sintoma

```pascal
for LBotao in [BtnHome, BtnConfig, BtnAutorizacao] do  // TButton
  ...
```
```
[dcc32 Error] Unidade.pas(NN): E2001 Ordinal type required
```
Compilava no **Delphi 12**, falha no **10.3.3** (e versões antigas).

## Causa

Num `for-in`, o construtor inline `[...]` com elementos **não-ordinais** (objetos, strings,
registros) é interpretado pelo compilador antigo como **construtor de conjunto (set)** — e set
exige tipo **ordinal**. Daí `E2001`. O Delphi 12 passou a aceitar `for-in` sobre **construtor
de array** de qualquer tipo; o 10.3.3 não.

## Correção — usar array explícito

Forma mínima e portável (sem var extra, sem uses extra — `TArray<T>` é do System):
```pascal
for LBotao in TArray<TButton>.Create(BtnHome, BtnConfig, BtnAutorizacao) do
  ...
```

Alternativa 100% conservadora (array fixo local):
```pascal
var LBotoes: array[0..2] of TButton;
...
LBotoes[0] := BtnHome; LBotoes[1] := BtnConfig; LBotoes[2] := BtnAutorizacao;
for LBotao in LBotoes do ...
```

## Relacionado
Outros erros de downgrade de versão: [string-literal-255-limite.md](string-literal-255-limite.md),
[dfm-fmx-sem-bom.md](dfm-fmx-sem-bom.md), [fmx-stylebook-resourcesbin-versao.md](fmx-stylebook-resourcesbin-versao.md).
