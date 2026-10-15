# FireDAC no Linux: erro cita `libfbembed.so`, mas o que falta é o symlink `libfbclient.so`

**Sintoma.** App Delphi (Horse/daemon) compilado para Linux64, rodando em
container, falha em **toda** operação de banco:

```
EFDException: [FireDAC][Phys][FB]-314. Cannot load vendor library
[libfbclient.so or libfbembed.so].
libfbembed.so: cannot open shared object file: No such file or directory
Hint: check it is in the PATH or application EXE directories, and has x64 bitness.
```

**A mensagem engana de duas formas:**

1. Ela nomeia **`libfbembed.so`** — a biblioteca do modo *embedded*, que quase
   ninguém usa em servidor. O FireDAC tenta `libfbclient.so` **primeiro**;
   quando falha, tenta `libfbembed.so` e **reporta apenas o último erro**. Você
   vai caçar a lib errada.
2. Ela sugere problema de PATH ou de *bitness*. Em geral não é nenhum dos dois.

**Causa real, na maioria dos casos: a lib está instalada, mas sem o alias sem
versão.** Distribuições e imagens costumam trazer:

```
libfbclient.so.3.0.11     <- arquivo real
libfbclient.so.2          -> libfbclient.so.3.0.11
libfbclient.so            <- AUSENTE (vem no pacote -dev)
```

O `dlopen` do FireDAC pede exatamente `libfbclient.so`. Sem esse symlink, não
importa que a biblioteca esteja ali, na versão certa e na arquitetura certa.

## Diagnóstico em 3 comandos

```bash
find / -name 'libfbclient*' 2>/dev/null    # a lib existe? em que nomes?
ldconfig -p | grep -i fbclient             # o loader enxerga o alias sem versao?
ls -l /usr/lib/x86_64-linux-gnu/libfbclient.so
```

Se aparecem `.so.2` e `.so.3.0.11` mas **não** o `.so` puro, é este o problema.

## Correção

**Definitiva — na imagem/host:**

```dockerfile
RUN ln -sf libfbclient.so.2 /usr/lib/x86_64-linux-gnu/libfbclient.so && ldconfig
```
ou instalar o pacote de desenvolvimento, que traz o symlink
(`firebird-dev` / `libfbclient2-dev`, conforme a distro).

**Efêmera — só para confirmar a hipótese** (some no próximo restart do
container, não serve como correção):

```bash
docker exec <container> ln -s /usr/lib/x86_64-linux-gnu/libfbclient.so.2 \
                              /usr/lib/x86_64-linux-gnu/libfbclient.so
docker exec <container> ldconfig
```

**Alternativa sem tocar no sistema** — apontar a lib pelo código, que aceita o
nome versionado:

```pascal
FDPhysFBDriverLink1.VendorLib := '/usr/lib/x86_64-linux-gnu/libfbclient.so.2';
```
Na ADRConnection isso corresponde a `FDriver.VendorLib := FParams.Lib`, ou seja
à chave `Lib` do `.ini` — útil quando não se pode alterar a imagem.

## Como isolar rápido: separe as rotas que tocam o banco

Se o serviço responde em algumas rotas e falha em outras, o padrão entrega a
causa antes de qualquer log:

| Rota | Resultado | Conclusão |
|---|---|---|
| `/version`, `/healthcheck` | 200 | processo de pé, porta e proxy certos |
| qualquer uma que consulta | 500 | é conexão com o banco, não a aplicação |

## Cuidado: o erro pode chegar disfarçado de Access Violation

Um controller que use **pool de conexões** pode mascarar isso. Quando a conexão
falha, o pool devolve um item nulo, e o código que não checa antes de usar
estoura:

```
Access violation at address 0000000000B96C65, accessing address 0000000000000000
```

Duas rotas do mesmo serviço, a mesma causa, mensagens completamente diferentes
— e a do pool manda você caçar um bug de memória que não existe. **Ao investigar
um AV em rota que usa banco, teste antes uma rota simples de consulta**: se ela
der `-314`, o AV é consequência, não causa.

Diagnosticado ao vivo em 2026-09-09: duas imagens Docker do mesmo hub, uma com
o symlink e outra sem. A API que rodava na imagem sem o alias respondia
`/version` normalmente e falhava em tudo que consultava o Firebird.
