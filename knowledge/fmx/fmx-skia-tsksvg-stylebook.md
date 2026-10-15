# [FMX] "Class TSkSvg not found" — Skia desabilitado com StyleBook que usa SVG

## Sintoma

Diálogo de runtime **"Class TSkSvg not found."** (compila normal, erro só ao rodar)
ao aplicar um estilo de um `TStyleBook` — tipicamente um StyleBook **importado de
outro projeto** que usa ícones SVG. O `.fmx` do StyleBook contém objetos `TSkSvg`
(componente do Skia) e, se o Skia não está habilitado, a classe não está
registrada para streaming → erro ao instanciar o estilo.

Confirmar que o StyleBook tem TSkSvg (o `.fmx` é binário/hex):
`grep` pelo hex de "SkSvg" = `536B537667` no `.fmx` do StyleBook.

O erro aparece **no momento em que um controle aplica o estilo com o ícone**
(lazy), não ao carregar o StyleBook. Por isso pode surgir só quando você troca o
`StyleLookup` de um botão para um estilo que tem ícone SVG.

## Variante em BUILD: `E2161 RLINK32: Error opening file <StyleBook>.fmx`

Se o Skia está **quebrado/mal instalado** (ou o pacote design-time do Skia não
carregou no IDE), o mesmo StyleBook com `TSkSvg` pode falhar já no **link**, não em
runtime:

```
[dcc32 Error] E2161 Error: RLINK32: Error opening file "...\IFood.View.Style.Geral.fmx"
```

O RLINK32 chega até a etapa de link (todos os units compilaram), mas não consegue
processar/abrir o `.fmx` do StyleBook porque a classe `TSkSvg` nele não está
resolvida pela instalação do Skia.

**Pegadinha de diagnóstico (não persiga o caminho errado):** o `.fmx` parece 100%
saudável — existe, **sem BOM**, não é read-only, não está travado, é **byte a byte
idêntico a um commit que já linkou antes**. Isso induz à hipótese errada de "lock do
Designer / handle preso do IDE". **Não é lock.** Se o form é um StyleBook com
`TSkSvg` e o erro é RLINK32 "Error opening file", **suspeite primeiro da instalação
do Skia** (pacote design-time, DCUs, `sk4d.dll`), não do arquivo.

**Correção:** reparar/reinstalar o Skia no IDE (ou `Project → Enable Skia` +
`<Skia>true</Skia>`, abaixo). Caso real: erro sumiu após corrigir a instalação do
Skia, sem tocar no `.fmx`.

## Correção — habilitar Skia (Delphi 12 Athens / RAD 23.0+)

Via IDE é um clique: **Project → Enable Skia**. Por linha de comando / edição
manual do `.dproj`:

1. No `.dproj`, no `PropertyGroup` principal (o que tem `<FrameworkType>FMX`),
   adicionar:
   ```xml
   <Skia>true</Skia>
   ```
2. No `.dpr`, linkar as units (garante o registro de `TSkSvg` mesmo no build por
   linha de comando):
   ```pascal
   uses
     System.Skia,
     FMX.Forms,
     FMX.Skia,
     ...
   ```

`<Skia>true</Skia>` faz os targets da Embarcadero linkarem o Skia e **embutirem a
lib nativa no pacote mobile** (Android `libsk4d.so`, iOS) automaticamente — no
device o erro some após rebuild/redeploy.

## Pegadinha Win32: sk4d.dll não é copiado pelo build CLI

No **Win32**, o `TSkSvg` precisa do `sk4d.dll` em runtime. O build por
`msbuild`/linha de comando **não copia** o `sk4d.dll` para a pasta de saída (o IDE
copia ao rodar via F9, pois acha o dll no PATH do RAD). Para testar o `.exe`
standalone Win32, copiar manualmente:

```
C:\Program Files (x86)\Embarcadero\Studio\23.0\bin\sk4d.dll  →  <saida>\Win32\Debug\
```

No device (Android/iOS) isso não se aplica — a lib vai embutida pelo `<Skia>true>`.

## Alternativa (sem Skia)

Se não quer a dependência do Skia: não usar estilos que contenham `TSkSvg`
(trocar o `StyleLookup` para um estilo sem ícone SVG, ou remover o `TSkSvg` do
StyleBook). Ver [[fmx-stylebook-form-separado]].
