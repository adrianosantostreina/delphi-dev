# `E2555: Cannot capture symbol` — anônima não enxerga procedure aninhada

## Sintoma

Compila no Windows, quebra no Android (ou em qualquer alvo onde o caminho com anônima
está atrás de `{$IFDEF}`):

```
error E2555: Cannot capture symbol 'Iniciar'
```

O código parece inofensivo — uma rotina auxiliar aninhada, chamada de dentro de um
callback anônimo:

```pascal
class procedure TServico.Amostrar(const AOnPronto: TProc);

  procedure Iniciar;          // <- procedure ANINHADA
  begin
    ...
  end;

begin
{$IFDEF ANDROID}
  PermissionsService.RequestPermissions([...],
    procedure(const APermissions: TClassicStringDynArray;
      const AGrantResults: TClassicPermissionStatusDynArray)
    begin
      if Concedido then
        Iniciar;              // <- E2555 aqui
    end);
{$ELSE}
  Iniciar;                    // <- este compila normalmente
{$ENDIF}
end;
```

## Causa

Um método anônimo captura o **frame** de quem o declarou para poder sobreviver a ele.
Variáveis locais e parâmetros são movidos para esse frame. Uma **procedure aninhada**,
não: ela é código com acesso privilegiado ao frame do pai por um mecanismo diferente
(*static link*), que o closure não sabe reproduzir. O compilador recusa em vez de
gerar algo que quebraria quando a anônima rodasse depois do retorno do pai — que é
exatamente o caso de um callback de permissão do Android.

Chamar a mesma rotina **fora** da anônima compila, e é o que faz o erro aparecer só em
uma plataforma quando os dois caminhos estão sob `IFDEF`.

## Correção — promover a rotina a método

```pascal
type
  TServico = class
  private
    class procedure IniciarLeitura(const AOnPronto: TProc);   // metodo, nao aninhada
  public
    class procedure Amostrar(const AOnPronto: TProc);
  end;

class procedure TServico.Amostrar(const AOnPronto: TProc);
begin
{$IFDEF ANDROID}
  PermissionsService.RequestPermissions([...],
    procedure(const APermissions: TClassicStringDynArray;
      const AGrantResults: TClassicPermissionStatusDynArray)
    begin
      if Concedido then
        IniciarLeitura(AOnPronto);   // metodo: capturado sem problema
    end);
{$ELSE}
  IniciarLeitura(AOnPronto);
{$ENDIF}
end;
```

Métodos são capturados normalmente (a anônima guarda o `Self`). Parâmetros e locais
também. Só rotina aninhada não é.

## O que também NÃO se captura

- Variáveis declaradas em bloco `asm`.
- O contador de um `for` — capturá-lo dá `E2555` em versões antigas e, onde compila,
  o valor lido depois é indefinido. Copie para um local antes:
  ```pascal
  for I := 0 to N do
  begin
    LIndice := I;              // copia local, capturada com seguranca
    Fila.Add(procedure begin Usar(LIndice) end);
  end;
  ```

## Regra prática

Se o corpo de uma anônima precisa chamar algo seu, esse algo tem de ser **método,
parâmetro ou variável local** — nunca `procedure`/`function` aninhada.

## Ver também

- [android-permissoes-runtime.md](android-permissoes-runtime.md)
