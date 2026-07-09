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
    [ValidateSet("FAST_5000", "MEDIUM_50000", "SLOW_250000", "FULL_ALL")]
    [string]$QProfile = "FAST_5000",
    [ValidateSet("OpenPrices", "M1OHLC", "EveryTick")]
    [string]$TesterModel = "OpenPrices",
    [double]$TakeProfit = 0.001,
    [double]$StopLoss = 0.0,
    [ValidateSet("Full", "CompactLongRun")]
    [string]$ReceiptMode = "Full",
    [int]$TimeoutSeconds = 240,
    [int]$PostExitReceiptWaitSeconds = 45,
    [string]$Login = "",
    [string]$Server = "",
    [switch]$BenchmarkMode,
    [string]$OutputFolderName = "",
    [string]$ShardId = "",
    [switch]$SkipReceiptHistogram,
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

function Format-OutputDecimalPart([double]$value, [int]$digits) {
    return (Format-InvariantDouble $value $digits).Replace("-", "m").Replace(".", "p")
}

function Get-ReceiptModeInputValue([string]$mode) {
    if ($mode -eq "CompactLongRun") {
        return 1
    }
    return 0
}

function Get-ReceiptModeOutputPart([string]$mode) {
    if ($mode -eq "CompactLongRun") {
        return "RC"
    }
    return "RF"
}

function Get-QProfileOutputPart([string]$profile) {
    if ($profile -eq "FAST_5000") { return "F5K" }
    if ($profile -eq "MEDIUM_50000") { return "M50K" }
    if ($profile -eq "SLOW_250000") { return "S250K" }
    if ($profile -eq "FULL_ALL") { return "FULL" }
    return $profile
}

function Get-FileSha256([string]$path) {
    if ($path -eq "" -or !(Test-Path -LiteralPath $path)) {
        return ""
    }
    return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
}

function Write-ReceiptHistogram([string]$receiptCsv, [string]$artifactDir) {
    $typeCounts = @{}
    $typeStatusCounts = @{}
    $rowCount = 0
    Import-Csv -LiteralPath $receiptCsv | ForEach-Object {
        $rowCount++
        $type = $_.receipt_type
        $status = $_.status
        if ($type -eq $null -or $type -eq "") { $type = "<blank>" }
        if ($status -eq $null -or $status -eq "") { $status = "<blank>" }
        if (!$typeCounts.ContainsKey($type)) { $typeCounts[$type] = 0 }
        $typeCounts[$type]++
        $typeStatusKey = "$type`t$status"
        if (!$typeStatusCounts.ContainsKey($typeStatusKey)) { $typeStatusCounts[$typeStatusKey] = 0 }
        $typeStatusCounts[$typeStatusKey]++
    }

    $byTypePath = Join-Path $artifactDir "fx28-receipt-type-histogram.csv"
    $byStatusPath = Join-Path $artifactDir "fx28-receipt-type-status-histogram.csv"
    $typeCounts.GetEnumerator() |
        Sort-Object Name |
        ForEach-Object { [pscustomobject]@{ receipt_type = $_.Key; count = $_.Value } } |
        Export-Csv -LiteralPath $byTypePath -NoTypeInformation
    $typeStatusCounts.GetEnumerator() |
        Sort-Object Name |
        ForEach-Object {
            $parts = $_.Key -split "`t", 2
            [pscustomobject]@{ receipt_type = $parts[0]; status = $parts[1]; count = $_.Value }
        } |
        Export-Csv -LiteralPath $byStatusPath -NoTypeInformation

    return [pscustomobject]@{
        ReceiptRows = $rowCount
        TypeHistogram = $byTypePath
        TypeStatusHistogram = $byStatusPath
    }
}

