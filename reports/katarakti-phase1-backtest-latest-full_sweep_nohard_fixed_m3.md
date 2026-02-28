# Katarakti Phase 1 Backtest

Generated: 2026-02-27T20:50:55.299Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Universe size: 36
Starting equity: +$100000.00
Entry mode: sweep
Exit mode: stepped_no_hard_sl
Lock style: fixed_pct
Max entries per pair/week: 3
Sweep Thu/Fri block (ET): off

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | +12.02% | +2.16% | 45.83% | 48 | +0.24% | 5.554 |
| universal_v1__both__sweep010 | +0.03% | +13.44% | 38.04% | 184 | +0.00% | 0.003 |
| universal_v1__skip__sweep025 | +4.80% | +1.74% | 48.28% | 29 | +0.16% | 2.753 |
| universal_v1__both__sweep025 | +21.49% | +4.15% | 46.46% | 127 | +0.16% | 5.181 |
| tiered_v1__skip__sweep010 | +12.02% | +2.16% | 45.83% | 48 | +0.24% | 5.554 |
| tiered_v1__skip__sweep025 | +4.80% | +1.74% | 48.28% | 29 | +0.16% | 2.753 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 0 | 21 | 8 | 4 | 0 | 7 | 8 | 87.50% | 43.75% | 25.00% | 14.58% |
| universal_v1__both__sweep010 | 0 | 83 | 28 | 12 | 0 | 20 | 41 | 80.43% | 34.78% | 19.57% | 11.41% |
| universal_v1__skip__sweep025 | 0 | 11 | 5 | 4 | 0 | 4 | 5 | 86.21% | 48.28% | 31.03% | 13.79% |
| universal_v1__both__sweep025 | 0 | 52 | 27 | 12 | 0 | 13 | 23 | 85.83% | 44.88% | 22.83% | 10.24% |
| tiered_v1__skip__sweep010 | 0 | 21 | 8 | 4 | 0 | 7 | 8 | 87.50% | 43.75% | 25.00% | 14.58% |
| tiered_v1__skip__sweep025 | 0 | 11 | 5 | 4 | 0 | 4 | 5 | 86.21% | 48.28% | 31.03% | 13.79% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +91.52% | +127.98% | 43 | 81.40% |
| tiered_v1 | +91.52% | +127.98% | 43 | 81.40% |

JSON: `reports/katarakti-phase1-backtest-2026-02-27-full_sweep_nohard_fixed_m3.json`