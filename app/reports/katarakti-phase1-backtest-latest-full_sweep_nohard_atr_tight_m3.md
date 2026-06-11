# Katarakti Phase 1 Backtest

Generated: 2026-02-27T20:52:46.601Z
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
| universal_v1__skip__sweep010 | +6.07% | +2.88% | 34.04% | 47 | +0.13% | 2.106 |
| universal_v1__both__sweep010 | +5.81% | +10.35% | 32.13% | 249 | +0.03% | 0.561 |
| universal_v1__skip__sweep025 | +1.70% | +1.75% | 32.00% | 25 | +0.07% | 0.969 |
| universal_v1__both__sweep025 | +6.88% | +11.46% | 35.83% | 120 | +0.06% | 0.600 |
| tiered_v1__skip__sweep010 | +6.07% | +2.88% | 34.04% | 47 | +0.13% | 2.106 |
| tiered_v1__skip__sweep025 | +1.70% | +1.75% | 32.00% | 25 | +0.07% | 0.969 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 0 | 25 | 10 | 0 | 0 | 6 | 6 | 55.32% | 38.30% | 29.79% | 23.40% |
| universal_v1__both__sweep010 | 0 | 144 | 53 | 0 | 0 | 27 | 25 | 46.59% | 21.29% | 16.87% | 12.85% |
| universal_v1__skip__sweep025 | 0 | 14 | 6 | 0 | 0 | 2 | 3 | 68.00% | 60.00% | 48.00% | 36.00% |
| universal_v1__both__sweep025 | 0 | 60 | 32 | 0 | 0 | 9 | 19 | 67.50% | 44.17% | 32.50% | 22.50% |
| tiered_v1__skip__sweep010 | 0 | 25 | 10 | 0 | 0 | 6 | 6 | 55.32% | 38.30% | 29.79% | 23.40% |
| tiered_v1__skip__sweep025 | 0 | 14 | 6 | 0 | 0 | 2 | 3 | 68.00% | 60.00% | 48.00% | 36.00% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +91.52% | +127.98% | 43 | 81.40% |
| tiered_v1 | +91.52% | +127.98% | 43 | 81.40% |

JSON: `reports/katarakti-phase1-backtest-2026-02-27-full_sweep_nohard_atr_tight_m3.json`