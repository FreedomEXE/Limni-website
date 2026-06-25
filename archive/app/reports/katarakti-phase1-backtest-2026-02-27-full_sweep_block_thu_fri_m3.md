# Katarakti Phase 1 Backtest

Generated: 2026-02-27T20:43:33.394Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Universe size: 36
Starting equity: +$100000.00
Entry mode: sweep
Exit mode: stepped_no_hard_sl
Max entries per pair/week: 3
Sweep Thu/Fri block (ET): on

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | +5.79% | +0.00% | 44.83% | 29 | +0.19% | 0.000 |
| universal_v1__both__sweep010 | +0.05% | +12.25% | 42.02% | 119 | +0.00% | 0.004 |
| universal_v1__skip__sweep025 | +3.81% | +0.00% | 47.37% | 19 | +0.20% | 0.000 |
| universal_v1__both__sweep025 | +20.22% | +1.74% | 51.25% | 80 | +0.23% | 11.613 |
| tiered_v1__skip__sweep010 | +5.79% | +0.00% | 44.83% | 29 | +0.19% | 0.000 |
| tiered_v1__skip__sweep025 | +3.81% | +0.00% | 47.37% | 19 | +0.20% | 0.000 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 0 | 16 | 6 | 2 | 0 | 5 | 0 | 100.00% | 44.83% | 24.14% | 17.24% |
| universal_v1__both__sweep010 | 0 | 55 | 19 | 9 | 0 | 19 | 17 | 86.55% | 40.34% | 24.37% | 15.97% |
| universal_v1__skip__sweep025 | 0 | 10 | 4 | 2 | 0 | 3 | 0 | 100.00% | 47.37% | 26.32% | 15.79% |
| universal_v1__both__sweep025 | 0 | 38 | 21 | 8 | 0 | 10 | 3 | 97.50% | 50.00% | 23.75% | 12.50% |
| tiered_v1__skip__sweep010 | 0 | 16 | 6 | 2 | 0 | 5 | 0 | 100.00% | 44.83% | 24.14% | 17.24% |
| tiered_v1__skip__sweep025 | 0 | 10 | 4 | 2 | 0 | 3 | 0 | 100.00% | 47.37% | 26.32% | 15.79% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +91.52% | +127.98% | 43 | 81.40% |
| tiered_v1 | +91.52% | +127.98% | 43 | 81.40% |

JSON: `reports/katarakti-phase1-backtest-2026-02-27-full_sweep_block_thu_fri_m3.json`