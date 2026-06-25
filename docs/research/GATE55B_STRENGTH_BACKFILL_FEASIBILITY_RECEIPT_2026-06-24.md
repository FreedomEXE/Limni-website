# Gate 55B Strength Backfill Feasibility Receipt

Date: 2026-06-24

## Verdict

Status: `BACKFILL_FEASIBILITY_BLOCKED_BY_2018_M1_WARMUP`

Gate 55B can proceed as a source-contract rebuild, but selected-vs-fade testing
must not reopen yet. The current stores can represent the first 2019 execution
week differently, and neither store has the 2018 M1 warmup needed to calculate
the proposed weekly/monthly Strength horizons for the first matrix week.

No backfill, source fetch, source write, matrix write, scoring expansion, COT
combination, filter, threshold optimization, or final system selection was run.

## Scope

This receipt answers one source-contract question:

`Can the rebuilt Strength path cover the 2018 warmup through the first 2019
trade week from existing M1 data without a new source backfill?`

Answer: no.

## Required First-Week Warmup Boundary

First matrix week under review:

`2019-01-07T00:00:00.000Z`

Gate 55B's rebuilt Strength candidate currently supports:

- `15m`
- `30m`
- `1h`
- `4h`
- `24h`
- `1w`
- `1m`

The largest proposed horizon is `1m`, defined in code as `28,800` minutes.

For the first Friday Strength decision:

- Friday freeze target: `2019-01-04T22:00:00.000Z`
- Minimum `1m` lookback start: `2018-12-15T22:00:00.000Z`
- Practical FX bar warmup start: `2018-12-16T22:00:00.000Z`
- Required display weeks for warmup:
  - `2018-12-17`
  - `2018-12-24`
  - `2018-12-31`
- Required first execution display week:
  - `2019-01-07`

Therefore, filling the remaining Gate 55A unresolved `2019-01-07` rows from a
rebuilt Strength contract requires pre-window M1 coverage before the first
trade week, not just M1 coverage inside the execution week.

## Existing Coverage Probes

All commands below were read-only. None used `--execute`, `--write`, or source
fetch mode.

### Local SQLite M1 planner

Command:

```powershell
npx tsx app/scripts/verification/plan-local-m1-backfill.ts --from-year=2018 --to-year=2019 --latest-display-week=2019-01-07 --chunk-weeks=1 | Select-Object -Last 8
```

Result:

```text
chunk=47 | 2018-11-19..2018-11-19 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=48 | 2018-11-26..2018-11-26 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=49 | 2018-12-03..2018-12-03 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=50 | 2018-12-10..2018-12-10 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=51 | 2018-12-17..2018-12-17 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=52 | 2018-12-24..2018-12-24 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=53 | 2018-12-31..2018-12-31 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=54 | 2019-01-07..2019-01-07 | complete=28 | partial=0 | missing=0 | weakRows=0 | weakSymbols=0
```

Interpretation:

The local SQLite warehouse has all 28 FX pairs for the first 2019 execution
week, but it has no 2018 M1 warmup weeks. It cannot calculate the first Friday
monthly/weekly Strength state without approved 2018 M1 backfill.

### Canonical Postgres M1 planner

Command:

```powershell
npx tsx app/scripts/verification/plan-bulk-m1-backfill.ts --from-year=2018 --to-year=2019 --latest-display-week=2019-01-07 --chunk-weeks=1 | Select-Object -Last 8
```

Result:

```text
chunk=47 | 2018-11-19..2018-11-19 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=48 | 2018-11-26..2018-11-26 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=49 | 2018-12-03..2018-12-03 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=50 | 2018-12-10..2018-12-10 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=51 | 2018-12-17..2018-12-17 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=52 | 2018-12-24..2018-12-24 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=53 | 2018-12-31..2018-12-31 | complete=0 | partial=0 | missing=28 | weakRows=28 | weakSymbols=28
chunk=54 | 2019-01-07..2019-01-07 | complete=11 | partial=1 | missing=16 | weakRows=17 | weakSymbols=17
```

Interpretation:

The canonical Postgres M1 store is weaker than local SQLite at the first 2019
execution week and also lacks the 2018 warmup weeks. It is not sufficient as-is
for the Gate 55B rebuild boundary.

### Existing Strength-history lookup

Command:

```powershell
npx tsx app/scripts/verification/export-strength-history-context.ts --week=2019-01-07 --read-existing-only --weekly-context --windows=15m,30m,1h,4h,24h,1w,1m
```

Result excerpt:

```text
readExisting rows=0 elapsed=1.24s
weeklyContext week=2019-01-07T00:00:00.000Z points=friday_close,market_open_confirmation
weeklyContextSummary point=friday_close | available=0/28 | long=0 | short=0 | neutral=28 | missing={"missing_strength_windows":28}
weeklyContextSummary point=market_open_confirmation | available=0/28 | long=0 | short=0 | neutral=28 | missing={"missing_strength_windows":28}
```

Interpretation:

Existing `strength_history_snapshots` data cannot seed the first 2019 week.
The rebuilt path must derive and persist auditable historical Strength rows
before selected-vs-fade testing can reopen.

