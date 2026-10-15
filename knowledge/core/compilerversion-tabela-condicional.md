# Tabela CompilerVersion ↔ Delphi + compilação condicional por versão

Use **`CompilerVersion`** (não `RTLVersion`) para guardar código por versão do compilador.

## Tabela CompilerVersion → Delphi

| Delphi | CompilerVersion | Delphi | CompilerVersion |
|---|---|---|---|
| XE   | 22.0 | 10.0 Seattle  | 30.0 |
| XE2  | 23.0 | 10.1 Berlin   | 31.0 |
| XE3  | 24.0 | 10.2 Tokyo    | 32.0 |
| XE4  | 25.0 | 10.3 Rio      | 33.0 |
| XE5  | 26.0 | 10.4 Sydney   | 34.0 |
| XE6  | 27.0 | 11 Alexandria | 35.0 |
| XE7  | 28.0 | 12 Athens     | 36.0 |
| XE8  | 29.0 | 13            | 37.0 |

## Padrão de guarda

```pascal
{$IF CompilerVersion >= 35.0} // Delphi 11+ : API nova
  // caminho moderno
{$ELSE}
  // fallback para versoes antigas
{$IFEND}
```
`{$IF}` fecha com `{$IFEND}` ou `{$ENDIF}` (ambos aceitos nas versões atuais). Se o `var`
de uma rotina só existe num ramo, envolver o bloco `var` inteiro na mesma guarda.

## Recurso × versão mínima (causas comuns de quebra em downgrade)

| Recurso | Versão mínima (CV) | Sintoma se faltar |
|---|---|---|
| Literal de string > 255 chars sem `+` | 12 / 36.0 | `E2056 String literals may have at most 255 elements` |
| `IFMXSystemAppearanceService`/`TSystemThemeKind` (tema do SO) | 11 / 35.0 | `E2003 Undeclared identifier` |
| `for X in [a,b,c]` de objetos/strings (construtor de array) | 12 / 36.0 | `E2001 Ordinal type required` (vira *set*) |
| Variáveis inline (`var x := ...`, `for var i`) | 10.3 / 33.0 | `E2029`/erro de sintaxe |
| `TArray<T>.Create(...)` (construtor de array dinâmico) | XE7 / 28.0 | erro de sintaxe |
| String helpers (`.ToUpper`, `.Trim`, `.Equals`, `.Replace`…) | XE3 / 24.0 | `E2003`/método inexistente |

Correções detalhadas: [string-literal-255-limite.md](string-literal-255-limite.md),
[for-in-array-constructor-e2001.md](for-in-array-constructor-e2001.md).
Cada uma das correções acima é **retrocompatível** quando feita com guarda — o código
continua compilando nas versões novas.
