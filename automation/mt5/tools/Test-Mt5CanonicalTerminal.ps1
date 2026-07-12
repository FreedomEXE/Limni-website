param(
    [string]$ManifestPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..\..")).Path
if ($ManifestPath -eq "") {
    $ManifestPath = Join-Path $repoRoot "automation\mt5\terminal-roots.json"
}
$manifest = Get-Content -Raw -LiteralPath (Resolve-Path -LiteralPath $ManifestPath) | ConvertFrom-Json
$canonicalId = '94497'
$canonicalDataRoot = 'C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB'
$canonicalMql5Root = Join-Path $canonicalDataRoot 'MQL5'
$canonicalMetaEditor = 'C:\Users\User\AppData\Roaming\Five Percent Online MetaTrader 5\MetaEditor64.exe'
$canonicalTerminal = 'C:\Users\User\AppData\Roaming\Five Percent Online MetaTrader 5\terminal64.exe'
$obsoleteTokens = @(
    '14275',
    '14275C4F9441C73E9E6547075C33FE6C',
    'MetaTrader 5 - alt',
    'Five Percent Online MetaTrader 5 - alt'
)

if (@($manifest.terminals).Count -ne 1 -or
    [string]$manifest.terminals[0].id -cne $canonicalId -or
    [string]$manifest.terminals[0].mql5Root -replace '/', '\' -cne $canonicalMql5Root -or
    [string]$manifest.terminals[0].metaEditor -replace '/', '\' -cne $canonicalMetaEditor -or
    [string]$manifest.terminals[0].terminalExe -replace '/', '\' -cne $canonicalTerminal) {
    throw 'Canonical terminal manifest mismatch.'
}
foreach ($path in @($canonicalMql5Root, $canonicalMetaEditor, $canonicalTerminal)) {
    if (!(Test-Path -LiteralPath $path)) { throw "Canonical terminal path missing: $path" }
}

$scanRoots = @(
    (Join-Path $repoRoot 'automation\mt5'),
    (Join-Path $repoRoot 'docs\backlog\CURRENT_WORK.md'),
    (Join-Path $repoRoot 'docs\research\gates\gate108')
)
$extensions = @('*.ps1','*.json','*.md','*.mq5','*.mqh','*.set','*.txt')
$obsoleteMatches = [System.Collections.Generic.List[object]]::new()
foreach ($root in $scanRoots) {
    if (!(Test-Path -LiteralPath $root)) { continue }
    $files = if ((Get-Item -LiteralPath $root).PSIsContainer) {
        @(Get-ChildItem -LiteralPath $root -Recurse -File -Include $extensions)
    } else { @((Get-Item -LiteralPath $root)) }
    foreach ($file in $files) {
        if ($file.FullName -ieq $PSCommandPath) { continue }
        if ($file.Name -eq 'GATE108A_CANONICAL_TERMINAL_CONSOLIDATION_2026-07-11.md') { continue }
        if ($file.FullName -match '\\artifacts\\') { continue }
        $lineNumber = 0
        foreach ($line in [System.IO.File]::ReadLines($file.FullName)) {
            $lineNumber++
            foreach ($token in $obsoleteTokens) {
                if ($line.IndexOf($token, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                    $obsoleteMatches.Add([pscustomobject]@{ path = $file.FullName; line = $lineNumber; token = $token })
                }
            }
        }
    }
}
if ($obsoleteMatches.Count -gt 0) {
    $details = ($obsoleteMatches | ForEach-Object { "$($_.path):$($_.line):$($_.token)" }) -join '; '
    throw "Obsolete active terminal reference(s): $details"
}

Write-Output 'status=PASS'
Write-Output "canonical_terminal_id=$canonicalId"
Write-Output "canonical_data_root=$canonicalDataRoot"
Write-Output "canonical_metaeditor=$canonicalMetaEditor"
Write-Output "canonical_terminal_exe=$canonicalTerminal"
Write-Output 'obsolete_active_reference_count=0'
