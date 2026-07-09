param(
    [Parameter(Mandatory = $true)]
    [string]$ReceiptCsv,
    [string]$OutputDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-OutputDir([string]$receiptCsv, [string]$outputDir) {
    if ($outputDir -eq "") {
        return (Split-Path -Parent (Resolve-Path -LiteralPath $receiptCsv).Path)
    }
    if (![System.IO.Path]::IsPathRooted($outputDir)) {
        $outputDir = Join-Path (Get-Location).Path $outputDir
    }
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
    return (Resolve-Path -LiteralPath $outputDir).Path
}

$receiptPath = (Resolve-Path -LiteralPath $ReceiptCsv).Path
$outDir = Resolve-OutputDir $receiptPath $OutputDir

$typeCounts = @{}
$typeStatusCounts = @{}
$rowCount = 0

Import-Csv -LiteralPath $receiptPath | ForEach-Object {
    $rowCount++
    $type = $_.receipt_type
    $status = $_.status
    if ($null -eq $type -or $type -eq "") { $type = "<blank>" }
    if ($null -eq $status -or $status -eq "") { $status = "<blank>" }

    if (!$typeCounts.ContainsKey($type)) { $typeCounts[$type] = 0 }
    $typeCounts[$type]++

    $key = "$type`t$status"
    if (!$typeStatusCounts.ContainsKey($key)) { $typeStatusCounts[$key] = 0 }
    $typeStatusCounts[$key]++
}

$byTypePath = Join-Path $outDir "receipt-type-histogram.csv"
$byStatusPath = Join-Path $outDir "receipt-type-status-histogram.csv"

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

$summary = [pscustomobject]@{
    receipt_csv = $receiptPath
    receipt_rows = $rowCount
    receipt_type_histogram = $byTypePath
    receipt_type_status_histogram = $byStatusPath
}

$summaryPath = Join-Path $outDir "receipt-histogram-summary.json"
$summary | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $summaryPath -Encoding ASCII
$summary
