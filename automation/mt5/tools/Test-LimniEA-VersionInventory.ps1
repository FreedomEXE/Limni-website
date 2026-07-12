param(
    [string]$RootPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($RootPath -eq "") {
    $RootPath = Join-Path $PSScriptRoot "..\Experts"
}
$RootPath = (Resolve-Path -LiteralPath $RootPath).Path
$files = @(Get-ChildItem -LiteralPath $RootPath -Recurse -File -Filter *.mq5 |
    Sort-Object FullName)
if ($files.Count -eq 0) { throw "No EA source files found under '$RootPath'." }

$rows = [System.Collections.Generic.List[string]]::new()
foreach ($file in $files) {
    $text = Get-Content -Raw -LiteralPath $file.FullName
    $matches = [regex]::Matches($text,
        '(?m)^\s*#property\s+version\s+"([^"]+)"\s*$')
    if ($matches.Count -ne 1) {
        throw "EA must contain exactly one visible #property version: $($file.FullName)"
    }
    $version = $matches[0].Groups[1].Value
    if ($version -notmatch '^\d+(\.\d+){1,3}$') {
        throw "EA version is not numeric/dotted: $($file.FullName) -> '$version'"
    }
    $relative = $file.FullName.Substring($RootPath.Length).TrimStart('\', '/')
    $rows.Add("ea=$relative|version=$version|status=PASS")
}

Write-Output "status=PASS"
Write-Output "ea_count=$($files.Count)"
$rows | ForEach-Object { Write-Output $_ }
