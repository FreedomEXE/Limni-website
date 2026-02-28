# Katarakti Phase 2 Backtest

Generated: 2026-02-27T22:37:21.387Z
Test plan: phase2
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Universe size: 3
Starting equity: +$100000.00
Entry mode: sweep
Exit mode: stepped_no_hard_sl
Lock style: atr
Max entries per pair/week: 1
Sweep Thu/Fri block (ET): off
Neutral both_ways variants included: no
Locked baseline variant: universal_v1__skip__sweep010
Correlation lookback (hours): 672
Pair filter: EURUSD, GBPUSD, USDJPY

## Variant Summary

| Variant | Return | Max DD | Win Rate | Trades | Avg/Trade | Risk-Adj |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| univ__hs2__corr070 | +0.00% | +0.00% | 0.00% | 0 | +0.00% | 0.000 |
| univ__hs3__corr070 | +0.00% | +0.00% | 0.00% | 0 | +0.00% | 0.000 |
| univ__hs2__corr060 | +0.00% | +0.00% | 0.00% | 0 | +0.00% | 0.000 |
| univ__hs2__corr070__no_anti | +0.00% | +0.00% | 0.00% | 0 | +0.00% | 0.000 |
| univ__no_hs | +0.00% | +0.00% | 0.00% | 0 | +0.00% | 0.000 |
| tiered__t1_only__1pct | +0.00% | +0.00% | 0.00% | 0 | +0.00% | 0.000 |
| tiered__t1t2__flat_1pct | +0.00% | +0.00% | 0.00% | 0 | +0.00% | 0.000 |
| tiered__t1t2__weighted | +0.00% | +0.00% | 0.00% | 0 | +0.00% | 0.000 |
| tiered__t1t2__weighted__hs2__corr070 | +0.00% | +0.00% | 0.00% | 0 | +0.00% | 0.000 |

## Handshake Diagnostics

| Variant | Signals | Clustered | Standalone | Passed | Gated Out | Trigger Rate | Avg Triggered Cluster |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| univ__hs2__corr070 | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00 |
| univ__hs3__corr070 | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00 |
| univ__hs2__corr060 | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00 |
| univ__hs2__corr070__no_anti | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00 |
| tiered__t1t2__weighted__hs2__corr070 | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00 |

## Correlation Coverage

| Week | Lookback (h) | Pairwise Corr Rows |
| --- | ---: | ---: |
| 2026-01-19 | 672 | 3 |
| 2026-01-26 | 672 | 3 |
| 2026-02-02 | 672 | 3 |
| 2026-02-09 | 672 | 3 |
| 2026-02-16 | 672 | 3 |

## Exit Diagnostics (Per Variant)

| Variant | hard_sl | breakeven | lock_015 | lock_035 | lock_055 | trailing | week_close | reach +0.25% | reach +0.50% | reach +0.75% | reach +1.00% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| univ__hs2__corr070 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |
| univ__hs3__corr070 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |
| univ__hs2__corr060 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |
| univ__hs2__corr070__no_anti | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |
| univ__no_hs | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |
| tiered__t1_only__1pct | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |
| tiered__t1t2__flat_1pct | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |
| tiered__t1t2__weighted | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |
| tiered__t1t2__weighted__hs2__corr070 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0.00% | 0.00% |

## Baseline (Bias Hold, Weekly Snapshot Returns)

| System | Return (arith) | Return (compounded) | Trades | Win Rate |
| --- | ---: | ---: | ---: | ---: |
| universal_v1 | +1.75% | +1.75% | 1 | 100.00% |
| tiered_v1 | +1.75% | +1.75% | 1 | 100.00% |

## Portfolio Baseline (Apples-to-Apples Week-Open Hold)

| Baseline | Return | Max DD | Win Rate | Trades | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: |
| hold_portfolio__universal_v1__skip | +0.00% | +0.00% | 0.00% | 1 | +0.00% |
| hold_portfolio__tiered_v1__skip | +0.00% | +0.00% | 0.00% | 1 | +0.00% |

JSON: `reports/katarakti-phase1-backtest-2026-02-27-phase2_smoke.json`