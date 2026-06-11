# Katarakti Phase 1 Backtest

Generated: 2026-02-27T20:29:23.898Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Universe size: 5
Starting equity: +$100000.00
Entry mode: week_open_hold
Exit mode: stepped_no_hard_sl
Max entries per pair/week: 1
Pair filter: EURUSD, GBPUSD, USDJPY, XAUUSD, BTCUSD

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | +4.36% | +0.00% | 66.67% | 6 | +0.72% | 0.000 |
| universal_v1__both__sweep010 | +3.56% | +2.82% | 54.55% | 22 | +0.16% | 1.260 |
| universal_v1__skip__sweep025 | +4.36% | +0.00% | 66.67% | 6 | +0.72% | 0.000 |
| universal_v1__both__sweep025 | +3.56% | +2.82% | 54.55% | 22 | +0.16% | 1.260 |
| tiered_v1__skip__sweep010 | +4.36% | +0.00% | 66.67% | 6 | +0.72% | 0.000 |
| tiered_v1__skip__sweep025 | +4.36% | +0.00% | 66.67% | 6 | +0.72% | 0.000 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 0 | 2 | 1 | 0 | 0 | 3 | 0 | 100.00% | 66.67% | 50.00% | 50.00% |
| universal_v1__both__sweep010 | 0 | 7 | 5 | 3 | 0 | 4 | 3 | 86.36% | 54.55% | 31.82% | 18.18% |
| universal_v1__skip__sweep025 | 0 | 2 | 1 | 0 | 0 | 3 | 0 | 100.00% | 66.67% | 50.00% | 50.00% |
| universal_v1__both__sweep025 | 0 | 7 | 5 | 3 | 0 | 4 | 3 | 86.36% | 54.55% | 31.82% | 18.18% |
| tiered_v1__skip__sweep010 | 0 | 2 | 1 | 0 | 0 | 3 | 0 | 100.00% | 66.67% | 50.00% | 50.00% |
| tiered_v1__skip__sweep025 | 0 | 2 | 1 | 0 | 0 | 3 | 0 | 100.00% | 66.67% | 50.00% | 50.00% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +32.77% | +36.92% | 6 | 100.00% |
| tiered_v1 | +32.77% | +36.92% | 6 | 100.00% |

JSON: `reports/katarakti-phase1-backtest-2026-02-27-entrycmp5_hold.json`