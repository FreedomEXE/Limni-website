# Katarakti Phase 1 Backtest

Generated: 2026-02-27T20:42:50.901Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Universe size: 36
Starting equity: +$100000.00
Entry mode: sweep
Exit mode: stepped_no_hard_sl
Max entries per pair/week: 1
Sweep Thu/Fri block (ET): on

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | +3.84% | +0.00% | 38.89% | 18 | +0.21% | 0.000 |
| universal_v1__both__sweep010 | +4.24% | +3.93% | 39.78% | 93 | +0.05% | 1.080 |
| universal_v1__skip__sweep025 | +2.99% | +0.00% | 41.67% | 12 | +0.25% | 0.000 |
| universal_v1__both__sweep025 | +8.82% | +0.00% | 50.00% | 46 | +0.18% | 0.000 |
| tiered_v1__skip__sweep010 | +3.84% | +0.00% | 38.89% | 18 | +0.21% | 0.000 |
| tiered_v1__skip__sweep025 | +2.99% | +0.00% | 41.67% | 12 | +0.25% | 0.000 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 0 | 11 | 2 | 1 | 0 | 4 | 0 | 100.00% | 38.89% | 27.78% | 22.22% |
| universal_v1__both__sweep010 | 0 | 44 | 15 | 8 | 0 | 12 | 14 | 84.95% | 37.63% | 21.51% | 12.90% |
| universal_v1__skip__sweep025 | 0 | 7 | 1 | 1 | 0 | 3 | 0 | 100.00% | 41.67% | 33.33% | 25.00% |
| universal_v1__both__sweep025 | 0 | 23 | 10 | 6 | 0 | 5 | 2 | 97.83% | 47.83% | 26.09% | 10.87% |
| tiered_v1__skip__sweep010 | 0 | 11 | 2 | 1 | 0 | 4 | 0 | 100.00% | 38.89% | 27.78% | 22.22% |
| tiered_v1__skip__sweep025 | 0 | 7 | 1 | 1 | 0 | 3 | 0 | 100.00% | 41.67% | 33.33% | 25.00% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +91.52% | +127.98% | 43 | 81.40% |
| tiered_v1 | +91.52% | +127.98% | 43 | 81.40% |

JSON: `reports/katarakti-phase1-backtest-2026-02-27-full_sweep_block_thu_fri_m1.json`