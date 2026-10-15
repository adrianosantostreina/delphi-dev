# Router4D (router4delphi) — `HAS_FMX` precisa ser definido no `.dproj` do projeto host

## Sintoma

Build (qualquer plataforma, mas aparece tipicamente em Android64/iOS ao restaurar
a dependência via boss4delphi) falha em `Router4D.pas` com:

```
Router4D.pas(16): error F2613: Unit 'Vcl.ExtCtrls' not found.
```

ou, em outras units do pacote (`Router4D.Interfaces.pas`, `Router4D.History.pas`,
`Router4D.Render.pas`, `Router4D.Link.pas`, `Router4D.Sidebar.pas`), erros
análogos de unit VCL não encontrada em plataforma mobile/FMX.

## Causa

O código-fonte do Router4D usa `{$IFDEF HAS_FMX} FMX.Types {$ELSE} Vcl.ExtCtrls {$ENDIF}`
(e o mesmo padrão em vários outros pontos) para suportar tanto VCL quanto FMX
a partir da mesma base de código. O define `HAS_FMX` **não** vem ativo por padrão:
o arquivo `modules\router4delphi\src\Router4D.inc` (instalado via `boss install`)
traz a linha comentada:

```pascal
//{$DEFINE HAS_FMX}
```

Editar esse `.inc` da biblioteca não é a forma documentada de configurar o pacote
(fica sujeito a ser sobrescrito em `boss update`/reinstalação). Os próprios projetos
de exemplo do Router4D (`Samples\FMX\Demo\*.dproj`, `Samples\FMX\SimpleDemo\*.dproj`)
mostram a forma correta: definir `HAS_FMX` via propriedade `DCC_Define` do **projeto
que consome a lib**.

## Correção

No `.dproj` do projeto host, na `PropertyGroup` base (condição `'$(Base)'!=''`,
sem restrição de plataforma/config — vale para todas as combinações), ao lado de
outros defines globais (ex. `SKIA`):

```xml
<DCC_Define>HAS_FMX;$(DCC_Define)</DCC_Define>
```

Note que o `.dproj` pode já ter uma linha `<DCC_Define>` para outro define (ex.
`SKIA;$(DCC_Define)`) — o formato do `.dproj` do Delphi aceita **múltiplas tags
`<DCC_Define>` na mesma `PropertyGroup`** (o MSBuild as concatena/a última
sobrescreve dependendo da ordem de merge com `$(DCC_Define)` de fora; na prática,
adicionar uma segunda linha própria para `HAS_FMX;$(DCC_Define)` funciona porque
cada uma referencia a variável acumulada anterior). Confirmado build-testado em
Delphi 13 (RAD Studio 37.0) Android64.

## Como diagnosticar rapidamente

1. Erro aponta para `modules\router4delphi\src\Router4D*.pas` mencionando
   `Vcl.*` não encontrado em build FMX/mobile.
2. Abrir `modules\router4delphi\src\Router4D.inc` — se `{$DEFINE HAS_FMX}`
   estiver comentado, essa é a causa.
3. `grep -r HAS_FMX modules\router4delphi` mostra o padrão usado em todo o
   pacote e confirma que os *Samples* FMX definem via `.dproj`.

## Relacionado

- [uses-fmx-components.md](uses-fmx-components.md)
- [build-via-bat-com-log.md](build-via-bat-com-log.md)
