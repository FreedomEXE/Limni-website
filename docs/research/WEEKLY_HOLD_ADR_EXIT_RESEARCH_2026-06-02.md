# Weekly Hold ADR Exit Research

Date: 2026-06-02

## Scope

This note captures the first Weekly Hold exit test after the ADR Grid runner/refill research.

Test script:

- `scripts/backtest-weekly-hold-adr-exits.ts`

Data window:

- 19 realized app-style weeks
- `2026-01-19T00:00:00.000Z` through `2026-05-24T23:00:00.000Z`

Return mode:

- ADR-normalized
- H1 path bars

## Variants Tested

### Weekly Hold Baseline

The current Weekly Hold behavior:

- enter at the app's execution/week open
- hold until the weekly execution window close

### Close at +1x ADR

Per-trade exit rule:

- close the full trade when price reaches `+1x` that pair's weekly ADR from entry
- otherwise hold to week close

### Trail After +1x ADR

Per-trade exit rule:

- arm a trailing stop only after price reaches `+1x` pair ADR
- do not close immediately at the `+1x ADR` touch
- tested trail distances: `0.20 ADR`, `0.40 ADR`, `1.00 ADR`
- active stops are checked before updating from the next H1 bar

This avoids assuming a favorable intrabar order after the trail first arms.

## Main Result: Tandem Weekly Hold

| Variant | Return | Path DD | Return/DD | Path Sharpe | Trades | Weekly Win |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Weekly Hold | +214.05% | 31.50% | 6.79 | 1.67 | 2,712 | 63.2% |
| Close at +1x ADR | +264.66% | 30.57% | 8.66 | 1.98 | 2,712 | 78.9% |
| Trail after +1x, 0.20 ADR | +286.18% | 26.07% | 10.98 | 2.14 | 2,712 | 63.2% |
| Trail after +1x, 0.40 ADR | +311.44% | 24.89% | 12.51 | 2.32 | 2,712 | 57.9% |
| Trail after +1x, 1.00 ADR | +190.09% | 29.17% | 6.52 | 1.56 | 2,712 | 63.2% |

Best Tandem result:

- `Trail after +1x, 0.40 ADR`
- return improved by `+97.38%`
- path DD improved by `6.61` points
- path Sharpe improved by `0.65`
- return/DD improved from `6.79` to `12.51`

## Main Result: Tiered Weekly Hold

| Variant | Return | Path DD | Return/DD | Path Sharpe | Trades | Weekly Win |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Weekly Hold | +91.99% | 15.57% | 5.91 | 2.42 | 349 | 73.7% |
| Close at +1x ADR | +92.47% | 10.59% | 8.73 | 3.60 | 349 | 84.2% |
| Trail after +1x, 0.20 ADR | +90.42% | 10.22% | 8.85 | 3.50 | 349 | 84.2% |
| Trail after +1x, 0.40 ADR | +99.97% | 9.63% | 10.38 | 3.69 | 349 | 84.2% |
| Trail after +1x, 1.00 ADR | +79.81% | 12.37% | 6.45 | 2.68 | 349 | 73.7% |

Best Tiered result:

- `Trail after +1x, 0.40 ADR`
- return improved by `+7.99%`
- path DD improved by `5.94` points
- path Sharpe improved by `1.28`
- return/DD improved from `5.91` to `10.38`

## Additional Active Systems

The 2026-06-03 rerun extended the same 19-week test to Agreement and Selector.

### Agreement Weekly Hold

| Variant | Return | Path DD | Return/DD | Path Sharpe | Trades | Weekly Win |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Weekly Hold | +53.66% | 29.18% | 1.84 | 1.07 | 516 | 57.9% |
| Close at +1x ADR | +59.77% | 16.57% | 3.61 | 1.55 | 516 | 63.2% |
| Trail after +1x, 0.20 ADR | +59.27% | 16.65% | 3.56 | 1.53 | 516 | 57.9% |
| Trail after +1x, 0.40 ADR | +68.59% | 15.81% | 4.34 | 1.73 | 516 | 63.2% |
| Trail after +1x, 1.00 ADR | +41.10% | 24.45% | 1.68 | 1.01 | 516 | 57.9% |

Best Agreement result:

- `Trail after +1x, 0.40 ADR`
- return improved by `+14.92%`
- path DD improved by `13.37` points
- path Sharpe improved by `0.65`
- return/DD improved from `1.84` to `4.34`

### Selector Weekly Hold

| Variant | Return | Path DD | Return/DD | Path Sharpe | Trades | Weekly Win |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Weekly Hold | +19.65% | 53.99% | 0.36 | 0.33 | 883 | 52.6% |
| Close at +1x ADR | +36.09% | 40.87% | 0.88 | 0.65 | 883 | 57.9% |
| Trail after +1x, 0.20 ADR | +36.01% | 41.29% | 0.87 | 0.65 | 883 | 57.9% |
| Trail after +1x, 0.40 ADR | +45.12% | 39.03% | 1.16 | 0.83 | 883 | 57.9% |
| Trail after +1x, 1.00 ADR | +23.00% | 50.60% | 0.45 | 0.44 | 883 | 57.9% |

