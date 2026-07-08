param(
    [string]$ManifestPath = "",
    [string]$ArtifactDir = "",
    [string]$TerminalId = "",
    [string]$TesterProfileSource = "",
    [string]$TesterProfileName = "LimniPortfolioEA.set",
    [string]$Symbol = "EURUSD.i",
    [string]$Period = "M1",
    [string]$FromDate = "2026.01.01",
    [string]$ToDate = "2026.01.08",
    [double]$TakeProfit = 0.001,
    [double]$StopLoss = 0.0,
    [int]$TimeoutSeconds = 240,
    [string]$Login = "",
    [string]$Server = "",
    [switch]$LeaveRunProfile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
    $root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..\..")
    return $root.Path
}

function Resolve-RepoPath([string]$repoRoot, [string]$relativePath) {
    return (Join-Path $repoRoot $relativePath)
}

function ConvertTo-WindowsPath([string]$path) {
    return $path -replace '/', '\'
}

function Assert-TerminalRoot([string]$path) {
    $resolved = (Resolve-Path -LiteralPath $path).Path
    if ($resolved -notmatch '\\MetaQuotes\\Terminal\\[A-Fa-f0-9]+\\MQL5$') {
        throw "Unexpected terminal MQL5 root: $resolved"
    }
    return $resolved
}

function Assert-PathUnder([string]$basePath, [string]$targetPath) {
    $base = (Resolve-Path -LiteralPath $basePath).Path.TrimEnd('\', '/')
    if (Test-Path -LiteralPath $targetPath) {
        $target = (Resolve-Path -LiteralPath $targetPath).Path
    } else {
        $parent = Split-Path -Parent $targetPath
        $leaf = Split-Path -Leaf $targetPath
        $target = Join-Path (Resolve-Path -LiteralPath $parent).Path $leaf
    }
    if (!$target.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to modify path outside '$base': $target"
    }
    return $target
}

function Format-InvariantDouble([double]$value, [int]$digits) {
    return $value.ToString("F$digits", [System.Globalization.CultureInfo]::InvariantCulture)
}

function Set-TesterInputLine([string[]]$lines, [string]$key, [string]$line) {
    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -like "$key=*") {
            $lines[$i] = $line
            $found = $true
        }
    }
    if (!$found) {
        $lines += $line
    }
    return ,$lines
}

function Get-ReceiptField([string]$message, [string]$key) {
    if ($message -match "(^|\|)$([regex]::Escape($key))=([^|]+)") {
        return $matches[2]
    }
    return ""
}

function Install-TesterProfile(
    [object[]]$terminals,
    [string]$sourcePath,
    [string]$profileName,
    [string]$artifactDir,
    [string]$backupPrefix
) {
    foreach ($terminal in $terminals) {
        $terminalRoot = Assert-TerminalRoot (ConvertTo-WindowsPath $terminal.mql5Root)
        $profileRoot = Join-Path $terminalRoot "Profiles\Tester"
        $target = Join-Path $profileRoot $profileName
        New-Item -ItemType Directory -Force -Path $profileRoot | Out-Null
        Assert-PathUnder $terminalRoot $target | Out-Null
        if (Test-Path -LiteralPath $target) {
            $backupName = "$backupPrefix-$($terminal.id)-$profileName"
            Copy-Item -LiteralPath $target -Destination (Join-Path $artifactDir $backupName) -Force
        }
        Copy-Item -LiteralPath $sourcePath -Destination $target -Force
    }
}

$repoRoot = Resolve-RepoRoot
if ($ManifestPath -eq "") {
    $ManifestPath = Join-Path $repoRoot "automation\mt5\terminal-roots.json"
}
$ManifestPath = (Resolve-Path -LiteralPath $ManifestPath).Path
$manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json

if ($TesterProfileSource -eq "") {
    $TesterProfileSource = Resolve-RepoPath $repoRoot "automation/mt5/tester-presets/limni-portfolio-revma-fx28-fast-smoke.set"
} elseif (![System.IO.Path]::IsPathRooted($TesterProfileSource)) {
    $TesterProfileSource = Resolve-RepoPath $repoRoot $TesterProfileSource
}
$TesterProfileSource = (Resolve-Path -LiteralPath $TesterProfileSource).Path

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
if ($ArtifactDir -eq "") {
    $ArtifactDir = Join-Path $repoRoot "docs\research\gates\gate102\artifacts\fx28-smoke-$stamp"
} elseif (![System.IO.Path]::IsPathRooted($ArtifactDir)) {
    $ArtifactDir = Join-Path $repoRoot $ArtifactDir
}
New-Item -ItemType Directory -Force -Path $ArtifactDir | Out-Null
$ArtifactDir = (Resolve-Path -LiteralPath $ArtifactDir).Path

