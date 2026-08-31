# gui.ps1 — harness de automacao de app Delphi FMX no Windows.
# NUNCA pede foco: clique por PostMessage, texto por WM_CHAR, captura por PrintWindow.
# Materializado em %TEMP% pela skill delphi-e2e e carregado com dot-source.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
  throw 'gui.ps1 requer Windows: user32.dll nao existe nesta plataforma.'
}

if (-not ('DelphiGui' -as [type])) {
Add-Type -Namespace '' -Name 'DelphiGui' -MemberDefinition @'
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder name, int max);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT p);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  public struct POINT { public int X; public int Y; }
'@ -UsingNamespace System.Text
}

# Constantes Win32 usadas pelo harness.
$script:SW_SHOWNOACTIVATE = 4
$script:HWND_BOTTOM       = [IntPtr]1
$script:SWP_NOSIZE        = 0x0001
$script:SWP_NOMOVE        = 0x0002
$script:SWP_NOACTIVATE    = 0x0010
$script:PW_RENDERFULLCONTENT = 2
$script:WM_MOUSEMOVE   = 0x0200
$script:WM_LBUTTONDOWN = 0x0201
$script:WM_LBUTTONUP   = 0x0202
$script:WM_CHAR        = 0x0102
$script:WM_KEYDOWN     = 0x0100
$script:WM_KEYUP       = 0x0101

function Initialize-DelphiGui {
  # Sem isto, em tela com escala != 100% todas as coordenadas saem erradas.
  [DelphiGui]::SetProcessDPIAware() | Out-Null
}

# Default: primeiro plano (decisao 15). O modo ao fundo e OPT-IN e custa uma chamada
# extra por interacao — o FMX ATIVA o form ao processar o clique, mesmo vindo de
# PostMessage, entao sem isto a janela sobe sozinha.
$script:DelphiKeepBottom = $false

function Set-DelphiWindowBottom {
  # Reposiciona a janela para o fim da ordem-Z SEM ativa-la (SWP_NOACTIVATE) — e o
  # que evita trocar "janela sobe ao clicar" por "clique rouba foco".
  param([Parameter(Mandatory)][int]$ProcessId)
  $w = Get-DelphiWindow -ProcessId $ProcessId
  $flags = $script:SWP_NOMOVE -bor $script:SWP_NOSIZE -bor $script:SWP_NOACTIVATE
  [DelphiGui]::SetWindowPos($w.Handle, $script:HWND_BOTTOM, 0, 0, 0, 0, $flags) | Out-Null
}

function Set-DelphiBackgroundMode {
  # Liga/desliga o reposicionamento automatico apos cada clique/texto (ver
  # Invoke-DelphiClick e Send-DelphiText).
  param([Parameter(Mandatory)][bool]$Enabled)
  $script:DelphiKeepBottom = $Enabled
}

function Get-DelphiWindow {
  <#
    Devolve a janela REAL do form FMX.
    Armadilha 1: Process.MainWindowHandle devolve a fantasma TFMAppClass (as vezes altura 0).
    Armadilha 2: ha varias FMT* — inclusive orfas INVISIVEIS do mesmo tamanho da real.
                 Escolher a VISIVEL de maior area; so "maior area" traz a orfa e o
                 PrintWindow sai preto.
    Armadilha 3: restaurar ANTES de escolher — com o app minimizado nenhuma FMT* esta
                 visivel e a selecao cai numa orfa.
  #>
  param([Parameter(Mandatory)][int]$ProcessId)

  Restore-DelphiProcess -ProcessId $ProcessId

  $script:__found = @()
  $callback = [DelphiGui+EnumWindowsProc]{
    param([IntPtr]$h, [IntPtr]$l)
    $owner = [uint32]0
    [DelphiGui]::GetWindowThreadProcessId($h, [ref]$owner) | Out-Null
    if ($owner -eq $script:__targetPid) {
      $sb = New-Object System.Text.StringBuilder 256
      [DelphiGui]::GetClassName($h, $sb, $sb.Capacity) | Out-Null
      $cls = $sb.ToString()
      if ($cls -like 'FMT*') {
        $r = New-Object DelphiGui+RECT
        if (-not [DelphiGui]::GetWindowRect($h, [ref]$r)) {
          throw "GetWindowRect falhou para a janela $h (classe $cls) do processo $ProcessId."
        }
        $script:__found += [pscustomobject]@{
          Handle  = $h
          Class   = $cls
          Visible = [DelphiGui]::IsWindowVisible($h)
          Area    = [Math]::Max(0, ($r.Right - $r.Left)) * [Math]::Max(0, ($r.Bottom - $r.Top))
        }
      }
    }
    return $true
  }
  $script:__targetPid = [uint32]$ProcessId
  [DelphiGui]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null

  $win = $script:__found | Where-Object { $_.Visible -and $_.Area -gt 0 } |
         Sort-Object Area -Descending | Select-Object -First 1
  if (-not $win) {
    throw "Nenhuma janela FMT* visivel no processo $ProcessId. Janelas vistas: $($script:__found.Count)."
  }

  $cr = New-Object DelphiGui+RECT
  if (-not [DelphiGui]::GetClientRect($win.Handle, [ref]$cr)) {
    throw "GetClientRect falhou para a janela $($win.Handle) (classe $($win.Class)) do processo $ProcessId."
  }
  $origin = New-Object DelphiGui+POINT
  if (-not [DelphiGui]::ClientToScreen($win.Handle, [ref]$origin)) {
    throw "ClientToScreen falhou para a janela $($win.Handle) (classe $($win.Class)) do processo $ProcessId."
  }

  [pscustomobject]@{
    Handle        = $win.Handle
    Class         = $win.Class
    Visible       = $win.Visible
    Area          = $win.Area
    ClientWidth   = $cr.Right
    ClientHeight  = $cr.Bottom
    ClientOriginX = $origin.X
    ClientOriginY = $origin.Y
  }
}

