# ADR Dip Neutral Pairs

Generated: 2026-03-24T15:51:10.419Z

## Overview

This test switches from directional continuation to neutral-pair mean reversion. When a pair has no net Tiered V3 directional pressure, the engine fades both 1x ADR boundaries from the weekly open: a dip below the open is bought, a rally above the open is sold, and each side can recycle with unlimited TP 0.25 ADR re-entries.

The execution layer stays aligned with the prior ADR research: 10-day ADR, H1 OANDA candles, canonical week windows, no stop loss, and week-close fallback exits when TP does not fire.

## Universe Summary

| Metric | Value |
| --- | --- |
| Total neutral pair-weeks available | 113 |
| Eligible neutral pair-weeks | 104 |
| Average neutral pairs/week | 11.56 |
| Skipped neutral pair-weeks | 9 |
| Directional SKIP pair-weeks (comparison only) | 91 |
| Directional SKIP eligible pair-weeks | 75 |

| Asset Class | Neutral Pair-Weeks | Eligible |
| --- | --- | --- |
| fx | 81 | 78 |
| indices | 6 | 3 |
| crypto | 0 | 0 |
| commodities | 26 | 23 |

## Combined Results

| Metric | LONG Fills | SHORT Fills | Combined |
| --- | --- | --- | --- |
| Total fills | 154 | 168 | 322 |
| Avg return/fill | +0.17% | +0.16% | +0.16% |
| Total return | +25.48% | +26.09% | +51.57% |
| Win rate | 86.36% | 86.31% | 86.34% |
| TP hit rate | 85.71% | 82.74% | 84.16% |
| Re-entries | 115 | 111 | 226 |

## Per-Asset-Class Breakdown

| Asset Class | Fills | Total Return | Avg Return/Fill | Win Rate | TP Hit Rate | Re-entries |
| --- | --- | --- | --- | --- | --- | --- |
| fx | 212 | +12.62% | +0.06% | 84.43% | 82.08% | 145 |
| indices | 19 | +6.54% | +0.34% | 94.74% | 89.47% | 16 |
| crypto | 0 | — | — | — | — | 0 |
| commodities | 91 | +32.42% | +0.36% | 89.01% | 87.91% | 65 |

## Per-Pair Breakdown

### Top Pairs

| Pair | Asset Class | Long Fills | Short Fills | Total Fills | Total Return | Avg Return/Fill | Win Rate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| XAGUSD | commodities | 17 | 14 | 31 | +12.91% | +0.42% | 87.10% |
| XAUUSD | commodities | 14 | 9 | 23 | +12.81% | +0.56% | 86.96% |
| WTIUSD | commodities | 22 | 15 | 37 | +6.70% | +0.18% | 91.89% |
| NIKKEIUSD | indices | 0 | 7 | 7 | +3.40% | +0.49% | 100.00% |
| GBPCAD | fx | 17 | 11 | 28 | +2.95% | +0.11% | 89.29% |
| GBPUSD | fx | 15 | 8 | 23 | +2.85% | +0.12% | 91.30% |
| EURNZD | fx | 18 | 0 | 18 | +2.42% | +0.13% | 100.00% |
| NZDUSD | fx | 10 | 4 | 14 | +1.97% | +0.14% | 85.71% |
| SPXUSD | indices | 0 | 8 | 8 | +1.74% | +0.22% | 87.50% |
| AUDJPY | fx | 7 | 9 | 16 | +1.56% | +0.10% | 81.25% |

### Bottom Pairs

| Pair | Asset Class | Long Fills | Short Fills | Total Fills | Total Return | Avg Return/Fill | Win Rate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EURCAD | fx | 7 | 0 | 7 | -1.14% | -0.16% | 85.71% |
| USDJPY | fx | 7 | 10 | 17 | -0.69% | -0.04% | 76.47% |
| EURJPY | fx | 2 | 9 | 11 | -0.62% | -0.06% | 81.82% |
| CHFJPY | fx | 1 | 3 | 4 | -0.52% | -0.13% | 50.00% |
| EURUSD | fx | 6 | 1 | 7 | -0.42% | -0.06% | 71.43% |
| GBPJPY | fx | 3 | 7 | 10 | -0.39% | -0.04% | 80.00% |
| NZDJPY | fx | 1 | 9 | 10 | -0.14% | -0.01% | 70.00% |
| CADJPY | fx | 1 | 14 | 15 | +0.17% | +0.01% | 73.33% |
| AUDCHF | fx | 0 | 8 | 8 | +0.51% | +0.06% | 62.50% |
| AUDUSD | fx | 0 | 2 | 2 | +0.74% | +0.37% | 100.00% |

