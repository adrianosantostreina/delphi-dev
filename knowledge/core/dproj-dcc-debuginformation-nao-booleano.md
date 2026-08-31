# `.dproj` escrito à mão: `DCC_DebugInformation` é enum numérico, não booleano — `F1026 File not found: 'true.dpr'`

Ao **gerar um `.dproj` sem o IDE** (agente, script, template), é natural escrever
`true`/`false` em toda propriedade que "parece booleana". Algumas **não são** — e o erro
resultante não tem nenhuma relação aparente com a causa.

## Sintoma

```
CodeGear.Delphi.Targets(431,5): error F1026: File not found: 'true.dpr'
```

O projeto se chama `MinhaApi.dpr`; `true.dpr` não existe em lugar nenhum e a string `true`
não aparece no `.dpr`. **Nenhuma linha de código chega a ser compilada** — o build morre
antes.

Confirmado no RAD Studio 37.0 (Delphi 13); o mecanismo vale para qualquer versão moderna.

## Causa

O `.dproj` traz:

```xml
<DCC_DebugInformation>true</DCC_DebugInformation>
```

`DCC_DebugInformation` **não é booleana** — é um **enum numérico**. O `.dproj` gerado pela
IDE usa:

```xml
<DCC_DebugInformation>0</DCC_DebugInformation>   <!-- Debug: 0 -->
<DCC_DebugInfoInExe>true</DCC_DebugInfoInExe>    <!-- ESTA sim é booleana -->
```

O `CodeGear.Delphi.Targets` repassa o valor **cru** à task DCC:

```xml
DebugInformation="$(DCC_DebugInformation)"
```

Valor não reconhecido não é validado — vaza como **token solto** na linha de comando do
compilador:

```
dcc32.exe -$O- -$W+ true --no-config -B -Q ...
                    ^^^^
```

O `dcc32` interpreta esse `true` como o **arquivo-fonte a compilar**, acrescenta `.dpr` e
procura `true.dpr`. Daí o `F1026`.

## Correção

```xml
<PropertyGroup Condition="'$(Cfg_1)'!=''">   <!-- Debug -->
  <DCC_Define>DEBUG;$(DCC_Define)</DCC_Define>
  <DCC_Optimize>false</DCC_Optimize>
  <DCC_GenerateStackFrames>true</DCC_GenerateStackFrames>
  <DCC_DebugInformation>0</DCC_DebugInformation>
  <DCC_DebugInfoInExe>true</DCC_DebugInfoInExe>
</PropertyGroup>

<PropertyGroup Condition="'$(Cfg_2)'!=''">   <!-- Release -->
  <DCC_Define>RELEASE;$(DCC_Define)</DCC_Define>
  <DCC_Optimize>true</DCC_Optimize>
  <DCC_GenerateStackFrames>false</DCC_GenerateStackFrames>
  <DCC_DebugInformation>2</DCC_DebugInformation>
</PropertyGroup>
```

## Quais são booleanas e quais não são

| Propriedade | Tipo | Valores |
|---|---|---|
| `DCC_Optimize` | booleana | `true` / `false` |
| `DCC_GenerateStackFrames` | booleana | `true` / `false` |
| `DCC_DebugInfoInExe` | booleana | `true` / `false` |
| **`DCC_DebugInformation`** | **enum numérico** | `0` (Debug) / `2` (nenhuma) |

## Como não errar de novo

**Nunca invente o tipo de uma propriedade do `.dproj`.** Crie um projeto vazio na IDE, salve,
e use o `.dproj` dela como referência — é a única fonte confiável do tipo de cada propriedade,
e ela varia entre versões do RAD Studio.

## Diagnóstico rápido

Quando o erro citar um arquivo que não existe e cujo nome parece um **valor**
(`true.dpr`, `false.dpr`, `0.dpr`), rode o build com verbosidade diagnóstica e leia a linha
de comando do compilador:

```
msbuild Projeto.dproj /t:Build /v:diag > diag.txt
findstr /C:"dcc32.exe" diag.txt
```

O token solto aparece na hora, e a propriedade que o produziu é a imediatamente anterior na
ordem dos switches.

Relacionado: [`dproj-projectguid-valido.md`](dproj-projectguid-valido.md) — outra armadilha de
`.dproj` escrito à mão.
