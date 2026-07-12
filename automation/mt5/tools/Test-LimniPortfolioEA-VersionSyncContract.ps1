param(
    [switch]$SelfTest,
    [string]$BuildInfoPath = "",
    [string]$ExpertPath = "",
    [string]$PreviousStatePath = "",
    [string]$TerminalBuildInfoPath = "",
    [string]$TerminalExpertPath = "",
    [string]$RepoEx5 = "",
    [string]$TerminalEx5 = "",
    [string]$ReceiptPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ConstString([string]$Text, [string]$Name) {
    $match = [regex]::Match($Text,
        '(?m)^\s*const\s+string\s+' + [regex]::Escape($Name) +
        '\s*=\s*"([^"]*)"\s*;')
    if (!$match.Success) { throw "Missing string constant: $Name" }
    return $match.Groups[1].Value
}

function Get-PropertyString([string]$Text, [string]$Name) {
    $match = [regex]::Match($Text,
        '(?m)^\s*#property\s+' + [regex]::Escape($Name) +
        '\s+"([^"]*)"\s*$')
    if (!$match.Success) { throw "Missing MQL property: $Name" }
    return $match.Groups[1].Value
}

function Get-SourceBundleShort([string]$BundleId) {
    if (!$BundleId.StartsWith("sha256:") -or $BundleId.Length -lt 19) {
        throw "Invalid source-bundle ID: $BundleId"
    }
    return $BundleId.Substring(7, 12)
}

function Get-VersionParts([string]$Version) {
    $matches = [regex]::Matches($Version, '\d+')
    if ($matches.Count -eq 0) { throw "Invalid EA version: $Version" }
    return @($matches | ForEach-Object { [int]$_.Value })
}

function Compare-EaVersion([string]$Left, [string]$Right) {
    $leftParts = Get-VersionParts $Left
    $rightParts = Get-VersionParts $Right
    $count = [Math]::Max($leftParts.Count, $rightParts.Count)
    for ($i = 0; $i -lt $count; $i++) {
        $leftValue = if ($i -lt $leftParts.Count) { $leftParts[$i] } else { 0 }
        $rightValue = if ($i -lt $rightParts.Count) { $rightParts[$i] } else { 0 }
        if ($leftValue -gt $rightValue) { return 1 }
        if ($leftValue -lt $rightValue) { return -1 }
    }
    return 0
}

function Assert-VersionSourceContract(
    [string]$PreviousVersion,
    [string]$PreviousSourceBundleId,
    [string]$CurrentVersion,
    [string]$CurrentSourceBundleId
) {
    if ($PreviousVersion -eq "" -or $PreviousSourceBundleId -eq "" -or
        $CurrentVersion -eq "" -or $CurrentSourceBundleId -eq "") {
        throw "Version/source contract inputs may not be empty."
    }
    $sourceChanged = $PreviousSourceBundleId -cne $CurrentSourceBundleId
    $versionComparison = Compare-EaVersion $CurrentVersion $PreviousVersion
    if ($sourceChanged -and $versionComparison -le 0) {
        throw "Compiled source-bundle changed from '$PreviousSourceBundleId' to '$CurrentSourceBundleId' without an incremented EA version ('$PreviousVersion' -> '$CurrentVersion')."
    }
    return [pscustomobject]@{
        SourceChanged = $sourceChanged
        VersionComparison = $versionComparison
    }
}

function Assert-Ex5HashesMatch([string]$RepoPath, [string]$TerminalPath) {
    if (!(Test-Path -LiteralPath $RepoPath -PathType Leaf)) {
        throw "Repository EX5 is missing: $RepoPath"
    }
    if (!(Test-Path -LiteralPath $TerminalPath -PathType Leaf)) {
        throw "Terminal EX5 is missing: $TerminalPath"
    }
    $repoHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $RepoPath).Hash.ToUpperInvariant()
    $terminalHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $TerminalPath).Hash.ToUpperInvariant()
    if ($repoHash -cne $terminalHash) {
        throw "Repository/terminal EX5 mismatch: repo=$repoHash terminal=$terminalHash"
    }
    return [pscustomobject]@{ RepoHash = $repoHash; TerminalHash = $terminalHash }
}

function Read-BuildIdentity([string]$BuildPath, [string]$ExpertPathForProperty) {
    if (!(Test-Path -LiteralPath $BuildPath -PathType Leaf)) {
        throw "BuildInfo is missing: $BuildPath"
    }
    if (!(Test-Path -LiteralPath $ExpertPathForProperty -PathType Leaf)) {
        throw "EA source is missing: $ExpertPathForProperty"
    }
    $buildText = Get-Content -Raw -LiteralPath $BuildPath
    $expertText = Get-Content -Raw -LiteralPath $ExpertPathForProperty
    $version = Get-ConstString $buildText 'LP_EA_VERSION'
    $bundleId = Get-ConstString $buildText 'LP_EA_SOURCE_BUNDLE_ID'
    $bundleShort = Get-SourceBundleShort $bundleId
    $propertyVersion = Get-PropertyString $expertText 'version'
    $propertyDescription = Get-PropertyString $expertText 'description'
    if ($propertyVersion -cne $version) {
        throw "EA property version '$propertyVersion' does not match LP_EA_VERSION '$version'."
    }
    if ($propertyDescription -notmatch [regex]::Escape("version $version") -or
        $propertyDescription -notmatch [regex]::Escape("source bundle $bundleShort")) {
        throw "EA property description does not expose version '$version' and source bundle '$bundleShort'."
    }
    return [pscustomobject]@{
        Version = $version
        SourceBundleId = $bundleId
        SourceBundleShort = $bundleShort
        SourceBundleAlgorithm = Get-ConstString $buildText 'LP_EA_SOURCE_BUNDLE_ALGORITHM'
    }
}

