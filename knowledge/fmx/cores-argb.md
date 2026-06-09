# FMX — Cores ARGB

No Delphi FireMonkey toda cor é **ARGB** — 4 canais de 2 dígitos hex cada: `AARRGGBB`.
O primeiro par (`AA`) é o **alpha** (opacidade). Para cores totalmente opacas, o alpha é `FF`.

## Regra de notação

| Contexto | Prefixo | Exemplo |
|---|---|---|
| `.fmx` / Object Inspector / propriedades de design | `#` | `#FFF0F2F8` |
| Código Pascal (constantes, atribuições) | `$` | `$FFF0F2F8` |

**Nunca omitir o alpha.** Não usar `#F0F2F8` nem `$F0F2F8` — o FMX exige os 8 dígitos.

## Convertendo de CSS/Figma

CSS usa `#RRGGBB` (6 dígitos, sem alpha). Ao portar para FMX:

```
CSS    → #F0F2F8
.fmx   → #FFF0F2F8
Pascal → $FFF0F2F8
```

## Exemplos

### No `.fmx` (Object Inspector)

```dfm
object recFundo: TRectangle
  Fill.Color = xFFF0F2F8
  Stroke.Color = xFFE5E7EB
  ...
end
```

> Nota: o Delphi grava como `xFFF0F2F8` no arquivo `.fmx`, mas quando você digita no Object Inspector, use `#FFF0F2F8` ou `FFF0F2F8`. O IDE converte.

### Em código Pascal

```pascal
const
  C_COR_PRIMARIA = $FF2E4A9E;   // Azul primário
  C_COR_FUNDO    = $FFF0F2F8;   // Fundo geral
  C_COR_BRANCO   = $FFFFFFFF;

// Uso
Rectangle1.Fill.Color := C_COR_PRIMARIA;
Label1.TextSettings.FontColor := $FF1B2B5E;
```

## Cores com transparência

O alpha pode ser qualquer valor de `00` (totalmente transparente) a `FF` (totalmente opaco).

```pascal
// Sombra 20% de opacidade, preto
$33000000  // 33 = ~20% de 255

// Overlay escuro 50%
$80000000
```

## Anti-padrões a evitar

```pascal
// ❌ ERRADO — sem alpha
Rectangle1.Fill.Color := $F0F2F8;

// ❌ ERRADO — usando # em código
Rectangle1.Fill.Color := #FFF0F2F8;

// ❌ ERRADO — usando TAlphaColorRec quando valor hex direto é mais claro
Rectangle1.Fill.Color := TAlphaColorRec.Navy;  // OK para cores nomeadas, mas não para paleta de marca

// ✅ CERTO
Rectangle1.Fill.Color := $FFF0F2F8;
```

## Constantes úteis do FMX

Embora a convenção do projeto seja usar valores hex literais de marca, o FMX fornece:

- `TAlphaColorRec.White` = `$FFFFFFFF`
- `TAlphaColorRec.Black` = `$FF000000`
- `TAlphaColors.White`, `TAlphaColors.Black`, etc.
- `claWhite`, `claBlack` (compatibilidade VCL, também válidos)

Use as nomeadas apenas para cores neutras sem identidade de marca.
