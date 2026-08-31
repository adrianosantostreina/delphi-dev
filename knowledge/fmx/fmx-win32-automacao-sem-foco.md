# [FMX/Windows] Automatizar um app FireMonkey sem roubar foco nem mexer no cursor

Dirigir um app FMX no Windows (clicar, digitar, capturar tela) **enquanto a pessoa
continua usando a máquina**. Serve para testar o app sem depender de aparelho e
sem interromper quem está no teclado.

## O que NÃO fazer

`SetForegroundWindow` + `SetCursorPos` + `mouse_event` rouba o foco no meio da
digitação e sequestra o cursor. Sintoma real observado: a pessoa digitava, o
script mandou `cola` no campo do app e o texto dela vazou junto — o campo ficou
`tácola`.

## As três peças

| Ação | API | Por quê |
|---|---|---|
| Clique | `PostMessage` de `WM_MOUSEMOVE`/`WM_LBUTTONDOWN`/`WM_LBUTTONUP` | vai direto à fila da janela; não precisa de foco nem toca no cursor |
| Texto | `WM_CHAR` na mesma fila | não depende de foco de teclado e **não sofre com acento morto** de teclado ABNT (problema clássico do `SendKeys`) |
| Screenshot | `PrintWindow` com flag **2** (`PW_RENDERFULLCONTENT`) | captura mesmo com a janela coberta |

## Manter a janela no fundo (o ponto principal)

**Em app com navegação entre telas, o form FMX subiu na ordem-Z ao processar um
clique vindo de `PostMessage`** — só usar `PostMessage` não bastou: a janela subiu
sozinha na frente do usuário.

**Escopo dessa observação.** Ela não se reproduziu num app FMX **mínimo** (um form,
um botão) no Delphi 13/Win32: ordem-Z e `GetForegroundWindow` ficaram inalterados
depois do clique por `PostMessage`. Ou seja, a ativação vem do que o *handler* faz —
abrir ou focar outro form, por exemplo —, não do `PostMessage` em si. O
reposicionamento abaixo continua valendo a pena: é barato e cobre o caso em que a
subida acontece.

1. **Subir o app já no fundo**: após o `Start-Process`, chamar em todas as janelas
   visíveis do processo
   `SetWindowPos(h, HWND_BOTTOM, 0,0,0,0, SWP_NOMOVE or SWP_NOSIZE or SWP_NOACTIVATE)`.
2. **Devolver ao fundo depois de cada interação**: o mesmo `SetWindowPos` ao fim
   de cada clique e de cada digitação, com um `Sleep` curto antes para o FMX
   terminar de tratar a mensagem.

`SWP_NOACTIVATE` é o que evita trocar um problema por outro.

## As cinco armadilhas

**1. `Process.MainWindowHandle` é inútil.** Devolve a janela-fantasma de classe
`TFMAppClass`, muitas vezes com altura 0. A janela real do form tem classe
`FMT<NomeDoForm>` (ex.: `FMTViewMain`). Enumerar por PID e filtrar por `FMT*`.

**2. Há VÁRIAS janelas `FMT*`** — uma por form instanciado — e pode haver órfãs
**invisíveis** com a mesma classe e tamanho da real. Regra: entre as `FMT*`,
preferir sempre a **VISÍVEL de maior área**. Pegar "a de maior área" traz a órfã e
o `PrintWindow` sai **preto**.

**3. Restaurar ANTES de escolher a janela.** Com o app minimizado nenhuma `FMT*`
está visível, então a seleção cai numa órfã invisível e a captura sai preta —
mesmo restaurando logo em seguida. Ordem correta: `Restaurar` → `escolher janela`
→ `capturar`.

**4. App minimizado ⇒ captura preta.** Quem fica *iconic* é a `TFMAppClass`; os
forms apenas viram `IsWindowVisible = False`. Restaurar só o form não adianta:
`ShowWindow` na janela iconic com **`SW_SHOWNOACTIVATE` (4)**.

**5. Coordenadas.** `PostMessage` usa coordenadas de **cliente**; `PrintWindow`
captura a **janela inteira** (com barra de título). Recortar a captura na área de
cliente faz as coordenadas da imagem baterem **1:1** com as do clique. E chamar
`SetProcessDPIAware()` antes de tudo, senão em tela com escala os valores saem
errados.

## Roteiro

1. `Shot` → ler a imagem → identificar o alvo e suas coordenadas.
2. `Click x y` → `Sleep` → `Shot` de novo para confirmar.
3. Ler o log do app **em paralelo**: um `PostMessage` pode ser entregue e ainda
   assim não ter efeito se o controle FMX não estiver no estado esperado.

Dar tempo ao app recém-iniciado: clique cedo demais na primeira tela não pega.

## Melhor que clicar: modo de autoteste no próprio app

Automação de UI serve para conferir **layout**. Para lógica (rede, sessão, cache,
parsing) é mais barato e confiável um modo headless:

```
MeuApp.exe --selftest
```

roda a bateria contra a API real sem abrir interface, grava `selftest.log` ao lado
do executável e **sai com o número de falhas como exit code**.

- **Gravar o log a cada linha, não no fim** — se travar, a última linha diz onde.
- **`FindCmdLineSwitch` remove UM caractere de switch**: `--selftest` vira
  `-selftest` e **não casa** com o switch `'selftest'`. Aceitar as duas formas:
  `FindCmdLineSwitch('selftest', True) or FindCmdLineSwitch('-selftest', True)`.
- Incluir um caso de **concorrência** (N requisições em paralelo) — expõe bug de
  conexão compartilhada que teste sequencial nunca pega.

## Bônus: enumerar janelas detecta vazamento

Como o FMX cria uma janela nativa por form, listar as `FMT*` do processo é um
detector de vazamento barato. Se cada item de lista é construído como um `TForm`
e ninguém libera, as janelas acumulam — 20 `FMTCompProduto` vivas para 9 produtos
denunciou exatamente isso.

## O que pedir ao usuário

Só uma coisa: **deixar a janela aberta, mesmo atrás das outras — não minimizar.**
Minimizado o Windows para de renderizar; dá para restaurar sozinho com
`SW_SHOWNOACTIVATE`, mas custa alguns segundos por ciclo.
