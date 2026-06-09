# Recursos Embutidos no Executável (RCDATA / .dres)

**Aplica-se a:** Delphi FMX **e** VCL, em todas as plataformas (Win32, Win64, Android, iOS, macOS, Linux).

Conhecimento sobre como embutir arquivos binários arbitrários (SVGs, JSONs, imagens, templates, scripts) dentro do executável Delphi e lê-los em runtime via `TResourceStream`.

---

## A forma certa: diálogo Resources and Images

O Delphi tem um diálogo nativo que gerencia recursos do projeto e **gera o `.dres` automaticamente** no build. É o mecanismo canônico — não precisa escrever `.rc` manualmente, não precisa chamar `brcc32`/`cgrc`, não precisa configurar nada no `.dproj` à mão.

### Passo a passo

1. Menu **Project → Resources and Images...**
2. Clique **Add...** e selecione o arquivo físico (ex: `imagens\svg\email.svg`)
3. No painel direito **Properties**, configure:
   - **Resource identifier:** nome pelo qual você vai chamar no código (ex: `svg_email`)
   - **Resource type:** **digite `RCDATA`** (sem underscore — o combo mostra `ICON`, `BITMAP`, `CURSOR`, `RCDATA`, `FONT`)
4. Repita para cada arquivo
5. **OK** — o IDE grava as entradas dentro do `.dproj`
6. **Build** — o Delphi gera `<NomeDoProjeto>.dres` automaticamente consolidando todos os recursos
7. No `.dpr`, adicione a diretiva: `{$R *.dres}` (o `*` expande para o nome do projeto)

### O que fica gravado no `.dproj`

```xml
<ItemGroup>
    <Resource Include="imagens\svg\email.svg">
        <ResourceType>RCDATA</ResourceType>
        <ResourceId>svg_email</ResourceId>
    </Resource>
    <Resource Include="imagens\svg\lock.svg">
        <ResourceType>RCDATA</ResourceType>
        <ResourceId>svg_lock</ResourceId>
    </Resource>
</ItemGroup>
```

### O que é gerado no build

```
MeuProjeto.dres      ← consolidado, gerado automaticamente pelo IDE
```

**Não edite o `.dres` à mão** — ele é um artefato binário, regerado a cada build.

---

## A diretiva `{$R *.dres}` — como funciona

```pascal
program MeuProjeto;

{$R *.dres}   // ← inclui recursos multiplataforma (cgrc)
{$R *.res}    // ← inclui recursos Windows clássicos (brcc32: ícone, version info)
```

- `{$R *.dres}` — o `*` expande para `MeuProjeto.dres` (nome do projeto). Formato multiplataforma, funciona em Android/iOS/Windows/macOS.
- `{$R *.res}` — formato PE tradicional do Windows. Gerado pelo `brcc32` a partir do `.rc` auto-gerado pelo IDE (ícone do app, version info, manifest). **Só serve para Windows.**

As duas diretivas coexistem no mesmo `.dpr` e cada uma serve a um propósito — mantenha as duas.

---

## Lendo o recurso em runtime

```pascal
uses
  System.Classes, System.SysUtils, Winapi.Windows;

function LerRecursoComoString(const AResName: string): string;
var
  LResStream: TResourceStream;
  LStringStream: TStringStream;
begin
  Result := '';
  LResStream := TResourceStream.Create(HInstance, AResName, RT_RCDATA);
  try
    LStringStream := TStringStream.Create;
    try
      LStringStream.CopyFrom(LResStream, 0);
      Result := LStringStream.DataString;
    finally
      LStringStream.Free;
    end;
  finally
    LResStream.Free;
  end;
end;
```

**Importante:** o segundo parâmetro do `TResourceStream.Create` é o **identifier** (ex: `'svg_email'`), e o terceiro é o **tipo** (`RT_RCDATA` constante do `Winapi.Windows` — corresponde ao `RCDATA` do diálogo).

No FMX mobile, `RT_RCDATA` também funciona (é uma constante portável do Delphi, não depende do Win32 API real).

### Aplicando a um `TSkSvg` (FMX)

