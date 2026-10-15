# [FMX] Quatro defeitos que compilam, passam no teste e so aparecem rodando o app

Todos apareceram no mesmo dia, numa tela nova de app FireMonkey com Router4Delphi.
Nenhum gera warning. Vale a leitura antes de dizer "compilou, esta pronto".

---

## 1. Propriedade inexistente no `.fmx` derruba a tela em RUNTIME

Sintoma: ao navegar para a tela, um dialogo nativo:

```
Error reading edtDe.ShowClearButtonInMobile: Property ShowClearButtonInMobile does not exist.
```

Causa: o compilador **nao valida nomes de propriedade** em `.dfm`/`.fmx` — o arquivo e lido
por RTTI no `LoadFromStream`, ja com o app rodando. Escrever o `.fmx` a mao (ou copiar de
outra versao do Delphi / de outro tipo de controle) e o caminho classico.

No caso: `ShowClearButtonInMobile` existe em `TEdit`, **nao** em `TDateEdit`.

Como conferir antes de rodar, sem abrir a IDE:

```bash
grep -n "property ShowClearButtonInMobile" \
  "/c/Program Files (x86)/Embarcadero/Studio/37.0/source/fmx/FMX.DateTimeCtrls.pas"
```

Sem resultado = a propriedade nao e publicada por aquele controle. Regra pratica: ao
escrever `.fmx` a mao, toda propriedade que nao veio de um controle igual ja existente no
projeto precisa ser conferida no fonte da FMX.

---

## 2. Controle do template fica ATRAS do que a tela adiciona

Sintoma: o botao flutuante aparece na tela, mas tocar nele aciona o que esta **atras** dele
(um item da lista, por exemplo).

Causa: em FMX, entre irmaos, **quem e criado depois fica por cima**. Um controle herdado do
form-base e criado ANTES dos controles que a tela descendente acrescenta — entao a
`TListBox` que voce adicionou cobre o botao do template, mesmo o botao continuando visivel
(o fundo transparente da lista deixa ele aparecer).

```pascal
BtnFlutuante.Visible := True;
BtnFlutuante.BringToFront;   // sem isto o toque cai no controle de tras
```

O sintoma engana: como o botao **aparece**, ninguem suspeita de z-order — a investigacao
vai para o `OnClick`, que esta correto.

---

## 3. `FormCreate` roda UMA vez na vida da view roteada

Router4Delphi (e qualquer roteador que guarde as instancias) **reaproveita a view**: na
segunda navegacao para a mesma rota, o form ja existe e o `FormCreate` **nao roda de novo**.

Dois sintomas, mesma causa:

- a lista nao mostra o registro que acabou de ser gravado;
- a tela de detalhe mostra sempre o **primeiro** registro aberto, porque o `class var ID`
  muda mas nada recarrega.

O gancho certo e o `Render` da `iRouter4DComponent`, chamado a **cada** navegacao. Mas ele
costuma nao ser virtual no form-base — e, como o roteador chama pela INTERFACE, um `Render`
nao-virtual reintroduzido no descendente **nunca e chamado**. Torne-o virtual na base:

```pascal
// no form-base
function Render: TFMXObject; virtual;

// na tela
function TViewPedidoLista.Render: TFMXObject;
begin
  Result := inherited Render;
  Recarregar;                 // roda a cada entrada
end;
```

E **tire a carga de dados do `FormCreate`** — senao a primeira entrada carrega duas vezes.
O `FormCreate` fica so com o que e uma vez na vida (criar listas internas, titulo, icones).

Quem recarrega tem de **limpar antes**, ou os itens da entrada anterior ficam empilhados.

---

## 4. Estado visual que so e pintado no caminho "ruim" nunca volta

```pascal
// ERRADO: pinta so quando ha problema
if AItem.ExcedeSaldo then
begin
  Lbl.Text := Lbl.Text + ' (acima do saldo)';
  Lbl.TextSettings.FontColor := TAlphaColorRec.Darkorange;
end;
```

Se o mesmo componente for repreenchido (o usuario corrige a quantidade), o texto do aviso
sai — porque o `Text` e reescrito do zero — mas a **cor fica**. A linha continua laranja
sugerindo um problema que ja foi resolvido.

Regra: **todo atributo visual condicional precisa dos dois ramos**.

```pascal
if AItem.ExcedeSaldo then
begin
  Lbl.Text := Lbl.Text + ' (acima do saldo)';
  Lbl.TextSettings.FontColor := TAlphaColorRec.Darkorange;
end
else
  Lbl.TextSettings.FontColor := TAlphaColor($FF78909C);   // volta ao normal
```

Vale para `Visible`, `Enabled`, `Fill.Color`, `Opacity` — qualquer coisa que so se liga.

---

## Conclusao pratica

Autoteste headless cobre rede, parsing, sessao e regra de negocio — e barato, deve existir.
Mas **nao pega nenhum destes quatro**. Reserve uma passada clicando na tela antes de fechar
qualquer sprint que tenha UI nova.
