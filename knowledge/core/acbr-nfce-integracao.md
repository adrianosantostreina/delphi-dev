# ACBr NFCe — Integração e Armadilhas (Trunk2 / Delphi 12 Athens)

Referência para integração real do `TACBrNFe` em projetos Delphi,
baseada em experimentos com ACBr Trunk2 (DCUs em `LibD29/Win32`).

---

## Localização das units-chave

| O que precisa | Unit correta |
|---|---|
| Enums de NFe (moNFCe, ve400, fpDinheiro, csosn102…) | `pcnConversaoNFe` |
| Aliases legados (taHomologacao, tnSaida…) | `pcnConversao` (re-exporta de `ACBrDFe.Conversao`) |
| Tipos SSL (TSSLLib, TSSLCryptLib, TSSLHttpLib, TSSLXmlSignLib) | `ACBrDFeSSL` |
| Componente principal | `ACBrNFe` |

---

## SSL em simulação (sem transmissão real)

Use **constantes nomeadas**, nunca cast inteiro (`TSSLLib(4)` falha quando
o ordinal do DCU compilado difere do fonte):

```pascal
AACBrNFe.Configuracoes.Geral.SSLLib        := libNone;    // 0
AACBrNFe.Configuracoes.Geral.SSLCryptLib   := cryNone;    // 0
AACBrNFe.Configuracoes.Geral.SSLHttpLib    := httpNone;   // 0
AACBrNFe.Configuracoes.Geral.SSLXmlSignLib := xsNone;     // 0
```

Em produção real: `libOpenSSL + cryOpenSSL + httpOpenSSL + xsLibXml2`.

---

## PathPDF — está no DANFE, não em Arquivos

`Configuracoes.Arquivos` **não** tem `PathPDF`. O path do PDF pertence ao
componente DANFE (`TACBrDFeReport`), que pode ser nil em servidores headless:

```pascal
if Assigned(AACBrNFe.DANFE) then
  AACBrNFe.DANFE.PathPDF := TConfiguracoes.PastaPDF;
```

---

## IdCSC é String, não Integer

```pascal
AACBrNFe.Configuracoes.Geral.IdCSC := '000001';  // String!
AACBrNFe.Configuracoes.Geral.CSC   := 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
```

---

## Extrair a chave 44 dígitos após GerarNFe

O campo `infNFe.ID` retornado pelo ACBr tem o prefixo `"NFe"` (3 chars):

```pascal
LChave := Copy(LNFe.NotasFiscais.Items[0].NFe.infNFe.ID, 4, 44);
```

---

## Assinar tolerante a falha (sem certificado válido)

Em simulação o certificado é inválido/inexistente — a assinatura falha mas
o XML é gerado corretamente pelo `GerarNFe`. Tolerar:

```pascal
try
  LNFe.NotasFiscais.Assinar;
except
  on E: Exception do
    Writeln('[DAO.NFCE] Aviso Assinar (simulacao): ' + E.Message);
end;
```

---

## ForceDirectories com path relativo → EInOutError

`ForceDirectories('xml')` falha porque a implementação recursiva chama
`ForceDirectories(ExtractFilePath('xml'))` = `ForceDirectories('')`, que
lança `EInOutError: Unable to create directory\r\n[]`.

Padrão seguro — garantir caminho absoluto com fallback `GetCurrentDir`:

```pascal
LPathXML := TConfiguracoes.PastaXML;
if LPathXML.IsEmpty then
begin
  LPathXML := ExtractFilePath(ParamStr(0));
  if LPathXML.IsEmpty then
    LPathXML := GetCurrentDir;
  LPathXML := IncludeTrailingPathDelimiter(LPathXML) + 'xml';
end;
try
  ForceDirectories(LPathXML);
except
  LPathXML := '';  // GravarXML usa diretório corrente como fallback
end;
```

> **Por que `ExtractFilePath(ParamStr(0))` pode ser vazio?**
> Quando o executável é lançado via linha de comando sem caminho completo
> (ex: `apiNFCE.exe` em vez de `C:\...\apiNFCE.exe`), `ParamStr(0)` retorna
> apenas o nome do arquivo, sem path.

---

## Mapeamento forma de pagamento PDV → ACBr

```pascal
function MapearFormaPagamentoACBr(AForma: Integer): TpcnFormaPagamento;
begin
  case AForma of
    1: Result := fpDinheiro;
    2: Result := fpCartaoCredito;
    3: Result := fpCartaoDebito;
    5: Result := fpPagamentoInstantaneo;  // PIX = 17 na SEFAZ
  else
    Result := fpOutro;
  end;
end;
```

`fpPagamentoInstantaneo` corresponde ao código SEFAZ `17` (PIX).

---

## Configuração mínima de NFCe (modelo 65, versão 4.00)

```pascal
AACBrNFe.Configuracoes.Geral.ModeloDF     := moNFCe;
AACBrNFe.Configuracoes.Geral.VersaoDF     := ve400;
AACBrNFe.Configuracoes.Geral.VersaoQRCode := veqr200;
AACBrNFe.Configuracoes.WebServices.Ambiente := taHomologacao;
AACBrNFe.Configuracoes.WebServices.UF := 'SP'; // sobrescrever com UF real
```
