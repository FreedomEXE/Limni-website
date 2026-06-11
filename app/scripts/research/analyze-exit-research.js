const fs = require('fs');

// Read the JSON file
const data = JSON.parse(fs.readFileSync('app/reports/manual-session-matrix-backtest-latest.json', 'utf8'));

// 1. Count total exit sweep summaries
const exitSweeps = data.exitResearch?.summaries || [];
console.log('=== TOTAL EXIT SWEEP SUMMARIES ===');
console.log(`Total count: ${exitSweeps.length}\n`);

// 2. Top 10 by avgReturnPct
console.log('=== TOP 10 BY AVG RETURN % ===');
const topByReturn = [...exitSweeps]
  .sort((a, b) => b.avgReturnPct - a.avgReturnPct)
  .slice(0, 10);
topByReturn.forEach((s, i) => {
  console.log(`\n${i + 1}. ${s.variantId} | ${s.gateMode} | ${s.timePolicy} | ${s.horizon}`);
  console.log(`   SL: ${s.stopLossPct}% | TP: ${s.takeProfitPct}%`);
  console.log(`   Trades: ${s.trades} | WinRate: ${s.winRatePct}% | AvgReturn: ${s.avgReturnPct}%`);
  console.log(`   MedianReturn: ${s.medianReturnPct}% | Expectancy: ${s.expectancyPct}% | PF: ${s.profitFactor}`);
  console.log(`   AvgMAE: ${s.avgMaePct}% | P95MAE: ${s.p95MaePct}% | AvgMFE: ${s.avgMfePct}% | P95MFE: ${s.p95MfePct}%`);
  console.log(`   StopHit: ${s.stopHitPct}% | TPHit: ${s.takeProfitHitPct}% | TimeExit: ${s.timeExitPct}%`);
});

// 3. Top 10 by profitFactor
console.log('\n\n=== TOP 10 BY PROFIT FACTOR ===');
const topByPF = [...exitSweeps]
  .filter(s => s.profitFactor !== null && s.profitFactor !== undefined)
  .sort((a, b) => b.profitFactor - a.profitFactor)
  .slice(0, 10);
topByPF.forEach((s, i) => {
  console.log(`\n${i + 1}. ${s.variantId} | ${s.gateMode} | ${s.timePolicy} | ${s.horizon}`);
  console.log(`   SL: ${s.stopLossPct}% | TP: ${s.takeProfitPct}%`);
  console.log(`   Trades: ${s.trades} | WinRate: ${s.winRatePct}% | AvgReturn: ${s.avgReturnPct}%`);
  console.log(`   MedianReturn: ${s.medianReturnPct}% | Expectancy: ${s.expectancyPct}% | PF: ${s.profitFactor}`);
  console.log(`   AvgMAE: ${s.avgMaePct}% | P95MAE: ${s.p95MaePct}% | AvgMFE: ${s.avgMfePct}% | P95MFE: ${s.p95MfePct}%`);
  console.log(`   StopHit: ${s.stopHitPct}% | TPHit: ${s.takeProfitHitPct}% | TimeExit: ${s.timeExitPct}%`);
});

// 4. ungated__lower_timeframe_replace + WEEK_CLOSE + all SL/TP combos
console.log('\n\n=== UNGATED__LOWER_TIMEFRAME_REPLACE | WEEK_CLOSE | ALL SL/TP COMBOS ===');
const ungatedWeekClose = exitSweeps
  .filter(s => s.variantId === 'ungated__lower_timeframe_replace' && s.horizon === 'WEEK_CLOSE')
  .sort((a, b) => b.avgReturnPct - a.avgReturnPct);
console.log(`Total combinations: ${ungatedWeekClose.length}\n`);
ungatedWeekClose.forEach((s, i) => {
  console.log(`\n${i + 1}. ${s.gateMode} | ${s.timePolicy}`);
  console.log(`   SL: ${s.stopLossPct}% | TP: ${s.takeProfitPct}%`);
  console.log(`   Trades: ${s.trades} | WinRate: ${s.winRatePct}% | AvgReturn: ${s.avgReturnPct}%`);
  console.log(`   MedianReturn: ${s.medianReturnPct}% | Expectancy: ${s.expectancyPct}% | PF: ${s.profitFactor}`);
  console.log(`   AvgMAE: ${s.avgMaePct}% | P95MAE: ${s.p95MaePct}% | AvgMFE: ${s.avgMfePct}% | P95MFE: ${s.p95MfePct}%`);
  console.log(`   StopHit: ${s.stopHitPct}% | TPHit: ${s.takeProfitHitPct}% | TimeExit: ${s.timeExitPct}%`);
});

// 5. Passive exit summaries (top-level summaries)
console.log('\n\n=== PASSIVE EXIT VARIANT SUMMARIES (6 VARIANTS) ===');
const passiveSummaries = data.summaries || [];
console.log(`Total variants: ${passiveSummaries.length}\n`);
passiveSummaries.forEach((s, i) => {
  console.log(`\n${i + 1}. ${s.id} (${s.gateMode} | ${s.timePolicy})`);
  console.log(`   Trades: ${s.trades}`);
  console.log(`   WinRate (Session Close): ${s.winRateSessionClosePct}%`);
  console.log(`   Avg Session Return: ${s.avgSessionReturnPct}% | Median: ${s.medianSessionReturnPct}%`);
  console.log(`   Avg Week Return: ${s.avgWeekReturnPct}% | Median: ${s.medianWeekReturnPct}%`);
  console.log(`   Session MAE - Avg: ${s.avgSessionMaePct}% | P95: ${s.p95SessionMaePct}%`);
  console.log(`   Session MFE - Avg: ${s.avgSessionMfePct}% | P95: ${s.p95SessionMfePct}%`);
  console.log(`   Week MAE - Avg: ${s.avgWeekMaePct}% | P95: ${s.p95WeekMaePct}%`);
  console.log(`   Week MFE - Avg: ${s.avgWeekMfePct}% | P95: ${s.p95WeekMfePct}%`);
  console.log(`   Worst Week MAE: ${s.worstWeekMaePct}%`);
});
