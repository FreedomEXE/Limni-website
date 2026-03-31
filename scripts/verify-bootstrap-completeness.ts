import { loadStrategyBootstrapMap } from "../src/lib/performance/strategyBootstrap.server";

type VerificationRow = {
  selectionKey: string;
  ok: boolean;
  totalReturnPct: number | null;
  maxDrawdownPct: number | null;
  totalTrades: number | null;
  currentWeekTradeCount: number | null;
};

function fmtPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function fmtCount(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return String(value);
}

async function main() {
  const startedAt = Date.now();
  const entries = await loadStrategyBootstrapMap();

  const rows: VerificationRow[] = entries.map(([selectionKey, strategyData]) => ({
    selectionKey,
    ok: strategyData !== null,
    totalReturnPct: strategyData?.multiWeekResult.totalReturnPct ?? null,
    maxDrawdownPct: strategyData?.multiWeekResult.maxDrawdownPct ?? null,
    totalTrades: strategyData?.multiWeekResult.totalTrades ?? null,
    currentWeekTradeCount: strategyData?.weekResults[strategyData.currentWeekOpenUtc]?.tradeCount ?? null,
  }));

  console.log(`Bootstrap completeness check`);
  console.log(`Entries: ${rows.length}`);
  console.log(`Elapsed: ${((Date.now() - startedAt) / 1000).toFixed(2)}s`);
  console.log("");

  for (const row of rows) {
    const status = row.ok ? "OK  " : "FAIL";
    console.log(
      `${status} ${row.selectionKey} | return ${fmtPct(row.totalReturnPct)} | dd ${fmtPct(row.maxDrawdownPct)} | trades ${fmtCount(row.totalTrades)} | current-week ${fmtCount(row.currentWeekTradeCount)}`,
    );
  }

  const failures = rows.filter((row) => !row.ok);
  const specialSelections = [
    "selector_sentiment_override:weekly_hold:none",
    "tandem:weekly_hold:none",
    "selector_sentiment_override:adr_pullback:none",
    "tandem:adr_pullback:none",
    "selector_sentiment_override:weekly_hold:strength_gate",
    "tandem:weekly_hold:strength_gate",
    "sentiment:weekly_hold:none",
    "tiered_v3:weekly_hold:none",
    "sentiment:adr_pullback:none",
  ];

  console.log("");
  console.log("Highlighted selections");
  for (const selectionKey of specialSelections) {
    const row = rows.find((item) => item.selectionKey === selectionKey);
    if (!row) {
      console.log(`MISS ${selectionKey}`);
      continue;
    }
    console.log(
      `${row.ok ? "OK  " : "FAIL"} ${selectionKey} | return ${fmtPct(row.totalReturnPct)} | dd ${fmtPct(row.maxDrawdownPct)} | trades ${fmtCount(row.totalTrades)} | current-week ${fmtCount(row.currentWeekTradeCount)}`,
    );
  }

  console.log("");
  console.log(`Summary: ${rows.length - failures.length}/${rows.length} loaded successfully.`);

  if (failures.length > 0) {
    console.error("Bootstrap failures detected:");
    for (const failure of failures) {
      console.error(`- ${failure.selectionKey}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[verify-bootstrap-completeness] Unhandled error:", error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
