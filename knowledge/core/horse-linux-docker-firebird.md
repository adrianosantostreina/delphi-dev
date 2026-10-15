# Horse no Linux/Docker + FireDAC a Firebird remoto

Padrões genéricos para publicar uma API **Delphi/Horse compilada para Linux** dentro de um
container Docker, conectando a um **Firebird remoto** via FireDAC. Vale para qualquer projeto;
detalhes de uma infra específica (nomes de rede, domínios) ficam na memória do projeto.

## Binário e runtime
- A API Horse para Linux é um **binário console**. Após copiar para o servidor, **`chmod +x`**
  é obrigatório (senão o container falha com `permission denied`).
- Dependências de runtime mínimas na imagem: `libfbclient2`, `libssl`, `libicu`, `tzdata`
  (uma imagem-base enxuta só com o **cliente** Firebird, sem o servidor).

## Config via `<nome>.ini` ao lado do binário
Padrão comum: a conexão e a porta ficam num `.ini` lido em runtime — **o nome do `.ini` NÃO
é necessariamente `<binario>.ini`** (registrar o nome real por projeto). Estrutura típica:
```ini
[CONFIG_DB]
Driver=FB
Database=/caminho/no/servidor/BANCO.FDB   ; path do .FDB DENTRO do host do Firebird
User_Name=SYSDBA
Password=masterkey
Server=<host alcançável>
PortDB=<porta>
Protocol=TCP

[CONFIG_HORSE]
Port=<porta http do Horse>

###/usr/lib/x86_64-linux-gnu/libfbclient.so.2   ; VendorLib (comentário/registro)
```

## FireDAC → Firebird no Linux
- **VendorLib** (cliente Firebird) no Linux: `/usr/lib/x86_64-linux-gnu/libfbclient.so.2`
  (pacote `libfbclient2`). Esse cliente conecta em servidores Firebird **2.5, 3.0, 4.0 e 5.0**.
- App **console** (toda API Horse é) + FireDAC: linkar `FireDAC.ConsoleUI.Wait` (NÃO `VCLUI.Wait`),
  senão AVs "Read of address 0x0" em qualquer operação de banco. Ver [firedac-console-firebird.md](firedac-console-firebird.md).
- `Database` é o caminho do `.FDB` **no host do servidor Firebird** (Linux é case-sensitive —
  conferir maiúsculas/minúsculas). ODS do `.FDB` deve casar com a versão do engine (não atachar
  um `.FDB` de FB5 num servidor FB3).

### Os DOIS erros aparecem em sequência (não confundir um com o outro)
Ao subir um binário Horse no Linux que nunca conectou antes, os problemas se manifestam **em ordem**:

1. **`[FireDAC][Phys][FB]-314. Cannot load vendor library [fbclient.dll]`** — o `VendorLib` não
   foi setado, então o FireDAC procura o nome default do Windows (`fbclient.dll`), inexistente no
   Linux. **Correção no código:** setar `TFDPhysFBDriverLink.VendorLib :=
   '/usr/lib/x86_64-linux-gnu/libfbclient.so.2'` antes do 1º `.Connect` (idealmente lido do `.ini`).
   - **Workaround por infra, SEM recompilar** (quando você não tem o fonte na mão): criar um symlink
     com o nome que o FireDAC procura, no **diretório do executável** (o "application EXE directory"
     do hint do erro), apontando para a lib real:
     `ln -sf /usr/lib/x86_64-linux-gnu/libfbclient.so.2 <dir_do_binario>/fbclient.dll`.
     Em container Docker, se o dir do app é bind-mount, o symlink **persiste** a restart/redeploy.
     O `dlopen('fbclient.dll')` do FireDAC resolve pelo dir do binário e o -314 some.

2. **`Access violation ... accessing address 0000000000000000`** (AV "Read of address 0x0") na
   PRIMEIRA operação de banco — aparece **só depois** de resolver o -314 (com a lib carregada).
   É o sintoma do app console sem a UI de espera de console: falta `FireDAC.ConsoleUI.Wait` +
   uma **instância** de `TFDGUIxWaitCursor` com `Provider := 'Console'` (e `FireDAC.DApt`). Só
   ter a unit no `uses` NÃO basta — precisa da instância. Ver [firedac-registro-drivers.md](firedac-registro-drivers.md).
   **Este NÃO tem workaround por infra — exige recompilar.**

Regra de diagnóstico: `-314 fbclient.dll` → problema de **VendorLib** (contornável por symlink).
`AV 0x0 logo na query` (com a lib já carregando) → problema de **console wait / DApt** (só recompilando).

### 3º erro possível: `SQLSTATE 28000 "user name and password are not defined"`
Depois de resolver -314 e o AV, a query pode falhar na **autenticação** (o app conecta mas o
servidor rejeita as credenciais). **Pegadinha de diagnóstico:** `isql -u SYSDBA -p masterkey /path/BANCO.FDB`
(sem `host:`) é conexão **local/embedded** e **NÃO passa pela autenticação de rede** — "funciona"
mesmo com a senha errada. O app conecta via **TCP**, que exige auth real. Para reproduzir do jeito
do app, sempre testar com a **forma TCP**: `isql -u SYSDBA -p <senha> localhost:/path/BANCO.FDB`.
- Nas imagens **`jacobalberty/firebird`** (2.5/3.0/4.0) a senha do SYSDBA **não é `masterkey`** —
  vem da env **`ISC_PASSWORD`** definida na criação do container (`docker inspect <fb> --format
  '{{range .Config.Env}}{{println .}}{{end}}' | grep ISC_PASSWORD`). Colocar essa senha real no `.ini`.
- Regra: `28000` com a lib já carregada e sem AV → **credencial errada no `.ini`** (ou testou só
  por isql local, que engana). Confirme por isql TCP antes de mexer no binário.

## Container → Firebird publicado no host
Se a API roda num container isolado e o Firebird está **publicado numa porta do host**:
- `Server=localhost` **NÃO funciona** — `localhost` dentro do container é o próprio container.
- Usar o **gateway do host**: no Docker, `extra_hosts: ["host.docker.internal:host-gateway"]`
  na definição do serviço e `Server=host.docker.internal` no `.ini`, com a **porta publicada**
  do Firebird. Sobrevive a troca de IP do host (não cravar IP fixo).

## Atrás de reverse proxy com StripPrefix
Quando o proxy (Traefik/Nginx) remove o prefixo público (`/minhaapi/ping` → `/ping`), a API
Horse deve registrar as rotas **a partir da raiz** (`/ping`, `/vendas`), não com o prefixo.
A porta interna do Horse não precisa ser única entre serviços (cada container é isolado); só o
prefixo público precisa ser único.

## Ferramentas Firebird no container (gbak/isql)
O caminho varia por imagem: imagens `jacobalberty/firebird` (2.5/3.0/4.0) usam
`/usr/local/firebird/bin`; `firebirdsql/firebird` (5.x) usa `/opt/firebird/bin`. Detectar com
`command -v isql || ls /usr/local/firebird/bin/isql /opt/firebird/bin/isql`.