function Find-DelphiTopWindow {
  <#
    Helper PRIVADO: enumera as janelas top-level do processo cuja classe bate com
    -ClassPattern (comparacao -like), escolhe a VISIVEL de maior area e devolve o
    mesmo formato de objeto que Get-DelphiWindow (Handle/Class/Visible/Area/
    ClientWidth/ClientHeight/ClientOriginX/ClientOriginY).
    Devolve $null quando nao acha nenhuma janela batendo com o padrao — "nao
    encontrada" e resposta legitima aqui, quem decide se e erro e o chamador.
    Get-DelphiWindow NAO usa este helper (mantem sua propria copia de proposito:
    ela LANCA quando nao acha, comportamento do qual as Tasks 1/2/4 dependem).
  #>
  param(
    [Parameter(Mandatory)][int]$ProcessId,
    [Parameter(Mandatory)][string]$ClassPattern
  )

  $script:__foundTop = @()
  $callback = [DelphiGui+EnumWindowsProc]{
    param([IntPtr]$h, [IntPtr]$l)
    $owner = [uint32]0
    [DelphiGui]::GetWindowThreadProcessId($h, [ref]$owner) | Out-Null
    if ($owner -eq $script:__targetPid) {
      $sb = New-Object System.Text.StringBuilder 256
      [DelphiGui]::GetClassName($h, $sb, $sb.Capacity) | Out-Null
      $cls = $sb.ToString()
      if ($cls -like $script:__targetClassPattern) {
        $r = New-Object DelphiGui+RECT
        if (-not [DelphiGui]::GetWindowRect($h, [ref]$r)) {
          throw "GetWindowRect falhou para a janela $h (classe $cls) do processo $ProcessId."
        }
        $script:__foundTop += [pscustomobject]@{
          Handle  = $h
          Class   = $cls
          Visible = [DelphiGui]::IsWindowVisible($h)
          Area    = [Math]::Max(0, ($r.Right - $r.Left)) * [Math]::Max(0, ($r.Bottom - $r.Top))
        }
      }
    }
    return $true
  }
  $script:__targetPid          = [uint32]$ProcessId
  $script:__targetClassPattern = $ClassPattern
  [DelphiGui]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null

  $win = $script:__foundTop | Where-Object { $_.Visible -and $_.Area -gt 0 } |
         Sort-Object Area -Descending | Select-Object -First 1
  if (-not $win) { return $null }

  $cr = New-Object DelphiGui+RECT
  if (-not [DelphiGui]::GetClientRect($win.Handle, [ref]$cr)) {
    throw "GetClientRect falhou para a janela $($win.Handle) (classe $($win.Class)) do processo $ProcessId."
  }
  $origin = New-Object DelphiGui+POINT
  if (-not [DelphiGui]::ClientToScreen($win.Handle, [ref]$origin)) {
    throw "ClientToScreen falhou para a janela $($win.Handle) (classe $($win.Class)) do processo $ProcessId."
  }

  [pscustomobject]@{
    Handle        = $win.Handle
    Class         = $win.Class
    Visible       = $win.Visible
    Area          = $win.Area
    ClientWidth   = $cr.Right
    ClientHeight  = $cr.Bottom
    ClientOriginX = $origin.X
    ClientOriginY = $origin.Y
  }
}

