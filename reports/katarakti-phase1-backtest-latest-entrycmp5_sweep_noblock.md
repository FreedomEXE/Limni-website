# Katarakti Phase 1 Backtest

Generated: 2026-02-27T20:42:24.815Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Universe size: 5
Starting equity: +$100000.00
Entry mode: sweep
Exit mode: stepped_no_hard_sl
Max entries per pair/week: 1
Sweep Thu/Fri block (ET): off
Pair filter: EURUSD, GBPUSD, USDJPY, XAUUSD, BTCUSD

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | +1.55% | +0.00% | 50.00% | 4 | +0.39% | 0.000 |
| universal_v1__both__sweep010 | +0.57% | +2.26% | 31.58% | 19 | +0.03% | 0.251 |
| universal_v1__skip__sweep025 | +1.55% | +0.00% | 50.00% | 4 | +0.39% | 0.000 |
| universal_v1__both__sweep025 | +0.79% | +0.87% | 27.27% | 11 | +0.07% | 0.903 |
| tiered_v1__skip__sweep010 | +1.55% | +0.00% | 50.00% | 4 | +0.39% | 0.000 |
| tiered_v1__skip__sweep025 | +1.55% | +0.00% | 50.00% | 4 | +0.39% | 0.000 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 0 | 2 | 0 | 1 | 0 | 1 | 0 | 100.00% | 50.00% | 50.00% | 25.00% |
| universal_v1__both__sweep010 | 0 | 11 | 1 | 1 | 0 | 1 | 5 | 78.95% | 21.05% | 15.79% | 10.53% |
| universal_v1__skip__sweep025 | 0 | 2 | 0 | 1 | 0 | 1 | 0 | 100.00% | 50.00% | 50.00% | 25.00% |
| universal_v1__both__sweep025 | 0 | 6 | 1 | 1 | 0 | 1 | 2 | 81.82% | 27.27% | 18.18% | 9.09% |
| tiered_v1__skip__sweep010 | 0 | 2 | 0 | 1 | 0 | 1 | 0 | 100.00% | 50.00% | 50.00% | 25.00% |
| tiered_v1__skip__sweep025 | 0 | 2 | 0 | 1 | 0 | 1 | 0 | 100.00% | 50.00% | 50.00% | 25.00% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +32.77% | +36.92% | 6 | 100.00% |
| tiered_v1 | +32.77% | +36.92% | 6 | 100.00% |

JSON: `reports/katarakti-phase1-backtest-2026-02-27-entrycmp5_sweep_noblock.json`