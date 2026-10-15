# [FMX/Windows] Automatizar/inspecionar um app FMX Win32 de fora do processo

Cenário: validar em runtime um app FireMonkey Win32 já compilado — tirar screenshot da
janela e clicar nos controles — a partir de um script externo (PowerShell/Python/agente).
Vale para smoke test manual, prova de que o build "abre e navega", e diagnóstico de telas
que só quebram no streaming (que o BUILD não pega).

## 1. A janela principal NÃO é a que `MainWindowHandle` devolve

Um app FMX no Windows cria **várias** janelas top-level no mesmo PID:

| Classe | O que é | Rect |
|---|---|---|
| `FMT<NomeDaClasse>` | **o form de verdade** (ex.: `FMTViewMain`, `FMTForm1`) | real |
| `TFMAppClass` | janela-fantasma da aplicação FMX | **0x0** |
| `TApplication` | compat. VCL | 0x0 |
| `TPUtilWindow` | janelas utilitárias (timers, mensagens) | 0x0 |
| `GDI+ Hook Window Class` | hook do GDI+ | 1x1 |
| `IME` / `MSCTFIME UI` | input method | 0x0 |

`(Get-Process X).MainWindowHandle` — e qualquer heurística "primeira janela top-level com
título" — devolve a **`TFMAppClass`**, que é visível mas tem `GetWindowRect` = `(0,0,0,0)`.
Resultado típico: screenshot vazio/errado e cliques em coordenada absoluta aleatória, sem
nenhum erro aparente.

**Regra:** enumerar as janelas do PID e escolher a **visível, de classe começando em `FMT`,
de maior área**.

```csharp
public static IntPtr MainVisible(int pid) {
  IntPtr best = IntPtr.Zero; int bestArea = 0;
  EnumWindows((h, l) => {
    int p; GetWindowThreadProcessId(h, out p);
    if (p != pid || !IsWindowVisible(h)) return true;
    var c = new StringBuilder(256); GetClassName(h, c, 256);
    if (!c.ToString().StartsWith("FMT")) return true;
    RECT r; GetWindowRect(h, out r);
    int area = (r.Right - r.Left) * (r.Bottom - r.Top);
    if (area > bestArea) { bestArea = area; best = h; }
    return true;
  }, IntPtr.Zero);
  return best;
}
```

**Bônus de diagnóstico:** os forms **não exibidos** também aparecem na enumeração, invisíveis,
com a classe revelando o nome (`FMTViewLogin`, `FMTViewMenu`, `FMTViewSplash`). Serve para
saber quais views já foram instanciadas — útil em apps com Router4D, onde o conteúdo é
reparented para um form hospedeiro.

## 2. Os controles não têm HWND — automação é por coordenada

FMX desenha a cena inteira num único canvas: `TButton`, `TEdit`, `TRectangle` **não são
janelas Win32**. Logo:

- UI Automation / MSAA / `FindWindowEx` / Inspect.exe **não enxergam** os controles.
- Ferramentas de automação baseadas em árvore de acessibilidade (WinAppDriver, pywinauto
  em backend `uia`) não funcionam de forma útil.
- O caminho viável é **screenshot → identificar o alvo visualmente → clicar por coordenada**
  relativa à janela (`SetCursorPos` + `mouse_event`), e `SendKeys`/`keybd_event` para texto.

Consequência prática: recalcular `GetWindowRect` **antes de cada clique**. Você não tem posse
exclusiva da máquina — o usuário pode arrastar a janela enquanto o script navega (caso real:
salto de `(690,146)` para `(233,102)` no meio de uma sessão), e a própria aplicação pode
reposicioná-la (form que se centraliza no `Show`, `ShowModal`, modo kiosk, mudança de DPI ao
arrastar para outro monitor). Cachear a origem quebra tudo em silêncio; recalcular custa uma
chamada de API. Alternativa complementar: fixar a posição com
`SetWindowPos(h, 0, X, Y, 0, 0, SWP_NOSIZE|SWP_NOZORDER)` no início da sessão.

> Nota de método: no caso real acima a causa foi **externa** (arrasto manual). O harness não
> podia tê-la movido — seu `SetWindowPos` usa `SWP_NOSIZE|SWP_NOMOVE` (`0x0003`). Não atribua
> ao FMX movimento de janela sem descartar antes o fator humano.

