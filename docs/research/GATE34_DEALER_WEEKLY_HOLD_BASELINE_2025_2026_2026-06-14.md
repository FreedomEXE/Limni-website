# Gate 34 Dealer Weekly Hold Baseline - Clean 2025 + Current 2026

Date: 2026-06-14

Gate: Gate 34 weekly-hold-engine-research

## Decision

Dealer-only Weekly Hold now has a saved clean baseline for future source
comparison.

Correction after ADR audit:

- The original table in this note was generated before daily FX ADR bars were
  filled for 2025, so the 2025 and stitched ADR-normalized figures are stale.
- Daily FX ADR bars were materialized from canonical 1H bars on 2026-06-14 and
  the clean 2025, current 2026, and stitched 2025+2026 receipts were rerun.
- Corrected audit:
  `docs/research/GATE34_DEALER_WEEKLY_HOLD_2024_2026_AUDIT_2026-06-14.md`
- Corrected clean 2025 week-close:
  `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-39w-20260614-181048.md`
- Corrected clean 2025 fixed-band:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-39w-20260614-181610.md`
- Corrected stitched 2025+2026 week-close:
  `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-62w-20260614-184050.md`
- Corrected stitched 2025+2026 fixed-band:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-62w-20260614-184722.md`
- Corrected clean 2025: week-close raw `-11.14%`, ADR `+21.33%`, weekly ADR
  PF `1.14`, ADR DD `50.34%`; best broad fixed-band row `TP 1.0x / SL 2.45x`
  raw `+30.17%`, ADR `+42.26%`, ADR DD `25.71%`.
- Corrected stitched 2025+2026: week-close raw `+39.23%`, ADR `+95.03%`,
  weekly ADR PF `1.46`, ADR DD `50.34%`; broad fixed-band return leader
  `TP 1.6x / SL 2.45x` raw `+63.54%`, ADR `+121.74%`, ADR DD `41.30%`.

Use this as the first Dealer benchmark before testing Commercial, Sentiment,
Strength, tandem, or tiered source ideas. Do not promote a final TP/SL rule yet.

Important update from the next test: 2024 was later tested and failed badly for
Dealer-only Weekly Hold. See
`docs/research/GATE34_DEALER_WEEKLY_HOLD_2024_RESULT_2026-06-14.md`. This
2025+2026 baseline remains useful as a benchmark, but it is not a final pass.

## Clean Windows

- Clean 2025 window: displayed weeks `2025-01-06` through `2025-09-29`.
- Clean 2025 source reports: through CFTC report date `2025-09-23`.
- Shutdown source reports excluded from optimization research:
  `2025-09-30` through `2025-12-23` inclusive.
- Current 2026 window: displayed weeks `2026-01-06` through `2026-06-08`.
- Stitched baseline: exact 62-week set, 39 clean 2025 weeks plus 23 current
  2026 weeks.

Coverage proof for the clean 2025 window:

- 28 FX pairs.
- 39 weekly rows per pair.
- 1,092 `pair_period_returns` rows for `canonical` and 1,092 for `execution`.
- 1H canonical price path coverage was complete for all 1,092 pair-weeks before
  the receipts below were generated.

## Receipts

Clean 2025 week-close baseline:

- `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-39w-20260614-055715.md`
- `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-39w-20260614-055715.json`

Clean 2025 fixed-band sweep:

- `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-39w-20260614-060417.md`
- `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-39w-20260614-060417.json`

Stitched 2025+2026 week-close baseline:

- `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-62w-20260614-061144.md`
- `app/reports/data-verification/weekly-hold-basket-baseline/fx-28pair-dealer-weekly-hold-baseline-62w-20260614-061144.json`

Stitched 2025+2026 fixed-band sweep:

- `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-62w-20260614-061938.md`
- `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-62w-20260614-061938.json`

Matching 2026 broad-grid receipt used for apples-to-apples comparison:

- `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-23w-20260614-041301.md`

## Key Comparison

Note: the table in this section is first-pass/default-ADR history. Use the
corrected receipts listed above for current decision-making.

All returns below are ADR-normalized. DD/return and giveback/return are lower-is-better.

