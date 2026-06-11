# Katarakti Phase 2 Backtest

Generated: 2026-02-27T22:38:23.846Z
Test plan: phase2
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
Correlation lookback (hours): 672

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| univ__hs2__corr070 | +4.16% | +1.33% | 31.58% | 19 | +0.22% | 3.122 |
| univ__hs3__corr070 | +0.22% | +0.35% | 42.86% | 7 | +0.03% | 0.629 |
| univ__hs2__corr060 | +3.89% | +1.40% | 29.41% | 17 | +0.23% | 2.775 |
| univ__hs2__corr070__no_anti | +5.01% | +0.31% | 33.33% | 15 | +0.33% | 16.421 |
| univ__no_hs | +14.07% | +0.38% | 36.67% | 30 | +0.45% | 37.429 |
| tiered__t1_only__1pct | +14.07% | +0.38% | 36.67% | 30 | +0.45% | 37.429 |
| tiered__t1t2__flat_1pct | +14.07% | +0.38% | 36.67% | 30 | +0.45% | 37.429 |
| tiered__t1t2__weighted | +21.62% | +0.56% | 36.67% | 30 | +0.67% | 38.324 |
| tiered__t1t2__weighted__hs2__corr070 | +6.24% | +2.00% | 31.58% | 19 | +0.33% | 3.122 |

## Handshake Diagnostics

| Variant | Signals | Clustered | Confirmed | Standalone | Passed | Gated Out | Trigger Rate | Avg Triggered Cluster |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| univ__hs2__corr070 | 81 | 66 | 34 | 15 | 49 | 32 | 51.52% | 2.03 |
| univ__hs3__corr070 | 81 | 66 | 1 | 15 | 16 | 65 | 1.52% | 3.00 |
| univ__hs2__corr060 | 81 | 79 | 39 | 2 | 41 | 40 | 49.37% | 2.36 |
| univ__hs2__corr070__no_anti | 81 | 65 | 24 | 16 | 40 | 41 | 36.92% | 2.00 |
| tiered__t1t2__weighted__hs2__corr070 | 81 | 66 | 34 | 15 | 49 | 32 | 51.52% | 2.03 |

## Correlation Coverage

| Week | Lookback (h) | Pairwise Corr Rows |
| --- | ---: | ---: |
| 2026-01-19 | 672 | 630 |
| 2026-01-26 | 672 | 630 |
| 2026-02-02 | 672 | 630 |
| 2026-02-09 | 672 | 630 |
| 2026-02-16 | 672 | 630 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| univ__hs2__corr070 | 0 | 10 | 2 | 0 | 0 | 3 | 4 | 63.16% | 47.37% | 42.11% | 36.84% |
| univ__hs3__corr070 | 0 | 2 | 0 | 0 | 0 | 2 | 3 | 57.14% | 14.29% | 0.00% | 0.00% |
| univ__hs2__corr060 | 0 | 8 | 2 | 0 | 0 | 3 | 4 | 58.82% | 47.06% | 47.06% | 41.18% |
| univ__hs2__corr070__no_anti | 0 | 8 | 2 | 0 | 0 | 2 | 3 | 73.33% | 60.00% | 53.33% | 46.67% |
| univ__no_hs | 0 | 16 | 2 | 0 | 0 | 5 | 7 | 63.33% | 46.67% | 36.67% | 30.00% |
| tiered__t1_only__1pct | 0 | 16 | 2 | 0 | 0 | 5 | 7 | 63.33% | 46.67% | 36.67% | 30.00% |
| tiered__t1t2__flat_1pct | 0 | 16 | 2 | 0 | 0 | 5 | 7 | 63.33% | 46.67% | 36.67% | 30.00% |
| tiered__t1t2__weighted | 0 | 16 | 2 | 0 | 0 | 5 | 7 | 63.33% | 46.67% | 36.67% | 30.00% |
| tiered__t1t2__weighted__hs2__corr070 | 0 | 10 | 2 | 0 | 0 | 3 | 4 | 63.16% | 47.37% | 42.11% | 36.84% |

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

JSON: `reports/katarakti-phase1-backtest-2026-02-27-phase2_full_atr_nohard.json`