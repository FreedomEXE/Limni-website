# Katarakti Phase 1 Backtest

Generated: 2026-02-27T20:42:47.650Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Universe size: 36
Starting equity: +$100000.00
Entry mode: sweep
Exit mode: stepped_no_hard_sl
Max entries per pair/week: 1
Sweep Thu/Fri block (ET): off

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | +10.36% | +1.15% | 43.33% | 30 | +0.33% | 8.995 |
| universal_v1__both__sweep010 | +6.76% | +5.95% | 38.17% | 131 | +0.05% | 1.135 |
| universal_v1__skip__sweep025 | +5.21% | +0.17% | 44.44% | 18 | +0.28% | 29.860 |
| universal_v1__both__sweep025 | +8.61% | +1.92% | 45.83% | 72 | +0.12% | 4.485 |
| tiered_v1__skip__sweep010 | +10.36% | +1.15% | 43.33% | 30 | +0.33% | 8.995 |
| tiered_v1__skip__sweep025 | +5.21% | +0.17% | 44.44% | 18 | +0.28% | 29.860 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 0 | 13 | 2 | 2 | 0 | 6 | 7 | 83.33% | 40.00% | 30.00% | 20.00% |
| universal_v1__both__sweep010 | 0 | 58 | 17 | 10 | 0 | 13 | 33 | 78.63% | 33.59% | 19.85% | 10.69% |
| universal_v1__skip__sweep025 | 0 | 8 | 1 | 2 | 0 | 4 | 3 | 88.89% | 44.44% | 38.89% | 22.22% |
| universal_v1__both__sweep025 | 0 | 28 | 13 | 8 | 0 | 7 | 16 | 81.94% | 43.06% | 23.61% | 9.72% |
| tiered_v1__skip__sweep010 | 0 | 13 | 2 | 2 | 0 | 6 | 7 | 83.33% | 40.00% | 30.00% | 20.00% |
| tiered_v1__skip__sweep025 | 0 | 8 | 1 | 2 | 0 | 4 | 3 | 88.89% | 44.44% | 38.89% | 22.22% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +91.52% | +127.98% | 43 | 81.40% |
| tiered_v1 | +91.52% | +127.98% | 43 | 81.40% |

JSON: `reports/katarakti-phase1-backtest-2026-02-27-full_sweep_noblock_m1.json`