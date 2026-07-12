param(
    [string]$ArtifactDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..\..")).Path
if ($ArtifactDir -eq "") {
    $ArtifactDir = Join-Path $repoRoot ("docs\research\gates\gate109\artifacts\canonical-compile-" +
        (Get-Date -Format "yyyyMMdd-HHmmss"))
}
if (![System.IO.Path]::IsPathRooted($ArtifactDir)) { $ArtifactDir = Join-Path $repoRoot $ArtifactDir }
New-Item -ItemType Directory -Path $ArtifactDir -Force | Out-Null

$toolsRoot = Join-Path $repoRoot "automation\mt5\tools"
$sourceTool = Join-Path $toolsRoot "Test-Gate108SourceBundle.ps1"
$inventoryTool = Join-Path $toolsRoot "Test-LimniEA-VersionInventory.ps1"
$versionTool = Join-Path $toolsRoot "Test-LimniPortfolioEA-VersionSyncContract.ps1"
$statePath = Join-Path $toolsRoot "canonical-compile-state.json"
$terminalManifestPath = Join-Path $repoRoot "automation\mt5\terminal-roots.json"
$terminalManifest = Get-Content -Raw -LiteralPath $terminalManifestPath | ConvertFrom-Json
if (@($terminalManifest.terminals).Count -ne 1 -or $terminalManifest.terminals[0].id -ne "94497") {
    throw "Canonical compile requires exactly terminal ID 94497."
}
$terminal = $terminalManifest.terminals[0]
$mql5Root = (Resolve-Path -LiteralPath $terminal.mql5Root).Path
$compiler = (Resolve-Path -LiteralPath $terminal.metaEditor).Path
$repoSource = (Resolve-Path -LiteralPath (Join-Path $repoRoot $terminalManifest.activeExpert.source)).Path
$repoEx5 = Join-Path $repoRoot $terminalManifest.activeExpert.compiled
$terminalSource = Join-Path $mql5Root $terminalManifest.activeExpert.terminalSource
$terminalEx5 = Join-Path $mql5Root $terminalManifest.activeExpert.terminalCompiled
$buildInfoPath = Join-Path $repoRoot "automation\mt5\Experts\Include\Core\BuildInfo.mqh"
$terminalBuildInfoPath = Join-Path $mql5Root "Experts\Include\Core\BuildInfo.mqh"
$sourceManifestPath = Join-Path $ArtifactDir "source-closure.csv"
$compileLog = Join-Path $ArtifactDir "terminal-94497-LimniPortfolioEA-compile-log.txt"
$compileReceipt = Join-Path $ArtifactDir "compile-receipt.txt"
$inventoryReceipt = Join-Path $ArtifactDir "ea-version-inventory.txt"
$versionPreflightReceipt = Join-Path $ArtifactDir "version-check-precompile.txt"
$versionPostflightReceipt = Join-Path $ArtifactDir "version-check-postcompile.txt"
$sourceHashProof = Join-Path $ArtifactDir "terminal-source-hash-proof.csv"
$presetHashProof = Join-Path $ArtifactDir "terminal-preset-hash-proof.csv"

function FullPath([string]$Path) { return [System.IO.Path]::GetFullPath($Path).TrimEnd('\', '/') }
function AssertUnder([string]$Root, [string]$Path) {
    $rootFull = (FullPath $Root) + [System.IO.Path]::DirectorySeparatorChar
    $pathFull = FullPath $Path
    if (!$pathFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path escapes approved root '$Root': '$Path'."
    }
    return $pathFull
}
function Hash([string]$Path) { return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToUpperInvariant() }
function Write-Receipt([string]$Path, [object[]]$Lines) {
    [System.IO.File]::WriteAllLines($Path, [string[]]$Lines,
        [System.Text.UTF8Encoding]::new($false))
}
function AssertClosed {
    $configured = @((FullPath $terminal.terminalExe), (FullPath $terminal.metaEditor))
    $running = @(Get-CimInstance Win32_Process -ErrorAction Stop |
        Where-Object { $_.Name -in @("terminal64.exe", "MetaEditor64.exe") })
    foreach ($process in $running) {
        if ($null -eq $process.ExecutablePath -or $process.ExecutablePath -eq "") {
            throw "Cannot resolve MT5 process path before canonical compile."
        }
        if ($configured -contains (FullPath $process.ExecutablePath)) {
            throw "Configured MT5 process is running: pid=$($process.ProcessId) path=$($process.ExecutablePath)"
        }
    }
}

AssertClosed

$inventoryOutput = @(& $inventoryTool -RootPath (Join-Path $repoRoot "automation\mt5\Experts"))
Write-Receipt $inventoryReceipt $inventoryOutput

$bundleOutput = @(& $sourceTool -ManifestPath $sourceManifestPath)
$bundleStatus = @($bundleOutput | Where-Object { $_ -eq "status=MATCH" })
if ($bundleStatus.Count -ne 1) { throw "Source bundle preflight did not pass." }
$bundleLine = @($bundleOutput | Where-Object { $_ -match '^bundle_id=' })
if ($bundleLine.Count -ne 1) { throw "Source bundle identity missing." }
$bundleIdentity = ($bundleLine[0] -split '=', 2)[1]
$sourceRows = Import-Csv -LiteralPath $sourceManifestPath
if (@($sourceRows).Count -le 0) { throw "Source closure is empty." }

$versionOutput = @(& $versionTool `
    -BuildInfoPath $buildInfoPath `
    -ExpertPath $repoSource `
    -PreviousStatePath $statePath `
    -ReceiptPath $versionPreflightReceipt)

$sourceProof = [System.Collections.Generic.List[object]]::new()
foreach ($row in $sourceRows) {
    $repoPath = Join-Path $repoRoot ($row.repo_relative_path -replace '/', '\')
    $terminalPath = Join-Path $mql5Root ($row.terminal_relative_path -replace '/', '\')
    AssertUnder $repoRoot $repoPath | Out-Null
    AssertUnder $mql5Root $terminalPath | Out-Null
    $parent = Split-Path -Parent $terminalPath
    if (!(Test-Path -LiteralPath $parent -PathType Container)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Copy-Item -LiteralPath $repoPath -Destination $terminalPath -Force
    $terminalHash = Hash $terminalPath
    if ($terminalHash -cne $row.raw_sha256.ToUpperInvariant()) {
        throw "Terminal source sync mismatch: $($row.terminal_relative_path)"
    }
    $sourceProof.Add([pscustomobject]@{
        repo_relative_path = $row.repo_relative_path
        terminal_relative_path = $row.terminal_relative_path
        repo_sha256 = (Hash $repoPath)
        terminal_sha256 = $terminalHash
        bytes = (Get-Item -LiteralPath $terminalPath).Length
        match = $true
    })
}
$sourceProof | Export-Csv -LiteralPath $sourceHashProof -NoTypeInformation -Encoding UTF8

$presetMappings = @(
    [pscustomobject]@{ id = "fx28_set"; repo = "automation\mt5\tester-presets\limni-portfolio-revma-gate108a-controlled.set"; terminal = "Profiles\Tester\LimniPortfolioEA.set" },
    [pscustomobject]@{ id = "single_pair_set"; repo = "automation\mt5\tester-presets\limni-portfolio-revma-single-pair-mechanics.set"; terminal = "Profiles\Tester\LimniPortfolioEA-SinglePairMechanics.set" }
)
$presetProof = [System.Collections.Generic.List[object]]::new()
foreach ($mapping in $presetMappings) {
    $repoPreset = Join-Path $repoRoot $mapping.repo
    $terminalPreset = Join-Path $mql5Root $mapping.terminal
    AssertUnder $repoRoot $repoPreset | Out-Null
    AssertUnder $mql5Root $terminalPreset | Out-Null
    $parent = Split-Path -Parent $terminalPreset
    if (!(Test-Path -LiteralPath $parent -PathType Container)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Copy-Item -LiteralPath $repoPreset -Destination $terminalPreset -Force
    $presetProof.Add([pscustomobject]@{
        id = $mapping.id
        repo_path = $repoPreset
        terminal_path = $terminalPreset
        repo_sha256 = (Hash $repoPreset)
        terminal_sha256 = (Hash $terminalPreset)
        bytes = (Get-Item -LiteralPath $terminalPreset).Length
        match = (Hash $repoPreset) -eq (Hash $terminalPreset)
    })
}
$presetProof | Export-Csv -LiteralPath $presetHashProof -NoTypeInformation -Encoding UTF8

AssertClosed
$beforeWrite = if (Test-Path -LiteralPath $terminalEx5) {
    (Get-Item -LiteralPath $terminalEx5).LastWriteTimeUtc
} else { [datetime]::MinValue }
$started = [datetime]::UtcNow
$process = Start-Process -FilePath $compiler `
    -ArgumentList @("/compile:$terminalSource", "/log:$compileLog") `
    -PassThru -Wait -WindowStyle Hidden
if (!(Test-Path -LiteralPath $compileLog -PathType Leaf)) {
    throw "Canonical compile log was not created."
}
$result = Select-String -LiteralPath $compileLog -Pattern 'Result:' | Select-Object -Last 1
if ($null -eq $result -or $result.Line -notmatch 'Result:\s+0 errors,\s+0 warnings') {
    throw "Canonical compile failed: $($result.Line)"
}
if (!(Test-Path -LiteralPath $terminalEx5 -PathType Leaf)) {
    throw "Canonical terminal EX5 missing."
}
$terminalItem = Get-Item -LiteralPath $terminalEx5
if ($terminalItem.LastWriteTimeUtc -le $beforeWrite -or
    $terminalItem.LastWriteTimeUtc -lt $started.AddSeconds(-2)) {
    throw "Canonical terminal EX5 freshness proof failed."
}

$includeLines = @([System.IO.File]::ReadLines($compileLog) |
    Where-Object { $_ -match 'including\s+' })
$requiredIncludeEvidence = @("Engine.mqh", "MandatoryDiagnostics.mqh", "TradeRouter.mqh")
foreach ($name in $requiredIncludeEvidence) {
    if (@($includeLines | Where-Object { $_ -match [regex]::Escape($name) }).Count -eq 0) {
        throw "Compiler-observed include closure is missing $name."
    }
}

# MetaEditor emits the canonical EX5 in the terminal source tree. Make the
# repository copy first, then explicitly propagate that exact byte stream back
# to the active terminal and verify both paths after propagation.
Copy-Item -LiteralPath $terminalEx5 -Destination $repoEx5 -Force
Copy-Item -LiteralPath $repoEx5 -Destination $terminalEx5 -Force
$repoHash = Hash $repoEx5
$terminalHash = Hash $terminalEx5
$repoBytes = (Get-Item -LiteralPath $repoEx5).Length
$terminalBytes = (Get-Item -LiteralPath $terminalEx5).Length
if ($repoBytes -ne $terminalBytes -or $repoHash -cne $terminalHash) {
    throw "Repository and active-terminal EX5 files are not byte-identical: repo=$repoHash terminal=$terminalHash"
}

$postVersionOutput = @(& $versionTool `
    -BuildInfoPath $buildInfoPath `
    -ExpertPath $repoSource `
    -PreviousStatePath $statePath `
    -TerminalBuildInfoPath $terminalBuildInfoPath `
    -TerminalExpertPath $terminalSource `
    -RepoEx5 $repoEx5 `
    -TerminalEx5 $terminalEx5 `
    -ReceiptPath $versionPostflightReceipt)

$buildText = Get-Content -Raw -LiteralPath $buildInfoPath
$versionMatch = [regex]::Match($buildText,
    '(?m)^\s*const\s+string\s+LP_EA_VERSION\s*=\s*"([^"]*)"\s*;')
if (!$versionMatch.Success) { throw "LP_EA_VERSION is missing after compile." }
$eaVersion = $versionMatch.Groups[1].Value
$sourceShort = $bundleIdentity.Substring(7, 12)
$state = [ordered]@{
    contract = "limni-ea-version-source-sync-v1"
    terminal_id = $terminal.id
    ea_name = "Limni Portfolio EA"
    ea_version = $eaVersion
    source_bundle_id = $bundleIdentity
    source_bundle_short = $sourceShort
    repo_ex5_sha256 = $repoHash
    terminal_ex5_sha256 = $terminalHash
    last_success_utc = [datetime]::UtcNow.ToString('o')
}
Write-Receipt $statePath (($state | ConvertTo-Json -Depth 4).TrimEnd())

$receiptLines = @(
    "status=PASS",
    "canonical_terminal_id=$($terminal.id)",
    "ea_name=Limni Portfolio EA",
    "ea_version=$eaVersion",
    "compiler=$compiler",
    "source=$terminalSource",
    "compile_invocations=1",
    "compile_result=$($result.Line.Trim())",
    "compiler_process_exit_code=$($process.ExitCode)",
    "source_bundle_algorithm=sha256-canonical-local-include-closure-v1",
    "source_bundle_id=$bundleIdentity",
    "source_bundle_short=$sourceShort",
    "source_count=$(@($sourceRows).Count)",
    "version_contract_precompile=PASS",
    "version_contract_postcompile=PASS",
    "repo_ex5_sha256=$repoHash",
    "repo_ex5_bytes=$repoBytes",
    "active_terminal_ex5_sha256=$terminalHash",
    "active_terminal_ex5_bytes=$terminalBytes",
    "copy_to_active_terminal=true",
    "repo_terminal_ex5_byte_identical=true",
    "compile_errors=0",
    "compile_warnings=0",
    "strategy_tester_run=false",
    "optimization_run=false",
    "benchmark_run=false",
    "backtest_run=false",
    "completed_utc=$([datetime]::UtcNow.ToString('o'))"
)
Write-Receipt $compileReceipt $receiptLines
$receiptLines | ForEach-Object { Write-Output $_ }
Write-Output "artifact_dir=$ArtifactDir"
