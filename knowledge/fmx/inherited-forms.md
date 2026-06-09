# FMX — Forms Herdados (Inherited Forms)

Forms herdados são essenciais em apps FMX com muitas telas: centralizam comportamento comum (keyboard handling, hardware back, Router4D, etc.) em um `TViewBase*` ancestral. Porém, o Form Designer tem bugs conhecidos com herança que exigem contornos específicos.

## Padrão de uso

```pascal
// Ancestral
type
  TViewBaseCad = class(TForm, iRouter4DComponent, IHardwareBackHandler)
    LytGeral: TLayout;
    ScrollConteudo: TVertScrollBox;
    LytFormulario: TLayout;
    procedure FormCreate(Sender: TObject);
    procedure FormKeyUp(...);
    procedure FormFocusChanged(...);
    procedure FormVirtualKeyboardShown(...);
    procedure FormVirtualKeyboardHidden(...);
  protected
    function HandleHardwareBack: Boolean; virtual;
  end;

// Descendente
type
  TViewLogin = class(TViewBaseCad)
    // componentes novos aqui
  end;
```

No `.fmx` do descendente, usar `inherited`:

```dfm
inherited ViewLogin: TViewLogin
  Caption = 'Login'
  inherited LytGeral: TLayout
    inherited ScrollConteudo: TVertScrollBox
      inherited LytFormulario: TLayout
        // novos componentes aqui
      end
    end
  end
end
```

## 🐛 Bug conhecido — Event handlers do ancestral

**Sintoma:** ao abrir o `.fmx` do descendente no Form Designer, a IDE exibe dialogs como:

> The FormCreate method referenced by ViewLogin.OnCreate does not exist. Remove the reference?

Aparece para `FormCreate`, `FormKeyUp`, `FormFocusChanged`, `FormVirtualKeyboardShown`, `FormVirtualKeyboardHidden` — qualquer handler declarado no ancestral.

**Causa:** o Form Designer FMX às vezes não resolve via RTTI transitiva os event handlers declarados no ancestral quando abre o `.fmx` do descendente. É um bug documentado do designer (já observado em várias versões do RAD Studio).

**Consequência se clicar "Yes":** o `.fmx` do descendente remove as referências (`OnCreate`, `OnKeyUp`, etc.) e o comportamento do ancestral para de funcionar em runtime naquela tela (keyboard handling, back button, etc.).

## ✅ Solução — Redeclarar handlers como stubs no descendente

Redeclare cada event handler do ancestral no descendente como um método publicado que apenas chama `inherited`:

```pascal
type
  TViewLogin = class(TViewBaseCad)
    // componentes...

    // Redeclarar os handlers do ancestral para resolver via RTTI local
    procedure FormCreate(Sender: TObject);
    procedure FormKeyUp(Sender: TObject; var Key: Word; var KeyChar: Char; Shift: TShiftState);
    procedure FormFocusChanged(Sender: TObject);
    procedure FormVirtualKeyboardShown(Sender: TObject; KeyboardVisible: Boolean; const Bounds: TRect);
    procedure FormVirtualKeyboardHidden(Sender: TObject; KeyboardVisible: Boolean; const Bounds: TRect);
  end;

implementation

procedure TViewLogin.FormCreate(Sender: TObject);
begin
  inherited;
end;

procedure TViewLogin.FormFocusChanged(Sender: TObject);
begin
  inherited;
end;

procedure TViewLogin.FormKeyUp(Sender: TObject; var Key: Word; var KeyChar: Char; Shift: TShiftState);
begin
  inherited;
end;

procedure TViewLogin.FormVirtualKeyboardHidden(Sender: TObject;
  KeyboardVisible: Boolean; const Bounds: TRect);
begin
  inherited;
end;

procedure TViewLogin.FormVirtualKeyboardShown(Sender: TObject;
  KeyboardVisible: Boolean; const Bounds: TRect);
begin
  inherited;
end;
```

**Importante:**
- Os stubs **devem chamar `inherited`** para preservar a lógica do ancestral
- Se o descendente precisar de lógica adicional, adicione depois do `inherited`
- Essa redeclaração **não quebra** a herança — o handler ancestral ainda executa

## 🎯 Quando você encontrar esses dialogs

1. **Clique "Cancel" em todos** (não "Yes" nem "No")
2. Abra o `.pas` do descendente
3. Adicione os stubs conforme exemplo acima
4. Feche e reabra o form no designer

Se você clicou "Yes" sem querer, restaure o `.fmx` do Git ou adicione manualmente as linhas de evento no `.fmx`:

```dfm
inherited ViewLogin: TViewLogin
  OnCreate = FormCreate
  OnKeyUp = FormKeyUp
  OnFocusChanged = FormFocusChanged
  OnVirtualKeyboardShown = FormVirtualKeyboardShown
  OnVirtualKeyboardHidden = FormVirtualKeyboardHidden
  ...
end
```

## Outras boas práticas com inherited forms

### 1. Nunca duplicar componentes do ancestral no `.fmx` do descendente
O `.fmx` do descendente só deve conter:
- A palavra-chave `inherited` antes do nome da classe
- **Referências** (`inherited LytGeral: TLayout`) aos componentes herdados que você quer modificar
- **Novos componentes** adicionados dentro dos containers herdados

### 2. `FormCreate` do ancestral sempre executa primeiro
Mesmo sem sobrescrever no descendente, o `FormCreate` do ancestral roda automaticamente. Só sobrescreva se precisar adicionar lógica no descendente.

### 3. `DoShow` como hook alternativo
Se precisar de lógica pós-exibição (quando a view já está visível), prefira sobrescrever `DoShow` no ancestral e deixar descendentes com override:

```pascal
// Ancestral
procedure TViewBaseCad.DoShow;
begin
  inherited;
  // hook
end;

// Descendente
procedure TViewLogin.DoShow;
begin
  inherited;
  // lógica específica da tela
end;
```

### 4. Interfaces do Router4D + herança
Se o ancestral implementa `iRouter4DComponent`, o descendente herda automaticamente. Não redeclarar `Render`, `UnRender`, `Props` no descendente a menos que queira sobrescrever. Para receber dados via EventBus, sobrescrever apenas `Props`:

```pascal
procedure TViewLogin.Props(Value: TProps);
begin
  inherited;
  // ler Value aqui
end;
```
