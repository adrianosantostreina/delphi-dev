# FMX: `TRectangle` com `ClipParent = True` pinta no Windows e some no Android

## Sintoma

Botões e "cards" feitos com `TRectangle` (fundo colorido, cantos arredondados) aparecem normais no
Windows. No Android **o fundo não aparece**: fica só o texto (`TLabel` filho) sobre o que estiver
atrás. Não dá erro nem warning. Outros `TRectangle` da mesma tela pintam normalmente.

Visto num app de comanda: as mesas (retângulos verdes/vermelhos com o número) viraram só números,
e o botão LOGIN perdeu o fundo laranja.

## Causa

`ClipParent = True` faz o controle **recortar o pai**: a área dele vira um "furo" no pai em vez de
ser pintada por cima. No canvas Direct2D do Windows o preenchimento continua aparecendo; no canvas
OpenGL ES do Android o recorte vence e o retângulo some.

Os 10 controles afetados tinham `ClipParent = True` sem motivo — provavelmente marcado junto com
`ClipChildren` no Object Inspector.

## Como achar

```bash
grep -n "ClipParent = True" *.fmx
```

## Correção

Tirar `ClipParent = True` (o padrão é `False`). Se a intenção era que o conteúdo não vazasse para
fora dos cantos arredondados, isso é `ClipChildren = True`, que funciona nas duas plataformas.

Visto em: Delphi 13 (RAD Studio 37.0), Android 16 no emulador, 2026-10-06.