function Write-BenchmarkNoReceipt(
    [string]$artifactDir,
    [string]$status,
    [string]$reason,
    [object]$terminal,
    [object]$process,
    [bool]$timedOut,
    [datetime]$runStartedAt,
    [datetime]$runEndedAt,
    [string]$qProfile,
    [string]$testerModel,
    [int]$testerModelValue,
    [string]$receiptMode,
    [string]$fromDate,
    [string]$toDate,
    [string]$tpText,
    [string]$slText,
    [string]$outputFolder,
    [string]$runManifestPath
) {
    $processExitCode = if ($null -ne $process -and $process.ExitCode -ne $null) { [int]$process.ExitCode } else { "" }
    $benchmarkPath = Join-Path $artifactDir "fx28-speed-benchmark.txt"
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("Gate104 FX28 tester speed benchmark - $(Get-Date -Format o)")
    $lines.Add("artifact_dir=$artifactDir")
    $lines.Add("terminal_id=$($terminal.id)")
    $lines.Add("q_profile=$qProfile")
    $lines.Add("tester_model=$testerModel")
    $lines.Add("tester_model_value=$testerModelValue")
    $lines.Add("receipt_mode=$receiptMode")
    $lines.Add("process_exit_code=$processExitCode")
    $lines.Add("timed_out=$timedOut")
    $lines.Add("from_date=$fromDate")
    $lines.Add("to_date=$toDate")
    $lines.Add("take_profit=$tpText")
    $lines.Add("stop_loss=$slText")
    $lines.Add("wall_seconds=$([Math]::Round(($runEndedAt - $runStartedAt).TotalSeconds, 3))")
    $lines.Add("output_folder=$outputFolder")
    $lines.Add("run_manifest=$runManifestPath")
    $lines.Add("status=$status")
    $lines.Add("reason=$reason")
    $lines.Add("strategy_evidence=false")
    Set-Content -LiteralPath $benchmarkPath -Value $lines -Encoding ASCII
    Write-Output ($lines -join [Environment]::NewLine)
}

function Find-ReceiptFolder(
    [string]$commonFiles,
    [string]$outputFolder,
    [string]$outputFolderPrefix,
    [datetime]$runStartedAt
) {
    return Get-ChildItem -LiteralPath $commonFiles -Directory |
        Where-Object {
            if ($outputFolder -eq "AUTO") {
                $_.Name -like "$outputFolderPrefix*" -and $_.LastWriteTime -ge $runStartedAt.AddMinutes(-1)
            } else {
                $_.Name -eq $outputFolder
            }
        } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
}

function Get-QProfileInputValue([string]$profile) {
    if ($profile -eq "MEDIUM_50000") { return 1 }
    if ($profile -eq "SLOW_250000") { return 2 }
    if ($profile -eq "FULL_ALL") { return 3 }
    return 0
}

function Get-QProfileCustomBars([string]$profile) {
    if ($profile -eq "FAST_5000") { return 5000 }
    if ($profile -eq "MEDIUM_50000") { return 50000 }
    if ($profile -eq "SLOW_250000") { return 250000 }
    return 0
}

