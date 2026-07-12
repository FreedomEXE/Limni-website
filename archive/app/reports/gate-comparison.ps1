# Gate Mode Comparison Analysis
$json = Get-Content 'manual-session-matrix-backtest-latest.json' -Raw | ConvertFrom-Json

Write-Output "=== GATE MODE COMPARISON: LOWER_TIMEFRAME_REPLACE ==="
Write-Output ""

# Session Close Performance
Write-Output "SESSION CLOSE METRICS:"
Write-Output "---------------------"
$ungatedLTF = $json.summaries | Where-Object { $_.id -eq "ungated__lower_timeframe_replace" }
$frozenLTF = $json.summaries | Where-Object { $_.id -eq "frozen__lower_timeframe_replace" }
$liveLTF = $json.summaries | Where-Object { $_.id -eq "live__lower_timeframe_replace" }

Write-Output "UNGATED:"
Write-Output "  Trades: $($ungatedLTF.trades)"
Write-Output "  Win Rate: $($ungatedLTF.winRateSessionClosePct)%"
Write-Output "  Avg Session Return: $($ungatedLTF.avgSessionReturnPct)%"
Write-Output ""

Write-Output "FROZEN:"
Write-Output "  Trades: $($frozenLTF.trades)"
Write-Output "  Win Rate: $($frozenLTF.winRateSessionClosePct)%"
Write-Output "  Avg Session Return: $($frozenLTF.avgSessionReturnPct)%"
Write-Output ""

Write-Output "LIVE:"
Write-Output "  Trades: $($liveLTF.trades)"
Write-Output "  Win Rate: $($liveLTF.winRateSessionClosePct)%"
Write-Output "  Avg Session Return: $($liveLTF.avgSessionReturnPct)%"
Write-Output ""

# Week Close Performance
Write-Output "WEEK CLOSE METRICS:"
Write-Output "-------------------"
Write-Output "UNGATED:"
Write-Output "  Avg Week Return: $($ungatedLTF.avgWeekReturnPct)%"
Write-Output "  Avg Week MAE: $($ungatedLTF.avgWeekMaePct)%"
Write-Output "  Avg Week MFE: $($ungatedLTF.avgWeekMfePct)%"
Write-Output "  P95 Week MAE: $($ungatedLTF.p95WeekMaePct)%"
Write-Output "  Worst Week MAE: $($ungatedLTF.worstWeekMaePct)%"
Write-Output ""

Write-Output "FROZEN:"
Write-Output "  Avg Week Return: $($frozenLTF.avgWeekReturnPct)%"
Write-Output "  Avg Week MAE: $($frozenLTF.avgWeekMaePct)%"
Write-Output "  Avg Week MFE: $($frozenLTF.avgWeekMfePct)%"
Write-Output "  P95 Week MAE: $($frozenLTF.p95WeekMaePct)%"
Write-Output "  Worst Week MAE: $($frozenLTF.worstWeekMaePct)%"
Write-Output ""

Write-Output "LIVE:"
Write-Output "  Avg Week Return: $($liveLTF.avgWeekReturnPct)%"
Write-Output "  Avg Week MAE: $($liveLTF.avgWeekMaePct)%"
Write-Output "  Avg Week MFE: $($liveLTF.avgWeekMfePct)%"
Write-Output "  P95 Week MAE: $($liveLTF.p95WeekMaePct)%"
Write-Output "  Worst Week MAE: $($liveLTF.worstWeekMaePct)%"
Write-Output ""

Write-Output "=== CONCLUSION ==="
Write-Output "Best for Session Close: UNGATED (54.8% win rate, -0.0012% avg return)"
Write-Output "Best for Week Close: LIVE (1.0688% avg return, lowest MAE at 1.8343%)"