### Storage-scale estimate for all candidate windows

Command:

```powershell
npx tsx app/scripts/verification/export-strength-history-context.ts --week=2019-01-07 --estimate-only --windows=15m,30m,1h,4h,24h,1w,1m
```

Result:

```text
estimate cadence=1m | snapshots=2620800 | currencyRows=146764800 | pairLookupCells=513676800
estimate cadence=5m | snapshots=524160 | currencyRows=29352960 | pairLookupCells=102735360
estimate cadence=15m | snapshots=174720 | currencyRows=9784320 | pairLookupCells=34245120
```

Interpretation:

Seven candidate windows at `15m` cadence imply `9,784,320` currency rows over
seven years. Pair lookup cells should remain computed from an indexed currency
snapshot store unless a later gate explicitly approves materializing them.

## Source Store Finding

Neither current store can satisfy Gate 55B unchanged:

| Store | 2018 warmup | 2019-01-07 execution week | Gate 55B read |
|---|---:|---:|---|
| Local SQLite `canonical_m1_bars` | 0/84 required pair-week rows complete for `2018-12-17`, `2018-12-24`, `2018-12-31` | 28/28 complete | Better rebuild staging candidate, but needs approved warmup backfill. |
| Postgres `canonical_price_bars` | 0/84 required pair-week rows complete for `2018-12-17`, `2018-12-24`, `2018-12-31` | 11 complete, 1 partial, 16 missing | Not enough for first-week rebuild without both warmup and execution-week repair. |
| Existing Strength history | 0 rows for first-week lookup | 0/28 available for both Friday and market-open context | Must be rebuilt from M1 source rows. |

## Partial-Week And Tie Handling Rule

Gate 55B should freeze a deterministic partial-week rule before any outcome
testing. Proposed rule for the rebuilt baseline:

1. Compute raw Strength only from windows that meet the frozen minimum coverage
   threshold.
2. If the required frozen horizon set is complete, use the rebuilt Strength
   side.
3. If source rows exist but the required horizon set is incomplete, carry the
   latest prior same-pair rebuilt Strength side and bucket with no lookahead.
4. If windows are complete but the direction calculation ties, carry the latest
   prior same-pair rebuilt Strength side and bucket with no lookahead.
5. If no prior same-pair rebuilt Strength side exists after approved warmup,
   mark the row `UNRESOLVED_NO_PRIOR_STRENGTH`; do not seed it from selected,
   fade, default-long, provider fallback, or future data.
6. Count native, carried-partial, carried-tie, stale, missing, and unresolved
   rows separately in every receipt.

This mirrors the COT baseline discipline without silently inheriting the
current `fallback_long_default` behavior from Strength helper code.

## Hash And Lineage Strategy

Gate 55B should require hashes before selected-vs-fade testing reopens:

| Hash | Payload |
|---|---|
| `raw_m1_bar_hash` | Sorted raw bar rows: `symbol`, `timeframe`, `bar_open_utc`, `bar_close_utc`, OHLC, source provider, quality status. |
| `coverage_manifest_hash` | Sorted pair-week coverage rows: symbol, week, expected bars, actual bars, first bar, last bar, coverage status. |
| `feature_contract_hash` | Frozen JSON contract: source precedence, derivation version, windows, cadence, coverage threshold, missing policy, tie policy, stale policy, fallback policy. |
| `currency_strength_snapshot_hash` | Sorted derived currency Strength rows by snapshot time, window, currency, raw strength, normalized strength, coverage, contributing pairs, derivation version. |
| `pair_decision_hash` | Sorted pair-level decision rows by week, pair, decision point, windows used, composite score, side, bucket, missing/tie/stale/fallback reason. |

The source precedence must be explicit. A later approved rebuild may choose:

- Local SQLite as the seven-year research warehouse, with Postgres only as live
  app/current source.
- Postgres as the canonical raw M1 store after missing 2018 and first-2019
  gaps are repaired.
- Dual-source comparison, with both hashes retained and mismatches failing
  closed.

Gate 55B should not mix these modes inside one scored receipt.

## Required Next Approval

The next Gate 55B implementation step is not selected-vs-fade scoring. It is an
approval decision:

`Approve or reject a no-outcome M1 warmup/backfill plan for 2018-12-17 through
2019-01-07, including source identity, storage target, and hash receipts.`

If approved, the smallest follow-up should still be source-only:

1. Backfill/repair only the required warmup boundary in the selected store.
2. Produce M1 coverage and raw source hashes.
3. Derive Strength history for the first 2019 week without scoring outcomes.
4. Prove 28/28 pair decisions or deterministic no-lookahead fallbacks.
5. Only then reopen selected-vs-fade baseline testing under the rebuilt
   contract.

## Hard Locks Preserved

- No COT+Strength combination.
- No horizon-by-PnL selection.
- No threshold optimization.
- No pair filtering.
- No regime overlay.
- No BPR/RRP retests.
- No PPP/NEER/REER work.
- No execution optimization.
- No risk overlay.
- No MT5/live/bot work.
- No production/live claims.
- No final Signal Model selection.
- No selected-vs-fade retest until source coverage and feature lineage pass.
