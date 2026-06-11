# Katarakti Phase 1 Backtest

Generated: 2026-03-03T05:08:04.641Z
Test plan: phase1
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z, 2026-02-23T00:00:00.000Z
Universe size: 36
Starting equity: +$100000.00
Entry mode: sweep
Exit mode: stepped_with_hard_sl
Lock style: fixed_pct
Max entries per pair/week: 1
Sweep Thu/Fri block (ET): off
Neutral both_ways variants included: no
Locked baseline variant: universal_v1__skip__sweep010

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | +9.36% | +1.22% | 41.18% | 34 | +0.27% | 7.661 |
| universal_v1__skip__sweep025 | +2.18% | +1.30% | 40.91% | 22 | +0.10% | 1.679 |
| tiered_v1__skip__sweep010 | +9.36% | +1.22% | 41.18% | 34 | +0.27% | 7.661 |
| tiered_v1__skip__sweep025 | +2.18% | +1.30% | 40.91% | 22 | +0.10% | 1.679 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 1 | 15 | 2 | 4 | 0 | 5 | 7 | 82.35% | 38.24% | 29.41% | 14.71% |
| universal_v1__skip__sweep025 | 3 | 8 | 1 | 4 | 0 | 3 | 3 | 77.27% | 40.91% | 36.36% | 13.64% |
| tiered_v1__skip__sweep010 | 1 | 15 | 2 | 4 | 0 | 5 | 7 | 82.35% | 38.24% | 29.41% | 14.71% |
| tiered_v1__skip__sweep025 | 3 | 8 | 1 | 4 | 0 | 3 | 3 | 77.27% | 40.91% | 36.36% | 13.64% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +93.15% | +131.70% | 50 | 80.00% |
| tiered_v1 | +89.49% | +123.37% | 48 | 79.17% |

## Portfolio Baseline (Apples-to-Apples Week-Open Hold)

| Baseline | Return | Max DD | Win Rate | Trades | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: |
| hold_portfolio__universal_v1__skip | +20.96% | +2.04% | 52.00% | 50 | +0.39% |
| hold_portfolio__tiered_v1__skip | +10.29% | +2.04% | 50.00% | 48 | +0.21% |

JSON: `reports/katarakti-phase1-backtest-2026-03-03.json`