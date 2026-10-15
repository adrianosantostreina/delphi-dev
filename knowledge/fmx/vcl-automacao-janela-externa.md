# [VCL/Windows] Automatizar um app VCL de fora do processo — muito mais fácil que FMX

Dirigir um app **VCL** no Windows (clicar, digitar, capturar) a partir de um script externo,
com a janela **atrás de tudo** e sem roubar o foco de quem está usando a máquina.

> Este arquivo é o par VCL de [fmx-automacao-windows-sem-foco.md](fmx-automacao-windows-sem-foco.md)
> e [fmx-win32-janela-automacao-externa.md](fmx-win32-janela-automacao-externa.md). **Confira o
> framework antes de escolher a técnica** — aplicar a receita de FMX num app VCL é jogar fora a
> maior vantagem que o VCL tem.

## A diferença que muda tudo

| | FireMonkey | **VCL** |
|---|---|---|
| Controles | Cena desenhada num **canvas único**; `TButton`/`TEdit` **não são janelas** | **Cada controle é uma janela Win32 real**, com HWND próprio |
| Como automatizar | screenshot → achar o alvo visualmente → clicar por **coordenada** | **enumerar controles e postar mensagem direto no HWND do controle** |
| Classe da janela principal | `FMT<NomeDoForm>`; `MainWindowHandle` devolve a `TFMAppClass` de área 0x0 | `T<NomeDaClasse>` (ex.: `TfrmPrincipal`); `MainWindowHandle` costuma acertar |
| Janelas órfãs invisíveis | comuns — captura sai preta se escolher a errada | não é problema |

Em VCL, `EnumChildWindows` + `GetClassName` + `GetWindowText` dá um inventário completo da tela:
classe, legenda, posição, visível, habilitado. É o "Inspect.exe" que o FMX não permite. Achar o
botão **pelo texto** e clicar nele é estável — não quebra quando o layout muda.

```
Classe Texto           X   Y   W  H Ativo
TPanel POLLING ATIVO 808  49 146 38  True
TPanel Pedidos         8 111 120 50  True
TPanel Configurações   8 311 120 50  True
```

`GetWindowText` num `TPanel` devolve o **Caption** — serve para conferir estado sem screenshot
(ex.: distinguir "o Caption sumiu" de "a pintura não saiu").

## As três peças

| Ação | API | Por quê |
|---|---|---|
| Clique | `PostMessage(hCtrl, WM_LBUTTONDOWN/UP, ...)` **no HWND do controle**, coordenadas de cliente (o centro serve) | não precisa de foco, não toca no cursor, não depende de o layout estar onde você achou |
| Texto | `WM_CHAR` no HWND do edit | não sofre com acento morto de teclado ABNT, ao contrário de `SendKeys` |
| Screenshot | `PrintWindow(h, hdc, 2)` (`PW_RENDERFULLCONTENT`) | captura com a janela coberta; em VCL (GDI) sai fiel — diferente de FMX com render por GPU, que pode sair em branco |

`TPanel` com `OnClick` responde a `PostMessage` normalmente: `TControl.WMLButtonUp` → `DoMouseUp`
→ `Click`.

## Manter a janela no fundo

**O VCL também ativa o form ao processar o clique**, mesmo vindo de `PostMessage`. Só postar não
basta — a janela sobe na frente do usuário. Depois de **cada** interação:

```
SetWindowPos(h, HWND_BOTTOM, 0,0,0,0, SWP_NOMOVE or SWP_NOSIZE or SWP_NOACTIVATE)
```

`SWP_NOACTIVATE` é o que evita trocar um problema por outro.

## Armadilhas

**1. `SetForegroundWindow` falha calado a partir de processo em background.** A API devolve `false`
sem erro e o `CopyFromScreen` seguinte captura **a janela que estiver por cima** — no caso real, o
e-mail pessoal do usuário. **Nunca usar captura de região de tela para inspecionar um app.**
`PrintWindow` lê o conteúdo da janela e não tem esse risco.

**2. `SetProcessDPIAware()` antes de qualquer `GetWindowRect`.** Sem isso, em monitor com escala
≠ 100% as coordenadas saem virtualizadas — sem erro nenhum.

**3. PowerShell: dentro do scriptblock do `EnumWindows`, `$x = ...` cria variável LOCAL** e o
acumulador nunca volta para a função. O sintoma é a função devolver a janela errada (ou a
`TApplication` de área 0x0) **em silêncio**. Usar um objeto por referência:

```powershell
$acc = @{ Best = [IntPtr]::Zero; Area = 0 }     # hashtable, não escalar
$cb = [W.Api+EnumProc]{
  param([IntPtr]$h, [IntPtr]$l)
  ...
  if ($a -gt $acc.Area) { $acc.Area = $a; $acc.Best = $h }
  return $true
}
```

**4. Filtrar por área > 0** já descarta a janela oculta `TApplication`, que o VCL também cria.

**5. `TLabel` não aparece na enumeração.** `TLabel`, `TSpeedButton` e afins são `TGraphicControl`
— desenham no canvas do pai e **não têm HWND**. Para conferir texto de label, ou usa screenshot,
ou põe a informação num `TPanel`.

**6. O app rodando trava o `.exe`** — o build seguinte falha com
`F2039: Could not create output file`. Encerrar o app antes de compilar. Cuidado com apps que
"fecham para a bandeja" no X: eles continuam vivos.

## Ver também

- [fmx-automacao-windows-sem-foco.md](fmx-automacao-windows-sem-foco.md) — o equivalente em FMX,
  onde a automação é obrigatoriamente por coordenada
- [build-via-bat-com-log.md](build-via-bat-com-log.md) — o build valida compilação, nunca o `.dfm`
