# `.dpr` uses clause é a fonte de verdade do Project Manager

## Regra

No Delphi, **o Project Manager (Project > Structure) lê a seção `uses` do `.dpr`**, não o `.dproj`. Units só aparecem visíveis no IDE se estiverem declaradas no `.dpr` com cláusula `in '<path>'`.

Adicionar apenas `<DCCReference Include="..."/>` no `.dproj` faz o compilador encontrar a unit, **mas não a expõe no Project Manager**. Para desenhar forms/frames visualmente, precisa estar no `.dpr`.

## Sintaxe para cada tipo de unit

| Tipo | Cláusula |
|---|---|
| Unit de código puro (model, repository, service) | `Nome in 'pasta\Nome.pas',` |
| Form FMX | `NomeUnit in 'pasta\NomeUnit.pas' {ClasseForm},` |
| Frame FMX | `NomeUnit in 'pasta\NomeUnit.pas' {ClasseFrame: TFrame},` |
| DataModule | `NomeUnit in 'pasta\NomeUnit.pas' {ClasseDM: TDataModule},` |

**O sufixo entre chaves `{...}`** diz ao IDE qual é o nome da classe principal da unit e, para frames/datamodules, qual é o tipo base — sem isso, o IDE não abre o Designer corretamente.

## Exemplo completo

```pascal
program HamburgueriaClaude;

uses
  System.StartUpCopy,
  FMX.Forms,

  // --- Code-only units ---
  AppConfig in 'src\infra\AppConfig.pas',
  Model.Produto in 'src\models\Model.Produto.pas',
  Repository.Interfaces in 'src\repositories\Repository.Interfaces.pas',
  Controller.App in 'src\controllers\Controller.App.pas',

  // --- Frames (precisam do :TFrame no final) ---
  FrameHome in 'src\frames\FrameHome.pas' {FrameHome: TFrame},
  FrameCategorias in 'src\frames\FrameCategorias.pas' {FrameCategorias: TFrame},

  // --- Forms (nome da classe entre chaves, sem :TForm) ---
  FormMain in 'src\forms\FormMain.pas' {MainForm};

{$R *.dres}
{$R *.res}

begin
  Application.Initialize;
  Application.CreateForm(TFormMain, MainForm);
  Application.Run;
end.
```

## Erros comuns

### "Meu arquivo não aparece no Project Manager"
Causa: só adicionou em `.dproj`, esqueceu do `.dpr`.
Fix: adicionar `UnitName in 'path\Unit.pas',` na clause `uses`.

### "Form Designer não abre — dá 'No form found'"
Causa: form ou frame declarado no `.dpr` **sem** o sufixo `{NomeClasse}` (ou `{NomeClasse: TFrame}` para frames).
Fix: adicionar o sufixo.

### "IDE reclama de duplicidade quando eu abro o .dpr"
Causa: `.dpr` e `.dproj` desincronizados — IDE encontra a mesma unit referenciada nos dois lugares mas com paths ligeiramente diferentes (ex: `src\frames\FrameX.pas` vs `src/frames/FrameX.pas`).
Fix: normalizar para backslashes `\` em ambos, idem case (filesystem do Windows é case-insensitive mas XML é case-sensitive).

## Quando o IDE faz isso automaticamente

Ao usar **File → New → Form/Frame/Unit** ou **Project → Add to Project** no IDE, o Delphi adiciona automaticamente nos dois lugares (`.dpr` uses e `.dproj` DCCReferences) mantidos em sincronia.

Quando você cria os arquivos **por fora do IDE** (editor externo, script, agent de IA), precisa editar **ambos manualmente** e garantir a sincronia. Caso contrário o IDE não vê a unit.

## Dica: sincronia .dpr ↔ .dproj

Toda unit nova deve ter entrada nos dois lugares:

**.dpr:**
```pascal
NovaUnit in 'src\pasta\NovaUnit.pas',
```

**.dproj:**
```xml
<DCCReference Include="src\pasta\NovaUnit.pas"/>
```

Para forms/frames no `.dproj`, incluir também:
```xml
<DCCReference Include="src\frames\FrameX.pas">
    <Form>FrameX</Form>
    <FormType>fmx</FormType>
    <DesignClass>TFrame</DesignClass>
</DCCReference>
```
