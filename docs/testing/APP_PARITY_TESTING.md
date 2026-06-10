# App-Parity Testing

Use this guide when a change must match the Limni app, especially Performance, ADR Grid, Pair Fill Cap, TradingView verifier work, or strategy result questions.

The rule is simple: app-parity numbers must come from the same app engine, week set, entry style, risk overlay, and metric adapter as the app. Do not compare dashboard numbers to one-off research scripts unless the script explicitly uses the same path below.

## Source Of Truth

Primary app engine:

- `src/lib/performance/weeklyHoldEngine.ts`
- `computeWeeklyHold(...)`
- `computeMultiWeekHold(...)`

Performance sidebar API:

- `src/app/api/performance/engine-stats/route.ts`
- Calls `computeWeeklyHold(...)` for the selected week.
- Calls `computeMultiWeekHold(...)` for all-time realized weeks.
- Builds sidebar metrics with `weeklyHoldToSidebarStatsWithPath(...)`.

Performance page canonical payload:

- Source weekly price rows: `pair_period_returns`.
- Execution-anchor rows must use `anchor_type = 'execution'` and the current `EXECUTION_ANCHOR_VERSION` from `src/lib/executionPriceWindows.ts`.
- Strategy surface cache: `strategy_week_shards`.
- Server loader: `src/lib/performance/strategyPageData.ts`.
- Shared APIs:
  - `src/app/api/performance/strategy-kernel-payload/route.ts`
  - `src/app/api/performance/strategy-page-data/route.ts`
- Client surfaces consume the same payload maps:
  - performance cards/sidebar/basket: `engineWeekMap` + `engineWeekResults`
  - simulation, rolling windows, return distribution, and daily/weekly/monthly calendar: `engineSimMap` + selected raw/normalized return mode

Raw-mode fallback rule:

- If the raw hourly simulation path exists, weekly rows, rolling windows, calendar returns, and simulation metrics use that path.
- If a raw hourly path is missing, the simulation section explicitly falls back to a raw weekly close path built from the same resolved weekly returns. Treat that as a labelled first-pass fallback, not an alternate source of truth.

TradingView verification exports:

- `scripts/verification/export-runtime-app-trades.ts`
  - Uses the current app runtime engine.
  - Use this when comparing the selected app engine/sidebar/Basket behavior against TradingView.
- `scripts/verification/export-app-trades.ts`
  - Reads persisted ADR Grid rows from the `trades` table.
  - Use this only when checking whether stored ledger rows have been refreshed correctly.
  - Reports both grid parent rows and fill rows so counts are not ambiguous.

If runtime export and database export disagree, treat that as a stale artifact or ledger reconciliation issue before using either surface as production truth.

## Fast Unit Regression

Run this when touching strategy selection, ADR Grid display conversion, trade drilldown, or canon trade rows:

```powershell
npm test -- src/lib/__tests__/engineAdapter.test.ts src/lib/__tests__/strategyConfigSelectionNormalization.test.ts src/lib/__tests__/tradeDrilldownRoute.test.ts src/lib/__tests__/canonWeekShard.test.ts src/lib/__tests__/canonClosedWeekDelta.test.ts
```

Run the full unit suite when the change crosses shared helpers:

```powershell
npm test
```

These tests verify app code contracts. They do not by themselves prove that a dashboard number matches a specific local or production DB snapshot.

## Reproduce Performance Sidebar Metrics

Start the app:

```powershell
npm run dev
```

Fetch Tiered ADR Grid with the production default Pair Fill Cap:

```powershell
curl "http://localhost:3000/api/performance/engine-stats?bias=tiered_4w&f1=adr_grid&f2=pair_fill_cap"
```

Fetch ADR Grid without Pair Fill Cap:

```powershell
curl "http://localhost:3000/api/performance/engine-stats?bias=tiered_4w&f1=adr_grid&f2=none"
```

Fetch one exact week:

```powershell
curl "http://localhost:3000/api/performance/engine-stats?bias=tiered_4w&f1=adr_grid&f2=pair_fill_cap&week=2026-05-24T23:00:00.000Z"
```

Use the JSON field names as the metric source:

- `allTime.totalReturnPct`: all-time app-engine return used by this sidebar path.
- `allTime.maxDrawdownPct`: all-time drawdown used by this sidebar path.
- `allTime.totalTrades`: all-time trade count from the engine result.
- `allTime.weeklyWinRate`: winning realized weeks divided by realized weeks.
- top-level `winRate`: selected-week trade/fill win rate.

If a UI card shows a different metric, trace that component and route before comparing. Some older comparison views use persisted snapshots or compounded weekly series instead of the sidebar engine result.

## Export Selected Runtime ADR Grid Rows

For app-vs-TradingView parity against the currently selected app engine, export runtime rows:

```powershell
npm run verification:export-runtime-app -- --week 2026-05-24T23:00:00.000Z --system tiered --f2 pair_fill_cap --template
```

For a single symbol:

```powershell
npm run verification:export-runtime-app -- --week 2026-05-24T23:00:00.000Z --system tandem --f2 pair_fill_cap --symbol EURUSD --template
```

Outputs:

- `reports/data-verification/runtime/<system>-adr_grid-<f2>-<week>-<symbols>-runtime-app-trades.json`
- `reports/data-verification/runtime/<system>-adr_grid-<f2>-<week>-<symbols>-runtime-app-trades.csv`
- `reports/data-verification/runtime/<system>-adr_grid-<f2>-<week>-<symbols>-indicator-template.csv`

Use this output when the question is whether the visible/current app runtime agrees with TradingView.

## Export Persisted ADR Grid Ledger Rows

