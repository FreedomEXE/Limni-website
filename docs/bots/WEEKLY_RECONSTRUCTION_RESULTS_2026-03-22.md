/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: docs/bots/WEEKLY_RECONSTRUCTION_RESULTS_2026-03-22.md
 *
 * Description:
 * Records the normalized weekly net-hold reconstruction for Universal
 * and Tiered V1-V3 under the week-reset drawdown rule.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

# Weekly Reconstruction Results — 2026-03-22

## Rules Locked

- Net only
- No hedging
- No carry / no rollover
- Hold all basket trades to week close
- Drawdown for weekly systems = fixed drawdown from week-start equity, reset every week
- All-time max drawdown = worst single weekly drawdown

## Canonical Weeks

- 2026-01-19
- 2026-01-26
- 2026-02-02
- 2026-02-09
- 2026-02-16
- 2026-02-23
- 2026-03-02
- 2026-03-08T23:00:00.000Z
- 2026-03-15T23:00:00.000Z

## Persisted Runs

- Universal V1 Net Hold: `strategy_backtest_runs.id = 12`
- Universal V2 Net Hold: `strategy_backtest_runs.id = 13`
- Universal V3 Net Hold: `strategy_backtest_runs.id = 14`
- Tiered V1 Net Hold: `strategy_backtest_runs.id = 15`
- Tiered V2 Net Hold: `strategy_backtest_runs.id = 16`
- Tiered V3 Net Hold: `strategy_backtest_runs.id = 17`

## Verified Baselines

| System | Return | Max DD | Trades | Win Rate |
|---|---:|---:|---:|---:|
| Universal V1 | -100.00% | 116.12% | 419 | 60.38% |
| Universal V2 | +297.01% | 75.19% | 396 | 61.87% |
| Universal V3 | -11.43% | 95.05% | 266 | 61.65% |
| Tiered V1 | +248.40% | 72.74% | 223 | 58.74% |
| Tiered V2 | +263.92% | 80.08% | 232 | 61.64% |
| Tiered V3 | +272.40% | 70.19% | 201 | 62.69% |

## Important Interpretation

These corrected baselines now use summed basket PnL rather than averaged pair returns. The previous reconstruction divided by total basket exposure, which materially understated the systems and broke the accounting model.

The corrected numbers also show that two systems are not investable in baseline form under canonical basket accounting:

- Universal V1 suffers a `-116.12%` week on `2026-03-08T23:00:00.000Z`, which floors compounded return at `-100.00%`
- Universal V3 suffers a `-95.05%` week on `2026-03-08T23:00:00.000Z`, leaving it slightly negative over the full 9-week window

Among the positive ungated baselines, the surface-level leaders are:

- Highest compounded return: Universal V2 at `+297.01%`
- Best drawdown / win-rate balance among positive baselines: Tiered V3 at `+272.40%`, `70.19%` max DD, `62.69%` win rate

That is still not enough to lock the weekly flagship. Canonical gated reruns are still required.

## Gate Comparison Status

The reconstruction audit also attaches an 8-week comparison against the existing gate overlay report:

- Universal V1 gated overlay: `+146.33%`, `1.19%` weekly-reset DD
- Universal V2 gated overlay: `+155.52%`, `2.22%` DD
- Universal V3 gated overlay: `+123.02%`, `2.75%` DD
- Tiered V1 gated overlay: `+1321.19%`, `0.00%` DD
- Tiered V2 gated overlay: `+297.30%`, `7.56%` DD
- Tiered V3 gated overlay: `+255.30%`, `5.19%` DD

These gated figures are **not yet canonical reconstructed runs**. They are recomputed from the existing gate-overlay report using compounded returns and the same week-reset DD rule. They are useful for investigation, but not yet safe enough to promote as the flagship weekly model without a dedicated gated rerun under the same normalized net-hold engine.

## Pair Universe Layer

The reconstruction now also persists one trade row for every signaled pair-week-system combination:

- traded pairs retain full pre-netting `modelSignals`, final net units / tier weight, and exact strategy contribution
- skipped pairs are also persisted as `direction = NEUTRAL` with `skippedByNetting = true`
- this feeds the pair-universe audit for future bubble-map research

## Files

- Audit JSON: [reports/weekly-reconstruction-audit.json](../../reports/weekly-reconstruction-audit.json)
- Pair universe JSON: [reports/pair-universe-audit.json](../../reports/pair-universe-audit.json)
- Reconstruction script: [scripts/reconstruct-weekly-systems.ts](../../scripts/reconstruct-weekly-systems.ts)
- Verification script: [scripts/verify-reconstruction.ts](../../scripts/verify-reconstruction.ts)