## Session Breakdown

| Session | Fills | Total Return | Avg Return/Fill | Win Rate | TP Hit Rate | Re-entries |
| --- | --- | --- | --- | --- | --- | --- |
| Asian | 69 | +33.54% | +0.49% | 89.86% | 88.41% | 44 |
| NY_Afternoon | 58 | +12.52% | +0.22% | 86.21% | 82.76% | 49 |
| London | 78 | +7.55% | +0.10% | 91.03% | 88.46% | 54 |
| Off_Hours | 18 | +5.58% | +0.31% | 88.89% | 77.78% | 13 |
| NY_Overlap | 99 | -7.62% | -0.08% | 79.80% | 79.80% | 66 |

## MAE Distribution

| MAE Bucket (xADR) | Fills | % of Total | Cumulative % | Avg Return | Win Rate |
| --- | --- | --- | --- | --- | --- |
| 0.00 - 0.10 | 109 | 33.85% | 33.85% | +0.38% | 99.08% |
| 0.10 - 0.25 | 83 | 25.78% | 59.63% | +0.54% | 92.77% |
| 0.25 - 0.50 | 54 | 16.77% | 76.40% | +0.23% | 83.33% |
| 0.50 - 0.75 | 25 | 7.76% | 84.16% | +0.40% | 84.00% |
| 0.75 - 1.00 | 12 | 3.73% | 87.89% | +0.22% | 75.00% |
| 1.00 - 1.50 | 16 | 4.97% | 92.86% | +0.21% | 56.25% |
| 1.50+ | 23 | 7.14% | 100.00% | -2.78% | 39.13% |

## MAE Per Asset Class

| Asset Class | Avg MAE (xADR) | Median MAE (xADR) | P95 MAE (xADR) | Max MAE (xADR) |
| --- | --- | --- | --- | --- |
| fx | 0.38 | 0.17 | 1.49 | 5.92 |
| indices | 0.37 | 0.25 | 1.16 | 1.53 |
| crypto | — | — | — | — |
| commodities | 0.66 | 0.21 | 2.55 | 6.80 |

## Comparison Vs Directional

| Mode | Fills | Total Return | Avg Return/Fill | Win Rate |
| --- | --- | --- | --- | --- |
| Neutral Both-Sides | 322 | +51.57% | +0.16% | 86.34% |
| Directional Variant A (Test 3) | 261 | +62.30% | +0.24% | 91.95% |
| Directional SKIP Only (same window) | 103 | +28.06% | +0.27% | 95.15% |

## "Is This Worth Trading?" Analysis

Average neutral pairs/week: **11.56**.
Return per eligible neutral pair-week: **+0.50%**.
Directional Test 3 Variant A baseline: **+62.30%** total return across **261** fills.
Neutral sleeve delta versus the directional baseline: **-10.73%**.
Inference: the neutral both-sides sleeve is additive research worth monitoring, but only if execution bandwidth can absorb more fills without degrading the directional book.

## Per-Week Breakdown

| Week | Neutral Pairs | Long Fills | Short Fills | Total Return |
| --- | --- | --- | --- | --- |
| Jan 26 | 9 | 15 | 40 | +11.10% |
| Feb 02 | 11 | 28 | 29 | +41.62% |
| Feb 09 | 15 | 17 | 3 | -6.90% |
| Feb 16 | 15 | 14 | 13 | -1.06% |
| Feb 23 | 17 | 6 | 24 | +4.62% |
| Mar 02 | 12 | 55 | 17 | -13.32% |
| Mar 09 | 14 | 18 | 28 | +20.77% |
| Mar 16 | 11 | 1 | 14 | -5.27% |