| Window | Variant | ADR Return | Weekly ADR PF | Trade ADR PF | Trade Expectancy | SL-Norm Return | DD/Return | Giveback/Return | Sharpe-Style | ADR Adv DD | Weekly W/L/F |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2025 clean | Week Close | -18.57% | 0.92 | 0.97 | -0.0170% | - | - | - | -0.18 | 73.97% | 17/22/0 |
| 2025 clean | Market TP 1.0x / SL 2.0x | +29.14% | 1.31 | 1.09 | +0.0276% | 14.57 | 0.994 | 0.878 | 0.66 | 28.97% | 22/17/0 |
| 2025 clean | Market TP 1.0x / SL 2.25x | +35.04% | 1.36 | 1.11 | +0.0332% | 15.57 | 0.825 | 0.632 | 0.76 | 28.91% | 24/15/0 |
| 2025 clean | Market TP 1.2x / SL 2.45x | +48.51% | 1.50 | 1.13 | +0.0455% | 19.80 | 0.608 | 0.610 | 0.97 | 29.48% | 21/18/0 |
| 2025 clean | Market TP 1.6x / SL 2.45x | +50.28% | 1.41 | 1.10 | +0.0466% | 20.52 | 0.668 | 0.587 | 0.87 | 33.59% | 19/20/0 |
| 2026 current | Week Close | +73.89% | 2.56 | 1.26 | +0.1147% | - | 0.396 | 0.229 | 1.61 | 29.25% | 17/6/0 |
| 2026 current | Market TP 1.0x / SL 2.0x | +72.92% | 6.00 | 1.45 | +0.1132% | 36.46 | 0.177 | 0.024 | 3.60 | 12.91% | 19/4/0 |
| 2026 current | Market TP 1.2x / SL 2.45x | +81.91% | 6.72 | 1.42 | +0.1272% | 33.43 | 0.148 | 0.042 | 3.49 | 12.13% | 17/6/0 |
| 2026 current | Market TP 1.6x / SL 2.45x | +98.81% | 7.45 | 1.42 | +0.1534% | 40.33 | 0.145 | 0.068 | 3.92 | 14.37% | 18/5/0 |
| 2025+2026 | Week Close | +55.32% | 1.20 | 1.06 | +0.0319% | - | 1.337 | 0.306 | 0.48 | 73.97% | 34/28/0 |
| 2025+2026 | Market TP 1.0x / SL 2.0x | +102.05% | 1.93 | 1.21 | +0.0601% | 51.03 | 0.284 | 0.017 | 2.05 | 28.97% | 41/21/0 |
| 2025+2026 | Market TP 1.0x / SL 2.25x | +110.22% | 1.96 | 1.23 | +0.0649% | 48.99 | 0.262 | 0.025 | 2.13 | 28.91% | 42/20/0 |
| 2025+2026 | Market TP 1.2x / SL 2.45x | +130.42% | 2.16 | 1.23 | +0.0763% | 53.23 | 0.226 | 0.027 | 2.32 | 29.48% | 38/24/0 |
| 2025+2026 | Market TP 1.6x / SL 2.45x | +149.10% | 2.09 | 1.21 | +0.0866% | 60.86 | 0.225 | 0.045 | 2.32 | 33.59% | 37/25/0 |

## Read

Clean 2025 alone is the important new pressure test:

- Blind week-close Dealer Weekly Hold was negative in clean 2025.
- Fixed market-week ADR TP/SL bands turned the same Dealer directions positive.
- The 1.5x SL variants were weak in 2025; the cleaner fixed-band behavior starts
  at SL 2.0x and improves at wider SLs.

The 62-week stitch confirms the broad conclusion:

- Week-close remains positive after adding 2026, but its 2025 weakness leaves it
  far worse on DD per return and stability.
- Fixed market-week bands materially improve PF, expectancy, adverse DD per unit
  return, giveback per unit return, and Sharpe-style weekly stability.
- `TP 1.0x / SL 2.0x` remains the clean simple candidate.
- `TP 1.2x / SL 2.45x` is the strongest stitched risk-adjusted row in this
  broad grid by weekly PF and marginal Sharpe-style score.
- `TP 1.6x / SL 2.45x` is the stitched return leader and has nearly identical
  Sharpe-style score to `1.2 / 2.45`, but it has higher drawdown, weaker 2025
  weekly W/L, and lower trade PF than the simpler/narrower alternatives.

Do not promote a final TP/SL from this gate. This baseline is strong enough to
compare other source signals against later, but final rule promotion waits for
broader receipt-backed windows and later indicator parity.

## Next Use

When testing another source, keep the same windows and compare against this
Dealer baseline first:

- clean 2025: `2025-01-06` through `2025-09-29`
- current 2026: `2026-01-06` through `2026-06-08`
- shutdown source reports excluded: `2025-09-30` through `2025-12-23`

Do not extend backward toward 2019 unless both source snapshots and price/path
coverage are receipt-backed for the added weeks.