function Get-DelphiDialog {
  <#
    Acha o dialogo nativo (MessageBox do ShowMessage) do processo, se houver algum
    aberto. Classe #32770 e uma janela TOP-LEVEL separada do form FMX (nao comeca
    com FMT*), entao Get-DelphiWindow nunca a enxerga - e por isso o protocolo
    precisa desta busca dedicada para responder "apareceu mensagem?".
    Devolve $null quando nao ha dialogo aberto: essa e uma resposta legitima e
    frequente, NAO uma falha - por isso nao lanca excecao nesse caso.
    Wrapper fino sobre Find-DelphiTopWindow — mesmo formato de retorno que
    Get-DelphiWindow, para poder ser passado direto a Get-DelphiShot -WindowHandle.
  #>
  param([Parameter(Mandatory)][int]$ProcessId)
  Find-DelphiTopWindow -ProcessId $ProcessId -ClassPattern "#32770"
}

function Restore-DelphiProcess {
  <#
    Armadilha 4: quem fica iconic e a TFMAppClass; os forms so viram IsWindowVisible=False.
    Restaurar o form nao adianta — tem que ser ShowWindow(SW_SHOWNOACTIVATE) na iconic.
    SW_SHOWNOACTIVATE e o que evita roubar foco ao restaurar.
  #>
  param([Parameter(Mandatory)][int]$ProcessId)
  $script:__targetPid = [uint32]$ProcessId
  $cb = [DelphiGui+EnumWindowsProc]{
    param([IntPtr]$h, [IntPtr]$l)
    $owner = [uint32]0
    [DelphiGui]::GetWindowThreadProcessId($h, [ref]$owner) | Out-Null
    if ($owner -eq $script:__targetPid -and [DelphiGui]::IsIconic($h)) {
      [DelphiGui]::ShowWindow($h, $script:SW_SHOWNOACTIVATE) | Out-Null
    }
    return $true
  }
  [DelphiGui]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
  Start-Sleep -Milliseconds 300
}

function Get-DelphiFormWindowCount {
  # Bonus da spec: o FMX cria uma janela nativa por form, entao contar FMT* detecta
  # vazamento de form. Reportar quando a contagem crescer ao longo da bateria.
  # Detector, nao caminho critico: se nao houver nenhuma FMT* visivel num instante
  # transitorio (janela fechando/reabrindo), devolve 0 em vez de propagar a excecao.
  param([Parameter(Mandatory)][int]$ProcessId)
  $script:__found = @()
  try {
    Get-DelphiWindow -ProcessId $ProcessId | Out-Null
  } catch {
    return 0
  }
  ($script:__found | Where-Object { $_.Visible }).Count
}

