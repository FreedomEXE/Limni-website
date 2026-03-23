# Katarakti Phase 1 Backtest

Generated: 2026-03-20T16:57:07.644Z
Test plan: phase1
Weeks: 2026-01-18T23:00:00.000Z, 2026-01-25T23:00:00.000Z, 2026-02-01T23:00:00.000Z, 2026-02-08T23:00:00.000Z, 2026-02-15T23:00:00.000Z, 2026-02-22T23:00:00.000Z, 2026-03-01T23:00:00.000Z, 2026-03-08T23:00:00.000Z
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
| universal_v1__skip__sweep010 | -0.28% | +0.43% | 12.50% | 8 | -0.04% | -0.653 |
| universal_v1__skip__sweep025 | -0.28% | +0.43% | 16.67% | 6 | -0.05% | -0.653 |
| tiered_v1__skip__sweep010 | -0.28% | +0.43% | 14.29% | 7 | -0.04% | -0.653 |
| tiered_v1__skip__sweep025 | -0.28% | +0.43% | 20.00% | 5 | -0.06% | -0.653 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| universal_v1__skip__sweep010 | 0 | 6 | 1 | 0 | 0 | 0 | 1 | 87.50% | 12.50% | 0.00% | 0.00% |
| universal_v1__skip__sweep025 | 0 | 4 | 1 | 0 | 0 | 0 | 1 | 83.33% | 16.67% | 0.00% | 0.00% |
| tiered_v1__skip__sweep010 | 0 | 5 | 1 | 0 | 0 | 0 | 1 | 85.71% | 14.29% | 0.00% | 0.00% |
| tiered_v1__skip__sweep025 | 0 | 3 | 1 | 0 | 0 | 0 | 1 | 80.00% | 20.00% | 0.00% | 0.00% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | -20.87% | -20.87% | 8 | 37.50% |
| tiered_v1 | -20.85% | -20.85% | 7 | 42.86% |

## Portfolio Baseline (Apples-to-Apples Week-Open Hold)

| Baseline | Return | Max DD | Win Rate | Trades | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: |
| hold_portfolio__universal_v1__skip | -0.31% | +1.84% | 50.00% | 8 | -0.04% |
| hold_portfolio__tiered_v1__skip | +0.69% | +1.00% | 57.14% | 7 | +0.10% |

JSON: `reports/katarakti-phase1-backtest-2026-03-20.json`