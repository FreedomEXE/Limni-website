# Katarakti Phase 1 Backtest

Generated: 2026-02-27T20:04:16.079Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Universe size: 36
Starting equity: +$100000.00
Exit mode: stepped_with_hard_sl
Max entries per pair/week: 3

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | +5.24% | +3.42% | 40.82% | 49 | +0.11% | 1.531 |
| universal_v1__both__sweep010 | -10.35% | +13.43% | 32.91% | 234 | -0.04% | -0.770 |
| universal_v1__skip__sweep025 | -0.89% | +2.98% | 40.00% | 30 | -0.03% | -0.297 |
| universal_v1__both__sweep025 | +1.41% | +8.14% | 38.64% | 132 | +0.01% | 0.173 |
| tiered_v1__skip__sweep010 | +5.24% | +3.42% | 40.82% | 49 | +0.11% | 1.531 |
| tiered_v1__skip__sweep025 | -0.89% | +2.98% | 40.00% | 30 | -0.03% | -0.297 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 6 | 18 | 8 | 3 | 0 | 6 | 8 | 75.51% | 38.78% | 20.41% | 12.24% |
| universal_v1__both__sweep010 | 35 | 97 | 33 | 12 | 0 | 17 | 40 | 71.79% | 28.63% | 13.68% | 8.12% |
| universal_v1__skip__sweep025 | 6 | 9 | 5 | 3 | 0 | 3 | 4 | 70.00% | 40.00% | 23.33% | 10.00% |
| universal_v1__both__sweep025 | 20 | 50 | 26 | 11 | 0 | 10 | 15 | 75.76% | 37.88% | 17.42% | 8.33% |
| tiered_v1__skip__sweep010 | 6 | 18 | 8 | 3 | 0 | 6 | 8 | 75.51% | 38.78% | 20.41% | 12.24% |
| tiered_v1__skip__sweep025 | 6 | 9 | 5 | 3 | 0 | 3 | 4 | 70.00% | 40.00% | 23.33% | 10.00% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +91.52% | +127.98% | 43 | 81.40% |
| tiered_v1 | +91.52% | +127.98% | 43 | 81.40% |

JSON: `reports/katarakti-phase1-backtest-2026-02-27-hard_sl_m3.json`