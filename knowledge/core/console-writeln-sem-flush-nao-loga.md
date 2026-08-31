# App console Delphi: `Writeln` sem `Flush` não aparece em log redirecionado — e o processo morto perde tudo

Observado ao pôr uma API Horse em produção local e capturar a saída para arquivo. Vale para
**qualquer** `{$APPTYPE CONSOLE}`: servidor Horse, worker, serviço, ferramenta de linha de
comando.

## Sintoma

A app está viva e servindo requisições normalmente, mas o arquivo de captura fica com **0 bytes**:

```powershell
Start-Process .\MinhaApi.exe -RedirectStandardOutput out.txt -RedirectStandardError err.txt
# ... app responde HTTP 200 ...
Get-Item out.txt   # Length: 0
```

O `Writeln` do callback de `THorse.Listen` (ou de qualquer ponto do startup) simplesmente não
chega ao arquivo. Rodando no console interativo, a mesma linha aparece — o que faz parecer que
"funciona" e só o redirecionamento está quebrado.

## Causa

Quando `Output` é um **console**, o runtime usa buffer *line-buffered* e cada `Writeln` sai na
hora. Quando `Output` é redirecionado para **pipe ou arquivo**, o buffer passa a ser cheio
(tipicamente alguns KB) e só é descarregado quando:

- enche,
- a app termina **normalmente** (o runtime dá flush no encerramento), ou
- alguém chama `Flush(Output)` explicitamente.

Um servidor que fica rodando nunca satisfaz nenhuma das três. E se ele for encerrado à força
(`Stop-Process -Force`, `taskkill /F`, Ctrl-C sem handler), **o buffer é descartado** — a saída
some inteira, inclusive mensagens de erro que teriam explicado a falha.

## Correção

`Flush(Output)` depois de cada bloco que precisa aparecer imediatamente:

```pascal
THorse.Listen(LPorta,
  procedure
  begin
    Writeln(Format('API rodando na porta %d', [LPorta]));
    Writeln('Swagger UI: http://localhost:' + LPorta.ToString + '/swagger/doc/html');
    Flush(Output);        // <-- sem isto, nada aparece em saída redirecionada
  end);
```

Para logging de verdade — o que um servidor precisa — `Writeln` não serve de qualquer forma:
escrever em **arquivo próprio** com append e flush por linha, e nunca depender do stdout.

## Consequência que costuma passar batido

**Uma app console Delphi sem arquivo de log e sem `Flush` não deixa rastro nenhum.** Nenhuma
exception, nenhum stack, nenhum aviso de startup. Num servidor Horse, o único sinal de erro que
sobra é o corpo da resposta HTTP 500 — que exige alguém fazendo a requisição no momento exato.

Isso importa em duas situações:

1. **Diagnóstico em produção.** Sem log, "o servidor caiu" é tudo que se sabe.
2. **Automação e teste de UI/E2E.** Ferramenta que pretende ler o log do app para correlacionar
   com o que aconteceu na tela **não encontra log nenhum** — e degrada para veredito puramente
   visual sem perceber. Conferir a existência de saída real antes de assumir que há log.

## Diagnóstico rápido

```powershell
# app viva + arquivo de captura com 0 bytes = buffer retido
Get-Process -Name MinhaApi
Get-Item out.txt | Select-Object Length
```

Se a app produz saída no console interativo mas nada no redirecionamento, é buffering — não é
código que deixou de executar.

Relacionado: [`writeln-sem-console-runtime-error-217.md`](writeln-sem-console-runtime-error-217.md)
— o problema oposto: `Writeln` em app **sem** console alocado derruba com Runtime error 217.
