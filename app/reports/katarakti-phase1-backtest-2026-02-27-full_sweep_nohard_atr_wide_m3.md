# Katarakti Phase 1 Backtest

Generated: 2026-02-27T20:52:53.116Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Universe size: 36
Starting equity: +$100000.00
Entry mode: sweep
Exit mode: stepped_no_hard_sl
Lock style: atr
Max entries per pair/week: 3
Sweep Thu/Fri block (ET): off

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | +21.76% | +2.56% | 43.90% | 41 | +0.49% | 8.488 |
| universal_v1__both__sweep010 | +20.53% | +17.15% | 32.86% | 140 | +0.16% | 1.197 |
| universal_v1__skip__sweep025 | +16.28% | +1.74% | 45.83% | 24 | +0.65% | 9.351 |
| universal_v1__both__sweep025 | -12.18% | +38.42% | 35.64% | 101 | -0.02% | -0.317 |
| tiered_v1__skip__sweep010 | +21.76% | +2.56% | 43.90% | 41 | +0.49% | 8.488 |
| tiered_v1__skip__sweep025 | +16.28% | +1.74% | 45.83% | 24 | +0.65% | 9.351 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 0 | 15 | 9 | 0 | 0 | 5 | 12 | 75.61% | 56.10% | 43.90% | 39.02% |
| universal_v1__both__sweep010 | 0 | 61 | 21 | 0 | 0 | 14 | 44 | 71.43% | 42.86% | 31.43% | 23.57% |
| universal_v1__skip__sweep025 | 0 | 8 | 6 | 0 | 0 | 3 | 7 | 79.17% | 75.00% | 66.67% | 54.17% |
| universal_v1__both__sweep025 | 0 | 42 | 20 | 0 | 0 | 8 | 31 | 82.18% | 65.35% | 48.51% | 36.63% |
| tiered_v1__skip__sweep010 | 0 | 15 | 9 | 0 | 0 | 5 | 12 | 75.61% | 56.10% | 43.90% | 39.02% |
| tiered_v1__skip__sweep025 | 0 | 8 | 6 | 0 | 0 | 3 | 7 | 79.17% | 75.00% | 66.67% | 54.17% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +91.52% | +127.98% | 43 | 81.40% |
| tiered_v1 | +91.52% | +127.98% | 43 | 81.40% |

JSON: `reports/katarakti-phase1-backtest-2026-02-27-full_sweep_nohard_atr_wide_m3.json`