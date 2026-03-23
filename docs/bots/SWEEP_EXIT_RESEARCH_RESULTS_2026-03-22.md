/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
# Sweep Exit Research Results

Date: 2026-03-22

Files:
- [backtest-cfd-sweep-exit-research.ts](c:/Users/User/Documents/GitHub/limni-website/scripts/backtest-cfd-sweep-exit-research.ts)
- [cfd-sweep-exit-research-latest.json](c:/Users/User/Documents/GitHub/limni-website/reports/cfd-sweep-exit-research-latest.json)

## Purpose

Hold the promising sweep entries fixed and compare CFD-friendly exits:

- `sweep_010__w60__live`
- `sweep_010__w60__bb_confirm__live`

Exit modes tested:
- `SESSION_CLOSE`
- `WEEK_CLOSE`
- `RANGE_STOP_WEEK_CLOSE`
- `ATR_1_5_WEEK_CLOSE`
- `ATR_2_0_WEEK_CLOSE`
- `PARTIAL_50_SESSION_WEEK`
- `TIME_STOP_2SESS`

Assumptions:
- range stop = opposite range boundary plus `0.25 x range height`
- ATR stop = `M5 ATR(14)` at entry
- partial exit = close `50%` at session end, hold `50%` to week close
- time stop = if MFE `< 0.5%` after `24h`, exit; otherwise hold to week close

## Results

### sweep_010__w60__live

- `WEEK_CLOSE`
  - WR `57.89%`
  - avg return `+2.24%`
  - avg MAE `2.88%`
  - PF `2.67`

- `RANGE_STOP_WEEK_CLOSE`
  - WR `17.54%`
  - avg return `+0.28%`
  - avg MAE `0.92%`
  - PF `1.40`

- `ATR_1_5_WEEK_CLOSE`
  - WR `14.04%`
  - avg return `+0.17%`
  - avg MAE `0.54%`
  - PF `1.45`

- `ATR_2_0_WEEK_CLOSE`
  - WR `15.79%`
  - avg return `+0.07%`
  - avg MAE `0.67%`
  - PF `1.14`

- `PARTIAL_50_SESSION_WEEK`
  - WR `61.40%`
  - avg return `+0.94%`
  - avg MAE `1.91%`
  - PF `2.09`

- `TIME_STOP_2SESS`
  - WR `50.88%`
  - avg return `+1.90%`
  - avg MAE `2.67%`
  - PF `2.45`

### sweep_010__w60__bb_confirm__live

- `WEEK_CLOSE`
  - WR `66.67%`
  - avg return `+3.78%`
  - avg MAE `3.26%`
  - PF `3.82`

- `RANGE_STOP_WEEK_CLOSE`
  - WR `18.52%`
  - avg return `+0.72%`
  - avg MAE `1.12%`
  - PF `1.81`

- `ATR_1_5_WEEK_CLOSE`
  - WR `11.11%`
  - avg return `+0.27%`
  - avg MAE `0.60%`
  - PF `1.63`

- `ATR_2_0_WEEK_CLOSE`
  - WR `14.81%`
  - avg return `+0.18%`
  - avg MAE `0.71%`
  - PF `1.32`

- `PARTIAL_50_SESSION_WEEK`
  - WR `66.67%`
  - avg return `+1.77%`
  - avg MAE `2.11%`
  - PF `3.25`

- `TIME_STOP_2SESS`
  - WR `51.85%`
  - avg return `+2.88%`
  - avg MAE `3.08%`
  - PF `2.87`

## Interpretation

1. The original `WEEK_CLOSE` control is still the raw return winner.
2. Tighter CFD-friendly stops are better than the raw wick stop idea, but they still cut too much of the move.
3. `PARTIAL_50_SESSION_WEEK` is the first exit that looks genuinely useful:
   - it preserves win rate well
   - it cuts drawdown versus pure week-close
   - it keeps a large enough chunk of expectancy
4. `TIME_STOP_2SESS` is also credible:
   - it retains much more expectancy than stop-based exits
   - it trims some dead trades
   - drawdown reduction is smaller than the partial exit

## Practical read

Current best exit candidates for the sweep family:

- Raw alpha benchmark:
  - `WEEK_CLOSE`

- Best structured compromise:
  - `PARTIAL_50_SESSION_WEEK`

- Best secondary candidate:
  - `TIME_STOP_2SESS`

## Recommendation

Do not use raw wick stops on the CFD sweep family.

The next sensible path is:
- carry forward `WEEK_CLOSE`, `PARTIAL_50_SESSION_WEEK`, and `TIME_STOP_2SESS`
- then test them at the portfolio level rather than adding more entry filters
