---
name: delphi-firedac
description: >
  Especialista em FireDAC. Auto-ativa quando detectar: TFDQuery, TFDConnection,
  TFDTable, TFDMemTable, TFDTransaction, TFDManager, FireDAC, "connection pool",
  "memory leak query", "driver not found", ADRConnection, TDataSet no contexto FireDAC.
---

# Delphi FireDAC

> **Notação `kb:`** — `kb:core/arquivo.md` é um arquivo da base de conhecimento. Leia com `kb_get`
> (MCP `delphi-dev-kb`); sem ele, leia o arquivo direto: `core/arquivo.md` em
> `~/.delphi-dev/kb-cache/current/` e, se não estiver lá, em `knowledge/` na raiz do plugin
> (a pasta ao lado de `skills/`; `~/.delphi-dev/plugin/knowledge/` so existe se o plugin foi instalado com `npx delphi-dev --target codex|opencode`).

## Idioma de saída
Detecte o idioma da primeira mensagem. Padrão: pt-BR. Respeite overrides explícitos.

## Regras fundamentais FireDAC

1. **Sempre registrar drivers explicitamente** — ver `kb:core/firedac-registro-drivers.md`
2. **TFDQuery: criar, usar, liberar dentro do método** — não manter aberto
3. **Transações explícitas** para operações de escrita múltipla
4. **Parâmetros tipados** — `ParamByName('id').AsInteger`, nunca `AsString` para números

## Padrão de uso de TFDQuery

```delphi
procedure TClienteRepository.SalvarCliente(ACliente: ICliente);
var
  LQuery: TFDQuery;
begin
  LQuery := TFDQuery.Create(nil);
  try
    LQuery.Connection := FConnection;
    LQuery.SQL.Text :=
      'INSERT INTO clientes (nome, ativo) VALUES (:nome, :ativo)';
    LQuery.ParamByName('nome').AsString := ACliente.Nome;
    LQuery.ParamByName('ativo').AsBoolean := ACliente.Ativo;
    LQuery.ExecSQL;
  finally
    LQuery.Free;
  end;
end;
```

## Memory leak comum
`TFDQuery` criado como campo da classe e nunca liberado no destructor.
`TFDQuery` criado com `Owner = Self` em método: liberado quando o form fecha, não quando o método termina.

## Referência completa
- `kb:core/firedac-registro-drivers.md` — units de driver obrigatórias, `ConsoleUI.Wait`, DEFINE `ADRCONN_FIREDAC`
- `kb:core/firedac-console-firebird.md` — FireDAC em console com Firebird
- `kb:core/adrconnection-query-builder.md` — ADRConnection / query builder
