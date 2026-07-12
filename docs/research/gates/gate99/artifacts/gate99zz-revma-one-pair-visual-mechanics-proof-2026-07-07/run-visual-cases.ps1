$ErrorActionPreference = "Stop"

$artifact = Split-Path -Parent $MyInvocation.MyCommand.Path
$terminal = "C:\Users\User\AppData\Roaming\Five Percent Online MetaTrader 5 - alt\terminal64.exe"
$commonRoot = "C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\Common\Files"
$configDir = Join-Path $artifact "visual-configs"
$screenshotDir = Join-Path $artifact "screenshots"
$receiptDir = Join-Path $artifact "visual-receipts"
New-Item -ItemType Directory -Force -Path $configDir, $screenshotDir, $receiptDir | Out-Null

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
public static class LimniWin32 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int x, int y, int width, int height, bool repaint);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int width, int height, uint flags);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint flags);
}
"@

function Close-AltTerminals {
  Get-Process -Name terminal64 -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -like "*Five Percent Online MetaTrader 5 - alt*" } |
    ForEach-Object { $null = $_.CloseMainWindow() }
  Start-Sleep -Seconds 4
}

function Write-VisualConfig(
  [datetime]$from,
  [datetime]$to,
  [string]$label,
  [string]$folderName,
  [string]$path
) {
  $report = "Gate99ZZ_$label"
  $fromText = $from.ToString("yyyy.MM.dd")
  $toText = $to.ToString("yyyy.MM.dd")
  $content = @"
; Gate 99ZZ one-pair Revma visual mechanics proof.
; Scope: AUDCHF.i only, visual Strategy Tester, no optimization, no performance claim.
[Tester]
Expert=Limni\LimniPortfolioEA.ex5
Symbol=AUDCHF.i
Period=M1
Optimization=0
Model=2
FromDate=$fromText
ToDate=$toText
ForwardMode=0
Deposit=10000
Currency=USD
ProfitInPips=0
Leverage=100
ExecutionMode=0
OptimizationCriterion=1
Visual=1
Report=$report
ReplaceReport=1
[TesterInputs]
ExecutionMode=2||0||0||3||N
EnableTrading=true||false||0||true||N
AllowLiveTrading=false||false||0||true||N
EnableOpenOrderRouting=true||false||0||true||N
EnableCloseExecution=false||false||0||true||N
EnableAccountCloseExecution=false||false||0||true||N
EnableStrategyEvaluation=true||false||0||true||N
RequireHedgingAccount=true||false||0||true||N
RequireAllSymbols=false||false||0||true||N
BrokerSymbolSuffix=.i
UseWeekBoundaryGuard=true||false||0||true||N
BrokerToEstOffsetHours=0.0||0.0||0.000000||0.000000||N
NewsGuardMode=0||0||0||2||N
NewsCalendarFile=LimniPortfolioEA\news_events.csv
NewsBlockBeforeMinutes=30||30||1||300||N
NewsBlockAfterMinutes=30||30||1||300||N
EnablePortfolioHarvestGovernor=false||false||0||true||N
HarvestInitialTargetMoney=0.0||0.0||0.000000||0.000000||N
HarvestTrailMoney=0.0||0.0||0.000000||0.000000||N
HarvestSoftLockOnBreach=true||false||0||true||N
HarvestGridWinddownOnBreach=true||false||0||true||N
HarvestArmEmergencyLiquidation=false||false||0||true||N
EnableCurrencyExposureGuard=false||false||0||true||N
MaxCurrencySignedLots=5.0||5.0||0.100000||50.000000||N
MaxCurrencyGrossLots=10.0||10.0||0.100000||100.000000||N
MaxSameDirectionGridsPerCurrency=4||4||1||20||N
MaxManagedPositions=200||200||1||500||N
MaxSingleOrderLots=1.0||1.0||0.010000||10.000000||N
MaxClosePositionsPerStep=10||10||1||100||N
NewsMinimumImpact=3||3||1||3||N
EnableRevmaSystem=true||false||0||true||N
RevmaUniverseMode=0||0||0||1||N
RevmaEnableContinuationSleeve=true||false||0||true||N
RevmaEnableReversionSleeve=true||false||0||true||N
RevmaQProfile=1||0||0||4||N
RevmaMaxM1Bars=50000||50000||1000||250000||N
RevmaFixedLots=0.01||0.01||0.010000||1.000000||N
RevmaGridSpacingQ=0.1||1.0||0.100000||5.000000||N
RevmaIntentExpiryMinutes=10||10||1||120||N
EnableQStateTrendVariant=false||false||0||true||N
QStateFixedLots=0.01||0.01||0.010000||1.000000||N
QStateGridSpacingQ=1.0||1.0||0.100000||5.000000||N
QStateGridCap=50||50||1||500||N
QStateIntentExpiryMinutes=10||10||1||120||N
QStateReentryNextDayAfterHarvest=true||false||0||true||N
UseTimerWatchdog=false||false||0||true||N
ExportToCommonFiles=true||false||0||true||N
OutputFolder=$folderName
"@
  Set-Content -LiteralPath $path -Value $content -Encoding ASCII
}

