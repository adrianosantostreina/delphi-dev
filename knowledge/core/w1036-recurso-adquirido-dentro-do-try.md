# W1036 nos DAOs: recurso adquirido DENTRO do `try` que o libera

## O padrão errado

```pascal
var
  LDataSet: TDataSet;
begin
  try
    LDataSet := FQuery.SQL(...).OpenDataSet;   // se levantar AQUI...
    Result := LDataSet.ToJSONArray;
  finally
    LDataSet.Free;                             // ...isto roda sobre LIXO -> AV
  end;
end;
```

O compilador acusa como **`W1036 Variable 'LDataSet' might not have been
initialized`** — que soa cosmético e por isso costuma ser ignorado. Não é: numa
variável local não inicializada, `Free` cai em endereço arbitrário. Quando a
conexão está indisponível ou o SQL está errado — justamente quando o `except`
deveria salvar o dia — o app morre com Access Violation e a causa real
desaparece.

O mesmo vale para `TIniFile`, `TStringStream`, `TResourceStream` e para os
objetos de negócio:

```pascal
try
  LDAOSync := TDAOSyncPessoas.Create(TConnection.Connection);  // pode levantar
  LDAOSync.Sync;
finally
  LDAOSync.Free;
end;
```

## As duas correções

**1. Adquirir FORA do `try`** — é o idioma correto e o preferido:

```pascal
LDAOSync := TDAOSyncPessoas.Create(TConnection.Connection);
try
  LDAOSync.Sync;
finally
  LDAOSync.Free;
end;
```

**2. `nil`-init**, quando a aquisição precisa mesmo ficar dentro do `try` (por
exemplo porque há um `except` que trata o erro da própria aquisição):

```pascal
LDataSet := nil;
try
  ...
finally
  LDataSet.Free;   // Free(nil) e seguro em Delphi
end;
```

## Por que vale caçar todos de uma vez

O aviso aparece **por método**, então um projeto costuma ter dezenas — 18 num
único levantamento aqui, espalhados por DAOs, sincronismo e views. São todos a
mesma falha, e a correção é mecânica. Filtrar o log de build por `W1036`
excluindo `modules/` dá a lista completa em segundos:

```powershell
Select-String -Path build_log.txt -Pattern "W1036" |
  Where-Object { $_.Line -notmatch 'modules\\' }
```

## Primos que aparecem no mesmo passe

- **`W1035 Return value of function might be undefined`** — função com corpo
  vazio (`begin // end;`) devolvendo **lixo**. Se é stub, `raise
  ENotImplemented` é melhor que um `False` silencioso, que pareceria "não deu
  certo, mas tudo bem".
- **`W1010 Method 'Destroy' hides virtual method of base type`** — destrutor
  declarado sem `override`. O `Free` chama `TObject.Destroy` e o seu destrutor
  **nunca roda**.
- **`case` sem `else` sobre valor vindo de `.ini`** — driver desconhecido deixa a
  variável sem valor e a conexão é montada com lixo. Sempre `else raise`
  dizendo o que é aceito.

## Relacionado

- [horse-conexao-por-requisicao.md](horse-conexao-por-requisicao.md)
- [adrconnection-query-builder.md](adrconnection-query-builder.md)