function Get-DelphiShot {
  <#
    PrintWindow com PW_RENDERFULLCONTENT captura mesmo com a janela coberta e sem
    tocar no foco. Captura a janela INTEIRA (com barra de titulo); recortamos a area
    de cliente para as coordenadas da imagem baterem 1:1 com as do clique.
    -WindowHandle: captura essa janela diretamente em vez de resolver o form FMX
    principal via Get-DelphiWindow - usado para capturar um dialogo nativo achado
    por Get-DelphiDialog (classe #32770, fora do alcance de Get-DelphiWindow).
    Omitido, o comportamento e identico ao de antes desta opcao existir.
  #>
  param(
    [Parameter(Mandatory)][int]$ProcessId,
    [Parameter(Mandatory)][string]$Path,
    [IntPtr]$WindowHandle
  )
  Add-Type -AssemblyName System.Drawing

  if ($WindowHandle -and $WindowHandle -ne [IntPtr]::Zero) {
    $handle        = $WindowHandle
    $cr = New-Object DelphiGui+RECT
    if (-not [DelphiGui]::GetClientRect($handle, [ref]$cr)) {
      throw "GetClientRect falhou para a janela $handle."
    }
    $origin = New-Object DelphiGui+POINT
    if (-not [DelphiGui]::ClientToScreen($handle, [ref]$origin)) {
      throw "ClientToScreen falhou para a janela $handle."
    }
    $clientWidth   = $cr.Right
    $clientHeight  = $cr.Bottom
    $clientOriginX = $origin.X
    $clientOriginY = $origin.Y
  } else {
    $w = Get-DelphiWindow -ProcessId $ProcessId
    $handle        = $w.Handle
    $clientWidth   = $w.ClientWidth
    $clientHeight  = $w.ClientHeight
    $clientOriginX = $w.ClientOriginX
    $clientOriginY = $w.ClientOriginY
  }

  $r = New-Object DelphiGui+RECT
  [DelphiGui]::GetWindowRect($handle, [ref]$r) | Out-Null
  $fullW = $r.Right - $r.Left
  $fullH = $r.Bottom - $r.Top
  if ($fullW -le 0 -or $fullH -le 0) { throw "Janela com dimensao invalida: ${fullW}x${fullH}." }

  $bmp = New-Object System.Drawing.Bitmap $fullW, $fullH
  try {
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $hdc = $gfx.GetHdc()
    $ok  = [DelphiGui]::PrintWindow($handle, $hdc, $script:PW_RENDERFULLCONTENT)
    $gfx.ReleaseHdc($hdc)
    $gfx.Dispose()
    if (-not $ok) { throw 'PrintWindow falhou.' }

    # Recorte para a area de cliente: a origem do cliente em coordenadas de tela menos
    # a origem da janela da o deslocamento da borda/titulo.
    $offX = $clientOriginX - $r.Left
    $offY = $clientOriginY - $r.Top
    $rect = New-Object System.Drawing.Rectangle $offX, $offY, $clientWidth, $clientHeight
    $client = $bmp.Clone($rect, $bmp.PixelFormat)
    try {
      $dir = Split-Path -Parent $Path
      if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
      $client.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $client.Dispose()
    }
  } finally {
    $bmp.Dispose()
  }
  $Path
}

function Test-DelphiShotIsBlank {
  # Captura preta = escolhemos uma janela orfa (armadilha 2/3). Detectar em vez de
  # devolver evidencia inutil ao relatorio.
  param([Parameter(Mandatory)][string]$Path)
  Add-Type -AssemblyName System.Drawing
  $bmp = [System.Drawing.Bitmap]::FromFile($Path)
  try {
    $step = [Math]::Max(1, [int]($bmp.Width / 20))
    foreach ($x in 0..([int]($bmp.Width / $step) - 1)) {
      foreach ($y in 0..([int]($bmp.Height / $step) - 1)) {
        $c = $bmp.GetPixel($x * $step, $y * $step)
        if ($c.R -ne 0 -or $c.G -ne 0 -or $c.B -ne 0) { return $false }
      }
    }
    return $true
  } finally { $bmp.Dispose() }
}

function Invoke-DelphiClick {
  <#
    PostMessage entrega direto na fila da janela: nao precisa de foco e nao move o cursor.
    Coordenadas sao de CLIENTE — as mesmas da imagem recortada por Get-DelphiShot.
  #>
  param(
    [Parameter(Mandatory)][int]$ProcessId,
    [Parameter(Mandatory)][int]$X,
    [Parameter(Mandatory)][int]$Y,
    [int]$SettleMs = 250
  )
  $w = Get-DelphiWindow -ProcessId $ProcessId
  if ($X -lt 0 -or $Y -lt 0 -or $X -ge $w.ClientWidth -or $Y -ge $w.ClientHeight) {
    throw "Coordenada ($X,$Y) fora da area de cliente ($($w.ClientWidth)x$($w.ClientHeight))."
  }
  $lParam = [IntPtr](($Y -shl 16) -bor ($X -band 0xFFFF))
  [DelphiGui]::PostMessage($w.Handle, $script:WM_MOUSEMOVE,   [IntPtr]::Zero, $lParam) | Out-Null
  [DelphiGui]::PostMessage($w.Handle, $script:WM_LBUTTONDOWN, [IntPtr]1,      $lParam) | Out-Null
  [DelphiGui]::PostMessage($w.Handle, $script:WM_LBUTTONUP,   [IntPtr]::Zero, $lParam) | Out-Null
  Start-Sleep -Milliseconds $SettleMs
  if ($script:DelphiKeepBottom) { Set-DelphiWindowBottom -ProcessId $ProcessId }
}

function Send-DelphiText {
  <#
    WM_CHAR nao depende de foco de teclado e NAO sofre com acento morto de teclado ABNT
    (problema classico do SendKeys).
  #>
  param(
    [Parameter(Mandatory)][int]$ProcessId,
    [Parameter(Mandatory)][AllowEmptyString()][string]$Text,
    [int]$PerCharMs = 20
  )
  $w = Get-DelphiWindow -ProcessId $ProcessId
  foreach ($ch in $Text.ToCharArray()) {
    [DelphiGui]::PostMessage($w.Handle, $script:WM_CHAR, [IntPtr][int]$ch, [IntPtr]::Zero) | Out-Null
    Start-Sleep -Milliseconds $PerCharMs
  }
  if ($script:DelphiKeepBottom) { Set-DelphiWindowBottom -ProcessId $ProcessId }
}

function Send-DelphiKey {
  # Teclas sem caractere: Esc = 27, Enter = 13, Tab = 9, Backspace = 8.
  param(
    [Parameter(Mandatory)][int]$ProcessId,
    [Parameter(Mandatory)][int]$VirtualKey,
    [int]$SettleMs = 200
  )
  $w = Get-DelphiWindow -ProcessId $ProcessId
  [DelphiGui]::PostMessage($w.Handle, $script:WM_KEYDOWN, [IntPtr]$VirtualKey, [IntPtr]::Zero) | Out-Null
  [DelphiGui]::PostMessage($w.Handle, $script:WM_KEYUP,   [IntPtr]$VirtualKey, [IntPtr]::Zero) | Out-Null
  Start-Sleep -Milliseconds $SettleMs
}