$results = [System.Collections.Generic.List[string]]::new()

if ($SelfTest) {
    $failed = $false
    try { Assert-VersionSourceContract '1.031' 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' '1.031' 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' | Out-Null } catch { $failed = $true }
    if (!$failed) { throw "Static case failed: source changed + version unchanged must fail." }
    $results.Add('case=source_changed_version_unchanged|PASS')

    Assert-VersionSourceContract '1.031' 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' '1.031' 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' | Out-Null
    $results.Add('case=source_unchanged_version_unchanged|PASS')

    Assert-VersionSourceContract '1.031' 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' '1.032' 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' | Out-Null
    $results.Add('case=source_changed_version_incremented|PASS')

    $repoTemp = Join-Path ([IO.Path]::GetTempPath()) ('limni-version-contract-repo-' + [guid]::NewGuid().ToString('N') + '.ex5')
    $terminalTemp = Join-Path ([IO.Path]::GetTempPath()) ('limni-version-contract-terminal-' + [guid]::NewGuid().ToString('N') + '.ex5')
    try {
        [IO.File]::WriteAllBytes($repoTemp, [byte[]](1, 2, 3))
        [IO.File]::WriteAllBytes($terminalTemp, [byte[]](1, 2, 4))
        $failed = $false
        try { Assert-Ex5HashesMatch $repoTemp $terminalTemp | Out-Null } catch { $failed = $true }
        if (!$failed) { throw "Static case failed: EX5 mismatch must fail." }
    } finally {
        Remove-Item -LiteralPath $repoTemp, $terminalTemp -Force -ErrorAction SilentlyContinue
    }
    $results.Add('case=repo_terminal_ex5_mismatch|PASS')
}

$repoIdentity = $null
$terminalIdentity = $null
if ($BuildInfoPath -ne "" -or $ExpertPath -ne "" -or $PreviousStatePath -ne "") {
    if ($BuildInfoPath -eq "" -or $ExpertPath -eq "" -or $PreviousStatePath -eq "") {
        throw "BuildInfoPath, ExpertPath, and PreviousStatePath must be supplied together."
    }
    $repoIdentity = Read-BuildIdentity $BuildInfoPath $ExpertPath
    if (!(Test-Path -LiteralPath $PreviousStatePath -PathType Leaf)) {
        throw "Previous successful compile state is missing: $PreviousStatePath"
    }
    $previousState = Get-Content -Raw -LiteralPath $PreviousStatePath | ConvertFrom-Json
    $comparison = Assert-VersionSourceContract $previousState.ea_version `
        $previousState.source_bundle_id $repoIdentity.Version $repoIdentity.SourceBundleId
    $results.Add('case=current_source_version_contract|PASS|source_changed=' +
        $comparison.SourceChanged + '|version=' + $repoIdentity.Version +
        '|source_bundle_short=' + $repoIdentity.SourceBundleShort)

    if ($TerminalBuildInfoPath -ne "" -or $TerminalExpertPath -ne "") {
        if ($TerminalBuildInfoPath -eq "" -or $TerminalExpertPath -eq "") {
            throw "TerminalBuildInfoPath and TerminalExpertPath must be supplied together."
        }
        $terminalIdentity = Read-BuildIdentity $TerminalBuildInfoPath $TerminalExpertPath
        if ($terminalIdentity.Version -cne $repoIdentity.Version -or
            $terminalIdentity.SourceBundleId -cne $repoIdentity.SourceBundleId) {
            throw "Terminal source identity differs from repository source identity."
        }
        $results.Add('case=terminal_source_identity|PASS')
    }
}

if ($RepoEx5 -ne "" -or $TerminalEx5 -ne "") {
    if ($RepoEx5 -eq "" -or $TerminalEx5 -eq "") {
        throw "RepoEx5 and TerminalEx5 must be supplied together."
    }
    $ex5 = Assert-Ex5HashesMatch $RepoEx5 $TerminalEx5
    $results.Add('case=repo_terminal_ex5_hash_parity|PASS|repo_sha256=' +
        $ex5.RepoHash + '|terminal_sha256=' + $ex5.TerminalHash)
}

if ($results.Count -eq 0) {
    throw "No verification requested. Use -SelfTest or supply actual compile contract paths."
}

$receipt = @('status=PASS') + $results
if ($ReceiptPath -ne "") {
    $parent = Split-Path -Parent $ReceiptPath
    if (!(Test-Path -LiteralPath $parent -PathType Container)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    [IO.File]::WriteAllLines($ReceiptPath, [string[]]$receipt,
        [Text.UTF8Encoding]::new($false))
}
$receipt | ForEach-Object { Write-Output $_ }
