param(
    [string]$ManifestPath = "",
    [string]$ArtifactDir = "",
    [string]$FromDate = "2026.01.01",
    [string]$ToDate = "2026.02.01",
    [int]$ShardDays = 7,
    [ValidateSet("FAST_5000", "MEDIUM_50000", "SLOW_250000", "FULL_ALL")]
    [string]$QProfile = "MEDIUM_50000",
    [ValidateSet("OpenPrices", "M1OHLC", "EveryTick")]
    [string]$TesterModel = "OpenPrices",
    [double]$TakeProfit = 0.750,
    [double]$StopLoss = 0.0,
    [ValidateSet("Full", "CompactLongRun")]
    [string]$ReceiptMode = "CompactLongRun",
    [int]$TimeoutSeconds = 900,
    [int]$PostExitReceiptWaitSeconds = 45,
    [int]$MaxParallel = 1,
    [switch]$AllowUnverifiedParallel,
    [string[]]$TerminalIds = @(),
    [string]$Symbol = "EURUSD.i",
    [string]$Period = "M1"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
    return (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..\..")).Path
}

function ConvertFrom-Mt5Date([string]$dateText) {
    return [datetime]::ParseExact($dateText, "yyyy.MM.dd", [System.Globalization.CultureInfo]::InvariantCulture)
}

function ConvertTo-Mt5Date([datetime]$dateValue) {
    return $dateValue.ToString("yyyy.MM.dd", [System.Globalization.CultureInfo]::InvariantCulture)
}

function Get-FileSha256([string]$path) {
    if ($path -eq "" -or !(Test-Path -LiteralPath $path)) { return "" }
    return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
}

function Read-KeyValueFile([string]$path) {
    $values = @{}
    if (!(Test-Path -LiteralPath $path)) {
        return $values
    }
    foreach ($line in Get-Content -LiteralPath $path) {
        $idx = $line.IndexOf("=")
        if ($idx -le 0) {
            continue
        }
        $key = $line.Substring(0, $idx)
        $value = $line.Substring($idx + 1)
        $values[$key] = $value
    }
    return $values
}

$repoRoot = Resolve-RepoRoot
if ($ManifestPath -eq "") {
    $ManifestPath = Join-Path $repoRoot "automation\mt5\terminal-roots.json"
}
$ManifestPath = (Resolve-Path -LiteralPath $ManifestPath).Path
$manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json

if ($ArtifactDir -eq "") {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $ArtifactDir = Join-Path $repoRoot "docs\research\gates\gate104\artifacts\shard-run-$stamp"
} elseif (![System.IO.Path]::IsPathRooted($ArtifactDir)) {
    $ArtifactDir = Join-Path $repoRoot $ArtifactDir
}
New-Item -ItemType Directory -Force -Path $ArtifactDir | Out-Null
$ArtifactDir = (Resolve-Path -LiteralPath $ArtifactDir).Path

$configuredTerminals = @($manifest.terminals)
if ($TerminalIds.Count -eq 0) {
    $TerminalIds = @($configuredTerminals | ForEach-Object { $_.id })
}
$TerminalIds = @($TerminalIds | Where-Object { $_ -ne "" })
if ($TerminalIds.Count -eq 0) {
    throw "No terminal workers selected."
}
if ($MaxParallel -gt 1 -and !$AllowUnverifiedParallel) {
    throw "Parallel terminal workers are disabled until each configured terminal is proven to launch its own expected data root. Re-run with -MaxParallel 1, or use -AllowUnverifiedParallel only for terminal-mapping diagnostics."
}
foreach ($terminalId in $TerminalIds) {
    if ($null -eq (@($configuredTerminals | Where-Object { $_.id -eq $terminalId }) | Select-Object -First 1)) {
        throw "TerminalId '$terminalId' not found in $ManifestPath"
    }
}

if ($ShardDays -lt 1) {
    throw "ShardDays must be >= 1"
}
$from = ConvertFrom-Mt5Date $FromDate
$to = ConvertFrom-Mt5Date $ToDate
if ($to -le $from) {
    throw "ToDate must be later than FromDate"
}

$shards = New-Object System.Collections.Generic.List[object]
$cursor = $from
$index = 1
while ($cursor -lt $to) {
    $end = $cursor.AddDays($ShardDays)
    if ($end -gt $to) { $end = $to }
    $shardId = "S{0:D3}" -f $index
    $shards.Add([pscustomobject]@{
        ShardId = $shardId
        Index = $index
        FromDate = ConvertTo-Mt5Date $cursor
        ToDate = ConvertTo-Mt5Date $end
    })
    $cursor = $end
    $index++
}

$runner = Join-Path $PSScriptRoot "Run-LimniPortfolioEA-FX28Smoke.ps1"
$maxWorkers = [Math]::Max(1, [Math]::Min($MaxParallel, $TerminalIds.Count))
$pending = New-Object System.Collections.Queue
foreach ($shard in $shards) {
    $pending.Enqueue($shard)
}

$running = New-Object System.Collections.Generic.List[object]
$results = New-Object System.Collections.Generic.List[object]
$startedAt = Get-Date

while ($pending.Count -gt 0 -or $running.Count -gt 0) {
    $busyTerminalIds = @($running | ForEach-Object { $_.TerminalId })
    foreach ($terminalId in $TerminalIds) {
        if ($running.Count -ge $maxWorkers -or $pending.Count -eq 0) {
            break
        }
        if ($busyTerminalIds -contains $terminalId) {
            continue
        }

        $shard = $pending.Dequeue()
        $shardDir = Join-Path $ArtifactDir $shard.ShardId
        New-Item -ItemType Directory -Force -Path $shardDir | Out-Null
        $outputFolder = "LPEA_$($shard.ShardId)_${terminalId}_${QProfile}_${TesterModel}_$(Get-Date -Format yyyyMMddHHmmss)"
        $job = Start-Job -ScriptBlock {
            param(
                [string]$runner,
                [string]$manifestPath,
                [string]$artifactDir,
                [string]$terminalId,
                [string]$symbol,
                [string]$period,
                [string]$fromDate,
                [string]$toDate,
                [string]$qProfile,
                [string]$testerModel,
                [double]$takeProfit,
                [double]$stopLoss,
                [string]$receiptMode,
                [int]$timeoutSeconds,
                [int]$postExitReceiptWaitSeconds,
                [string]$outputFolder,
                [string]$shardId
            )
            & powershell -NoProfile -ExecutionPolicy Bypass -File $runner `
                -ManifestPath $manifestPath `
                -ArtifactDir $artifactDir `
                -TerminalId $terminalId `
                -Symbol $symbol `
                -Period $period `
                -FromDate $fromDate `
                -ToDate $toDate `
                -QProfile $qProfile `
                -TesterModel $testerModel `
                -TakeProfit $takeProfit `
                -StopLoss $stopLoss `
                -ReceiptMode $receiptMode `
                -TimeoutSeconds $timeoutSeconds `
                -PostExitReceiptWaitSeconds $postExitReceiptWaitSeconds `
                -BenchmarkMode `
                -OutputFolderName $outputFolder `
                -ShardId $shardId 2>&1
            $code = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }
            Write-Output "__GATE104_EXIT_CODE=$code"
        } -ArgumentList @(
            $runner,
            $ManifestPath,
            $shardDir,
            $terminalId,
            $Symbol,
            $Period,
            $shard.FromDate,
            $shard.ToDate,
            $QProfile,
            $TesterModel,
            $TakeProfit,
            $StopLoss,
            $ReceiptMode,
            $TimeoutSeconds,
            $PostExitReceiptWaitSeconds,
            $outputFolder,
            $shard.ShardId
        )

        $running.Add([pscustomobject]@{
            Job = $job
            TerminalId = $terminalId
            ShardId = $shard.ShardId
            FromDate = $shard.FromDate
            ToDate = $shard.ToDate
            ArtifactDir = $shardDir
            StartedAt = Get-Date
        })
        $busyTerminalIds += $terminalId
    }

    Start-Sleep -Seconds 2

    for ($i = $running.Count - 1; $i -ge 0; $i--) {
        $item = $running[$i]
        if ($item.Job.State -notin @("Completed", "Failed", "Stopped")) {
            continue
        }
        $output = Receive-Job -Job $item.Job -Keep
        $outputPath = Join-Path $item.ArtifactDir "shard-runner-output.txt"
        $output | Out-String | Set-Content -LiteralPath $outputPath -Encoding UTF8
        $exitCode = 1
        $exitMarker = @($output | Where-Object { $_ -is [string] -and $_ -like "__GATE104_EXIT_CODE=*" } | Select-Object -Last 1)
        if ($exitMarker.Count -gt 0) {
            $exitCode = [int]($exitMarker[0] -replace "^__GATE104_EXIT_CODE=", "")
        }
        Remove-Job -Job $item.Job -Force

        $benchmarkPath = Join-Path $item.ArtifactDir "fx28-speed-benchmark.txt"
        $kv = Read-KeyValueFile $benchmarkPath
        $status = if ($kv.ContainsKey("status")) { $kv["status"] } else { "NO_BENCHMARK_SUMMARY" }
        if ($exitCode -ne 0 -and $status -eq "PASS_BENCHMARK_RECEIPTS_PRESENT") {
            $status = "FAILED_AFTER_BENCHMARK"
        }
        $results.Add([pscustomobject]@{
            shard_id = $item.ShardId
            terminal_id = $item.TerminalId
            from_date = $item.FromDate
            to_date = $item.ToDate
            status = $status
            exit_code = $exitCode
            wall_seconds = if ($kv.ContainsKey("wall_seconds")) { $kv["wall_seconds"] } else { "" }
            receipt_rows = if ($kv.ContainsKey("receipt_rows")) { $kv["receipt_rows"] } else { "" }
            receipt_bytes = if ($kv.ContainsKey("receipt_bytes")) { $kv["receipt_bytes"] } else { "" }
            compact_receipt_rows_skipped = if ($kv.ContainsKey("compact_receipt_rows_skipped")) { $kv["compact_receipt_rows_skipped"] } else { "" }
            final_balance = if ($kv.ContainsKey("balance")) { $kv["balance"] } else { "" }
            final_open_position_count = if ($kv.ContainsKey("open_position_count")) { $kv["open_position_count"] } else { "" }
            final_managed_position_count = if ($kv.ContainsKey("managed_position_count")) { $kv["managed_position_count"] } else { "" }
            max_managed_position_count_observed = if ($kv.ContainsKey("max_managed_position_count_observed")) { $kv["max_managed_position_count_observed"] } else { "" }
            worst_stop_take_profit_net_open_pct_after_fees_observed = if ($kv.ContainsKey("worst_stop_take_profit_net_open_pct_after_fees_observed")) { $kv["worst_stop_take_profit_net_open_pct_after_fees_observed"] } else { "" }
            receipts = if ($kv.ContainsKey("receipts")) { $kv["receipts"] } else { "" }
            summary = if ($kv.ContainsKey("summary")) { $kv["summary"] } else { "" }
            benchmark = $benchmarkPath
            artifact_dir = $item.ArtifactDir
        })
        $running.RemoveAt($i)
    }
}

$endedAt = Get-Date
$ledgerPath = Join-Path $ArtifactDir "gate104-shard-ledger.csv"
$results | Sort-Object shard_id | Export-Csv -LiteralPath $ledgerPath -NoTypeInformation

$failed = @($results | Where-Object { $_.status -ne "PASS_BENCHMARK_RECEIPTS_PRESENT" -or $_.exit_code -ne 0 })
$summary = [ordered]@{
    generated_at = (Get-Date).ToString("o")
    status = if ($failed.Count -eq 0) { "PASS_SHARD_LEDGER" } else { "FAIL_SHARD_LEDGER" }
    repo_root = $repoRoot
    artifact_dir = $ArtifactDir
    manifest_path = $ManifestPath
    manifest_sha256 = Get-FileSha256 $ManifestPath
    from_date = $FromDate
    to_date = $ToDate
    shard_days = $ShardDays
    shard_count = $shards.Count
    terminal_ids = $TerminalIds
    max_parallel = $maxWorkers
    allow_unverified_parallel = [bool]$AllowUnverifiedParallel
    q_profile = $QProfile
    tester_model = $TesterModel
    take_profit = $TakeProfit
    stop_loss = $StopLoss
    receipt_mode = $ReceiptMode
    timeout_seconds = $TimeoutSeconds
    post_exit_receipt_wait_seconds = $PostExitReceiptWaitSeconds
    started_at = $startedAt.ToString("o")
    ended_at = $endedAt.ToString("o")
    wall_seconds = [Math]::Round(($endedAt - $startedAt).TotalSeconds, 3)
    failed_shards = $failed.Count
    ledger = $ledgerPath
}
$summaryPath = Join-Path $ArtifactDir "gate104-shard-summary.json"
$summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $summaryPath -Encoding ASCII

Write-Output "Gate104 shard runner summary"
Write-Output "status=$($summary.status)"
Write-Output "artifact_dir=$ArtifactDir"
Write-Output "ledger=$ledgerPath"
Write-Output "summary=$summaryPath"
Write-Output "shards=$($shards.Count)"
Write-Output "failed_shards=$($failed.Count)"
Write-Output "wall_seconds=$($summary.wall_seconds)"

if ($failed.Count -gt 0) {
    Write-Error "One or more Gate104 shards failed. See $ledgerPath"
    exit 1
}
