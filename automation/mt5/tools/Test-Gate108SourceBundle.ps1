param(
    [switch]$PrintExpectedOnly,
    [string]$ManifestPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..\..")).Path
$entryPoint = (Resolve-Path -LiteralPath (Join-Path $repoRoot "automation\mt5\Experts\Limni\LimniPortfolioEA.mq5")).Path
$buildInfoPath = (Resolve-Path -LiteralPath (Join-Path $repoRoot "automation\mt5\Experts\Include\Core\BuildInfo.mqh")).Path
$algorithm = "sha256-canonical-local-include-closure-v1"
$selfSentinel = "__GATE108_SOURCE_BUNDLE_SELF__"
$utf8Strict = [System.Text.UTF8Encoding]::new($false, $true)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$repoPrefix = $repoRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar

function Read-CanonicalSourceText {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [switch]$NormalizeSelfIdentity
    )

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $offset = 0
    $count = $bytes.Length
    if ($count -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $offset = 3
        $count -= 3
    }
    try {
        $text = $utf8Strict.GetString($bytes, $offset, $count)
    } catch {
        throw "Gate108 source is not strict UTF-8: '$Path'."
    }
    $text = $text.Replace("`r`n", "`n").Replace("`r", "`n")
    if ($NormalizeSelfIdentity) {
        $pattern = '(?m)(LP_EA_SOURCE_BUNDLE_ID\s*=\s*")[^"]*(")'
        $matches = [regex]::Matches($text, $pattern)
        if ($matches.Count -ne 1) {
            throw "BuildInfo must contain exactly one source-bundle identity declaration."
        }
        $text = [regex]::Replace($text, $pattern, "`$1$selfSentinel`$2")
    }
    return $text
}

function ConvertTo-CsvField([string]$Value) {
    return '"' + $Value.Replace('"', '""') + '"'
}

$visited = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::OrdinalIgnoreCase)
$pending = [System.Collections.Generic.Stack[string]]::new()
$externalIncludes = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::Ordinal)
$pending.Push($entryPoint)

