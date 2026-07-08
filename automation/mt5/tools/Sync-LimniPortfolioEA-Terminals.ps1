param(
    [string]$ManifestPath = "",
    [string]$ArtifactDir = "",
    [switch]$NoSync,
    [switch]$SkipCompile,
    [switch]$FailOnStaleTesterProfiles,
    [switch]$ArchiveStaleTesterProfiles,
    [switch]$SyncTesterProfile,
    [switch]$FailOnTesterProfileDrift,
    [string]$TesterProfileSource = "",
    [string]$TesterProfileName = "LimniPortfolioEA.set",
    [switch]$FailOnUnknownRunningTerminal
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

function Get-RelativePath([string]$basePath, [string]$fullPath) {
    $base = (Resolve-Path -LiteralPath $basePath).Path.TrimEnd('\', '/')
    $full = (Resolve-Path -LiteralPath $fullPath).Path
    if (!$full.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path '$full' is not under '$base'"
    }
    return $full.Substring($base.Length).TrimStart('\', '/')
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

function Reset-DirectoryFromSource([string]$sourcePath, [string]$destinationPath, [string]$safeBasePath) {
    Assert-PathUnder $safeBasePath $destinationPath | Out-Null
    if (Test-Path -LiteralPath $destinationPath) {
        Remove-Item -LiteralPath $destinationPath -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $destinationPath | Out-Null
    Copy-Item -Path (Join-Path $sourcePath "*") -Destination $destinationPath -Recurse -Force
}

function Get-CompileResultLine([string]$logPath) {
    if (!(Test-Path -LiteralPath $logPath)) {
        return ""
    }
    $line = Select-String -Path $logPath -Pattern "Result:" | Select-Object -Last 1
    if ($null -eq $line) {
        return ""
    }
    return $line.Line.Trim()
}

function Invoke-MetaEditorCompile(
    [string]$metaEditor,
    [string]$sourcePath,
    [string]$logPath,
    [string]$label
) {
    if (!(Test-Path -LiteralPath $metaEditor)) {
        throw "MetaEditor missing for ${label}: $metaEditor"
    }
    if (!(Test-Path -LiteralPath $sourcePath)) {
        throw "Compile source missing for ${label}: $sourcePath"
    }
    $logParent = Split-Path -Parent $logPath
    New-Item -ItemType Directory -Force -Path $logParent | Out-Null
    $process = Start-Process `
        -FilePath $metaEditor `
        -ArgumentList @("/compile:$sourcePath", "/log:$logPath") `
        -Wait `
        -PassThru `
        -WindowStyle Hidden
    $resultLine = Get-CompileResultLine $logPath
    $clean = $resultLine -match 'Result:\s+0 errors,\s+0 warnings'
    [pscustomobject]@{
        Label = $label
        MetaEditor = $metaEditor
        Source = $sourcePath
        Log = $logPath
        ExitCode = $process.ExitCode
        ResultLine = $resultLine
        Clean = $clean
    }
}

function Get-SourceFiles([string]$repoRoot, $manifest) {
    $files = New-Object System.Collections.Generic.List[string]
    $source = Resolve-RepoPath $repoRoot $manifest.activeExpert.source
    if (Test-Path -LiteralPath $source) {
        $files.Add((Resolve-Path -LiteralPath $source).Path)
    }
    $includeRoot = Resolve-RepoPath $repoRoot $manifest.activeExpert.includeSource
    Get-ChildItem -LiteralPath $includeRoot -Recurse -File |
        Where-Object { $_.Extension -in @(".mqh", ".mq5") } |
        Sort-Object FullName |
        ForEach-Object { $files.Add($_.FullName) }
    return $files
}

function Find-BannedMatches([string[]]$roots, [string[]]$patterns) {
    $matches = New-Object System.Collections.Generic.List[object]
    $regex = ($patterns | ForEach-Object { [regex]::Escape($_) }) -join '|'
    $textExtensions = @(".mq5", ".mqh", ".set", ".ini", ".txt", ".md", ".json", ".csv")
    foreach ($root in $roots) {
        if (!(Test-Path -LiteralPath $root)) {
            continue
        }
        $item = Get-Item -LiteralPath $root
        $files = @()
        if ($item.PSIsContainer) {
            $files = Get-ChildItem -LiteralPath $item.FullName -Recurse -File -ErrorAction SilentlyContinue |
                Where-Object { $textExtensions -contains $_.Extension.ToLowerInvariant() }
        } else {
            $files = @($item)
        }
        foreach ($file in $files) {
            $hitLines = Select-String -LiteralPath $file.FullName -Pattern $regex -ErrorAction SilentlyContinue
            foreach ($hit in $hitLines) {
                $matches.Add([pscustomobject]@{
                    Path = $hit.Path
                    Line = $hit.LineNumber
                    Text = $hit.Line.Trim()
                })
            }
        }
    }
    return $matches
}

function Write-Matches([string]$path, [string]$title, $matches) {
    $matchList = @($matches)
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("$title - $(Get-Date -Format o)")
    if ($matchList.Count -eq 0) {
        $lines.Add("NO MATCHES")
    } else {
        foreach ($match in $matchList) {
            $lines.Add("$($match.Path):$($match.Line):$($match.Text)")
        }
    }
    Set-Content -LiteralPath $path -Value $lines
}

$repoRoot = Resolve-RepoRoot
if ($ManifestPath -eq "") {
    $ManifestPath = Join-Path $repoRoot "automation\mt5\terminal-roots.json"
}
$ManifestPath = (Resolve-Path -LiteralPath $ManifestPath).Path
$manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json

if ($ArtifactDir -eq "") {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $ArtifactDir = Join-Path $repoRoot "docs\research\gates\gate101\artifacts\mt5-terminal-sync-$stamp"
} elseif (![System.IO.Path]::IsPathRooted($ArtifactDir)) {
    $ArtifactDir = Join-Path $repoRoot $ArtifactDir
}
New-Item -ItemType Directory -Force -Path $ArtifactDir | Out-Null
$ArtifactDir = (Resolve-Path -LiteralPath $ArtifactDir).Path

$syncLog = Join-Path $ArtifactDir "terminal-sync.txt"
$hashCsv = Join-Path $ArtifactDir "terminal-source-hash-proof.csv"
$testerProfileHashCsv = Join-Path $ArtifactDir "terminal-tester-profile-hash-proof.csv"
$compileSummary = Join-Path $ArtifactDir "terminal-compile-summary.txt"
$expertsSearch = Join-Path $ArtifactDir "terminal-experts-stale-input-search.txt"
$profilesSearch = Join-Path $ArtifactDir "terminal-profiles-stale-input-search.txt"
$runningTerminalsLog = Join-Path $ArtifactDir "running-terminals.txt"
$staleProfileArchiveLog = Join-Path $ArtifactDir "stale-tester-profile-archive.txt"

$summary = New-Object System.Collections.Generic.List[string]
$summary.Add("MT5 terminal sync gate - $(Get-Date -Format o)")
$summary.Add("Manifest: $ManifestPath")
$summary.Add("ArtifactDir: $ArtifactDir")

$repoSource = Resolve-RepoPath $repoRoot $manifest.activeExpert.source
$repoCompiled = Resolve-RepoPath $repoRoot $manifest.activeExpert.compiled
$repoInclude = Resolve-RepoPath $repoRoot $manifest.activeExpert.includeSource
$repoExpertRoot = Resolve-RepoPath $repoRoot "automation/mt5/Experts"
$repoReadme = Resolve-RepoPath $repoRoot "automation/mt5/README.md"
if ($TesterProfileSource -eq "") {
    $TesterProfileSource = Resolve-RepoPath $repoRoot "automation/mt5/tester-presets/limni-portfolio-revma-fx28-fast-smoke.set"
} elseif (![System.IO.Path]::IsPathRooted($TesterProfileSource)) {
    $TesterProfileSource = Resolve-RepoPath $repoRoot $TesterProfileSource
}
$testerProfileSourceResolved = ""
$testerProfileSourceHash = ""
if (Test-Path -LiteralPath $TesterProfileSource) {
    $testerProfileSourceResolved = (Resolve-Path -LiteralPath $TesterProfileSource).Path
    $testerProfileSourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $testerProfileSourceResolved).Hash
}
$sourceFiles = Get-SourceFiles $repoRoot $manifest
$repoHashes = @{}
foreach ($file in $sourceFiles) {
    $relative = Get-RelativePath (Resolve-RepoPath $repoRoot "automation/mt5/Experts") $file
    $repoHashes[$relative] = (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash
}

$terminalHashRows = New-Object System.Collections.Generic.List[object]
$testerProfileRows = New-Object System.Collections.Generic.List[object]
$terminalExpertsRoots = New-Object System.Collections.Generic.List[string]
$terminalProfileRoots = New-Object System.Collections.Generic.List[string]
$compileResults = New-Object System.Collections.Generic.List[object]

$running = Get-CimInstance Win32_Process -Filter "name='terminal64.exe'" -ErrorAction SilentlyContinue |
    Select-Object ProcessId, ExecutablePath, CommandLine
$runningLines = New-Object System.Collections.Generic.List[string]
$knownTerminalExe = @{}
foreach ($terminal in $manifest.terminals) {
    if ($null -ne $terminal.terminalExe) {
        $knownTerminalExe[(ConvertTo-WindowsPath $terminal.terminalExe)] = $terminal.id
    }
}
$unknownRunning = New-Object System.Collections.Generic.List[string]
foreach ($proc in $running) {
    $exe = ""
    if ($null -ne $proc.ExecutablePath) {
        $exe = ConvertTo-WindowsPath $proc.ExecutablePath
    }
    if ($knownTerminalExe.ContainsKey($exe)) {
        $status = "known:$($knownTerminalExe[$exe])"
    } else {
        $status = "UNKNOWN"
    }
    if ($status -eq "UNKNOWN") {
        $unknownRunning.Add($exe)
    }
    $runningLines.Add("pid=$($proc.ProcessId)|status=$status|exe=$exe|cmd=$($proc.CommandLine)")
}
if ($runningLines.Count -eq 0) {
    $runningLines.Add("NO RUNNING terminal64.exe")
}
Set-Content -LiteralPath $runningTerminalsLog -Value $runningLines

if (!$SkipCompile) {
    $repoMetaEditor = ConvertTo-WindowsPath $manifest.terminals[0].metaEditor
    $repoCompileLog = Join-Path $ArtifactDir "repo-$($manifest.activeExpert.name)-compile-log.txt"
    $compileResults.Add((Invoke-MetaEditorCompile $repoMetaEditor $repoSource $repoCompileLog "repo"))
}

foreach ($terminal in $manifest.terminals) {
    $terminalRoot = Assert-TerminalRoot (ConvertTo-WindowsPath $terminal.mql5Root)
    $metaEditor = ConvertTo-WindowsPath $terminal.metaEditor
    $terminalExpertsRoot = Join-Path $terminalRoot "Experts"
    $terminalExpertsRoots.Add($terminalExpertsRoot)
    $profileRoot = Join-Path $terminalRoot "Profiles\Tester"
    if ((Test-Path -LiteralPath $profileRoot) -or $SyncTesterProfile) {
        $terminalProfileRoots.Add($profileRoot)
    }
    $testerProfileTarget = Join-Path $profileRoot $TesterProfileName
    if ($testerProfileSourceResolved -ne "" -and $SyncTesterProfile -and !$NoSync) {
        Assert-PathUnder $terminalRoot $testerProfileTarget | Out-Null
        New-Item -ItemType Directory -Force -Path $profileRoot | Out-Null
        Copy-Item -LiteralPath $testerProfileSourceResolved -Destination $testerProfileTarget -Force
    }
    $testerProfileStatus = "SOURCE_MISSING"
    $testerProfileTargetHash = ""
    if ($testerProfileSourceResolved -ne "") {
        if (Test-Path -LiteralPath $testerProfileTarget) {
            $testerProfileTargetHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $testerProfileTarget).Hash
            if ($testerProfileTargetHash -eq $testerProfileSourceHash) {
                $testerProfileStatus = "MATCH"
            } else {
                $testerProfileStatus = "MISMATCH"
            }
        } else {
            $testerProfileStatus = "MISSING"
        }
    }
    $testerProfileRows.Add([pscustomobject]@{
        Terminal = $terminal.id
        ProfileName = $TesterProfileName
        SourcePath = $testerProfileSourceResolved
        TargetPath = $testerProfileTarget
        SourceHash = $testerProfileSourceHash
        TargetHash = $testerProfileTargetHash
        Status = $testerProfileStatus
    })

    $terminalSource = Join-Path $terminalRoot (ConvertTo-WindowsPath $manifest.activeExpert.terminalSource)
    $terminalCompiled = Join-Path $terminalRoot (ConvertTo-WindowsPath $manifest.activeExpert.terminalCompiled)
    $terminalInclude = Join-Path $terminalRoot (ConvertTo-WindowsPath $manifest.activeExpert.terminalInclude)

    if (!$NoSync) {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $terminalSource) | Out-Null
        Copy-Item -LiteralPath $repoSource -Destination $terminalSource -Force
        if (Test-Path -LiteralPath $repoCompiled) {
            Copy-Item -LiteralPath $repoCompiled -Destination $terminalCompiled -Force
        }
        Reset-DirectoryFromSource $repoInclude $terminalInclude $terminalRoot
    }

    foreach ($relative in $repoHashes.Keys) {
        $terminalFile = Join-Path $terminalExpertsRoot $relative
        $terminalHash = ""
        $hashStatus = "MISSING"
        if (!(Test-Path -LiteralPath $terminalFile)) {
            $terminalHashRows.Add([pscustomobject]@{
                Terminal = $terminal.id
                RelativePath = $relative
                RepoHash = $repoHashes[$relative]
                TerminalHash = $terminalHash
                Status = $hashStatus
            })
            continue
        }
        $terminalHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $terminalFile).Hash
        if ($terminalHash -eq $repoHashes[$relative]) {
            $hashStatus = "MATCH"
        } else {
            $hashStatus = "MISMATCH"
        }
        $terminalHashRows.Add([pscustomobject]@{
            Terminal = $terminal.id
            RelativePath = $relative
            RepoHash = $repoHashes[$relative]
            TerminalHash = $terminalHash
            Status = $hashStatus
        })
    }

    if (!$SkipCompile) {
        $terminalCompileLog = Join-Path $ArtifactDir "terminal-$($terminal.id)-$($manifest.activeExpert.name)-compile-log.txt"
        $compileResults.Add((Invoke-MetaEditorCompile $metaEditor $terminalSource $terminalCompileLog "terminal-$($terminal.id)"))
    }
}

$terminalHashRows | Export-Csv -LiteralPath $hashCsv -NoTypeInformation
$hashFailures = @($terminalHashRows | Where-Object { $_.Status -ne "MATCH" })
$testerProfileRows | Export-Csv -LiteralPath $testerProfileHashCsv -NoTypeInformation
$testerProfileFailures = @($testerProfileRows | Where-Object { $_.Status -ne "MATCH" })

$compileLines = New-Object System.Collections.Generic.List[string]
$compileLines.Add("MT5 compile summary - $(Get-Date -Format o)")
foreach ($result in $compileResults) {
    $compileLines.Add("$($result.Label)|exit_code=$($result.ExitCode)|clean=$($result.Clean)|$($result.ResultLine)|log=$($result.Log)")
}
Set-Content -LiteralPath $compileSummary -Value $compileLines
$compileFailures = @($compileResults | Where-Object { -not $_.Clean })

$banned = @($manifest.bannedInputNames)
$expertsRoots = @($repoExpertRoot, $repoReadme) + @($terminalExpertsRoots)
$expertMatches = @(Find-BannedMatches $expertsRoots $banned)
Write-Matches $expertsSearch "MT5 active Experts stale-input search" $expertMatches

$profileMatches = @(Find-BannedMatches @($terminalProfileRoots) $banned)
if ($ArchiveStaleTesterProfiles -and $profileMatches.Count -gt 0) {
    $archiveRoot = Join-Path $ArtifactDir "archived-stale-tester-profiles"
    New-Item -ItemType Directory -Force -Path $archiveRoot | Out-Null
    $archiveLines = New-Object System.Collections.Generic.List[string]
    $archiveLines.Add("Stale tester profile archive - $(Get-Date -Format o)")
    $archiveLines.Add("ArchiveRoot: $archiveRoot")
    $uniqueProfilePaths = @($profileMatches | Select-Object -ExpandProperty Path -Unique)
    foreach ($profilePath in $uniqueProfilePaths) {
        $resolvedProfile = (Resolve-Path -LiteralPath $profilePath).Path
        $underProfileRoot = $false
        foreach ($profileRoot in $terminalProfileRoots) {
            if (!(Test-Path -LiteralPath $profileRoot)) {
                continue
            }
            $resolvedRoot = (Resolve-Path -LiteralPath $profileRoot).Path.TrimEnd('\', '/')
            if ($resolvedProfile.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
                $underProfileRoot = $true
                break
            }
        }
        if (!$underProfileRoot) {
            throw "Refusing to archive tester profile outside configured profile roots: $resolvedProfile"
        }
        $profileHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedProfile).Hash.Substring(0, 12)
        $safeName = "$profileHash-$(Split-Path -Leaf $resolvedProfile).archived"
        $archiveTarget = Join-Path $archiveRoot $safeName
        Move-Item -LiteralPath $resolvedProfile -Destination $archiveTarget -Force
        $archiveLines.Add("$resolvedProfile -> $archiveTarget")
    }
    Set-Content -LiteralPath $staleProfileArchiveLog -Value $archiveLines
    $profileMatches = @(Find-BannedMatches @($terminalProfileRoots) $banned)
} else {
    Set-Content -LiteralPath $staleProfileArchiveLog -Value @("Stale tester profile archive - $(Get-Date -Format o)", "Archive not requested.")
}
Write-Matches $profilesSearch "MT5 tester profile stale-input search" $profileMatches

$summary.Add("Source hash mismatches: $($hashFailures.Count)")
$summary.Add("Tester profile source: $testerProfileSourceResolved")
$summary.Add("Tester profile hash mismatches: $($testerProfileFailures.Count)")
$summary.Add("Compile failures: $($compileFailures.Count)")
$summary.Add("Active Experts stale-input matches: $($expertMatches.Count)")
$summary.Add("Tester profile stale-input matches: $($profileMatches.Count)")
$summary.Add("Unknown running terminal64.exe count: $($unknownRunning.Count)")
$summary.Add("Compile summary: $compileSummary")
$summary.Add("Source hash proof: $hashCsv")
$summary.Add("Tester profile hash proof: $testerProfileHashCsv")
$summary.Add("Active Experts stale search: $expertsSearch")
$summary.Add("Tester profile stale search: $profilesSearch")
$summary.Add("Stale tester profile archive: $staleProfileArchiveLog")
$summary.Add("Running terminals: $runningTerminalsLog")
Set-Content -LiteralPath $syncLog -Value $summary

Write-Output ($summary -join [Environment]::NewLine)

$hardFailure = $false
if ($hashFailures.Count -gt 0) { $hardFailure = $true }
if ($FailOnTesterProfileDrift -and $testerProfileFailures.Count -gt 0) { $hardFailure = $true }
if ($compileFailures.Count -gt 0) { $hardFailure = $true }
if ($expertMatches.Count -gt 0) { $hardFailure = $true }
if ($FailOnStaleTesterProfiles -and $profileMatches.Count -gt 0) { $hardFailure = $true }
if ($FailOnUnknownRunningTerminal -and $unknownRunning.Count -gt 0) { $hardFailure = $true }

if ($hardFailure) {
    Write-Error "MT5 terminal sync gate FAILED. See $syncLog"
    exit 1
}

if ($profileMatches.Count -gt 0) {
    Write-Warning "MT5 terminal sync gate passed for active Experts, but stale tester profile keys remain. See $profilesSearch"
}
if ($testerProfileFailures.Count -gt 0) {
    Write-Warning "MT5 terminal sync gate passed for active Experts, but tester profile drift remains. See $testerProfileHashCsv"
}
if ($unknownRunning.Count -gt 0) {
    Write-Warning "Unknown running terminal64.exe process detected. See $runningTerminalsLog"
}

Write-Output "MT5 terminal sync gate PASS"