function Get-TesterModelValue([string]$model) {
    if ($model -eq "M1OHLC") { return 1 }
    if ($model -eq "EveryTick") { return 0 }
    return 2
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

function Get-FileLineCount([string]$path) {
    $count = 0
    foreach ($line in [System.IO.File]::ReadLines($path)) {
        $count++
    }
    return $count
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

$tpPart = Format-OutputDecimalPart $TakeProfit 3
$slPart = Format-OutputDecimalPart $StopLoss 3
$receiptModeInput = Get-ReceiptModeInputValue $ReceiptMode
$receiptModePart = Get-ReceiptModeOutputPart $ReceiptMode
$qProfileInput = Get-QProfileInputValue $QProfile
$qProfileCustomBars = Get-QProfileCustomBars $QProfile
$testerModelValue = Get-TesterModelValue $TesterModel
$qProfilePart = Get-QProfileOutputPart $QProfile
if ($OutputFolderName -ne "") {
    $outputFolder = $OutputFolderName
} elseif ($BenchmarkMode) {
    $shardPart = if ($ShardId -ne "") { "_$($ShardId)" } else { "" }
    $outputFolder = "LPEA_Rv_FX28_${qProfilePart}_${TesterModel}_${receiptModePart}_TP${tpPart}_SL${slPart}${shardPart}_$stamp"
} else {
    $outputFolder = "AUTO"
}
$outputFolderPrefix = if ($outputFolder -eq "AUTO") {
    "LimniPortfolioEA_Rv_FX28_${QProfile}_APct_TP${tpPart}_SL${slPart}_L0p010_G0p10Q_${receiptModePart}_NCG_NEG_AC_"
} else {
    $outputFolder
}
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
$profileLines = Set-TesterInputLine $profileLines "RevmaQProfile" "RevmaQProfile=$qProfileInput||0||0||4||N"
$profileLines = Set-TesterInputLine $profileLines "RevmaCustomMaxM1Bars" "RevmaCustomMaxM1Bars=$qProfileCustomBars||5000||1000||250000||N"
$profileLines = Set-TesterInputLine $profileLines "RevmaShowVisualDashboard" "RevmaShowVisualDashboard=false||false||0||true||N"
$profileLines = Set-TesterInputLine $profileLines "StopTakeProfitMode" "StopTakeProfitMode=2||0||0||2||N"
$profileLines = Set-TesterInputLine $profileLines "TakeProfit" "TakeProfit=$tpText||$tpText||0.000000||10.000000||N"
$profileLines = Set-TesterInputLine $profileLines "StopLoss" "StopLoss=$slText||$slText||0.000000||10.000000||N"
$profileLines = Set-TesterInputLine $profileLines "MaxClosePositionsPerStep" "MaxClosePositionsPerStep=50||10||1||100||N"
$profileLines = Set-TesterInputLine $profileLines "ExportToCommonFiles" "ExportToCommonFiles=true||false||0||true||N"
$profileLines = Set-TesterInputLine $profileLines "ReceiptMode" "ReceiptMode=$receiptModeInput||0||0||1||N"
$profileLines = Set-TesterInputLine $profileLines "OutputFolder" "OutputFolder=$outputFolder"
Set-Content -LiteralPath $runProfile -Value $profileLines -Encoding ASCII

$runTerminals = @($configuredTerminals)
Install-TesterProfile $runTerminals $runProfile $TesterProfileName $ArtifactDir "backup-before-run-$stamp"

$reportScope = if ($BenchmarkMode) { "GATE104_SPEED" } else { "Gate102_FX28_SMOKE" }
$report = "${reportScope}_${QProfile}_${TesterModel}_$stamp"
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
$configLines.Add("Model=$testerModelValue")
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

$runManifestPath = Join-Path $ArtifactDir "fx28-run-manifest.json"
$runManifest = [ordered]@{
    generated_at = (Get-Date).ToString("o")
    terminal_id = $terminal.id
    terminal_role = $terminal.role
    terminal_exe = $terminalExe
    terminal_mql5_root = $terminalRoot
    symbol = $Symbol
    period = $Period
    from_date = $FromDate
    to_date = $ToDate
    q_profile = $QProfile
    tester_model = $TesterModel
    tester_model_value = $testerModelValue
    take_profit = $tpText
    stop_loss = $slText
    receipt_mode = $ReceiptMode
    benchmark_mode = [bool]$BenchmarkMode
    timeout_seconds = $TimeoutSeconds
    post_exit_receipt_wait_seconds = $PostExitReceiptWaitSeconds
    output_folder = $outputFolder
    output_folder_prefix = $outputFolderPrefix
    shard_id = $ShardId
    tester_profile_name = $TesterProfileName
    tester_profile_source = $TesterProfileSource
    tester_profile_source_sha256 = Get-FileSha256 $TesterProfileSource
    generated_profile = $runProfile
    generated_profile_sha256 = Get-FileSha256 $runProfile
    tester_config = $configPath
    tester_config_sha256 = Get-FileSha256 $configPath
    manifest_path = $ManifestPath
    manifest_sha256 = Get-FileSha256 $ManifestPath
}
$runManifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $runManifestPath -Encoding ASCII

$process = $null
$timedOut = $false
$runStartedAt = Get-Date
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
        Install-TesterProfile $runTerminals $TesterProfileSource $TesterProfileName $ArtifactDir "backup-after-run-$stamp"
    }
}
$runEndedAt = Get-Date

$processSummary = [pscustomobject]@{
    TerminalId = $terminal.id
    Pid = if ($null -ne $process) { $process.Id } else { 0 }
    ExitCode = if ($null -ne $process) { $process.ExitCode } else { "" }
    TimedOut = $timedOut
    QProfile = $QProfile
    TesterModel = $TesterModel
    TesterModelValue = $testerModelValue
    ReceiptMode = $ReceiptMode
    BenchmarkMode = [bool]$BenchmarkMode
    StartedAt = $runStartedAt.ToString("o")
    EndedAt = $runEndedAt.ToString("o")
    WallSeconds = [Math]::Round(($runEndedAt - $runStartedAt).TotalSeconds, 3)
    Config = $configPath
    RunProfile = $runProfile
    RunManifest = $runManifestPath
    RunProfileSha256 = Get-FileSha256 $runProfile
    TesterConfigSha256 = Get-FileSha256 $configPath
    OutputFolder = $outputFolder
    OutputFolderPrefix = $outputFolderPrefix
    Report = $report
}
$processSummary | Format-List | Out-String | Set-Content -LiteralPath (Join-Path $ArtifactDir "fx28-smoke-process.txt")