while ($pending.Count -gt 0) {
    $path = [System.IO.Path]::GetFullPath($pending.Pop())
    if (!$path.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Gate108 quoted include escapes the repository: '$path'."
    }
    if (!(Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Gate108 quoted include is missing: '$path'."
    }
    if (!$visited.Add($path)) {
        continue
    }

    $text = Read-CanonicalSourceText -Path $path
    foreach ($match in [regex]::Matches($text, '(?m)^\s*#include\s+"([^"]+)"')) {
        $includePath = $match.Groups[1].Value.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $resolved = [System.IO.Path]::GetFullPath(
            (Join-Path ([System.IO.Path]::GetDirectoryName($path)) $includePath))
        if (!$resolved.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Gate108 quoted include escapes the repository: '$($match.Groups[1].Value)'."
        }
        $pending.Push($resolved)
    }
    foreach ($match in [regex]::Matches($text, '(?m)^\s*#include\s+<([^>]+)>')) {
        [void]$externalIncludes.Add($match.Groups[1].Value.Replace('\', '/'))
    }
}

if (!$visited.Contains($buildInfoPath)) {
    throw "Gate108 active include closure does not contain BuildInfo.mqh."
}

$pathMap = @{}
$relativePaths = [string[]]@(
    foreach ($path in $visited) {
    $relative = $path.Substring($repoRoot.Length).TrimStart('\', '/').Replace('\', '/')
        $pathMap[$relative] = $path
        $relative
    }
)
[Array]::Sort($relativePaths, [System.StringComparer]::Ordinal)
if ($relativePaths.Count -eq 0) {
    throw "Gate108 source bundle contains no source files."
}

$sha256 = [System.Security.Cryptography.SHA256]::Create()
try {
    $manifestLines = [System.Collections.Generic.List[string]]::new()
    $manifestCsvLines = [System.Collections.Generic.List[string]]::new()
    $manifestCsvLines.Add('repo_relative_path,terminal_relative_path,raw_bytes,raw_sha256,canonical_bytes,canonical_sha256,self_identity_normalized')
    foreach ($relativePath in $relativePaths) {
        $fullPath = $pathMap[$relativePath]
        if (!$relativePath.StartsWith('automation/mt5/', [System.StringComparison]::Ordinal)) {
            throw "Gate108 closure path cannot map to a terminal: '$relativePath'."
        }
        $terminalRelativePath = $relativePath.Substring('automation/mt5/'.Length)
        $rawBytes = [System.IO.File]::ReadAllBytes($fullPath)
        $rawHashBytes = $sha256.ComputeHash($rawBytes)
        $rawHash = ([System.BitConverter]::ToString($rawHashBytes) -replace '-', '').ToLowerInvariant()
        $canonicalText = Read-CanonicalSourceText -Path $fullPath `
            -NormalizeSelfIdentity:($fullPath -ieq $buildInfoPath)
        $canonicalBytes = $utf8NoBom.GetBytes($canonicalText)
        $fileHashBytes = $sha256.ComputeHash($canonicalBytes)
        $fileHash = ([System.BitConverter]::ToString($fileHashBytes) -replace '-', '').ToLowerInvariant()
        $manifestLines.Add($relativePath + "`0" + $fileHash)
        $manifestCsvLines.Add((
            (ConvertTo-CsvField $relativePath) + ',' +
            (ConvertTo-CsvField $terminalRelativePath) + ',' +
            $rawBytes.Length + ',' + $rawHash + ',' +
            $canonicalBytes.Length + ',' + $fileHash + ',' +
            (($fullPath -ieq $buildInfoPath).ToString().ToLowerInvariant())
        ))
    }
    $manifestPayload = ($manifestLines -join "`n") + "`n"
    $bundleHashBytes = $sha256.ComputeHash($utf8NoBom.GetBytes($manifestPayload))
} finally {
    $sha256.Dispose()
}
$bundleHash = ([System.BitConverter]::ToString($bundleHashBytes) -replace '-', '').ToLowerInvariant()
$expectedBundleId = "sha256:$bundleHash"
$externalPaths = [string[]]@($externalIncludes)
[Array]::Sort($externalPaths, [System.StringComparer]::Ordinal)
$externalList = $externalPaths -join ";"

Write-Output "algorithm=$algorithm"
Write-Output "entrypoint=automation/mt5/Experts/Limni/LimniPortfolioEA.mq5"
Write-Output "source_count=$($relativePaths.Count)"
Write-Output "external_include_count=$($externalIncludes.Count)"
Write-Output "external_includes=$externalList"
Write-Output "bundle_id=$expectedBundleId"

if ($ManifestPath -ne "") {
    if (![System.IO.Path]::IsPathRooted($ManifestPath)) {
        $ManifestPath = Join-Path $repoRoot $ManifestPath
    }
    $ManifestPath = [System.IO.Path]::GetFullPath($ManifestPath)
    $protectedRoot = [System.IO.Path]::GetFullPath(
        (Join-Path $repoRoot 'automation\mt5')).TrimEnd('\', '/') +
        [System.IO.Path]::DirectorySeparatorChar
    if ($ManifestPath.StartsWith($protectedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Manifest output may not overlap the active MT5 source/preset/tool tree: '$ManifestPath'."
    }
    $manifestParent = Split-Path -Parent $ManifestPath
    if (!(Test-Path -LiteralPath $manifestParent -PathType Container)) {
        throw "Manifest parent directory does not exist: '$manifestParent'."
    }
    [System.IO.File]::WriteAllLines(
        $ManifestPath,
        [string[]]$manifestCsvLines,
        $utf8NoBom)
    Write-Output "manifest_path=$([System.IO.Path]::GetFullPath($ManifestPath))"
}

if ($PrintExpectedOnly) {
    exit 0
}

$buildInfo = Read-CanonicalSourceText -Path $buildInfoPath
$algorithmMatch = [regex]::Match($buildInfo, 'LP_EA_SOURCE_BUNDLE_ALGORITHM\s*=\s*"([^"]+)"')
$bundleMatch = [regex]::Match($buildInfo, 'LP_EA_SOURCE_BUNDLE_ID\s*=\s*"([^"]+)"')
if (!$algorithmMatch.Success -or !$bundleMatch.Success) {
    throw "BuildInfo source-bundle constants are missing."
}
if ($algorithmMatch.Groups[1].Value -cne $algorithm) {
    throw "Source-bundle algorithm mismatch: compiled='$($algorithmMatch.Groups[1].Value)' expected='$algorithm'."
}
if ($bundleMatch.Groups[1].Value -cne $expectedBundleId) {
    throw "Source-bundle identity mismatch: compiled='$($bundleMatch.Groups[1].Value)' expected='$expectedBundleId'."
}

Write-Output "status=MATCH"
