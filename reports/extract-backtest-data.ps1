# Extract backtest data
$json = Get-Content 'manual-session-matrix-backtest-latest.json' -Raw | ConvertFrom-Json

Write-Output "=== BASIC COUNTS ==="
Write-Output "Total Variants: $($json.summaries.Count)"
Write-Output "Total Trades: $($json.trades.Count)"
Write-Output "Exit Research Summaries: $($json.exitResearch.summaries.Count)"
Write-Output ""

Write-Output "=== VARIANT SUMMARIES ==="
foreach ($variant in $json.summaries) {
    Write-Output "---"
    Write-Output "ID: $($variant.id)"
    Write-Output "Trades: $($variant.trades)"
    Write-Output "Win Rate (Session Close): $($variant.winRateSessionClosePct)%"
    Write-Output "Avg Session Return: $($variant.avgSessionReturnPct)%"
    Write-Output "Avg Week Return: $($variant.avgWeekReturnPct)%"
    Write-Output "Avg Week MAE: $($variant.avgWeekMaePct)%"
    Write-Output "P95 Week MAE: $($variant.p95WeekMaePct)%"
    Write-Output "Avg Week MFE: $($variant.avgWeekMfePct)%"
    Write-Output "P95 Week MFE: $($variant.p95WeekMfePct)%"
    Write-Output "Worst Week MAE: $($variant.worstWeekMaePct)%"
    Write-Output ""
    Write-Output "By Timeframe:"
    $variant.byTimeframe | ConvertTo-Json -Depth 5
    Write-Output ""
    Write-Output "By Session:"
    $variant.bySession | ConvertTo-Json -Depth 5
    Write-Output ""
}

Write-Output "=== TOP 10 EXIT COMBOS BY AVG RETURN (Positive Only) ==="
$topByReturn = $json.exitResearch.summaries | Where-Object { $_.avgReturnPct -gt 0 } | Sort-Object -Property avgReturnPct -Descending | Select-Object -First 10
foreach ($combo in $topByReturn) {
    Write-Output "---"
    Write-Output "Variant ID: $($combo.variantId)"
    Write-Output "Horizon: $($combo.horizon)"
    Write-Output "Stop Loss: $($combo.stopLossPct)%"
    Write-Output "Take Profit: $($combo.takeProfitPct)%"
    Write-Output "Trades: $($combo.trades)"
    Write-Output "Win Rate: $($combo.winRatePct)%"
    Write-Output "Avg Return: $($combo.avgReturnPct)%"
    Write-Output "Profit Factor: $($combo.profitFactor)"
    Write-Output "Stop Hit: $($combo.stopHitPct)%"
    Write-Output "Take Profit Hit: $($combo.takeProfitHitPct)%"
    Write-Output "Time Exit: $($combo.timeExitPct)%"
    Write-Output ""
}

Write-Output "=== TOP 5 EXIT COMBOS BY PROFIT FACTOR (Min 100 Trades) ==="
$topByPF = $json.exitResearch.summaries | Where-Object { $_.trades -ge 100 } | Sort-Object -Property profitFactor -Descending | Select-Object -First 5
foreach ($combo in $topByPF) {
    Write-Output "---"
    Write-Output "Variant ID: $($combo.variantId)"
    Write-Output "Horizon: $($combo.horizon)"
    Write-Output "Stop Loss: $($combo.stopLossPct)%"
    Write-Output "Take Profit: $($combo.takeProfitPct)%"
    Write-Output "Trades: $($combo.trades)"
    Write-Output "Win Rate: $($combo.winRatePct)%"
    Write-Output "Avg Return: $($combo.avgReturnPct)%"
    Write-Output "Profit Factor: $($combo.profitFactor)"
    Write-Output "Stop Hit: $($combo.stopHitPct)%"
    Write-Output "Take Profit Hit: $($combo.takeProfitHitPct)%"
    Write-Output "Time Exit: $($combo.timeExitPct)%"
    Write-Output ""
}

Write-Output "=== DATA QUALITY - MISSING PAIRS ==="
if ($json.dataQuality.missingPairs.Count -gt 0) {
    $json.dataQuality.missingPairs | ForEach-Object { Write-Output $_ }
} else {
    Write-Output "None"
}
