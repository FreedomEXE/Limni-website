# Research Context: 5Y Range Position Filter

**Date logged**: 2026-02-13  
**Scope**: Preserve the 5-year high/low filter concept and backtest outcomes for future in-app research runs.

## Hypothesis

Weekly entries may improve risk quality by filtering directional trades using long-term range position:

- `SHORT` filter rule: keep signal only when `distance_to_low > distance_to_high`.
- `LONG` symmetric variant: keep signal only when `distance_to_high > distance_to_low`.

Rationale: prefer trades with more directional room-to-run inside a multi-year range and potentially reduce drawdowns.

## What was tested

- Universe/models from stored `performance_snapshots` pair outcomes.
- Available history at run time: 4 weeks.
- Lookback window: 5 years.
- Entry reference: week-open hourly price.
- Range reference: prior 5-year daily highs/lows up to week open.

## Artifacts produced

- Script: `scripts/research-range-filter-5y.ts`
- Short-only report: `reports/range-filter-5y-backtest-short-only-2026-02-13.md`
- Short-only raw: `reports/range-filter-5y-backtest-short-only-2026-02-13.json`
- Symmetric report: `reports/range-filter-5y-backtest-short-and-long-2026-02-13.md`
- Symmetric raw: `reports/range-filter-5y-backtest-short-and-long-2026-02-13.json`

## Headline outcomes (4-week sample)

### Short-only filter

- Return: `340.34% -> 225.58%` (delta `-114.77%`)
- Max drawdown (weekly curve): `13.43% -> 11.84%` (delta `-1.60%`)
- Signals kept: `338/389` (`86.9%` pass)

### Short + Long symmetric filter

- Return: `340.34% -> 189.93%` (delta `-150.42%`)
- Max drawdown (weekly curve): `13.43% -> 5.70%` (delta `-7.73%`)
- Signals kept: `199/389` (`51.2%` pass)

## Interpretation

- The filter improved drawdown but reduced returns in this sample.
- Symmetric filtering cut drawdown more, but also removed many more signals and more return.
- This behaves like a risk-shaping overlay and should be evaluated on longer history before production use.

## Caveats

- Small sample size (4 weeks) limits confidence.
- Weekly-curve drawdown here is strategy-level, not tick/intraday path drawdown.
- Results should be treated as provisional and re-tested as more weeks accumulate.

## Follow-up ideas

1. Add strictness levels (not only midpoint split) to map return-vs-drawdown frontier.
2. Apply filter selectively by asset class/model instead of globally.
3. Add in-app compare views with pass-rate diagnostics and drawdown impact.
