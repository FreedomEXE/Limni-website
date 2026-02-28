# Katarakti Phase 1 Backtest

Generated: 2026-02-27T20:42:28.197Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Universe size: 5
Starting equity: +$100000.00
Entry mode: sweep
Exit mode: stepped_no_hard_sl
Max entries per pair/week: 1
Sweep Thu/Fri block (ET): on
Pair filter: EURUSD, GBPUSD, USDJPY, XAUUSD, BTCUSD

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | +1.19% | +0.00% | 33.33% | 3 | +0.40% | 0.000 |
| universal_v1__both__sweep010 | +0.21% | +2.61% | 29.41% | 17 | +0.01% | 0.081 |
| universal_v1__skip__sweep025 | +1.19% | +0.00% | 33.33% | 3 | +0.40% | 0.000 |
| universal_v1__both__sweep025 | +1.35% | +0.00% | 25.00% | 8 | +0.17% | 0.000 |
| tiered_v1__skip__sweep010 | +1.19% | +0.00% | 33.33% | 3 | +0.40% | 0.000 |
| tiered_v1__skip__sweep025 | +1.19% | +0.00% | 33.33% | 3 | +0.40% | 0.000 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 0 | 2 | 0 | 0 | 0 | 1 | 0 | 100.00% | 33.33% | 33.33% | 33.33% |
| universal_v1__both__sweep010 | 0 | 10 | 1 | 0 | 0 | 1 | 5 | 76.47% | 17.65% | 11.76% | 11.76% |
| universal_v1__skip__sweep025 | 0 | 2 | 0 | 0 | 0 | 1 | 0 | 100.00% | 33.33% | 33.33% | 33.33% |
| universal_v1__both__sweep025 | 0 | 6 | 1 | 0 | 0 | 1 | 0 | 100.00% | 25.00% | 12.50% | 12.50% |
| tiered_v1__skip__sweep010 | 0 | 2 | 0 | 0 | 0 | 1 | 0 | 100.00% | 33.33% | 33.33% | 33.33% |
| tiered_v1__skip__sweep025 | 0 | 2 | 0 | 0 | 0 | 1 | 0 | 100.00% | 33.33% | 33.33% | 33.33% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +32.77% | +36.92% | 6 | 100.00% |
| tiered_v1 | +32.77% | +36.92% | 6 | 100.00% |

JSON: `reports/katarakti-phase1-backtest-2026-02-27-entrycmp5_sweep_block_thu_fri.json`