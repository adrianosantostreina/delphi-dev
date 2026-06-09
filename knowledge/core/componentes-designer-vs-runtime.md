# Componentes no Designer vs. em Runtime

## Regra

**Sempre crie componentes de UI (botões, labels, painéis, etc.) no designer (DFM/FMX)**, não em código via `Create`. Componentes declarados no DFM/FMX:

- São visíveis no Form Designer
- Aparecem na lista de componentes do form
- São declarados automaticamente no `class(TForm)` pelo IDE
- Têm seus event handlers conectados pelo IDE sem risco de erro

## Quando usar criação dinâmica (Create em código)

Apenas quando a **quantidade** de controles é variável e desconhecida em design time:

- Linhas de uma grade criadas dinamicamente
- Botões gerados a partir de uma lista de dados
- Controles condicionais a uma feature flag carregada em runtime

## Anti-padrão

```pascal
// ERRADO — botão fixo criado em runtime (nunca aparece no designer)
procedure TfrmCategorias.FormCreate(Sender: TObject);
begin
  FBtnNova := TSpeedButton.Create(Self);
  FBtnNova.Parent := LytBtnBotoes;
  FBtnNova.Text := 'Nova';
  FBtnNova.OnClick := BtnNovaClick;
end;
```

## Padrão correto

Declarar no FMX/DFM e referenciar no PAS:

```
// No .fmx
object speBtnNova: TSpeedButton
  Align = Client
  OnClick = speBtnNovaClick
end

// No .pas (seção published do TForm)
speBtnNova: TSpeedButton;
procedure speBtnNovaClick(Sender: TObject);
```

## Caso real (GestorADRIFood)

Botões CRUD da tela de categorias foram inicialmente criados em `FormCreate` e não apareciam no designer. A correção foi declará-los no `.fmx` com o padrão `TLayout > TRectangle > TLabel + TSpeedButton`, seguindo o visual dos botões "Reenviar" e "Fechar" já existentes na tela.
