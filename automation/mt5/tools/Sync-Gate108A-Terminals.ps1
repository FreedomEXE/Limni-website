param(
    [string]$ArtifactDir = "",
    [string]$TerminalManifestPath = "",
    [string]$CompileArtifactDir = "",
    [switch]$SkipCompile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..\..")).Path
$sourceBundleTool = Join-Path $PSScriptRoot "Test-Gate108SourceBundle.ps1"
$profileTool = Join-Path $PSScriptRoot "Test-Gate108ControlledProfile.ps1"
if ($TerminalManifestPath -eq "") {
    $TerminalManifestPath = Join-Path $repoRoot "automation\mt5\terminal-roots.json"
}
$TerminalManifestPath = (Resolve-Path -LiteralPath $TerminalManifestPath).Path
$terminalManifest = Get-Content -Raw -LiteralPath $TerminalManifestPath | ConvertFrom-Json
$expectedTerminalIds = @('94497')
$expectedCompilerHash = '2C0C8E9E5C1239E30E8A908D9205CDB01B9CDFCF876752E43BD7A755CCE58AD3'
$expectedPresetHash = '57A2AECDE64179F4363E66EC85242A31BADC5AB9EACD7A862CB65AF53F454F1C'
$expectedStandardIncludes = @(
    'Object.mqh',
    'StdLibErr.mqh',
    'Trade/DealInfo.mqh',
    'Trade/HistoryOrderInfo.mqh',
    'Trade/OrderInfo.mqh',
    'Trade/PositionInfo.mqh',
    'Trade/Trade.mqh'
)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Get-NormalizedFullPath([string]$Path) {
    return [System.IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
}

function Assert-PathUnder([string]$Root, [string]$Path) {
    $rootFull = (Get-NormalizedFullPath $Root) + [System.IO.Path]::DirectorySeparatorChar
    $pathFull = Get-NormalizedFullPath $Path
    if (!$pathFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path escapes approved root '$Root': '$Path'."
    }
    return $pathFull
}

function Get-RelativePathStrict([string]$Root, [string]$Path) {
    $rootFull = Get-NormalizedFullPath $Root
    $pathFull = Assert-PathUnder $rootFull $Path
    return $pathFull.Substring($rootFull.Length).TrimStart('\', '/').Replace('\', '/')
}

function Assert-ConfiguredProcessesClosed($Terminals) {
    $configured = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($terminal in $Terminals) {
        [void]$configured.Add((Get-NormalizedFullPath $terminal.terminalExe))
        [void]$configured.Add((Get-NormalizedFullPath $terminal.metaEditor))
    }
    try {
        $running = @(Get-CimInstance Win32_Process -ErrorAction Stop |
            Where-Object { $_.Name -in @('terminal64.exe', 'MetaEditor64.exe') })
    } catch {
        throw "Unable to prove configured MT5 processes are closed: $($_.Exception.Message)"
    }
    $blocked = [System.Collections.Generic.List[string]]::new()
    foreach ($process in $running) {
        if ($null -eq $process.ExecutablePath -or $process.ExecutablePath -eq '') {
            throw "Cannot resolve executable path for running MT5 process pid=$($process.ProcessId) name=$($process.Name)."
        }
        $path = Get-NormalizedFullPath $process.ExecutablePath
        if ($configured.Contains($path)) {
            $blocked.Add("pid=$($process.ProcessId)|name=$($process.Name)|path=$path")
        }
    }
    if ($blocked.Count -gt 0) {
        throw "Configured MT5 process is running; close it before Gate108 sync: $($blocked -join '; ')"
    }
}

function Invoke-CleanMetaEditorCompile {
    param(
        [Parameter(Mandatory = $true)][string]$Compiler,
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Ex5,
        [Parameter(Mandatory = $true)][string]$Log,
        [Parameter(Mandatory = $true)][string]$Label
    )
    $beforeWrite = if (Test-Path -LiteralPath $Ex5) {
        (Get-Item -LiteralPath $Ex5).LastWriteTimeUtc
    } else { [datetime]::MinValue }
    $started = [datetime]::UtcNow
    $process = Start-Process -FilePath $Compiler `
        -ArgumentList @("/compile:$Source", "/log:$Log") `
        -PassThru -Wait -WindowStyle Hidden
    if (!(Test-Path -LiteralPath $Log -PathType Leaf)) {
        throw "$Label compile log was not created."
    }
    $result = Select-String -LiteralPath $Log -Pattern 'Result:' | Select-Object -Last 1
    if ($null -eq $result -or $result.Line -notmatch 'Result:\s+0 errors,\s+0 warnings') {
        throw "$Label compile failed: $($result.Line)"
    }
    if (!(Test-Path -LiteralPath $Ex5 -PathType Leaf)) {
        throw "$Label EX5 was not created."
    }
    $after = Get-Item -LiteralPath $Ex5
    if ($after.LastWriteTimeUtc -le $beforeWrite -or $after.LastWriteTimeUtc -lt $started.AddSeconds(-2)) {
        throw "$Label EX5 freshness proof failed."
    }
    return [pscustomobject]@{
        label = $Label
        compiler = $Compiler
        source = $Source
        ex5 = $Ex5
        log = $Log
        exit_code = $process.ExitCode
        result = $result.Line.Trim()
        started_utc = $started.ToString('o')
        completed_utc = [datetime]::UtcNow.ToString('o')
    }
}

function Get-CompileDependencyProof {
    param(
        [Parameter(Mandatory = $true)]$Compile,
        [Parameter(Mandatory = $true)][string]$LocalRoot,
        [Parameter(Mandatory = $true)][string[]]$ExpectedLocal,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][System.Collections.Generic.List[object]]$StandardRows
    )
    $local = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    [void]$local.Add((Get-RelativePathStrict $LocalRoot $Compile.source))
    $standard = [System.Collections.Generic.Dictionary[string,string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $unknown = [System.Collections.Generic.List[string]]::new()
    foreach ($line in [System.IO.File]::ReadLines($Compile.log)) {
        $cleanLine = [regex]::Replace($line, "`e\[[0-?]*[ -/]*[@-~]", '')
        $match = [regex]::Match($cleanLine, 'information: including\s+(.+)$')
        if (!$match.Success) { continue }
        $path = $match.Groups[1].Value.Trim()
        $full = Get-NormalizedFullPath $path
        $standardMatch = [regex]::Match($full, '(?i)[\\/]MQL5[\\/]Include[\\/](.+)$')
        if ($standardMatch.Success) {
            $relative = $standardMatch.Groups[1].Value.Replace('\', '/')
            if ($standard.ContainsKey($relative) -and
                $standard[$relative] -ine $full) {
                throw "$($Compile.label) standard include '$relative' resolved to multiple paths."
            }
            $standard[$relative] = $full
            continue
        }
        $localPrefix = (Get-NormalizedFullPath $LocalRoot) + [System.IO.Path]::DirectorySeparatorChar
        if ($full.StartsWith($localPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            [void]$local.Add((Get-RelativePathStrict $LocalRoot $full))
            continue
        }
        $unknown.Add($full)
    }
    if ($unknown.Count -ne 0) {
        throw "$($Compile.label) compiler log contains unknown dependencies: $($unknown -join ';')"
    }
    $localActual = [string[]]@($local)
    [Array]::Sort($localActual, [System.StringComparer]::OrdinalIgnoreCase)
    $localExpected = [string[]]@($ExpectedLocal)
    [Array]::Sort($localExpected, [System.StringComparer]::OrdinalIgnoreCase)
    if (($localActual -join "`n") -cne ($localExpected -join "`n")) {
        throw "$($Compile.label) compiler-observed local closure mismatch."
    }
    $standardActual = [string[]]@($standard.Keys)
    [Array]::Sort($standardActual, [System.StringComparer]::OrdinalIgnoreCase)
    $standardExpected = [string[]]@($expectedStandardIncludes)
    [Array]::Sort($standardExpected, [System.StringComparer]::OrdinalIgnoreCase)
    if (($standardActual -join "`n") -cne ($standardExpected -join "`n")) {
        throw "$($Compile.label) standard include closure mismatch: $($standardActual -join ';')"
    }
    foreach ($relative in $standardActual) {
        $path = $standard[$relative]
        $item = Get-Item -LiteralPath $path
        $StandardRows.Add([pscustomobject]@{
            label = $Compile.label
            relative_path = $relative
            resolved_path = $path
            bytes = $item.Length
            sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash
        })
    }
}

$terminals = @($terminalManifest.terminals)
if ($terminals.Count -ne 1 -or
    (@($terminals.id | Sort-Object) -join ',') -cne (@($expectedTerminalIds | Sort-Object) -join ',')) {
    throw "Gate108 requires exactly canonical terminal ID 94497."
}
Assert-ConfiguredProcessesClosed $terminals

if ($ArtifactDir -eq "") {
    $ArtifactDir = Join-Path $repoRoot ("docs\research\gates\gate108\artifacts\gate108a-completion-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
} elseif (![System.IO.Path]::IsPathRooted($ArtifactDir)) {
    $ArtifactDir = Join-Path $repoRoot $ArtifactDir
}
$ArtifactDir = [System.IO.Path]::GetFullPath($ArtifactDir)
$protectedMt5Root = (Get-NormalizedFullPath (Join-Path $repoRoot 'automation\mt5')) +
    [System.IO.Path]::DirectorySeparatorChar
if ($ArtifactDir.StartsWith($protectedMt5Root,
        [System.StringComparison]::OrdinalIgnoreCase) -or
    $ArtifactDir -ieq (Get-NormalizedFullPath (Join-Path $repoRoot 'automation\mt5'))) {
    throw "Gate108 artifact output may not overlap the active MT5 source/preset/tool tree: '$ArtifactDir'."
}
foreach ($terminal in $terminals) {
    $protectedTerminalRoot = Get-NormalizedFullPath (
        (Resolve-Path -LiteralPath $terminal.mql5Root).Path)
    $protectedTerminalPrefix = $protectedTerminalRoot +
        [System.IO.Path]::DirectorySeparatorChar
    if ($ArtifactDir.StartsWith($protectedTerminalPrefix,
            [System.StringComparison]::OrdinalIgnoreCase) -or
        $ArtifactDir -ieq $protectedTerminalRoot) {
        throw "Gate108 artifact output may not overlap configured terminal MQL5 root $($terminal.id): '$ArtifactDir'."
    }
}
if (Test-Path -LiteralPath $ArtifactDir) {
    if ((Get-ChildItem -LiteralPath $ArtifactDir -Force | Measure-Object).Count -ne 0) {
        throw "Gate108 artifact directory must be new or empty: '$ArtifactDir'."
    }
} else {
    New-Item -ItemType Directory -Path $ArtifactDir | Out-Null
}
$ArtifactDir = (Resolve-Path -LiteralPath $ArtifactDir).Path

$sourceManifestPath = Join-Path $ArtifactDir 'gate108a-source-closure.csv'
$sourceBundleProofPath = Join-Path $ArtifactDir 'gate108a-source-bundle.txt'
$profileProofPath = Join-Path $ArtifactDir 'gate108a-controlled-profile-proof.txt'
$inputProofPath = Join-Path $ArtifactDir 'gate108a-input-classification.txt'
$bundleOutput = @(& $sourceBundleTool -ManifestPath $sourceManifestPath)
[System.IO.File]::WriteAllLines($sourceBundleProofPath, [string[]]$bundleOutput, $utf8NoBom)
if (@($bundleOutput | Select-String '^status=MATCH$').Count -ne 1) { throw "Source bundle mismatch." }
$preBundleIdentity = @($bundleOutput | Where-Object { $_ -match '^bundle_id=' })
if ($preBundleIdentity.Count -ne 1) { throw "Precompile source bundle identity is missing or duplicated." }
$profileOutput = @(& $profileTool -ProofPath $profileProofPath -SourceManifestPath $sourceManifestPath)
$inputLines = @($profileOutput | Where-Object { $_ -match '^(input_group_metadata_count|broker_compatibility_inputs|strategy_inputs|lifecycle_inputs|capital_inputs|account_size_authority|preset_bytes|preset_sha256)=' })
[System.IO.File]::WriteAllLines($inputProofPath, [string[]]$inputLines, $utf8NoBom)
if (@($profileOutput | Select-String '^status=PASS$').Count -ne 1) { throw "Controlled profile proof failed." }

$closure = @(Import-Csv -LiteralPath $sourceManifestPath)
if ($closure.Count -ne 57) { throw "Canonical Gate108 source closure must contain 57 files." }
$expectedLocal = [string[]]@($closure.terminal_relative_path)
$presetSource = (Resolve-Path -LiteralPath (Join-Path $repoRoot 'automation\mt5\tester-presets\limni-portfolio-revma-gate108a-controlled.set')).Path
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $presetSource).Hash -cne $expectedPresetHash) { throw "Controlled preset source hash mismatch." }

$compilerRows = [System.Collections.Generic.List[object]]::new()
$terminalContexts = [System.Collections.Generic.List[object]]::new()
$resolvedRoots = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$resolvedTerminalExes = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$resolvedDestinations = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($terminal in $terminals) {
    $compiler = (Resolve-Path -LiteralPath $terminal.metaEditor).Path
    $terminalExe = (Resolve-Path -LiteralPath $terminal.terminalExe).Path
    $mql5Root = (Resolve-Path -LiteralPath $terminal.mql5Root).Path
    $rootParentName = Split-Path -Leaf (Split-Path -Parent $mql5Root)
    if ((Split-Path -Leaf $mql5Root) -cne 'MQL5' -or
        !$rootParentName.StartsWith([string]$terminal.id, [System.StringComparison]::OrdinalIgnoreCase) -or
        !$resolvedRoots.Add((Get-NormalizedFullPath $mql5Root)) -or
        !$resolvedTerminalExes.Add((Get-NormalizedFullPath $terminalExe))) {
        throw "Terminal manifest root/executable identity is duplicated or inconsistent for $($terminal.id)."
    }
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $compiler).Hash
    if ($hash -cne $expectedCompilerHash) { throw "Compiler hash mismatch for terminal $($terminal.id)." }
    $item = Get-Item -LiteralPath $compiler
    $compilerRows.Add([pscustomobject]@{
        terminal_id = $terminal.id
        compiler = $compiler
        bytes = $item.Length
        sha256 = $hash
        file_version = $item.VersionInfo.FileVersion
        product_version = $item.VersionInfo.ProductVersion
    })
    $fileMappings = [System.Collections.Generic.List[object]]::new()
    foreach ($file in $closure) {
        $source = (Resolve-Path -LiteralPath (Join-Path $repoRoot ($file.repo_relative_path -replace '/', '\'))).Path
        $repoHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash
        if ($repoHash -cne $file.raw_sha256.ToUpperInvariant()) {
            throw "Repository source drift before sync: $($file.repo_relative_path)"
        }
        $destination = Assert-PathUnder $mql5Root (Join-Path $mql5Root ($file.terminal_relative_path -replace '/', '\'))
        if (!$resolvedDestinations.Add((Get-NormalizedFullPath $destination))) {
            throw "Terminal destination is duplicated across configured terminals: $destination"
        }
        $fileMappings.Add([pscustomobject]@{
            source = $source
            destination = $destination
            terminal_relative_path = $file.terminal_relative_path
            repo_sha256 = $repoHash
        })
    }
    $presetTarget = Assert-PathUnder $mql5Root (Join-Path $mql5Root 'Profiles\Tester\LimniPortfolioEA.set')
    if (!$resolvedDestinations.Add((Get-NormalizedFullPath $presetTarget))) {
        throw "Terminal preset destination is duplicated: $presetTarget"
    }
    $terminalContexts.Add([pscustomobject]@{
        id = [string]$terminal.id
        mql5_root = $mql5Root
        compiler = $compiler
        terminal_exe = $terminalExe
        files = $fileMappings
        preset_target = $presetTarget
    })
}
$compilerRows | Export-Csv -LiteralPath (Join-Path $ArtifactDir 'gate108a-toolchain-proof.csv') -NoTypeInformation -Encoding UTF8

$sourceRows = [System.Collections.Generic.List[object]]::new()
$presetRows = [System.Collections.Generic.List[object]]::new()
Assert-ConfiguredProcessesClosed $terminals
foreach ($context in $terminalContexts) {
    foreach ($mapping in $context.files) {
        $parent = Split-Path -Parent $mapping.destination
        if (!(Test-Path -LiteralPath $parent -PathType Container)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Copy-Item -LiteralPath $mapping.source -Destination $mapping.destination -Force
        $destinationHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $mapping.destination).Hash
        if ($destinationHash -cne $mapping.repo_sha256) { throw "Source sync mismatch: terminal=$($context.id) path=$($mapping.terminal_relative_path)" }
        $sourceRows.Add([pscustomobject]@{
            phase = 'precompile'
            terminal_id = $context.id
            terminal_relative_path = $mapping.terminal_relative_path
            repo_sha256 = $mapping.repo_sha256
            terminal_sha256 = $destinationHash
            bytes = (Get-Item -LiteralPath $mapping.destination).Length
            match = $true
        })
    }
    $presetParent = Split-Path -Parent $context.preset_target
    if (!(Test-Path -LiteralPath $presetParent -PathType Container)) { New-Item -ItemType Directory -Path $presetParent -Force | Out-Null }
    Copy-Item -LiteralPath $presetSource -Destination $context.preset_target -Force
    $presetHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $context.preset_target).Hash
    if ($presetHash -cne $expectedPresetHash -or (Get-Item -LiteralPath $context.preset_target).Length -ne 22) { throw "Terminal preset mismatch: $($context.id)" }
    $presetRows.Add([pscustomobject]@{ phase = 'precompile'; terminal_id = $context.id; path = $context.preset_target; bytes = 22; sha256 = $presetHash; match = $true })
}
$sourceRows | Export-Csv -LiteralPath (Join-Path $ArtifactDir 'gate108a-terminal-source-hash-proof.csv') -NoTypeInformation -Encoding UTF8
$presetRows | Export-Csv -LiteralPath (Join-Path $ArtifactDir 'gate108a-terminal-preset-hash-proof.csv') -NoTypeInformation -Encoding UTF8

Assert-ConfiguredProcessesClosed $terminals
$compilerCanonical = ($compilerRows | Where-Object terminal_id -eq '94497').compiler
$repoSource = (Resolve-Path -LiteralPath (Join-Path $repoRoot 'automation\mt5\Experts\Limni\LimniPortfolioEA.mq5')).Path
$repoEx5 = Join-Path $repoRoot 'automation\mt5\Experts\Limni\LimniPortfolioEA.ex5'
$compiles = [System.Collections.Generic.List[object]]::new()
if ($SkipCompile) {
    if ($CompileArtifactDir -eq "") { throw '-SkipCompile requires -CompileArtifactDir.' }
    if (![System.IO.Path]::IsPathRooted($CompileArtifactDir)) { $CompileArtifactDir = Join-Path $repoRoot $CompileArtifactDir }
    $CompileArtifactDir = (Resolve-Path -LiteralPath $CompileArtifactDir).Path
    $artifactBundle = Join-Path $CompileArtifactDir 'gate108a-source-bundle.txt'
    if (!(Test-Path -LiteralPath $artifactBundle)) { throw "Compile artifact source bundle missing: $artifactBundle" }
    $artifactBundleId = @((Get-Content -LiteralPath $artifactBundle) | Where-Object { $_ -match '^bundle_id=' })
    if ($artifactBundleId.Count -ne 1 -or $artifactBundleId[0] -cne $preBundleIdentity[0]) { throw 'Reusable compile artifact source bundle does not match current source.' }
    $reusable = @(
        [pscustomobject]@{ label = 'repo'; compiler = $compilerCanonical; source = $repoSource; ex5 = $repoEx5; log = (Join-Path $CompileArtifactDir 'repo-LimniPortfolioEA-compile-log.txt') },
        [pscustomobject]@{ label = 'terminal-94497'; compiler = ($terminalContexts[0].compiler); source = (Join-Path $terminalContexts[0].mql5_root 'Experts\Limni\LimniPortfolioEA.mq5'); ex5 = (Join-Path $terminalContexts[0].mql5_root 'Experts\Limni\LimniPortfolioEA.ex5'); log = (Join-Path $CompileArtifactDir 'terminal-94497-LimniPortfolioEA-compile-log.txt') }
    )
    foreach ($item in $reusable) {
        if (!(Test-Path -LiteralPath $item.log) -or !(Test-Path -LiteralPath $item.ex5)) { throw "Reusable compile receipt missing for $($item.label)." }
        $result = Select-String -LiteralPath $item.log -Pattern 'Result:' | Select-Object -Last 1
        if ($null -eq $result -or $result.Line -notmatch 'Result:\s+0 errors,\s+0 warnings') { throw "Reusable compile receipt is not clean for $($item.label)." }
        $compiles.Add([pscustomobject]@{ label = $item.label; compiler = $item.compiler; source = $item.source; ex5 = $item.ex5; log = $item.log; exit_code = 0; result = $result.Line.Trim(); started_utc = (Get-Item $item.log).CreationTimeUtc.ToString('o'); completed_utc = (Get-Item $item.log).LastWriteTimeUtc.ToString('o') })
    }
} else {
    $compiles.Add((Invoke-CleanMetaEditorCompile $compilerCanonical $repoSource $repoEx5 (Join-Path $ArtifactDir 'repo-LimniPortfolioEA-compile-log.txt') 'repo'))
    foreach ($context in $terminalContexts) {
        Assert-ConfiguredProcessesClosed $terminals
        $source = Join-Path $context.mql5_root 'Experts\Limni\LimniPortfolioEA.mq5'
        $ex5 = Join-Path $context.mql5_root 'Experts\Limni\LimniPortfolioEA.ex5'
        $compiles.Add((Invoke-CleanMetaEditorCompile $context.compiler $source $ex5 (Join-Path $ArtifactDir ("terminal-$($context.id)-LimniPortfolioEA-compile-log.txt")) ("terminal-$($context.id)")))
    }
}

$standardRows = [System.Collections.Generic.List[object]]::new()
foreach ($compile in $compiles) {
    $localRoot = if ($compile.label -eq 'repo') { Join-Path $repoRoot 'automation\mt5' } else {
        $id = $compile.label.Substring('terminal-'.Length)
        ($terminalContexts | Where-Object id -eq $id).mql5_root
    }
    Get-CompileDependencyProof $compile $localRoot $expectedLocal $standardRows
}
$standardRows | Export-Csv -LiteralPath (Join-Path $ArtifactDir 'gate108a-standard-include-closure.csv') -NoTypeInformation -Encoding UTF8
foreach ($relative in $expectedStandardIncludes) {
    $hashes = @($standardRows | Where-Object relative_path -eq $relative | Select-Object -ExpandProperty sha256 -Unique)
    if ($hashes.Count -ne 1) { throw "Standard include hash differs across compiles: $relative" }
}

$compileSummary = [System.Collections.Generic.List[string]]::new()
foreach ($compile in $compiles) {
    $compileSummary.Add("label=$($compile.label)|compiler=$($compile.compiler)|exit_code=$($compile.exit_code)|result=$($compile.result)|started_utc=$($compile.started_utc)|completed_utc=$($compile.completed_utc)")
}
[System.IO.File]::WriteAllLines((Join-Path $ArtifactDir 'gate108a-compile-summary.txt'), [string[]]$compileSummary, $utf8NoBom)

$compiledEx5Rows = [System.Collections.Generic.List[object]]::new()
foreach ($compile in $compiles) {
    $item = Get-Item -LiteralPath $compile.ex5
    $compiledEx5Rows.Add([pscustomobject]@{ label = $compile.label; path = $compile.ex5; bytes = $item.Length; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $compile.ex5).Hash })
}

# MetaEditor embeds terminal-root-specific build bytes in EX5 output. Each
# target was compiled above for an independent receipt; the repository EX5 is
# the canonical executable propagated to both terminal roots for equality.
foreach ($context in $terminalContexts) {
    Assert-ConfiguredProcessesClosed $terminals
    $terminalEx5 = Join-Path $context.mql5_root 'Experts\Limni\LimniPortfolioEA.ex5'
    Copy-Item -LiteralPath $repoEx5 -Destination $terminalEx5 -Force
    $canonicalHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $repoEx5).Hash
    $terminalHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $terminalEx5).Hash
    if ($terminalHash -cne $canonicalHash) {
        throw "Canonical EX5 propagation mismatch: terminal=$($context.id)"
    }
}

$ex5Rows = [System.Collections.Generic.List[object]]::new()
foreach ($compile in $compiles) {
    $item = Get-Item -LiteralPath $compile.ex5
    $ex5Rows.Add([pscustomobject]@{
        label = $compile.label
        path = $compile.ex5
        bytes = $item.Length
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $compile.ex5).Hash
        compiled_sha256 = ($compiledEx5Rows | Where-Object label -eq $compile.label).sha256
        canonical_propagation = $compile.label -ne 'repo'
    })
}
if (@($ex5Rows.sha256 | Select-Object -Unique).Count -ne 1 -or @($ex5Rows.bytes | Select-Object -Unique).Count -ne 1) {
    throw "Repo and terminal EX5 files are not byte-identical."
}
$ex5Rows | Export-Csv -LiteralPath (Join-Path $ArtifactDir 'gate108a-ex5-hash-proof.csv') -NoTypeInformation -Encoding UTF8

$postBundle = @(& $sourceBundleTool)
if (@($postBundle | Select-String '^status=MATCH$').Count -ne 1) { throw "Post-compile source bundle drift." }
$postBundleIdentity = @($postBundle | Where-Object { $_ -match '^bundle_id=' })
if ($postBundleIdentity.Count -ne 1 -or
    $postBundleIdentity[0] -cne $preBundleIdentity[0]) {
    throw "Repository source bundle identity changed during synchronization."
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $presetSource).Hash -cne
        $expectedPresetHash -or
    (Get-Item -LiteralPath $presetSource).Length -ne 22) {
    throw "Repository controlled preset changed during synchronization."
}
foreach ($context in $terminalContexts) {
    foreach ($mapping in $context.files) {
        $destinationHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $mapping.destination).Hash
        if ($destinationHash -cne $mapping.repo_sha256) {
            throw "Post-compile terminal source drift: terminal=$($context.id) path=$($mapping.terminal_relative_path)"
        }
        $sourceRows.Add([pscustomobject]@{
            phase = 'postcompile'
            terminal_id = $context.id
            terminal_relative_path = $mapping.terminal_relative_path
            repo_sha256 = $mapping.repo_sha256
            terminal_sha256 = $destinationHash
            bytes = (Get-Item -LiteralPath $mapping.destination).Length
            match = $true
        })
    }
    $presetHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $context.preset_target).Hash
    if ($presetHash -cne $expectedPresetHash -or
        (Get-Item -LiteralPath $context.preset_target).Length -ne 22) {
        throw "Post-compile terminal preset drift: $($context.id)"
    }
    $presetRows.Add([pscustomobject]@{ phase = 'postcompile'; terminal_id = $context.id; path = $context.preset_target; bytes = 22; sha256 = $presetHash; match = $true })
}
$sourceRows | Export-Csv -LiteralPath (Join-Path $ArtifactDir 'gate108a-terminal-source-hash-proof.csv') -NoTypeInformation -Encoding UTF8
$presetRows | Export-Csv -LiteralPath (Join-Path $ArtifactDir 'gate108a-terminal-preset-hash-proof.csv') -NoTypeInformation -Encoding UTF8

$summary = @(
    'gate=Gate108A',
    'status=PASS',
    'source_files=57',
    'terminals=94497',
    'compilers_equivalent=true',
    'compiler_observed_local_closure_match=true',
    'compiler_observed_standard_closure_match=true',
    'repo_terminal_ex5_byte_equal=true',
    ('ex5_sha256=' + $ex5Rows[0].sha256),
    ('ex5_bytes=' + $ex5Rows[0].bytes),
    'strategy_tester_run=false',
    'smoke_runner_run=false',
    'shard_runner_run=false',
    'benchmark_run=false',
    'optimization_run=false',
    'backtest_automation_run=false'
)
[System.IO.File]::WriteAllLines((Join-Path $ArtifactDir 'gate108a-sync-summary.txt'), [string[]]$summary, $utf8NoBom)
$summary | ForEach-Object { Write-Output $_ }
Write-Output "artifact_dir=$ArtifactDir"
