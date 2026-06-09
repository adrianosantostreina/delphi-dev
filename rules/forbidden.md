# Rule: Comandos Proibidos em Delphi

## Proibido sem exceção

### `with`
**Problema:** Esconde a origem dos identificadores, causa bugs silenciosos em refactoring.
```delphi
// PROIBIDO
with LCliente do
begin
  Nome := 'João';
  Ativo := True;
end;

// CORRETO
LCliente.Nome := 'João';
LCliente.Ativo := True;
```

### `Break` e `Continue`
**Problema:** Múltiplos pontos de saída de loop tornam o fluxo imprevisível.
```delphi
// PROIBIDO
for I := 0 to Count - 1 do
begin
  if Items[I] = nil then Continue;
  if Items[I].Id = AId then Break;
end;

// CORRETO — use variável de controle ou extraia para método com Exit único
```

### `Real`
**Problema:** Precisão inferior, tipo legado. Use `Double` ou `Currency` (monetário).
```delphi
// PROIBIDO
var LTaxa: Real;

// CORRETO
var LTaxa: Double;
var LValor: Currency; // para valores monetários
```

### `const` em parâmetros de interface (ARC)
**Problema:** Em plataformas ARC (iOS/Android), `const` em parâmetros de interface não incrementa o ref count, causando acesso a memória liberada.
```delphi
// PROIBIDO (em interfaces, ARC)
procedure ProcessarCliente(const ACliente: ICliente);

// CORRETO
procedure ProcessarCliente(ACliente: ICliente);
```

### SQL por concatenação
**Problema:** SQL injection, impossível parametrizar, difícil de manter.
```delphi
// PROIBIDO
LQuery.SQL.Text := 'SELECT * FROM clientes WHERE nome = ''' + ANome + '''';

// CORRETO
LQuery.SQL.Text := 'SELECT * FROM clientes WHERE nome = :nome';
LQuery.ParamByName('nome').AsString := ANome;
```

### `ShowMessage` em produção
**Problema:** Bloqueia a thread principal, inacessível em serviços/background.
Use logging ou sistema de notificação.

### `Exit` no meio de método
**Problema:** Múltiplos pontos de saída dificultam rastreamento.
Um método deve ter um único ponto de retorno (ou pelo menos o mínimo indispensável).