For stored-ledger checks, export persisted app rows:

```powershell
npm run verification:export-app -- --system tiered --anchor execution --template
```

For Tiered and Tandem together:

```powershell
npm run verification:export-app -- --system all --anchor execution --template
```

For one week:

```powershell
npm run verification:export-app -- --system tiered --anchor execution --from-week 2026-05-24T23:00:00.000Z --to-week 2026-05-24T23:00:00.000Z --template
```

Outputs:

- `reports/data-verification/app/<system>-execution-app-trades.json`
- `reports/data-verification/app/<system>-execution-app-trades.csv`
- `reports/data-verification/app/<system>-execution-indicator-template.csv`

Read `allTimeTotals` for all-time exported row totals. Read `weeklyTotals` for week-level parent grid totals. Read `counts.grids` and `counts.fills` to avoid mixing parent-grid count with fill count.

Do not use this database-backed export as selected runtime proof unless it has been reconciled against the runtime export for the same week, system, entry style, risk overlay, and symbol scope.

## Diff App Rows Against TradingView

After exporting the indicator CSV:

```powershell
npm run verification:diff -- --app reports/data-verification/app/tiered-execution-app-trades.json --indicator reports/data-verification/indicator/tiered-execution-indicator.csv
```

Use this diff for trade-by-trade parity. A strategy is not verified for automation until missing rows, unexpected rows, prices, returns, ADR values, fill order, cap state, and weekly totals are clean or explicitly classified.

## Before/After Rule Changes

When changing ADR Grid rules:

1. Capture the current app metric with the `engine-stats` API or app export before editing.
2. Apply the rule change.
3. Bump the ADR Grid entry engine artifact version in `src/lib/performance/strategyArtifactVersions.ts`.
4. If the UI must refresh into the new data immediately, bump `GLOBAL_PRELOAD_CACHE_VERSION` in `src/lib/preload/preloadContract.ts`.
5. If execution windows change, also bump the execution anchor/derivation versions and add/refresh tests for DST-sensitive New York open/close behavior.
6. Rebuild or repair the affected strategy shards, then run the same command again from the same DB snapshot.
7. Compare only the same metric basis:
   - sidebar all-time vs sidebar all-time
   - exported grid parent totals vs exported grid parent totals
   - fill counts vs fill counts
   - weekly win rate vs weekly win rate
   - fill win rate vs fill win rate

Local database refresh for release/parity work:

```powershell
npm run db:migrate
npm run performance:refresh-canonical
npm run verification:visible-engine-stats
```

`performance:refresh-canonical` re-derives closed-week canonical and execution `pair_period_returns` from `canonical_price_bars` 1h rows, then rebuilds all 12 visible Performance strategy week-shard configurations. Use `-- --skip-pair-returns`, `-- --skip-strategy-shards`, `-- --key=<strategy:f1:f2>`, or `-- --weeks=<iso-week>,<iso-week>` only for a narrow repair.

2026-06-04 contract note:

- Market-truth/canonical rows remain the raw baseline and may infer actual early market closes from available 1h bars.
- Execution rows are strategy policy rows: Sunday 8pm New York open, Friday 9am New York new-entry cutoff, Friday 11am New York force close.
- ADR Grid Friday cutoff is `adr-grid-canonical-weekly-anchor-v7-friday-cutoff`.
- Strategy artifacts are `strategy-artifact-v33` for the v2.0.3 reset/crypto candidate. Existing checked-in canon bundles remain stale until regenerated under that contract.
- Execution windows are `execution_ny_crypto_sun20_v2` / `v5_execution_ny_crypto_sun20` for the v2.0.3 reset/crypto candidate.
- The 2026-06-04 Friday-cutoff refresh produced `684` canonical rows and `684` execution rows across `19` closed weeks, repaired all 12 visible strategy shards, and wrote `reports/data-verification/app/visible-engine-stats-2026-06-04.md`.
- Old EURUSD Pair Fill Cap checkpoints with `11-12` fills for May 18/May 25 are stale; patched runtime returns `7` fills / `+1.4%` for both samples.
- Any `execution_ny_session_v2` / Friday-4pm refresh outputs are stale under the new execution policy.

For the ADR Grid full-reset entry filter specifically, the app engine defaults
to the new rule. To reproduce the old/broken baseline without changing any other
engine path, start the app with:

```powershell
$env:LIMNI_ADR_GRID_RESET_ENTRY_FILTER = "off"; npm run dev
```

Then run the same `engine-stats` or export command against that server. Clear the
variable or start a fresh shell for the normal new-rule result.

For a direct A/B through the same app engine and sidebar metric adapter:

```powershell
npm run verification:compare-grid-reset-filter -- --bias tiered_4w --f1 adr_grid --f2 pair_fill_cap
```

To pin the selected week:

```powershell
npm run verification:compare-grid-reset-filter -- --bias tiered_4w --f1 adr_grid --f2 pair_fill_cap --week 2026-05-24T23:00:00.000Z
```

Do not compare:

- raw `computeMultiWeekHold` script output to a UI card unless the script uses the same week list and adapter as the card
- summed weekly return to compounded weekly return
- grid parent count to fill count
- weekly win rate to fill win rate
- local DB output to production output without confirming both DB snapshots contain the same weeks and rows

## Fresh Chat Checklist

Give a new chat this file first when asking for app-parity work. The minimum context is:

```text
Use docs/testing/APP_PARITY_TESTING.md.
Target: Tiered / ADR Grid / Pair Fill Cap.
Metric source: /api/performance/engine-stats unless I explicitly ask for TradingView row parity.
Do not compare research-script totals to dashboard totals.
```
