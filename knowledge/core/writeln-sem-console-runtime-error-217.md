# WriteLn/console em `initialization` quebra apps GUI/Service (Runtime error N, sem log nenhum)

## Sintoma

Um `.exe` GUI (VCL Forms Application, `TServiceApplication`/`Vcl.SvcMgr`,
FMX, etc.) mostra, ao iniciar, o dialog genérico do Windows:

```
Error - Runtime error <N> at <ENDEREÇO>
```

com o mesmo endereço toda vez (determinístico, reproduzível), **sem
nenhuma exceção Delphi capturável** — nem um `try/except` envolvendo
`Application.Initialize`/`CreateForm`/`Run` no `.dpr` pega nada, e nenhum
log de diagnóstico (mesmo um que envolva `ServiceCreate`/`FormCreate`/etc.)
chega a ser escrito. Acontece mesmo sem nenhum parâmetro especial — só de
rodar o `.exe`.

## Causa raiz

Alguma unit no `uses` (direto ou transitivo) tem, na sua seção
`initialization`, uma chamada que usa **I/O de console** — `WriteLn`,
`ReadLn`, `Write`, ou qualquer coisa que dependa de `System.Output`/
`System.Input` (as `TextFile` padrão que só existem de verdade quando o
processo tem um **console anexado**).

Isso é comum em código compartilhado entre um app **console**
(`{$APPTYPE CONSOLE}`, ex. uma API Horse rodando como `.exe` de linha de
comando) e um app **GUI/Service** que reaproveita a mesma unit de
infraestrutura (ex. a mesma API, agora hospedada como Windows Service via
`Vcl.SvcMgr`, ou uma versão desktop via `Vcl.Forms`/`FMX.Forms`) — o app
console tem console de verdade (`WriteLn` funciona), o app GUI/Service
**não tem nenhum console anexado** (`WriteLn` não tem onde escrever).

Uma seção `initialization` roda **antes** do `begin/end` do `.dpr`, e mais
cedo ainda: roda antes de `System.SysUtils` terminar sua própria
inicialização — que é o ponto em que a RTL instala o hook que converte
erros de runtime numéricos (I/O error, abstract error, etc.) em objetos
`Exception` Delphi normais, capturáveis por `try/except`. Um erro de
runtime que aconteça **antes** desse hook estar pronto não vira uma
`Exception` normal — cai direto no handler de baixíssimo nível da RTL, que
mostra esse dialog genérico "Runtime error N at ADDRESS" e mata o processo,
**sem propagar nada capturável**. Isso explica por que nenhum
`try/except`/log de diagnóstico do app pega o erro, mesmo que o `.dpr`
tenha uma rede de segurança bem montada em volta do `begin/end`.

## Diagnóstico

1. Confirmar que nenhum log é escrito mesmo com `try/except` amplo no
   `.dpr` e logging no `FormCreate`/`ServiceCreate` — indício forte de
   crash em `initialization`, antes do `.dpr` rodar.
2. Reproduzir **localmente**, se possível: rodar o `.exe` puro (sem
   parâmetros especiais, sem precisar `/install` nem admin) já é
   suficiente na maioria dos casos, porque o bug está em `initialization`,
   que roda incondicionalmente, independente de qualquer parâmetro de
   linha de comando.
3. Bissecção do `.dpr`: comentar blocos de units do `uses` (metade de
   cada vez) até achar o mínimo que ainda reproduz o crash — mais
   confiável e rápido que tentar decifrar o endereço via `.map` (ver
   nota abaixo sobre por que a correlação por endereço pode não bater).
4. Depois de achar a unit suspeita, procurar `initialization` nela e nas
   units que ela usa, atrás de `WriteLn`/`Write`/`ReadLn`/qualquer coisa
   que dependa de console.

### Nota sobre correlação por endereço via `.map`

Em teoria, com `<DCC_MapFile>3</DCC_MapFile>` (Detailed) no `.dproj` e um
crash reproduzido **na mesma build exata** que gerou o `.map`, dá pra achar
a rotina: o endereço do dialog é **absoluto**; o `.map` lista offsets
**relativos ao início de cada segmento** (campo "Start" do cabeçalho, ex.
`0001:00401000` — não é o `ImageBase` bruto `0x00400000`). Depois de achar
a rotina pelo endereço mais próximo (≤) na seção "Address Publics by
Value", o endereço reportado no dialog é o **endereço de retorno de quem
fez a chamada que falhou** (não o endereço interno da rotina de erro em
si). Na prática, essa correlação só é confiável se o endereço do crash for
da **mesma build** que gerou o `.map` — um endereço de um build antigo
(já sobrescrito) ou de uma máquina com política de ASLR/relocação
diferente não bate com o `.map` atual, e tentar forçar a conta dá um
resultado sem sentido (ex. offset maior que o tamanho total do módulo
mapeado). Nesse caso, é mais produtivo reproduzir o crash ao vivo (mesmo
que numa máquina de dev, não no servidor) e bissectar o `uses`, que não
depende de endereço nenhum.

## Correção

Guardar a chamada de I/O de console com o global `IsConsole` (`System.pas`,
sempre disponível, não precisa de `uses` extra) — `True` só em apps
`{$APPTYPE CONSOLE}`:

```pascal
initialization
  if IsConsole then
    ShowLogo; // ou qualquer WriteLn direto aqui
end.
```

Isso preserva 100% do comportamento do app console (continua imprimindo
normalmente) e elimina o crash em qualquer consumidor GUI/Service da mesma
unit compartilhada (`IsConsole = False` ali, a chamada simplesmente não
roda). Alternativa mais invasiva (evitar se a unit for compartilhada): mover
a chamada de dentro de `initialization` para o `begin/end` do `.dpr` do app
console especificamente — funciona, mas exige tocar em mais de um lugar e
perde a conveniência de "só dar uses que já configura sozinho".

## Caso real (2026-08-25)

Projeto Horse API com dois `.dpr`: `business.dpr` (console,
`{$APPTYPE CONSOLE}`) e um `G2ServiceForcaVendas.dpr` novo (Windows
Service via `Vcl.SvcMgr`), compartilhando toda a infraestrutura
(`controller`/`dao`/`model`/`sql`/`infra`) via `uses ... in '..\pasta\'`.
Uma unit de utilidades genéricas (`G2.Infra.Functions.pas`) tinha
`initialization: ShowLogo;`, e `ShowLogo` só continha uma sequência de
`WriteLn` desenhando um logo ASCII — decoração de banner do console,
inofensiva no `business.exe`, fatal no `G2ServiceForcaVendas.exe`.