$configuredTerminals = @($manifest.terminals)
if ($configuredTerminals.Count -eq 0) {
    throw "No terminals configured in $ManifestPath"
}

if ($TerminalId -eq "") {
    $terminal = $configuredTerminals[0]
} else {
    $terminal = @($configuredTerminals | Where-Object { $_.id -eq $TerminalId }) | Select-Object -First 1
    if ($null -eq $terminal) {
        throw "TerminalId '$TerminalId' not found in $ManifestPath"
    }
}

$terminalRoot = Assert-TerminalRoot (ConvertTo-WindowsPath $terminal.mql5Root)
$terminalExe = ConvertTo-WindowsPath $terminal.terminalExe
if (!(Test-Path -LiteralPath $terminalExe)) {
    throw "terminal64.exe missing for terminal $($terminal.id): $terminalExe"
}

$terminalDataRoot = Split-Path -Parent $terminalRoot
$terminalBaseRoot = Split-Path -Parent $terminalDataRoot
$commonFiles = Join-Path $terminalBaseRoot "Common\Files"

$outputFolder = "LimniPortfolioEA_Gate102_FX28_SMOKE_$stamp"
$runProfile = Join-Path $ArtifactDir $TesterProfileName
$tpText = Format-InvariantDouble $TakeProfit 3
$slText = Format-InvariantDouble $StopLoss 3
$profileLines = Get-Content -LiteralPath $TesterProfileSource
$profileLines = Set-TesterInputLine $profileLines "ExecutionMode" "ExecutionMode=2||0||0||3||N"
$profileLines = Set-TesterInputLine $profileLines "EnableTrading" "EnableTrading=true||false||0||true||N"
$profileLines = Set-TesterInputLine $profileLines "AllowLiveTrading" "AllowLiveTrading=false||false||0||true||N"
$profileLines = Set-TesterInputLine $profileLines "EnableOpenOrderRouting" "EnableOpenOrderRouting=true||false||0||true||N"
$profileLines = Set-TesterInputLine $profileLines "EnableCloseExecution" "EnableCloseExecution=true||false||0||true||N"
$profileLines = Set-TesterInputLine $profileLines "EnableAccountCloseExecution" "EnableAccountCloseExecution=true||false||0||true||N"
$profileLines = Set-TesterInputLine $profileLines "RequireAllSymbols" "RequireAllSymbols=true||false||0||true||N"
$profileLines = Set-TesterInputLine $profileLines "RevmaUniverseMode" "RevmaUniverseMode=1||0||0||1||N"
$profileLines = Set-TesterInputLine $profileLines "RevmaQProfile" "RevmaQProfile=0||0||0||4||N"
$profileLines = Set-TesterInputLine $profileLines "RevmaShowVisualDashboard" "RevmaShowVisualDashboard=false||false||0||true||N"
$profileLines = Set-TesterInputLine $profileLines "StopTakeProfitMode" "StopTakeProfitMode=2||0||0||2||N"
$profileLines = Set-TesterInputLine $profileLines "TakeProfit" "TakeProfit=$tpText||$tpText||0.000000||10.000000||N"
$profileLines = Set-TesterInputLine $profileLines "StopLoss" "StopLoss=$slText||$slText||0.000000||10.000000||N"
$profileLines = Set-TesterInputLine $profileLines "MaxClosePositionsPerStep" "MaxClosePositionsPerStep=50||10||1||100||N"
$profileLines = Set-TesterInputLine $profileLines "ExportToCommonFiles" "ExportToCommonFiles=true||false||0||true||N"
$profileLines = Set-TesterInputLine $profileLines "OutputFolder" "OutputFolder=$outputFolder"
Set-Content -LiteralPath $runProfile -Value $profileLines -Encoding ASCII

Install-TesterProfile $configuredTerminals $runProfile $TesterProfileName $ArtifactDir "backup-before-run-$stamp"

