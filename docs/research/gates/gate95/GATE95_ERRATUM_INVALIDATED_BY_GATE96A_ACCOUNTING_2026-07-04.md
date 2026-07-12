# Gate 95 Erratum: Invalidated By Gate 96A Accounting

Date: 2026-07-04

Gate 95 OOS headline net, profit factor, drawdown, monthly rankings, pair rankings, Candidate B performance conclusions, and promotion/ranking metrics are invalidated for research selection because Gate 96A found material actual-USD conversion accounting failures.

The original Gate 95 ledgers remain useful as raw entry, admission, execution-shape, movement-candle, and Type 3 structural evidence. They must not be used as final PnL evidence.

## Gate 96A Finding

Gate 96A passed movement-candle causality and failed accounting validation:

- movement-candle causality failures: `0`
- accounting validation failures: `2`
- Gate 95 `adr_event_0_025_type3_long_only` pre-audit accounting net: `+$9.31M`
- Gate 96A actual-USD marked net for the same audit row: `+$241.8K`
- Gate 95 `adr_event_0_05_type3_long_only` pre-audit accounting net: `+$853.6K`
- Gate 96A actual-USD marked net for the same audit row: `+$21.2K`

The old Gate 95 headline numbers are therefore invalidated model-accounting numbers. They may be referenced only as the Gate 95 pre-audit accounting error, not as strategy performance.

## Required Stop Line

No historical expansion, promotion, MT5 mutation, live/runtime selection, strategy selection, or research ranking may use the original Gate 95 accounting metrics.

Ignore the original Gate 95 values for:

- net/PnL
- profit factor
- drawdown
- equity curve
- monthly stability
- pair concentration
- Candidate B performance
- variant ranking

## Next Gate

The next bounded gate is:

`Gate 95R: limnihedge-type3-corrected-accounting-oos-replay`

Gate 95R must replay the same Gate 95 OOS matrix for `2025-01-01..2026-05-31` with corrected actual-USD accounting, marked terminal/open inventory, corrected cost-stress summaries, and fail-closed validation. It must not add variants, run `2019-2024`, mutate MT5, add lifecycle changes, or integrate Candidate B/Katarakti/Q/Triangle/LRMG changes beyond the existing Gate 95 reporting buckets.