```pascal
procedure CarregarIcone(const AResName: string; ASkSvg: TSkSvg; ACor: TAlphaColor);
var
  LResStream: TResourceStream;
  LContent: TStringStream;
begin
  LResStream := TResourceStream.Create(HInstance, AResName, RT_RCDATA);
  try
    LContent := TStringStream.Create;
    try
      LContent.CopyFrom(LResStream, 0);
      ASkSvg.Svg.Source := LContent.DataString;
      ASkSvg.Svg.OverrideColor := ACor;
    finally
      LContent.Free;
    end;
  finally
    LResStream.Free;
  end;
end;
```

---

## Caminho alternativo (NÃO recomendado): `.rc` manual

Você **pode** escrever um `.rc` à mão e adicioná-lo ao projeto via **Project → Add to Project**, mas esse caminho é frágil:

1. O Delphi vai chamar `cgrc.exe`/`brcc32.exe` sobre o `.rc`, e o nome de saída **não é previsível** entre versões do IDE — às vezes gera `MeuResource.dres`, às vezes `MeuProjeto.dres`, às vezes nada.
2. A diretiva `{$R *.dres}` espera `<NomeDoProjeto>.dres`, então você pode acabar com `E1026 File not found: 'MeuProjeto.dres'` mesmo com o `.rc` compilando.
3. Para corrigir, tem que usar `{$R MeuResource.rc}` ou `{$R MeuResource.res}` explicitamente — e aí perde a portabilidade entre plataformas.

**Regra:** sempre use o diálogo **Project → Resources and Images**. É a via oficial, é o que o IDE espera, e funciona idêntico entre VCL e FMX.

Se você encontrar um `.rc` antigo na raiz de um projeto existente, provavelmente é **documentação legada** deixada pelo autor — o recurso real está no `.dproj` via `<Resource>`. Não se deixe enganar pela presença do `.rc` físico.

---

## Erros comuns

### `[DCC Error] E1026 File not found: 'MeuProjeto.dres'`

**Causa:** `{$R *.dres}` no `.dpr`, mas nenhum recurso foi cadastrado no diálogo **Resources and Images**. Sem recursos cadastrados, o IDE não gera o `.dres`.

**Fix:** ou cadastre pelo menos 1 recurso no diálogo, ou comente/remova a diretiva.

### `[DCC Error] E2606 Duplicate resource: type RCDATA ID <nome>`

**Causa mais comum:** o `.dpr` tem `{$R *.dres}` declarado **duas ou mais vezes** — o linker inclui o mesmo arquivo N vezes e todos os IDs aparecem duplicados.

**Fix:** deixar uma única diretiva `{$R *.dres}` no `.dpr` (convenção: logo após `program <Nome>;`).

**Outra causa possível:** o mesmo recurso está cadastrado duas vezes — uma via diálogo **Resources and Images** (`<RcItem>` no `.dproj`) e outra via `.rc` manual adicionado ao Project Manager. Nesse caso, escolha um dos dois caminhos e remova o outro (o canônico é o diálogo — apagar o `.rc` do Project Manager).

### `Resource <id> not found`

**Causa:** em runtime, `TResourceStream.Create` não encontra o identifier.

**Possíveis razões:**
- O **Resource type** no diálogo não está como `RCDATA` (está como `RC_DATA`, `BITMAP`, etc.)
- O **Resource identifier** está com typo (sensível a case? depende da versão — padronize lowercase)
- O projeto foi compilado **antes** de adicionar o recurso e está rodando binário antigo — faça **Build** (não só Compile)

### Diálogo mostra `RC_DATA` como default em vez de `RCDATA`

Algumas versões do Delphi preenchem o campo com `RC_DATA` (com underscore) por default. **Apague e digite `RCDATA` manualmente** — é isso que bate com a constante `RT_RCDATA` do código em runtime.

---

## Referência de projeto — Inforsys

No Inforsys mobile, os SVGs estão cadastrados via diálogo no `InforSysMobile.dproj` linhas 544-599:

```xml
<Resource Include="imagens\svg\agenda.svg">
    <ResourceType>RCDATA</ResourceType>
    <ResourceId>svg_agenda</ResourceId>
</Resource>
```

Existe também um `InforSysMobileResource.rc` na pasta, mas **não é usado** pelo build — é documentação legada. Quem alimenta o `InforSysMobile.dres` é o `.dproj`.