$report = "Gate102_FX28_SMOKE_$stamp"
$configPath = Join-Path $ArtifactDir "gate102-fx28-smoke.ini"
$configLines = New-Object System.Collections.Generic.List[string]
$configLines.Add("[Common]")
if ($Login -ne "") { $configLines.Add("Login=$Login") }
if ($Server -ne "") { $configLines.Add("Server=$Server") }
$configLines.Add("ShutdownTerminal=1")
$configLines.Add("")
$configLines.Add("[Tester]")
$configLines.Add("Expert=Limni\LimniPortfolioEA.ex5")
$configLines.Add("ExpertParameters=$TesterProfileName")
$configLines.Add("Symbol=$Symbol")
$configLines.Add("Period=$Period")
$configLines.Add("Model=2")
$configLines.Add("ExecutionMode=0")
$configLines.Add("Optimization=0")
$configLines.Add("OptimizationCriterion=1")
$configLines.Add("FromDate=$FromDate")
$configLines.Add("ToDate=$ToDate")
$configLines.Add("ForwardMode=0")
$configLines.Add("Deposit=10000")
$configLines.Add("Currency=USD")
$configLines.Add("Leverage=100")
$configLines.Add("Visual=0")
$configLines.Add("Report=$report")
$configLines.Add("ReplaceReport=1")
$configLines.Add("ShutdownTerminal=1")
Set-Content -LiteralPath $configPath -Value $configLines -Encoding ASCII

$process = $null
$timedOut = $false
try {
    $process = Start-Process -FilePath $terminalExe -ArgumentList "/config:$configPath" -PassThru -WindowStyle Hidden
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while (!$process.HasExited -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 2
        $process.Refresh()
    }
    if (!$process.HasExited) {
        $timedOut = $true
        Stop-Process -Id $process.Id -Force
        $process.WaitForExit()
    }
}
finally {
    if (!$LeaveRunProfile) {
        Install-TesterProfile $configuredTerminals $TesterProfileSource $TesterProfileName $ArtifactDir "backup-after-run-$stamp"
    }
}

$processSummary = [pscustomobject]@{
    TerminalId = $terminal.id
    Pid = if ($null -ne $process) { $process.Id } else { 0 }
    ExitCode = if ($null -ne $process) { $process.ExitCode } else { "" }
    TimedOut = $timedOut
    Config = $configPath
    RunProfile = $runProfile
    OutputFolder = $outputFolder
    Report = $report
}
$processSummary | Format-List | Out-String | Set-Content -LiteralPath (Join-Path $ArtifactDir "fx28-smoke-process.txt")

if ($timedOut) {
    Write-Error "FX28 smoke timed out after $TimeoutSeconds seconds. See $ArtifactDir"
    exit 1
}

$receiptFolder = Join-Path $commonFiles $outputFolder
if (!(Test-Path -LiteralPath $receiptFolder)) {
    Write-Error "Receipt folder missing: $receiptFolder"
    exit 1
}
$receiptPath = Get-ChildItem -LiteralPath $receiptFolder -Filter "*_receipts.csv" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
$summaryPath = Get-ChildItem -LiteralPath $receiptFolder -Filter "*_summary.csv" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if ($null -eq $receiptPath -or $null -eq $summaryPath) {
    Write-Error "Receipt or summary CSV missing in $receiptFolder"
    exit 1
}

$receipts = Import-Csv -LiteralPath $receiptPath.FullName
$summaryRows = Import-Csv -LiteralPath $summaryPath.FullName
$metrics = @{}
foreach ($row in $summaryRows) {
    $metrics[$row.metric] = $row.value
}

$runStart = @($receipts | Where-Object { $_.receipt_type -eq "run_start" -and $_.status -eq "started" } | Select-Object -First 1)
$engineRows = @($receipts | Where-Object { $_.receipt_type -eq "engine_step" })
$firstEngine = $engineRows | Select-Object -First 1
$lastEngine = $engineRows | Select-Object -Last 1
$accountExits = @($receipts | Where-Object { $_.receipt_type -eq "stop_take_profit_guard" -and $_.status -eq "account_exit_intent" })
$closeScans = @($receipts | Where-Object { $_.receipt_type -eq "order_request" -and $_.status -eq "close_scan_complete" -and $_.message -like "*close_scope=account_all_ea*" })
$intentSymbols = @($receipts | Where-Object { $_.receipt_type -eq "intent" -and $_.symbol -ne "" } | Select-Object -ExpandProperty symbol -Unique)

$closedTotal = 0
$matchedMax = 0
$closeLimitSplits = 0
foreach ($scan in $closeScans) {
    $closed = Get-ReceiptField $scan.message "closed"
    $matched = Get-ReceiptField $scan.message "matched"
    $skipped = Get-ReceiptField $scan.message "skipped_due_to_close_limit"
    if ($closed -ne "") { $closedTotal += [int]$closed }
    if ($matched -ne "") { $matchedMax = [Math]::Max($matchedMax, [int]$matched) }
    if ($skipped -ne "" -and [int]$skipped -gt 0) { $closeLimitSplits++ }
}