if ($timedOut -and !$BenchmarkMode) {
    Write-Error "FX28 smoke timed out after $TimeoutSeconds seconds. See $ArtifactDir"
    exit 1
}

$receiptFolderItem = Find-ReceiptFolder $commonFiles $outputFolder $outputFolderPrefix $runStartedAt
if ($null -eq $receiptFolderItem -and !$timedOut -and $PostExitReceiptWaitSeconds -gt 0) {
    $postExitDeadline = (Get-Date).AddSeconds($PostExitReceiptWaitSeconds)
    while ($null -eq $receiptFolderItem -and (Get-Date) -lt $postExitDeadline) {
        Start-Sleep -Seconds 2
        $receiptFolderItem = Find-ReceiptFolder $commonFiles $outputFolder $outputFolderPrefix $runStartedAt
    }
}
if ($null -eq $receiptFolderItem) {
    if ($BenchmarkMode) {
        $status = if ($timedOut) { "TIMED_OUT_BENCHMARK_NO_RECEIPTS" } else { "MISSING_RECEIPTS_BENCHMARK" }
        Write-BenchmarkNoReceipt $ArtifactDir $status "receipt folder missing for prefix: $outputFolderPrefix" $terminal $process $timedOut $runStartedAt $runEndedAt $QProfile $TesterModel $testerModelValue $ReceiptMode $FromDate $ToDate $tpText $slText $outputFolder $runManifestPath
    }
    Write-Error "Receipt folder missing for prefix: $outputFolderPrefix"
    exit 1
}
$receiptFolder = $receiptFolderItem.FullName
$receiptPath = Get-ChildItem -LiteralPath $receiptFolder -Filter "*_receipts.csv" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
$summaryPath = Get-ChildItem -LiteralPath $receiptFolder -Filter "*_summary.csv" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if ($null -eq $receiptPath -or $null -eq $summaryPath) {
    if ($BenchmarkMode) {
        $status = if ($timedOut) { "TIMED_OUT_BENCHMARK_INCOMPLETE_RECEIPTS" } else { "MISSING_RECEIPTS_BENCHMARK" }
        Write-BenchmarkNoReceipt $ArtifactDir $status "receipt or summary CSV missing in $receiptFolder" $terminal $process $timedOut $runStartedAt $runEndedAt $QProfile $TesterModel $testerModelValue $ReceiptMode $FromDate $ToDate $tpText $slText $outputFolder $runManifestPath
    }
    Write-Error "Receipt or summary CSV missing in $receiptFolder"
    exit 1
}

$summaryRows = Import-Csv -LiteralPath $summaryPath.FullName
$metrics = @{}
foreach ($row in $summaryRows) {
    $metrics[$row.metric] = $row.value
}

