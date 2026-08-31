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
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
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
        [DelphiGui]::GetWindowRect($h, [ref]$r) | Out-Null
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
  [DelphiGui]::GetClientRect($win.Handle, [ref]$cr) | Out-Null
  $origin = New-Object DelphiGui+POINT
  [DelphiGui]::ClientToScreen($win.Handle, [ref]$origin) | Out-Null

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
  param([Parameter(Mandatory)][int]$ProcessId)
  $script:__found = @()
  Get-DelphiWindow -ProcessId $ProcessId | Out-Null
  ($script:__found | Where-Object { $_.Visible }).Count
}