Best Selector result:

- `Trail after +1x, 0.40 ADR`
- return improved by `+25.47%`
- path DD improved by `14.96` points
- path Sharpe improved by `0.50`
- return/DD improved from `0.36` to `1.16`

## Active-System Snapshot

| System | Baseline Weekly Hold | Trail after +1x, 0.40 ADR | Delta |
| --- | ---: | ---: | ---: |
| Tandem | +214.05%, 31.50% DD, 1.67 Sharpe, 63.2% weekly win | +311.44%, 24.89% DD, 2.32 Sharpe, 57.9% weekly win | +97.38%, -6.61 DD, +0.65 Sharpe |
| Tiered | +91.99%, 15.57% DD, 2.42 Sharpe, 73.7% weekly win | +99.97%, 9.63% DD, 3.69 Sharpe, 84.2% weekly win | +7.99%, -5.94 DD, +1.28 Sharpe |
| Agreement | +53.66%, 29.18% DD, 1.07 Sharpe, 57.9% weekly win | +68.59%, 15.81% DD, 1.73 Sharpe, 63.2% weekly win | +14.92%, -13.37 DD, +0.65 Sharpe |
| Selector | +19.65%, 53.99% DD, 0.33 Sharpe, 52.6% weekly win | +45.12%, 39.03% DD, 0.83 Sharpe, 57.9% weekly win | +25.47%, -14.96 DD, +0.50 Sharpe |

## Production Gate

Do not backfill, ship, or wire this into the app yet.

The current `+1x ADR arm / 0.40 ADR trail` variant improves return, drawdown, Sharpe, and return/DD, but weekly win rate is still below the working production threshold on three of the four active systems:

- Tandem: `57.9%`
- Tiered: `84.2%`
- Agreement: `63.2%`
- Selector: `57.9%`

The next candidate should target at least `70%` weekly win rate across all four Weekly Hold systems before spending more implementation time on app backfill, Pine parity, screenshots, or release promotion.

## Next Research Sweep

Suggested next pass for the future agent:

- Sweep trail activation thresholds: `0.50 ADR`, `0.75 ADR`, `1.00 ADR`, and optionally `1.25 ADR`.
- Sweep trail distances: `0.20 ADR`, `0.30 ADR`, `0.40 ADR`, `0.60 ADR`.
- Test partial exit variants: close `50%` at activation, trail the remaining `50%`; also compare close `33%` / trail `67%`.
- Add a break-even guard after activation: once `+0.50 ADR` or `+1.00 ADR` is touched, stop cannot settle below entry for longs or above entry for shorts.
- Test Friday/time exits: close or tighten trail during the final session window rather than carrying all positions to the weekly close.
- Add a minimum signal-strength gate before entering Weekly Hold, especially for Tandem, Agreement, and Selector where weekly win rate is lagging.
- Split results by asset class: FX, metals, indices, oil, crypto. The same trail may not be optimal across all instruments.
- Rank candidates by weekly win rate first, then Sharpe, return/DD, total return, and max drawdown.

Useful acceptance rule for the next research run:

- primary gate: weekly win rate `>= 70%` on Tandem, Tiered, Agreement, and Selector
- secondary gate: no system should lose more than `10%` relative total return versus its current best trail result
- risk gate: path DD should remain below the current baseline Weekly Hold DD for each system

## Plain-English Read

This is the first exit modification in this research set that clearly improved Weekly Hold rather than only changing the shape.

The `+1x ADR` touch is acting like a useful confirmation point:

- immediate closure improves Weekly Hold, especially drawdown
- trailing after the touch performs better than immediate closure
- `0.40 ADR` trailing is the best tested balance so far
- `1.00 ADR` trailing is too wide and gives back too much

The result supports the user's hybrid thesis:

- Weekly Hold can carry fewer, larger, lower-cost trades
- ADR Grid can still harvest intraday movement
- a profitable Weekly Hold sleeve could offset the cost drag from smaller grid fills

## Current Conclusion

Keep `Weekly Hold + trail after +1x ADR, 0.40 ADR distance` as a useful research benchmark, not a release candidate.

Do not promote directly to app backfill, Pine parity, or production. Weekly win rate is still below the `70%` working threshold on Tandem, Agreement, and Selector.

The next useful work is the sweep above. Any future candidate still needs:

- longer-window validation if more weeks are available
- cost sensitivity
- FX-only and asset-class split
- comparison against broker-safe Friday liquidation buffers
- Pine verifier support if it remains promising

## Verification

Commands run:

- `npx tsc --noEmit --pretty false`
- `npx tsx scripts/backtest-weekly-hold-adr-exits.ts`

2026-06-03 rerun:

- extended `scripts/backtest-weekly-hold-adr-exits.ts` to cover Tandem, Tiered, Agreement, and Selector.
- reran `npx tsx scripts/backtest-weekly-hold-adr-exits.ts`.
