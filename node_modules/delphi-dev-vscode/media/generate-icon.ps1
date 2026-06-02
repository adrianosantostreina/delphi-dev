Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Background: VS Code dark panel color with subtle gradient
$bgRect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($bgRect,
    [System.Drawing.Color]::FromArgb(255, 30, 32, 40),
    [System.Drawing.Color]::FromArgb(255, 18, 20, 26),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)
$g.FillRectangle($bgBrush, $bgRect)

# Rounded border (visual polish)
$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 255, 255, 255)), 2
$g.DrawRectangle($borderPen, 1, 1, $size - 3, $size - 3)

# Main glyph: "D" letter, Delphi red-ish
$font = New-Object System.Drawing.Font("Segoe UI", 180, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$letterBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 240, 240, 245))
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$textRect = New-Object System.Drawing.RectangleF 0, -8, $size, $size
$g.DrawString("D", $font, $letterBrush, $textRect, $sf)

# Accent dot top-right (matches SVG circle at cx=19)
$dotColor = [System.Drawing.Color]::FromArgb(255, 239, 68, 68)
$dotBrush = New-Object System.Drawing.SolidBrush($dotColor)
$dotSize = 52
$dotX = $size - $dotSize - 22
$dotY = 22
$g.FillEllipse($dotBrush, $dotX, $dotY, $dotSize, $dotSize)

# Subtle highlight ring around dot
$dotRing = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 255, 255, 255)), 2
$g.DrawEllipse($dotRing, $dotX, $dotY, $dotSize, $dotSize)

$outPath = Join-Path $PSScriptRoot "delphi-dev-icon.png"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
$bgBrush.Dispose()
$borderPen.Dispose()
$font.Dispose()
$letterBrush.Dispose()
$dotBrush.Dispose()
$dotRing.Dispose()

Write-Host "Icon saved: $outPath"
