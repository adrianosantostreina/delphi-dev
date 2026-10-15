# `MessageDlg` da VCL mostra "Yes / No / Confirm" em inglês

## Sintoma

Aplicação inteiramente em português, e o diálogo de confirmação aparece assim:

```
[ Confirm ]
Remover a pausa "Almoço"?
        [ &Yes ]  [ &No ]
```

```pascal
if MessageDlg('Remover a pausa?', TMsgDlgType.mtConfirmation,
  [TMsgDlgBtn.mbYes, TMsgDlgBtn.mbNo], 0) = mrYes then
```

O texto que **você** escreveu sai em português; o **título** e as **legendas dos botões**, não.

## Causa

`MessageDlg` monta o form com strings de **resource da própria VCL** (`SMsgDlgConfirm`, `SMsgDlgYes`,
`SMsgDlgNo`, em `Vcl.Consts`). Elas vêm no idioma do **pacote de recursos da IDE**, que por padrão é
inglês. Sem o resource DLL traduzido implantado junto, nada fica em português — não há propriedade
para configurar isso na chamada.

## Correção — `Application.MessageBox`

A `MessageBox` do Windows usa os botões **do sistema operacional**, já traduzidos, e recebe o título
como parâmetro:

```pascal
function Confirmar(const ATitulo, APergunta: string): Boolean;
begin
  Result := Application.MessageBox(PChar(APergunta), PChar(ATitulo),
    MB_YESNO or MB_ICONQUESTION) = IDYES;
end;

procedure Avisar(const ATitulo, ATexto: string);
begin
  Application.MessageBox(PChar(ATexto), PChar(ATitulo), MB_OK or MB_ICONINFORMATION);
end;
```

Retornos: `IDYES`, `IDNO`, `IDOK`, `IDCANCEL` (de `Winapi.Windows`) — **não** `mrYes`/`mrOk`.

## Efeito colateral em automação de testes de UI

As duas rotas criam janelas **de classes diferentes**, e isso quebra script de automação escrito para
uma delas:

| Chamada | Classe da janela | Como fechar |
|---|---|---|
| `MessageDlg` | **`TMessageForm`** (um `TForm` da VCL) | clicar no `TButton` filho pelo caption |
| `Application.MessageBox` | **`#32770`** (diálogo nativo) | clicar no `Button` filho, ou `WM_COMMAND` com `IDYES`/`IDOK` |

Procurar `#32770` num app que usa `MessageDlg` não acha nada — e o script conclui "nenhum diálogo
apareceu" enquanto a aplicação está travada esperando resposta.

## Relacionado

[fmx-win32-janela-automacao-externa.md](fmx-win32-janela-automacao-externa.md) — automação de janela
por API do Windows.
