# [FMX] Frames, Clone, Render e Streaming — armadilhas de runtime

Conjunto de pegadinhas de FMX que **compilam sem erro** mas quebram em runtime
(AV, EReadError, dados nil). Todas descobertas em projeto real (app loja FMX + Router4Delphi).

## 0. Propriedades inválidas no `.fmx` que o RLINK reporta como "Error opening file"

**Sintoma:** o `.pas` compila, mas o **linker** falha com
`error E2161: RLINK32: Error opening file "...X.fmx"`. A mensagem engana — o
arquivo existe e não está travado; o problema é **conteúdo inválido no `.fmx`**
que o compilador de recurso do form não parseia.

**Causas comuns ao escrever `.fmx` à mão / fora do IDE:**
- `Margins.Rect = (12, 14, 16, 14)` / `Padding.Rect = (...)` — **tupla é inválida**.
  `TBounds` é gravado como sub-propriedades: `Margins.Left = 12.000000`,
  `Margins.Top = ...`, `Margins.Right = ...`, `Margins.Bottom = ...`.
- `Viewport.Width` / `Viewport.Height` em `TListBox`/scrollboxes — **não streamáveis**.
- Cores no `.fmx` usam prefixo `x`: `Fill.Color = xFFF9F3EC` (no código é `$FF...`).
- `FormFactor.Devices = [iPhone, Android]` → **valor inválido** nesse set em versões
  recentes; o IDE gera `[Desktop]`. (Esse dá `EReadError: Invalid property value`
  em runtime, não no link.)

> Regra: gerando `.fmx` manualmente, use só propriedades que o próprio IDE grava;
> margens sempre como `Margins.Left/Top/Right/Bottom`, nunca `Margins.Rect`.

## 1. Datamodule sem `{$R *.dfm}` → componentes nil em runtime

Se a unit de um `TDataModule` (ou form) **não tem** `{$R *.dfm}` na `implementation`,
o `.dfm` não é carregado e os componentes declarados nele ficam **nil** — sem erro de
compilação. Acesso depois dá `EAccessViolation: Read of address 000000xx` (offset = campo
do componente nil).

**Sintoma:** `MemTable`/`Query`/qualquer componente do designer é `nil` ao usar.
**Correção:** garantir `{$R *.dfm}` logo após o `uses` da `implementation`.

## 2. Router4Delphi `Render<T>` NÃO dispara `OnShow`/`FormShow`

Ao renderizar uma view com `TRouter4D.Render<TFrmX>.SetElement(...)` (tela inicial
embutida em um layout), o `OnShow` do form **não** é chamado — então código de carga
em `FormShow` não roda (tela aparece vazia). `TRouter4D.Link.&To(...)` pode disparar,
`Render<>` não.

**Correção:** colocar a carga no método `Render` da interface `iRouter4DComponent`.
Tornar `TFrmBase.Render` **virtual** e dar `override` na tela:
```pascal
function TFrmVitrine.Render: TFMXObject;
begin
  Result := inherited Render;   // retorna o layout raiz
  CarregarDados;                // roda em Render<> e em Link.To
end;
```

## 3. Frame renderizado via `Render<T>` precisa de `RegisterClass`

Views registradas em `TRouter4D.Switch.Router(C_Rota, TFrmX)` já ficam registradas para
streaming. Mas um frame **só** renderizado direto (`Render<TFrmSidebar>`), sem rota,
dá `EClassNotFound: Class TFrmX not found` ao carregar seu `.fmx` herdado.

**Correção:** registrar a classe na `initialization` da unit:
```pascal
initialization
  RegisterClass(TFrmSidebar);
```

## 4. `Clone` NÃO preserva `Name` nem handlers de evento dos filhos

`TFmxObject.Clone(AOwner)` (usado para duplicar um card-template por item) copia a
árvore visual, mas os **Names dos filhos se perdem** e os `OnClick` podem não vir.
Logo `clone.FindComponent('lblX')` / busca por `Name` retorna nil → card fica com o
texto default do template.

**Correções:**
- Acessar filhos por **índice** (`LCard.Children[0]`, `[1]`…) — a ordem do `.fmx` é
  preservada. Guardar com `if LCard.Children[i] is TLabel then`.
- **Religar** os eventos após clonar: `TRect(LCard.Children[0]).OnClick := OnSelecionar;`
- Clonar com `Clone(nil)` (sem owner) evita colisão de nomes; o `Parent` libera os
  filhos ao `DeleteChildren`.

## 5. `TabOrder` e `TagString` NÃO são streamáveis em vários controles FMX

- `TRectangle`/`TShape` **não têm** `TabOrder` → pôr `TabOrder = 0` no `.fmx` dá
  `EReadError: Property TabOrder does not exist` em runtime (compila!). `TLayout`/
  `TLabel`/`TButton` aceitam.
- `TagString`/`TagFloat`/`TagObject` são **public, não published** → não podem ir no
  `.fmx` (`EReadError: Property TagString does not exist`). Use `Tag` (Integer, esse é
  published) ou defina em código.

## 6. `System.IOUtils.TPath` sombreia `FMX.Objects.TPath`

Se a unit usa `FMX.Objects` (tem `TPath` = o shape de vetor) e você adiciona
`System.IOUtils` **depois** no `uses`, `TPath` passa a resolver para o **record**
`System.IOUtils.TPath` → casts `TPath(...)` viram "Invalid typecast" e `.Fill/.Tag/
.OnClick` somem. Idem `TFile`/`TDirectory` não colidem, mas `TPath` sim.

**Correção:** não misturar; qualificar (`System.IOUtils.TPath.Combine`) só funciona com
a unit no uses — então isole o IO em outra unit, ou use IO clássico, ou ordene o uses
para o `TPath` desejado prevalecer.

## Diagnóstico rápido em app FMX Win32 (sem IDE)

- Envolver o startup no `.dpr` em `try/except` gravando `E.ClassName + E.Message` num
  arquivo (Documents) revela `EReadError`/`EClassNotFound`/`EAccessViolation` de
  streaming sem precisar do debugger.
- Build via `.bat` (msbuild Win32) + rodar o `.exe` + capturar a janela com
  `PrintWindow` (user32) permite "ver" a tela; **porém PrintWindow não captura brushes
  de bitmap (GPU)** — eles saem como cor sólida mesmo carregados. Para conferir imagem,
  use `CopyFromScreen` com a janela em foreground.
