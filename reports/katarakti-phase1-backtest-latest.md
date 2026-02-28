# Katarakti Phase 1 Backtest

Generated: 2026-02-27T21:04:20.539Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Universe size: 36
Starting equity: +$100000.00
Entry mode: sweep
Exit mode: stepped_with_hard_sl
Lock style: fixed_pct
Max entries per pair/week: 1
Sweep Thu/Fri block (ET): off
Neutral both_ways variants included: no
Locked baseline variant: universal_v1__skip__sweep010

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | +8.60% | +1.22% | 40.00% | 30 | +0.28% | 7.038 |
| universal_v1__skip__sweep025 | +3.53% | +1.17% | 38.89% | 18 | +0.19% | 3.007 |
| tiered_v1__skip__sweep010 | +8.60% | +1.22% | 40.00% | 30 | +0.28% | 7.038 |
| tiered_v1__skip__sweep025 | +3.53% | +1.17% | 38.89% | 18 | +0.19% | 3.007 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 1 | 13 | 2 | 2 | 0 | 5 | 7 | 80.00% | 36.67% | 26.67% | 16.67% |
| universal_v1__skip__sweep025 | 1 | 8 | 1 | 2 | 0 | 3 | 3 | 83.33% | 38.89% | 33.33% | 16.67% |
| tiered_v1__skip__sweep010 | 1 | 13 | 2 | 2 | 0 | 5 | 7 | 80.00% | 36.67% | 26.67% | 16.67% |
| tiered_v1__skip__sweep025 | 1 | 8 | 1 | 2 | 0 | 3 | 3 | 83.33% | 38.89% | 33.33% | 16.67% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +91.52% | +127.98% | 43 | 81.40% |
| tiered_v1 | +91.52% | +127.98% | 43 | 81.40% |

## Portfolio Baseline (Apples-to-Apples Week-Open Hold)

| Baseline | Return | Max DD | Win Rate | Trades | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: |
| hold_portfolio__universal_v1__skip | +10.62% | +2.04% | 51.16% | 43 | +0.24% |
| hold_portfolio__tiered_v1__skip | +10.62% | +2.04% | 51.16% | 43 | +0.24% |

JSON: `reports/katarakti-phase1-backtest-2026-02-27.json`