## 3. Foreground lock: `SetForegroundWindow` falha calado

Um processo que não está em primeiro plano **não consegue** trazer outra janela para frente —
a API retorna `false` sem erro. O sintoma é cruel: o screenshot sai com o conteúdo de **outra
aplicação** que está por cima (uma IDE, um navegador), porque a captura é da região da tela,
não da janela.

Workaround consolidado (combinar tudo — nenhum item sozinho é confiável):

```csharp
public static bool ForceForeground(IntPtr h) {
  if (h == GetForegroundWindow()) return true;
  keybd_event(0x12, 0, 0, IntPtr.Zero);   // ALT down  -> destrava o foreground lock
  keybd_event(0x12, 0, 2, IntPtr.Zero);   // ALT up
  uint fg = GetWindowThreadProcessId(GetForegroundWindow(), IntPtr.Zero);
  uint me = GetCurrentThreadId();
  uint tg = GetWindowThreadProcessId(h, IntPtr.Zero);
  AttachThreadInput(me, fg, true);
  AttachThreadInput(me, tg, true);
  ShowWindow(h, 9);                                  // SW_RESTORE
  SetWindowPos(h, (IntPtr)(-1), 0,0,0,0, 0x0003);    // HWND_TOPMOST
  SetWindowPos(h, (IntPtr)(-2), 0,0,0,0, 0x0003);    // HWND_NOTOPMOST
  BringWindowToTop(h);
  SetForegroundWindow(h);
  AttachThreadInput(me, tg, false);
  AttachThreadInput(me, fg, false);
  return h == GetForegroundWindow();  // SEMPRE conferir o retorno
}
```

**Sempre validar** comparando com `GetForegroundWindow()` e repetir uma vez; se ainda falhar,
abortar em vez de capturar lixo.

Alternativa quando não se pode roubar o foco: `PrintWindow(h, hdc, PW_RENDERFULLCONTENT=2)`
captura a janela mesmo ocluída — mas **não** permite clicar, e em FMX com render por GPU pode
voltar em branco. Serve para inspeção, não para navegação.

## 4. DPI

O processo que automatiza precisa chamar `SetProcessDPIAware()` (ou declarar DPI awareness no
manifest) **antes** de qualquer `GetWindowRect`/`CopyFromScreen`/`SetCursorPos`. Sem isso, em
monitor com escala ≠ 100% o Windows devolve coordenadas virtualizadas e todo clique cai
deslocado — de novo, sem erro nenhum.

## 5. Captura só da janela (não da tela toda)

```powershell
$r = [Win]::Rect($h)          # Left, Top, Width, Height
$bmp = New-Object System.Drawing.Bitmap($r[2], $r[3])
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r[0], $r[1], 0, 0, (New-Object System.Drawing.Size($r[2], $r[3])))
$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
```

Recortar pela `RECT` da janela, além de respeitar a privacidade do resto do desktop, faz o PNG
ter **coordenadas 1:1 com o sistema de clique** — o pixel visto no screenshot é o argumento
direto do clique relativo. Cuidado: a `RECT` inclui a barra de título, então o `(0,0)` do PNG é
o canto da janela, não da área de cliente.

## 6. Armadilhas de sequência

- **Primeiro clique engolido:** após um clique que muda o foco de um controle FMX (ex.: botão
  "C" de um numpad), o clique seguinte pode ser consumido só para restabelecer o foco. Se um
  campo precisa de N dígitos, conferir por screenshot em vez de assumir que N cliques = N
  caracteres.
- Dar `Start-Sleep` entre clique e captura (~500–800 ms): FMX anima transição de tela e o
  screenshot pega o estado intermediário.
- Numa bateria de navegação, **não confirmar** operações que gravam (fechamento de caixa,
  lançamentos, exclusões). Preferir sempre o caminho não-destrutivo do diálogo.

## Ver também

- `fmx-frames-clone-render-streaming.md` — erros de streaming que compilam mas quebram em
  runtime; é exatamente o que esse tipo de smoke test externo pega.
- `build-via-bat-com-log.md` — o build valida compilação/link, nunca o `.fmx`.