function Capture-TerminalWindow([int]$ProcessId, [string]$path) {
  $process = Get-Process -Id $ProcessId -ErrorAction Stop
  for ($i = 0; $i -lt 30 -and $process.MainWindowHandle -eq 0; $i++) {
    Start-Sleep -Seconds 1
    $process.Refresh()
  }
  if ($process.MainWindowHandle -eq 0) {
    throw "terminal main window handle not available"
  }

  $handle = $process.MainWindowHandle
  [LimniWin32]::ShowWindow($handle, 9) | Out-Null
  [LimniWin32]::MoveWindow($handle, 40, 40, 1600, 920, $true) | Out-Null
  [LimniWin32]::SetWindowPos($handle, [IntPtr]::new(-1), 40, 40, 1600, 920, 0x0040) | Out-Null
  [LimniWin32]::SetForegroundWindow($handle) | Out-Null
  Start-Sleep -Seconds 2

  $rect = New-Object RECT
  [LimniWin32]::GetWindowRect($handle, [ref]$rect) | Out-Null
  $width = [Math]::Max(1, $rect.Right - $rect.Left)
  $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $hdc = $graphics.GetHdc()
  $printed = [LimniWin32]::PrintWindow($handle, $hdc, 2)
  $graphics.ReleaseHdc($hdc)
  if (-not $printed) {
    $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
  }
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
  [LimniWin32]::SetWindowPos($handle, [IntPtr]::new(-2), $rect.Left, $rect.Top, $width, $height, 0x0040) | Out-Null
}

$cases = @(
  [pscustomobject]@{ label = "long_above_continuation_add_higher"; from = [datetime]"2026-04-01"; to = [datetime]"2026-04-11"; expected = "LONG above anchor -> continuation -> add higher" },
  [pscustomobject]@{ label = "short_below_continuation_add_lower"; from = [datetime]"2025-02-01"; to = [datetime]"2025-02-11"; expected = "SHORT below anchor -> continuation -> add lower" },
  [pscustomobject]@{ label = "long_below_reversion_add_lower"; from = [datetime]"2025-03-01"; to = [datetime]"2025-03-11"; expected = "LONG below anchor -> reversion -> add lower" },
  [pscustomobject]@{ label = "short_above_reversion_add_higher"; from = [datetime]"2025-09-01"; to = [datetime]"2025-09-11"; expected = "SHORT above anchor -> reversion -> add higher" }
)

$results = @()
$runStamp = Get-Date -Format "yyyyMMddHHmmss"
foreach ($case in $cases) {
  Close-AltTerminals
  $folderName = "LimniPortfolioEA_Gate99ZZ_VISUAL_" + $runStamp + "_" + $case.label
  $ini = Join-Path $configDir ($case.label + ".ini")
  Write-VisualConfig -from $case.from -to $case.to -label $case.label -folderName $folderName -path $ini

  $process = Start-Process -FilePath $terminal -ArgumentList @("/config:$ini") -PassThru -WindowStyle Normal
  $common = Join-Path $commonRoot $folderName
  $receipt = $null
  $addDetected = $false
  for ($i = 0; $i -lt 600; $i++) {
    $receipt = Get-ChildItem -LiteralPath $common -Filter "*_receipts.csv" -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if ($receipt -and $receipt.Length -gt 0) {
      if (Select-String -LiteralPath $receipt.FullName -SimpleMatch "revma_grid_add" -Quiet) {
        $addDetected = $true
        break
      }
    }
    Start-Sleep -Seconds 1
  }

  $screenshotPath = Join-Path $screenshotDir ($case.label + ".png")
  Capture-TerminalWindow -ProcessId $process.Id -path $screenshotPath

  Close-AltTerminals
  $receipt = Get-ChildItem -LiteralPath $common -Filter "*_receipts.csv" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  $summary = Get-ChildItem -LiteralPath $common -Filter "*_summary.csv" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  $receiptCopy = ""
  $summaryCopy = ""
  if ($receipt) {
    $receiptCopy = Join-Path $receiptDir ($case.label + "-receipts.csv")
    Copy-Item -LiteralPath $receipt.FullName -Destination $receiptCopy -Force
  }
  if ($summary) {
    $summaryCopy = Join-Path $receiptDir ($case.label + "-summary.csv")
    Copy-Item -LiteralPath $summary.FullName -Destination $summaryCopy -Force
  }

  $results += [pscustomobject]@{
    label = $case.label
    expected = $case.expected
    from = $case.from.ToString("yyyy-MM-dd")
    to = $case.to.ToString("yyyy-MM-dd")
    add_detected = $addDetected
    screenshot = $screenshotPath
    receipt = $receiptCopy
    summary = $summaryCopy
  }
  Write-Host ("visual {0} add_detected={1} screenshot={2}" -f $case.label, $addDetected, $screenshotPath)
}

$out = Join-Path $artifact "visual-case-runs.csv"
$results | Export-Csv -LiteralPath $out -NoTypeInformation -Encoding ASCII
$results | Format-Table label,add_detected,screenshot,receipt -AutoSize | Out-String -Width 260
Write-Host "summary=$out"
