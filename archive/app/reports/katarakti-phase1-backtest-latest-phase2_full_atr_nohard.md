# Katarakti Phase 2 Backtest

Generated: 2026-03-22T04:38:10.643Z
Test plan: phase2
Weeks: 2026-01-18T23:00:00.000Z, 2026-01-25T23:00:00.000Z, 2026-02-01T23:00:00.000Z, 2026-02-08T23:00:00.000Z, 2026-02-15T23:00:00.000Z, 2026-02-22T23:00:00.000Z, 2026-03-01T23:00:00.000Z, 2026-03-08T23:00:00.000Z
Universe size: 36
Starting equity: +$100000.00
Entry mode: sweep
Exit mode: stepped_no_hard_sl
Lock style: atr
Max entries per pair/week: 1
Sweep Thu/Fri block (ET): off
Neutral both_ways variants included: no
Locked baseline variant: universal_v1__skip__sweep010
Correlation lookback (hours): 672

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| univ__hs2__corr070 | -17.17% | +17.17% | 0.00% | 6 | -2.86% | -1.000 |
| univ__hs3__corr070 | +0.00% | +0.00% | 0.00% | 2 | +0.00% | 0.000 |
| univ__hs2__corr060 | -17.17% | +17.17% | 0.00% | 5 | -3.43% | -1.000 |
| univ__hs2__corr070__no_anti | -17.17% | +17.17% | 0.00% | 6 | -2.86% | -1.000 |
| univ__no_hs | -17.17% | +17.17% | 0.00% | 8 | -2.15% | -1.000 |
| tiered__t1_only__1pct | -17.17% | +17.17% | 0.00% | 7 | -2.45% | -1.000 |
| tiered__t1t2__flat_1pct | -17.17% | +17.17% | 0.00% | 8 | -2.15% | -1.000 |
| tiered__t1t2__weighted | -25.75% | +25.75% | 0.00% | 8 | -3.22% | -1.000 |
| tiered__t1t2__weighted__hs2__corr070 | -25.75% | +25.75% | 0.00% | 6 | -4.29% | -1.000 |

## Handshake Diagnostics

| Variant | Signals | Clustered | Confirmed | Standalone | Passed | Gated Out | Trigger Rate | Avg Triggered Cluster |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| univ__hs2__corr070 | 34 | 32 | 27 | 2 | 29 | 5 | 84.38% | 2.00 |
| univ__hs3__corr070 | 34 | 32 | 0 | 2 | 2 | 32 | 0.00% | 0.00 |
| univ__hs2__corr060 | 34 | 33 | 27 | 1 | 28 | 6 | 81.82% | 2.00 |
| univ__hs2__corr070__no_anti | 34 | 32 | 27 | 2 | 29 | 5 | 84.38% | 2.00 |
| tiered__t1t2__weighted__hs2__corr070 | 34 | 32 | 27 | 2 | 29 | 5 | 84.38% | 2.00 |

## Correlation Coverage

| Week | Lookback (h) | Pairwise Corr Rows |
| --- | ---: | ---: |
| 2026-01-18 | 672 | 630 |
| 2026-01-25 | 672 | 630 |
| 2026-02-01 | 672 | 630 |
| 2026-02-08 | 672 | 630 |
| 2026-02-15 | 672 | 630 |
| 2026-02-22 | 672 | 630 |
| 2026-03-01 | 672 | 630 |
| 2026-03-08 | 672 | 630 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| univ__hs2__corr070 | 0 | 4 | 0 | 0 | 0 | 0 | 2 | 66.67% | 16.67% | 0.00% | 0.00% |
| univ__hs3__corr070 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |
| univ__hs2__corr060 | 0 | 3 | 0 | 0 | 0 | 0 | 2 | 80.00% | 20.00% | 0.00% | 0.00% |
| univ__hs2__corr070__no_anti | 0 | 4 | 0 | 0 | 0 | 0 | 2 | 66.67% | 16.67% | 0.00% | 0.00% |
| univ__no_hs | 0 | 6 | 0 | 0 | 0 | 0 | 2 | 62.50% | 12.50% | 0.00% | 0.00% |
| tiered__t1_only__1pct | 0 | 5 | 0 | 0 | 0 | 0 | 2 | 57.14% | 14.29% | 0.00% | 0.00% |
| tiered__t1t2__flat_1pct | 0 | 6 | 0 | 0 | 0 | 0 | 2 | 62.50% | 12.50% | 0.00% | 0.00% |
| tiered__t1t2__weighted | 0 | 6 | 0 | 0 | 0 | 0 | 2 | 62.50% | 12.50% | 0.00% | 0.00% |
| tiered__t1t2__weighted__hs2__corr070 | 0 | 4 | 0 | 0 | 0 | 0 | 2 | 66.67% | 16.67% | 0.00% | 0.00% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | -20.87% | -20.87% | 8 | 37.50% |
| tiered_v1 | -20.85% | -20.85% | 7 | 42.86% |

## Portfolio Baseline (Apples-to-Apples Week-Open Hold)

| Baseline | Return | Max DD | Win Rate | Trades | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: |
| hold_portfolio__universal_v1__skip | -19.91% | +21.76% | 50.00% | 8 | -2.49% |
| hold_portfolio__tiered_v1__skip | -19.91% | +21.76% | 57.14% | 7 | -2.84% |

JSON: `reports/katarakti-phase1-backtest-2026-03-22-phase2_full_atr_nohard.json`