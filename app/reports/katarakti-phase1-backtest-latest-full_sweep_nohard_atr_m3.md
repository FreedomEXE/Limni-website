# Katarakti Phase 1 Backtest

Generated: 2026-02-27T20:50:58.662Z
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
| universal_v1__skip__sweep010 | +12.58% | +2.63% | 33.33% | 45 | +0.27% | 4.784 |
| universal_v1__both__sweep010 | +4.41% | +10.03% | 29.17% | 216 | +0.03% | 0.440 |
| universal_v1__skip__sweep025 | +7.49% | +1.76% | 32.00% | 25 | +0.29% | 4.261 |
| universal_v1__both__sweep025 | +20.69% | +11.34% | 30.70% | 114 | +0.18% | 1.824 |
| tiered_v1__skip__sweep010 | +12.58% | +2.63% | 33.33% | 45 | +0.27% | 4.784 |
| tiered_v1__skip__sweep025 | +7.49% | +1.76% | 32.00% | 25 | +0.29% | 4.261 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 0 | 23 | 5 | 0 | 0 | 6 | 11 | 64.44% | 46.67% | 33.33% | 26.67% |
| universal_v1__both__sweep010 | 0 | 123 | 37 | 0 | 0 | 23 | 33 | 53.24% | 27.78% | 18.98% | 13.89% |
| universal_v1__skip__sweep025 | 0 | 13 | 4 | 0 | 0 | 2 | 6 | 72.00% | 64.00% | 52.00% | 40.00% |
| universal_v1__both__sweep025 | 0 | 59 | 19 | 0 | 0 | 12 | 24 | 74.56% | 53.51% | 35.96% | 27.19% |
| tiered_v1__skip__sweep010 | 0 | 23 | 5 | 0 | 0 | 6 | 11 | 64.44% | 46.67% | 33.33% | 26.67% |
| tiered_v1__skip__sweep025 | 0 | 13 | 4 | 0 | 0 | 2 | 6 | 72.00% | 64.00% | 52.00% | 40.00% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +91.52% | +127.98% | 43 | 81.40% |
| tiered_v1 | +91.52% | +127.98% | 43 | 81.40% |

JSON: `reports/katarakti-phase1-backtest-2026-02-27-full_sweep_nohard_atr_m3.json`