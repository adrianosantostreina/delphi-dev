# SSL / TLS no Android (FMX)

## O erro classico

Apps FMX Android falham ao acessar HTTPS com:

```
EJNIException: java.security.cert.CertificateException:
  java.security.cert.CertPathValidatorException:
  Trust anchor for certification path not found
```

Isso significa que o Android **nao conseguiu construir a chain de
certificados ate um root CA confiavel**. Causas tipicas:

1. **Chain incompleta no servidor** (mais comum) — o servidor envia apenas o
   leaf cert, sem o intermediario. `curl` no desktop disfarca buscando o
   intermediario sozinho; Android nao faz isso.
2. **Cert self-signed** (DDNS, dev environments).
3. **Cert assinado por CA privada** (ambientes corporativos).

### Diagnostico rapido

```bash
openssl s_client -connect <host>:443 -servername <host> < /dev/null
```

Procurar:
- `Verify return code: 21 (unable to verify the first certificate)` → chain incompleta no servidor
- `Verify return code: 18 (self-signed certificate)` → self-signed
- Numero de certs em `Certificate chain` (deveria ser >= 2 para cert publico)

A solucao **correta** e sempre **corrigir o servidor** — em nginx, trocar
`ssl_certificate cert.pem` por `ssl_certificate fullchain.pem`. So use os
workarounds abaixo se nao tiver controle do servidor.

---

## RESTRequest4D NAO expoe bypass de SSL

O contrato `IRequest` do RESTRequest4D (`RESTRequest4D.Request.Contract.pas`)
nao tem metodo de desabilitar validacao de certificado. Os backends `Indy` e
`ICS` expoem `CertFile`/`KeyFile` (cert do **cliente**, nao do servidor) e
nada mais. O backend default (`TRequestClient` via `REST.Client`) tambem nao
expoe.

Conclusao: **para bypass de SSL em FMX Android, nao usar RESTRequest4D no
ponto onde o bypass e necessario** — usar `TNetHTTPClient` direto.

---

## Bypass via TNetHTTPClient (workaround dev)

`TNetHTTPClient.OnValidateServerCertificate` funciona no Android desde Delphi
11.x (com OpenSSL ou via TrustManager customizado no JNI). Como o evento e
`of object`, precisa de um metodo de **instancia** — nao de class procedure.

### Padrao reutilizavel

```pascal
unit ExemploServico;

interface

uses
  System.SysUtils, System.JSON, System.Classes,
  System.Net.URLClient,
  System.Net.HttpClient,
  System.Net.HttpClientComponent;

type
  TServico = class
    class function Chamar(const APayload: string): string;
  end;

implementation

const
  C_BYPASS_SSL = True;   // ⚠️ trocar para False em producao

type
  TSSLAceitarTudo = class
    procedure OnValidate(const Sender: TObject; const ARequest: TURLRequest;
      const Certificate: TCertificate; var Accepted: Boolean);
  end;

procedure TSSLAceitarTudo.OnValidate(const Sender: TObject;
  const ARequest: TURLRequest; const Certificate: TCertificate;
  var Accepted: Boolean);
begin
  Accepted := True;
end;

class function TServico.Chamar(const APayload: string): string;
var
  LBypass: TSSLAceitarTudo;
  LClient: TNetHTTPClient;
  LRequest: TNetHTTPRequest;
  LBody: TStringStream;
  LResponse: IHTTPResponse;
begin
  LBypass := TSSLAceitarTudo.Create;
  LClient := TNetHTTPClient.Create(nil);
  LRequest := TNetHTTPRequest.Create(nil);
  LBody := TStringStream.Create(APayload, TEncoding.UTF8);
  try
    if C_BYPASS_SSL then
      LClient.OnValidateServerCertificate := LBypass.OnValidate;

    LRequest.Client := LClient;
    LRequest.CustomHeaders['Content-Type'] := 'application/json';

    LResponse := LRequest.Post('https://host/endpoint', LBody);
    Result := LResponse.ContentAsString(TEncoding.UTF8);
  finally
    LBody.Free;
    LRequest.Free;
    LClient.Free;
    LBypass.Free;
  end;
end;
```

### Pegadinhas

- `OnValidateServerCertificate` exige metodo `of object` — class procedures
  nao sao aceitas pelo compilador. Use uma classe helper instanciavel.
- Liberar `TNetHTTPClient`, `TNetHTTPRequest` e o helper apos a chamada — sao
  TComponent + TObject, nao tem ARC.
- Em Android, o `OnValidate` so e chamado quando ha problema na chain. Se a
  chain estiver OK, o evento nao dispara — comportamento esperado.

---

## Solucao alternativa: network_security_config.xml

Permite configurar trust anchors customizados sem alterar codigo Pascal.
Util quando o cert e self-signed ou intermediario customizado.

1. Criar `res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config>
        <domain includeSubdomains="false">host.exemplo.com</domain>
        <trust-anchors>
            <certificates src="@raw/intermediario_customizado"/>
            <certificates src="system"/>
        </trust-anchors>
    </domain-config>
</network-security-config>
```

2. Adicionar `intermediario_customizado.pem` em `res/raw/`.

3. Editar `AndroidManifest.template.xml` adicionando ao `<application>`:

```xml
android:networkSecurityConfig="@xml/network_security_config"
```

4. Deployar via Project > Deployment os arquivos `res/xml/...xml` e
   `res/raw/...pem` para `.\res\xml\` e `.\res\raw\` no Android.

Vantagem: mais seguro que bypass total (so confia naquele cert especifico
para aquele dominio especifico).

Desvantagem: mais complexo de configurar e exige saber o cert exato.

---

## Cleartext traffic (HTTP sem TLS)

Para Android 9+ (API 28+), HTTP cleartext e bloqueado por padrao. Para
permitir, no `AndroidManifest.template.xml`:

```xml
<application
  ...
  android:usesCleartextTraffic="true">
```

Ou (mais seguro) limitar a hosts especificos via `network_security_config.xml`:

```xml
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain>host.local</domain>
    </domain-config>
</network-security-config>
```

---

## Resumo de decisao

| Situacao | Solucao recomendada |
|---|---|
| Servidor com chain incompleta (e voce controla o servidor) | Corrigir nginx/apache para usar `fullchain.pem` |
| Servidor com chain incompleta (sem controle) | `TNetHTTPClient` + `OnValidateServerCertificate` (DEV); ou embedar intermediario via `network_security_config.xml` (PROD) |
| Self-signed em ambiente dev | `network_security_config.xml` apontando para o cert |
| Cert de CA privada corporativa | `network_security_config.xml` apontando para o root CA da empresa |
| HTTP puro (sem TLS) | `usesCleartextTraffic` no manifest, escopo por dominio |