if ($BenchmarkMode) {
    $processExitCode = if ($null -ne $process -and $process.ExitCode -ne $null) { [int]$process.ExitCode } else { 0 }
    $benchmarkStatus = "PASS_BENCHMARK_RECEIPTS_PRESENT"
    if ($timedOut) {
        $benchmarkStatus = "TIMED_OUT_BENCHMARK"
    } elseif ($processExitCode -ne 0) {
        $benchmarkStatus = "STOPPED_OR_FAILED_BENCHMARK"
    }

    $receiptLineCount = Get-FileLineCount $receiptPath.FullName
    $receiptDataRows = [Math]::Max(0, $receiptLineCount - 1)
    $headerLine = Get-Content -LiteralPath $receiptPath.FullName -TotalCount 1
    $headRows = @(Get-Content -LiteralPath $receiptPath.FullName -TotalCount 40 | ConvertFrom-Csv)
    $runStart = @($headRows | Where-Object { $_.receipt_type -eq "run_start" -and $_.status -eq "started" } | Select-Object -First 1)
    $firstEngine = @($headRows | Where-Object { $_.receipt_type -eq "engine_step" } | Select-Object -First 1)
    $tailLines = @(Get-Content -LiteralPath $receiptPath.FullName -Tail 800)
    $tailRows = @(@($headerLine) + $tailLines | ConvertFrom-Csv)
    $lastEngine = @($tailRows | Where-Object { $_.receipt_type -eq "engine_step" } | Select-Object -Last 1)
    $histogram = $null
    if (!$SkipReceiptHistogram) {
        $histogram = Write-ReceiptHistogram $receiptPath.FullName $ArtifactDir
    }

    $benchmarkLines = New-Object System.Collections.Generic.List[string]
    $benchmarkLines.Add("Gate104 FX28 tester speed benchmark - $(Get-Date -Format o)")
    $benchmarkLines.Add("artifact_dir=$ArtifactDir")
    $benchmarkLines.Add("terminal_id=$($terminal.id)")
    $benchmarkLines.Add("q_profile=$QProfile")
    $benchmarkLines.Add("tester_model=$TesterModel")
    $benchmarkLines.Add("tester_model_value=$testerModelValue")
    $benchmarkLines.Add("receipt_mode=$ReceiptMode")
    $benchmarkLines.Add("process_exit_code=$processExitCode")
    $benchmarkLines.Add("timed_out=$timedOut")
    $benchmarkLines.Add("from_date=$FromDate")
    $benchmarkLines.Add("to_date=$ToDate")
    $benchmarkLines.Add("take_profit=$tpText")
    $benchmarkLines.Add("stop_loss=$slText")
    $benchmarkLines.Add("wall_seconds=$([Math]::Round(($runEndedAt - $runStartedAt).TotalSeconds, 3))")
    $benchmarkLines.Add("receipt_folder=$receiptFolder")
    $benchmarkLines.Add("output_folder=$outputFolder")
    $benchmarkLines.Add("receipts=$($receiptPath.FullName)")
    $benchmarkLines.Add("summary=$($summaryPath.FullName)")
    $benchmarkLines.Add("run_manifest=$runManifestPath")
    $benchmarkLines.Add("generated_profile_sha256=$($processSummary.RunProfileSha256)")
    $benchmarkLines.Add("tester_config_sha256=$($processSummary.TesterConfigSha256)")
    $benchmarkLines.Add("receipt_bytes=$($receiptPath.Length)")
    $benchmarkLines.Add("summary_bytes=$($summaryPath.Length)")
    $benchmarkLines.Add("receipt_rows=$receiptDataRows")
    if ($null -ne $histogram) {
        $benchmarkLines.Add("receipt_type_histogram=$($histogram.TypeHistogram)")
        $benchmarkLines.Add("receipt_type_status_histogram=$($histogram.TypeStatusHistogram)")
    }
    foreach ($key in @("receipt_mode", "compact_receipt_rows_skipped", "balance", "equity", "open_position_count", "managed_position_count", "max_open_position_count_observed", "max_managed_position_count_observed", "max_open_grid_count_observed", "stop_take_profit_metric_observations", "worst_stop_take_profit_net_open_pct_after_fees_observed", "best_stop_take_profit_net_open_pct_after_fees_observed", "worst_stop_take_profit_net_open_money_after_fees_observed", "best_stop_take_profit_net_open_money_after_fees_observed", "revma_q_profile", "revma_q_profile_id")) {
        if ($metrics.ContainsKey($key)) {
            $benchmarkLines.Add("$key=$($metrics[$key])")
        }
    }
    if ($runStart.Count -gt 0) { $benchmarkLines.Add("run_start=$($runStart[0].message)") }
    if ($firstEngine.Count -gt 0) { $benchmarkLines.Add("first_engine=$($firstEngine[0].message)") }
    if ($lastEngine.Count -gt 0) { $benchmarkLines.Add("last_engine=$($lastEngine[0].message)") }
    $benchmarkLines.Add("status=$benchmarkStatus")
    $benchmarkPath = Join-Path $ArtifactDir "fx28-speed-benchmark.txt"
    Set-Content -LiteralPath $benchmarkPath -Value $benchmarkLines -Encoding ASCII
    Write-Output ($benchmarkLines -join [Environment]::NewLine)
    if ($benchmarkStatus -ne "PASS_BENCHMARK_RECEIPTS_PRESENT") {
        Write-Error "FX28 speed benchmark did not complete cleanly. See $benchmarkPath"
        exit 1
    }
    Write-Output "FX28 speed benchmark PASS"
    exit 0
}

$receipts = Import-Csv -LiteralPath $receiptPath.FullName

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
