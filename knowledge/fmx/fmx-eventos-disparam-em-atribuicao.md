# [FMX] Eventos de "mudança" disparam em atribuição por código, não só na interação

No FMX, vários eventos que *parecem* ser de interação do usuário são, na verdade, eventos de
**mudança de valor** — e disparam também quando o código atribui a propriedade. Escrever a
rotina assumindo "só dispara quando o usuário mexe" gera reentrância e corrupção de dado
silenciosa.

## TSwitch.OnSwitch — dispara em `IsChecked := ...`

`FMX.StdCtrls`:

```pascal
procedure TCustomSwitch.SetIsChecked(const AValue: Boolean);
begin
  if Model.Value <> AValue then
  begin
    ...
    Model.Value := AValue;   // <-- o model notifica e cai em DoSwitch
  end;
end;

procedure TCustomSwitch.DoSwitch;
begin
  ...
  if Assigned(OnSwitch) then
    OnSwitch(Self);          // <-- o handler roda
end;
```

O disparo vem do *model* (`if Owner is TCustomSwitch then TCustomSwitch(Owner).DoSwitch;`).
Note que **só dispara se o valor MUDOU** (`if Model.Value <> AValue`) — reatribuir o mesmo
valor não dispara nada, o que esconde o problema em metade dos testes manuais.

**Caso clássico que quebra:** switch "marcar/desmarcar todos" que percorre N switches filhos.
Se algum ponto do código depois desligar o switch mestre para refletir estado, o `OnSwitch`
do mestre dispara de novo e revarre os N filhos — em geral no meio de outra operação.

**Cura — guarda de reentrância** (não existe "SetIsCheckedSilent" no FMX):

```pascal
private
  FAjustandoSwitches: Boolean;

procedure TForm1.SwtTodosSwitch(Sender: TObject);
begin
  if FAjustandoSwitches then
    Exit;

  FAjustandoSwitches := True;
  try
    // ... varre e atribui os filhos ...
  finally
    FAjustandoSwitches := False;
  end;
end;

// E em TODO ponto que mexe no mestre por código:
FAjustandoSwitches := True;
try
  SwtTodos.IsChecked := False;
finally
  FAjustandoSwitches := False;
end;
```

## TEdit.OnChangeTracking — dispara em `Text := ...`

`FMX.Edit`:

```pascal
procedure TCustomEditModel.DoChangeTracking;
begin
  FChanged := True;
  SendMessage(MM_EDIT_TEXT_CHANGING);
  if Assigned(FOnChangeTracking) and not (csLoading in Owner.ComponentState) then
    FOnChangeTracking(Owner);
end;
```

A **única** blindagem é `csLoading` (streaming do form). Atribuir `Edt.Text := Campo.AsString`
ao carregar um registro **dispara** `OnChangeTracking`.

### Por que isso morde em campo com máscara

O padrão comum de máscara em FMX é:

```pascal
procedure TForm1.EdtFoneChangeTracking(Sender: TObject);
begin
  {$IFDEF MSWINDOWS}
  EdtFone.Format(TMaskFormat.Telefone);
  {$ENDIF}
end;

procedure TForm1.EdtFoneTyping(Sender: TObject);
begin
  {$IFDEF ANDROID}
  EdtFone.Format(TMaskFormat.Telefone);
  {$ENDIF}
end;
```

Isso não é capricho: **`OnTyping` só dispara com entrada real do usuário** (vem da presentation
nativa), enquanto **`OnChangeTracking` dispara também por código**. Ou seja:

| Plataforma | Evento usado | Carregar registro reformata o campo? |
|---|---|---|
| Android/iOS | `OnTyping` | **Não** |
| Windows | `OnChangeTracking` | **Sim** |

Consequência prática: no Windows, abrir um cadastro antigo **reescreve** o campo pela máscara
atual, e um "salvar" depois persiste o valor reformatado — mesmo que o usuário não tenha
tocado naquele campo. Se a coluna do banco for texto livre com dados legados heterogêneos,
isso é reescrita de dado histórico sem ninguém pedir.

**Regra:** a rotina de máscara tem de ser **idempotente e não destrutiva**, porque ela vai
rodar sobre dado que já está formatado (ou malformado). Nunca truncar para caber na máscara —
ver [mascara-telefone-dinamica-br.md](mascara-telefone-dinamica-br.md).

## Como checar outros eventos antes de confiar

Não adivinhe: abra a fonte da RTL e veja quem chama o `Do<Evento>`.

```bash
p="C:/Program Files (x86)/Embarcadero/Studio/<ver>/source/fmx/FMX.StdCtrls.pas"
awk '/procedure TCustomSwitch.SetIsChecked/,/^end;/' "$p"
grep -n "DoSwitch" "$p"
```

Se o setter empurra para um *model* (`Model.Value := ...`), assuma que o evento dispara — a
notificação do model é justamente o caminho que chama o `Do<Evento>`.

## Sintomas que denunciam esta armadilha

- Handler de "todos" rodando N vezes por operação (ver no log).
- Campo formatado "sozinho" ao abrir um registro, sem ninguém digitar.
- Comportamento que só reproduz no Windows (ou só no Android) — é o `{$IFDEF}` separando
  `OnChangeTracking` de `OnTyping`.
- Dado que muda de formato no banco sem edição consciente.
