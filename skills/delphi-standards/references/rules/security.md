# Rule: Segurança em Código Delphi

## SQL sempre parametrizado

```delphi
// OBRIGATÓRIO
LQuery.SQL.Text := 'SELECT * FROM usuarios WHERE login = :login AND senha = :senha';
LQuery.ParamByName('login').AsString := ALogin;
LQuery.ParamByName('senha').AsString := ASenhaHash;

// JAMAIS
LQuery.SQL.Text := 'SELECT * FROM usuarios WHERE login = ''' + ALogin + ''' AND senha = ''' + ASenha + '''';
```

## Credenciais
- Nunca hardcoded no código: sem `FConexao.Password := 'minhasenha'`
- Usar arquivo de configuração externo (`.ini`) fora do executável
- Em mobile: usar Keychain (iOS) ou Keystore (Android) via API do SO

## HTTPS em produção
- `TRESTClient.BaseURL` sempre `https://` em produção
- Nunca desabilitar validação de certificado em produção:
  ```delphi
  // JAMAIS em produção
  LHTTPClient.OnValidateServerCertificate :=
    procedure(const Sender: TObject; const ARequest: TURLRequest;
              const Certificate: TCertificate; var Accepted: Boolean)
    begin
      Accepted := True; // bypass total — PROIBIDO em produção
    end;
  ```

## Validação de input
- Validar na borda do sistema (formulários, API)
- Nunca confiar em dados que chegam de fora (mesmo de outros sistemas internos)
- Sanitizar antes de exibir (prevenção de XSS em WebBrowser/TEdgeBrowser)
