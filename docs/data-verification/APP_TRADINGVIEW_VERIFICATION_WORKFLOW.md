# App vs TradingView Data Verification Workflow

## Purpose

This is the truth gate before any trading bot work. The app and TradingView indicator must agree trade-by-trade before a system is selected for automation.

Scenario matrix and manual screenshot evidence are tracked in:

- `docs/data-verification/APP_TRADINGVIEW_EXECUTION_MATRIX.md`

Before comparing app numbers, read:

- `docs/testing/APP_PARITY_TESTING.md`

That guide defines which commands reproduce app-engine/sidebar metrics and which
commands export canonical app rows for TradingView parity. Do not compare
research-script totals to app/dashboard totals unless the script explicitly uses
the same app engine, week set, entry style, risk overlay, and metric adapter.

Use that matrix for every manual comparison so period state, anchor, normalization, live-bar mode, asset class, direction, and discrepancy classification stay explicit.

This workflow has three comparison layers:

1. Data section vs TradingView indicator for pair-level truth.
2. Data section vs Performance section wherever both expose the same execution-anchor pair/direction/week result.
3. Performance section vs TradingView indicator for strategy/grid/fill detail after the shared pair-level data agrees.

Performance is execution-anchored today. Market Truth checks are Data-section/indicator checks only unless Performance adds a Market Truth view.

Initial priority:

1. Tiered / ADR Grid / Pair Fill Cap
2. Tandem / ADR Grid / Pair Fill Cap

Both are verified on the execution anchor first.

## Export App Truth

Use the runtime export when the question is whether the current app engine/sidebar
matches TradingView. Use the database export when the question is whether
persisted ledger rows have been refreshed correctly. If the two disagree, treat
that as a stale artifact or ledger reconciliation issue before using either
surface as production truth.

Runtime engine export:

```powershell
npm run verification:export-runtime-app -- --week 2026-05-17T23:00:00.000Z --system tiered --f2 none --symbol EURUSD --template
```

Outputs:

- `reports/data-verification/runtime/<system>-adr_grid-<f2>-<week>-<symbols>-runtime-app-trades.json`
- `reports/data-verification/runtime/<system>-adr_grid-<f2>-<week>-<symbols>-runtime-app-trades.csv`
- `reports/data-verification/runtime/<system>-adr_grid-<f2>-<week>-<symbols>-indicator-template.csv`

Database-backed ledger export:

Run from `limni-website/`:

```powershell
npm run verification:export-app -- --system all --anchor execution --template
```

Optional narrow week window:

```powershell
npm run verification:export-app -- --system tiered --anchor execution --from-week 2026-05-24T23:00:00.000Z --to-week 2026-05-24T23:00:00.000Z --template
```

Outputs:

- `reports/data-verification/app/<systems>-execution-app-trades.json`
- `reports/data-verification/app/<systems>-execution-app-trades.csv`
- `reports/data-verification/app/<systems>-execution-indicator-template.csv`

The JSON includes row-level data, weekly totals, and all-time totals. Weekly and all-time totals are calculated from grid parent rows only, so fill detail is not double-counted.

## Indicator Export Contract

The indicator-side export should match this row schema. A CSV is enough.

Required columns:

| Column | Meaning |
|---|---|
| `system` | `tiered` or `tandem` |
| `strategyVariant` | `tiered_4w-adr_grid-pair_fill_cap` or `tandem-adr_grid-pair_fill_cap` |
| `anchorType` | `execution` for the first verification pass |
| `weekOpenUtc` | Exact app execution week open ISO timestamp |
| `rowKind` | `grid` parent row or `fill` detail row |
| `gridKey` | Optional; auto-derived if omitted |
| `pair` | App canonical symbol, e.g. `AUDCAD` |
| `direction` | `LONG` or `SHORT` |
| `sourceModel` | Tandem source sleeve (`dealer`, `commercial`, `sentiment`, `strength`) or tiered source id |
| `tier` | Tier number for Tiered, blank for non-tier rows |
| `fillSeq` | Fill sequence for fill rows; blank for grid rows |
| `entryUtc` | Entry timestamp |
| `exitUtc` | Exit timestamp |
| `entryPrice` | Executed entry price |
| `exitPrice` | Executed exit price |
| `returnRawPct` | Raw percent return in app units |
| `returnAdrNormalizedPct` | ADR-normalized return, when available |
| `adrPct` | ADR percentage used by the app, when available |
| `exitReason` | App-compatible exit label when available |
| `activeFillsAtEntry` | Pair Fill Cap state before the fill |
| `capThresholdAtEntry` | Pair Fill Cap threshold, normally `3` |

Aliases such as `week_open_utc`, `source_model`, `fill_seq`, and `raw_pct` are accepted by the diff script.

## Diff App vs Indicator

After creating an indicator CSV:

```powershell
npm run verification:diff -- --app reports/data-verification/app/tiered-tandem-execution-app-trades.json --indicator reports/data-verification/indicator/tiered-tandem-execution-indicator.csv
```

Output:

- `reports/data-verification/diffs/app-vs-indicator-<timestamp>.json`

The diff checks:

- Missing app rows in the indicator.
- Unexpected indicator rows not present in the app.
- Pair, direction, source/tier, fill order, entry, exit, prices, return, ADR value, exit reason, and Pair Fill Cap state.
- Weekly grid/fill counts and weekly totals.

Numeric tolerances:

- Prices: `0.00001`
- Returns and ADR values: `0.0001`
- Fill sequence, tier, and cap state: exact

## Discrepancy Classification

Every mismatch must be classified before automation:

- `app_bug`
- `indicator_bug`
- `rule_interpretation_gap`
- `missing_or_incorrect_source_data`

Do not select a system for bot automation until the diff is clean or every residual mismatch has a documented non-blocking classification.

## Recommended First Pass

1. Export Tiered and Tandem app rows for execution anchor.
2. Upgrade the Pine indicator to emit the same row schema for one week and one pair.
3. Start with AUDCAD if it has rows in the selected system/week; otherwise use the highest-row FX pair from the app export.
4. Compare one closed week until trade rows match.
5. Expand to all pairs for that week.
6. Expand week-by-week across closed history.
7. Only then inspect current week behavior.

Current week is last because source-data freshness and partial-week boundaries can create legitimate live-state differences.
