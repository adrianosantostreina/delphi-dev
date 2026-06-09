# Nomenclatura de units FMX para Android — evitando ponto em forms/frames

## O problema

Ao compilar projetos FMX para **Android64** no Delphi 12, forms/frames com nome de unit dotado (`Form.Main`, `Frame.Home`, `Frame.Produto.Detalhe`) produzem erro de link:

```
[DCC Error] E2597 ld.lld: error: cannot open
  D:\...\Android64\Debug\Form.Main.o: unspecified system_category error
```

O linker LLVM (`ld.lld`) usado pelo Android toolchain do Delphi não resolve corretamente o `.o` gerado a partir de uma unit dotada **quando ela tem `.fmx` associado via `{$R *.fmx}`**. O `.dcu` é gerado; o `.o` intermediário não é encontrado.

## A regra

Para **Android builds**:

| Tipo de unit | Pode ter pontos? | Exemplo |
|---|---|---|
| Form FMX (`.pas` + `.fmx`) | ❌ Não | `FormMain.pas`, `FormLogin.pas` |
| Frame FMX (`.pas` + `.fmx`) | ❌ Não | `FrameHome.pas`, `FrameListaProdutos.pas` |
| DataModule (`.pas` + `.dfm` ou sem DFM) | ✅ Sim | `DM.Conexao.pas` |
| Model / Service / Repository (só `.pas`) | ✅ Sim | `Model.Produto.pas`, `Repository.Interfaces.pas` |

Em outras palavras: **somente units com recurso `.fmx` atrelado** precisam ter nome plano sem pontos. Units que são apenas código Pascal seguem livremente a convenção dotada do estilo Delphi moderno (System.SysUtils, FMX.Forms, etc.).

## Por que não todas?

Units puras de código (sem `.fmx`/`.dfm`) são compiladas direto para `.o` pelo DCC e o linker as encontra sem problema — o DCC gera `Model.Produto.o` e `ld.lld` abre normalmente. A falha só acontece na combinação **dot + resource binding**.

## Como renomear uma unit afetada

1. Fechar o projeto no Delphi.
2. Renomear os dois arquivos: `Frame.Home.pas` → `FrameHome.pas` e `Frame.Home.fmx` → `FrameHome.fmx`.
3. Editar a primeira linha do `.pas`: `unit Frame.Home;` → `unit FrameHome;`.
4. Editar o `.fmx`: `object FrameHome: TFrameHome` (mantém o nome da classe `TFrameHome`, não precisa mudar aqui — apenas a unit).
5. No `.dproj`, localizar:
   ```xml
   <DCCReference Include="...\Frame.Home.pas">
       <Form>FrameHome</Form>
       <FormType>fmx</FormType>
   </DCCReference>
   ```
   E trocar para:
   ```xml
   <DCCReference Include="...\FrameHome.pas">
   ```
6. No `.dpr`, atualizar a referência: `FrameHome in 'path\FrameHome.pas' {FrameHome};`.
7. **Project → Clean** em todas as plataformas (remover `.dcu`, `.o` antigos).
8. **Build**.

## Sintoma no IDE

Se a opção `Project → Clean` não for feita, builds seguintes podem ainda reportar o erro por causa de arquivos `.o` stale. Apagar as pastas `Android\`, `Android64\`, `Win32\`, `Win64\` manualmente antes do próximo build também resolve.

## Referência de projeto

Aplicado no projeto **HamburgueriaClaude** (totem self-checkout Android) após encontrar o erro. Todos os forms/frames seguem o padrão plano (`FormMain`, `FrameHome`, etc.); models, repositories e services continuam com pontos (`Model.Produto`, `Repository.Produto.Local`, `Service.Seed`).
