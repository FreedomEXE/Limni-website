# Katarakti Phase 1 Backtest

Generated: 2026-02-27T21:57:47.892Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Universe size: 36
Starting equity: +$100000.00
Entry mode: sweep
Exit mode: stepped_no_hard_sl
Lock style: atr
Max entries per pair/week: 1
Sweep Thu/Fri block (ET): off
Neutral both_ways variants included: no
Locked baseline variant: universal_v1__skip__sweep010

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | +14.07% | +0.38% | 36.67% | 30 | +0.45% | 37.429 |
| universal_v1__skip__sweep025 | +8.50% | +0.17% | 33.33% | 18 | +0.46% | 48.768 |
| tiered_v1__skip__sweep010 | +14.07% | +0.38% | 36.67% | 30 | +0.45% | 37.429 |
| tiered_v1__skip__sweep025 | +8.50% | +0.17% | 33.33% | 18 | +0.46% | 48.768 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 0 | 16 | 2 | 0 | 0 | 5 | 7 | 63.33% | 46.67% | 36.67% | 30.00% |
| universal_v1__skip__sweep025 | 0 | 10 | 3 | 0 | 0 | 1 | 4 | 72.22% | 66.67% | 55.56% | 44.44% |
| tiered_v1__skip__sweep010 | 0 | 16 | 2 | 0 | 0 | 5 | 7 | 63.33% | 46.67% | 36.67% | 30.00% |
| tiered_v1__skip__sweep025 | 0 | 10 | 3 | 0 | 0 | 1 | 4 | 72.22% | 66.67% | 55.56% | 44.44% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +91.52% | +127.98% | 43 | 81.40% |
| tiered_v1 | +91.52% | +127.98% | 43 | 81.40% |

## Portfolio Baseline (Apples-to-Apples Week-Open Hold)

| Baseline | Return | Max DD | Win Rate | Trades | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: |
| hold_portfolio__universal_v1__skip | +12.61% | +0.23% | 48.84% | 43 | +0.28% |
| hold_portfolio__tiered_v1__skip | +12.61% | +0.23% | 48.84% | 43 | +0.28% |

JSON: `reports/katarakti-phase1-backtest-2026-02-27-ab_parity_nohard_atr.json`