# [FMX] Fonte de largura fixa no Android (Skia) — e por que os valores "somem"

## Sintoma

Texto de colunas fixas (cupom de 48 colunas, relatório em texto) sai **torto** no Android
com `Font.Family = 'Consolas'`: a fonte não existe no Android e o Skia cai numa fonte
**proporcional**. Ao trocar por uma mono com tamanho fixo (`'monospace'`, 12 pt), a coluna
da direita (os valores) **some** — a linha ficou mais larga que o `TLabel` e é cortada.

## Causa

- `Consolas`/`Courier New` são fontes do Windows. No Android o Skia procura a família no
  `/system/etc/fonts.xml`; se não acha, usa a padrão (Roboto, proporcional).
- Fonte mono avança **0,6 em por caractere**. 48 colunas a 12 pt = 345 px lógicos; a
  largura útil do label no celular costuma ser menor que isso — o texto não quebra
  (`WordWrap = False`) e é cortado à direita.

## Correção

1. Família por plataforma (nomes do `fonts.xml`):
   ```pascal
   FontePapel = {$IFDEF ANDROID}'serif-monospace'{$ELSE}'Courier New'{$ENDIF};
   // 'serif-monospace' = Cutive Mono (estilo Courier); 'monospace' = Droid Sans Mono
   ```
2. **Tamanho calculado pela largura**, não fixo, e recalculado no `OnResize` do container
   (a largura final só existe depois do layout, e muda ao girar):
   ```pascal
   ALabel.TextSettings.Font.Family := FontePapel;
   ALabel.TextSettings.Font.Size   :=
     Min(14, Floor((ALabel.Width - 2) / (AColunas * 0.6)));
   ```
   O teto evita letra gigante em tablet.

## Como conferir

Print no emulador: as colunas de valor alinhadas à direita e a última coluna visível
inteira. Testado com `GlobalUseSkia := True`, Delphi 13, Android 16 (API 36).