$failures = New-Object System.Collections.Generic.List[string]
if ($runStart.Count -eq 0) {
    $failures.Add("missing run_start")
} else {
    if ($runStart[0].message -notlike "*revma_universe_mode=FX28*") { $failures.Add("run_start revma_universe_mode is not FX28") }
    if ($runStart[0].message -notlike "*account_close_execution=true*") { $failures.Add("account close execution is not true") }
    if ($runStart[0].message -notlike "*sltp_mode=MULTI_CURRENCY_PERCENT_AFTER_FEES*") { $failures.Add("SL/TP mode is not multi-currency percent") }
}
if ($null -eq $firstEngine) {
    $failures.Add("missing engine_step receipts")
} else {
    $activeSymbolsScanned = Get-ReceiptField $firstEngine.message "active_symbols_scanned"
    $clockReadySymbols = Get-ReceiptField $firstEngine.message "clock_ready_symbols"
    $evaluatedSymbols = Get-ReceiptField $firstEngine.message "evaluated_symbols"
    if ($activeSymbolsScanned -eq "" -or [int]$activeSymbolsScanned -ne 28) { $failures.Add("first engine step did not scan 28 symbols") }
    if ($clockReadySymbols -eq "" -or [int]$clockReadySymbols -ne 28) { $failures.Add("first engine step did not have 28 clock-ready symbols") }
    if ($evaluatedSymbols -eq "" -or [int]$evaluatedSymbols -ne 28) { $failures.Add("first engine step did not evaluate 28 symbols") }
}
if ($accountExits.Count -lt 1) { $failures.Add("no account_exit_intent receipts") }
if ($closeScans.Count -lt 1) { $failures.Add("no account_all_ea close_scan_complete receipts") }
if ($closedTotal -lt 1) { $failures.Add("account close scans closed zero positions") }
if (!$metrics.ContainsKey("managed_position_count") -or [int]$metrics["managed_position_count"] -ne 0) {
    $failures.Add("final managed_position_count is not zero")
}
if (!$metrics.ContainsKey("open_position_count") -or [int]$metrics["open_position_count"] -ne 0) {
    $failures.Add("final open_position_count is not zero")
}

$proofLines = New-Object System.Collections.Generic.List[string]
$proofLines.Add("Gate102 FX28 smoke proof - $(Get-Date -Format o)")
$proofLines.Add("artifact_dir=$ArtifactDir")
$proofLines.Add("receipt_folder=$receiptFolder")
$proofLines.Add("receipts=$($receiptPath.FullName)")
$proofLines.Add("summary=$($summaryPath.FullName)")
$proofLines.Add("run_profile=$runProfile")
$proofLines.Add("terminal_id=$($terminal.id)")
$proofLines.Add("process_exit_code=$($processSummary.ExitCode)")
if ($runStart.Count -gt 0) { $proofLines.Add("run_start=$($runStart[0].message)") } else { $proofLines.Add("run_start=") }
if ($null -ne $firstEngine) { $proofLines.Add("first_engine=$($firstEngine.message)") } else { $proofLines.Add("first_engine=") }
if ($null -ne $lastEngine) { $proofLines.Add("last_engine=$($lastEngine.message)") } else { $proofLines.Add("last_engine=") }
$proofLines.Add("intent_symbol_count=$($intentSymbols.Count)")
$proofLines.Add("intent_symbols=$($intentSymbols -join ',')")
$proofLines.Add("account_exit_intents=$($accountExits.Count)")
$proofLines.Add("account_close_scans=$($closeScans.Count)")
$proofLines.Add("account_close_total_closed=$closedTotal")
$proofLines.Add("max_matched_in_close_scan=$matchedMax")
$proofLines.Add("close_limit_split_scans=$closeLimitSplits")
$proofLines.Add("final_balance=$($metrics['balance'])")
$proofLines.Add("final_open_position_count=$($metrics['open_position_count'])")
$proofLines.Add("final_managed_position_count=$($metrics['managed_position_count'])")
if ($failures.Count -gt 0) {
    $proofLines.Add("status=FAIL")
    foreach ($failure in $failures) {
        $proofLines.Add("failure=$failure")
    }
} else {
    $proofLines.Add("status=PASS")
}
$proofPath = Join-Path $ArtifactDir "fx28-smoke-proof.txt"
Set-Content -LiteralPath $proofPath -Value $proofLines -Encoding ASCII

Write-Output ($proofLines -join [Environment]::NewLine)
if ($failures.Count -gt 0) {
    Write-Error "FX28 smoke proof failed. See $proofPath"
    exit 1
}

Write-Output "FX28 smoke PASS"
