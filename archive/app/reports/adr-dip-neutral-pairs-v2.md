# ADR Dip Neutral Pairs V2

Generated: 2026-03-24T16:51:37.508Z

## Overview

This clean re-run keeps the Test 4A execution engine intact but fixes the reporting blind spots. Neutral pairs are traded as both-side mean reversion from the weekly open, while the report now keeps all 9 weeks visible, isolates the strongest asset-class sleeves, and audits what neutral actually means at the model-vote level.

The execution layer stays aligned with the prior ADR research: 10-day ADR, H1 OANDA candles, canonical week windows, no stop loss, and week-close fallback exits when TP does not fire.

## Universe Summary

| Metric | Value |
| --- | --- |
| Total neutral pair-weeks available | 113 |
| Eligible neutral pair-weeks | 104 |
| Neutral-pair activity | 113 neutral pairs across 9 active weeks (9/9 weeks had neutral pairs) |
| Average neutral pairs/active week | 12.56 |
| Weeks with zero neutral pairs | 0 |
| Skipped neutral pair-weeks | 9 |
| Directional baseline pair-weeks | 211 |
| Directional baseline eligible pair-weeks | 184 |

| Asset Class | Neutral Pair-Weeks | Eligible |
| --- | --- | --- |
| fx | 81 | 78 |
| indices | 6 | 3 |
| crypto | 0 | 0 |
| commodities | 26 | 23 |

## Neutral Classification Audit

| Metric | Value |
| --- | --- |
| Conflicting neutral pair-weeks | 88 |
| Silent neutral pair-weeks | 25 |
| Conflicting share | 77.88% |
| Silent share | 22.12% |

| Week | Pair | Asset Class | Dealer | Commercial | Sentiment | Neutral Kind | Net |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Jan 19 | EURGBP | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Jan 19 | NDXUSD | indices | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Jan 19 | NIKKEIUSD | indices | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Jan 19 | NZDCHF | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Jan 19 | SPXUSD | indices | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Jan 19 | USDJPY | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Jan 19 | WTIUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Jan 19 | XAGUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Jan 19 | XAUUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Jan 26 | EURGBP | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Jan 26 | NDXUSD | indices | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Jan 26 | NIKKEIUSD | indices | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Jan 26 | NZDCHF | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Jan 26 | SPXUSD | indices | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Jan 26 | USDJPY | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Jan 26 | WTIUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Jan 26 | XAGUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Jan 26 | XAUUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 02 | AUDCHF | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 02 | AUDJPY | fx | NEUTRAL | SHORT | LONG | CONFLICTING | NEUTRAL |
| Feb 02 | CADJPY | fx | SHORT | NEUTRAL | LONG | CONFLICTING | NEUTRAL |
| Feb 02 | CHFJPY | fx | SHORT | NEUTRAL | LONG | CONFLICTING | NEUTRAL |
| Feb 02 | EURGBP | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 02 | EURJPY | fx | NEUTRAL | SHORT | LONG | CONFLICTING | NEUTRAL |
| Feb 02 | GBPCAD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Feb 02 | NZDJPY | fx | SHORT | NEUTRAL | LONG | CONFLICTING | NEUTRAL |
| Feb 02 | WTIUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 02 | XAGUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 02 | XAUUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 09 | AUDJPY | fx | NEUTRAL | SHORT | LONG | CONFLICTING | NEUTRAL |
| Feb 09 | CADJPY | fx | NEUTRAL | SHORT | LONG | CONFLICTING | NEUTRAL |
| Feb 09 | CHFJPY | fx | SHORT | NEUTRAL | LONG | CONFLICTING | NEUTRAL |
| Feb 09 | EURCAD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Feb 09 | EURJPY | fx | NEUTRAL | SHORT | LONG | CONFLICTING | NEUTRAL |
| Feb 09 | EURUSD | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 09 | GBPCAD | fx | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 09 | GBPJPY | fx | SHORT | NEUTRAL | LONG | CONFLICTING | NEUTRAL |
| Feb 09 | GBPUSD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Feb 09 | NZDJPY | fx | SHORT | NEUTRAL | LONG | CONFLICTING | NEUTRAL |
| Feb 09 | NZDUSD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Feb 09 | USDJPY | fx | SHORT | NEUTRAL | LONG | CONFLICTING | NEUTRAL |
| Feb 09 | WTIUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 09 | XAGUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 09 | XAUUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 16 | AUDJPY | fx | NEUTRAL | SHORT | LONG | CONFLICTING | NEUTRAL |
| Feb 16 | CADJPY | fx | NEUTRAL | SHORT | LONG | CONFLICTING | NEUTRAL |
| Feb 16 | CHFJPY | fx | SHORT | NEUTRAL | LONG | CONFLICTING | NEUTRAL |
| Feb 16 | EURCAD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Feb 16 | EURJPY | fx | NEUTRAL | SHORT | LONG | CONFLICTING | NEUTRAL |
| Feb 16 | EURUSD | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 16 | GBPCAD | fx | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 16 | GBPJPY | fx | SHORT | NEUTRAL | LONG | CONFLICTING | NEUTRAL |
| Feb 16 | GBPUSD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Feb 16 | NZDJPY | fx | SHORT | NEUTRAL | LONG | CONFLICTING | NEUTRAL |
| Feb 16 | NZDUSD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Feb 16 | USDJPY | fx | SHORT | NEUTRAL | LONG | CONFLICTING | NEUTRAL |
| Feb 16 | WTIUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 16 | XAGUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 16 | XAUUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 23 | AUDCHF | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 23 | CADJPY | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Feb 23 | EURCAD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Feb 23 | EURGBP | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 23 | EURNZD | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 23 | EURUSD | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 23 | GBPCAD | fx | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 23 | GBPJPY | fx | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 23 | GBPUSD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Feb 23 | NZDCAD | fx | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 23 | NZDJPY | fx | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 23 | NZDUSD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Feb 23 | USDCAD | fx | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 23 | USDJPY | fx | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 23 | WTIUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 23 | XAGUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Feb 23 | XAUUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 02 | AUDCHF | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 02 | EURCAD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Mar 02 | EURNZD | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 02 | EURUSD | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 02 | GBPCAD | fx | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 02 | GBPJPY | fx | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 02 | GBPUSD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Mar 02 | NZDUSD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Mar 02 | USDJPY | fx | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 02 | WTIUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 02 | XAGUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 02 | XAUUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 09 | AUDCAD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Mar 09 | AUDCHF | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 09 | AUDJPY | fx | NEUTRAL | SHORT | LONG | CONFLICTING | NEUTRAL |
| Mar 09 | CADJPY | fx | NEUTRAL | SHORT | LONG | CONFLICTING | NEUTRAL |
| Mar 09 | CHFJPY | fx | SHORT | NEUTRAL | LONG | CONFLICTING | NEUTRAL |
| Mar 09 | EURJPY | fx | NEUTRAL | SHORT | LONG | CONFLICTING | NEUTRAL |
| Mar 09 | EURNZD | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 09 | GBPUSD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Mar 09 | NZDJPY | fx | SHORT | NEUTRAL | LONG | CONFLICTING | NEUTRAL |
| Mar 09 | NZDUSD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Mar 09 | USDJPY | fx | SHORT | NEUTRAL | LONG | CONFLICTING | NEUTRAL |
| Mar 09 | WTIUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 09 | XAGUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 09 | XAUUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 16 | AUDCAD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Mar 16 | AUDJPY | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 16 | AUDUSD | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 16 | EURNZD | fx | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 16 | GBPCAD | fx | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 16 | GBPJPY | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Mar 16 | GBPNZD | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Mar 16 | NZDJPY | fx | NEUTRAL | NEUTRAL | NEUTRAL | SILENT | NEUTRAL |
| Mar 16 | USDCAD | fx | SHORT | LONG | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 16 | WTIUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |
| Mar 16 | XAGUSD | commodities | LONG | SHORT | NEUTRAL | CONFLICTING | NEUTRAL |

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

| Asset Class | Neutral Fills | Neutral Return | Neutral Avg/Fill | Directional Fills | Directional Return | Directional Avg/Fill |
| --- | --- | --- | --- | --- | --- | --- |
| fx | 212 | +12.62% | +0.06% | 192 | +21.30% | +0.11% |
| indices | 19 | +6.54% | +0.34% | 37 | +12.82% | +0.35% |
| crypto | 0 | — | — | 32 | +28.17% | +0.88% |
| commodities | 91 | +32.42% | +0.36% | 0 | — | — |

## "Is This Worth Trading?" Analysis

Neutral-pair activity: **113** pairs across **9** active weeks (**9/9** weeks had neutral pairs).
Average neutral pairs per active week: **12.56**.
Return per eligible neutral pair-week: **+0.50%**.
Directional Test 3 Variant A baseline in this run: **+62.30%** total return across **261** fills.
Neutral sleeve delta versus the directional baseline: **-10.72%**.
Inference: the neutral both-sides sleeve is additive research worth monitoring, but only if execution bandwidth can absorb more fills without degrading the directional book.

## Per-Week Breakdown

| Week | Scope | Neutral Pairs | Long Fills | Short Fills | Total Return |
| --- | --- | --- | --- | --- | --- |
| Jan 19 | TOTAL | 9 | 0 | 0 | — |
|  | fx | 3 | 0 | 0 | — |
|  | indices | 3 | 0 | 0 | — |
|  | crypto | 0 | 0 | 0 | — |
|  | commodities | 3 | 0 | 0 | — |
| Jan 26 | TOTAL | 9 | 15 | 40 | +11.10% |
|  | fx | 3 | 6 | 4 | +2.08% |
|  | indices | 3 | 0 | 19 | +6.54% |
|  | crypto | 0 | 0 | 0 | — |
|  | commodities | 3 | 9 | 17 | +2.48% |
| Feb 02 | TOTAL | 11 | 28 | 29 | +41.62% |
|  | fx | 8 | 5 | 27 | +2.93% |
|  | indices | 0 | 0 | 0 | — |
|  | crypto | 0 | 0 | 0 | — |
|  | commodities | 3 | 23 | 2 | +38.69% |
| Feb 09 | TOTAL | 15 | 17 | 3 | -6.90% |
|  | fx | 12 | 17 | 2 | -7.84% |
|  | indices | 0 | 0 | 0 | — |
|  | crypto | 0 | 0 | 0 | — |
|  | commodities | 3 | 0 | 1 | +0.94% |
| Feb 16 | TOTAL | 15 | 14 | 13 | -1.06% |
|  | fx | 12 | 14 | 11 | +0.91% |
|  | indices | 0 | 0 | 0 | — |
|  | crypto | 0 | 0 | 0 | — |
|  | commodities | 3 | 0 | 2 | -1.97% |
| Feb 23 | TOTAL | 17 | 6 | 24 | +4.62% |
|  | fx | 14 | 5 | 18 | +3.07% |
|  | indices | 0 | 0 | 0 | — |
|  | crypto | 0 | 0 | 0 | — |
|  | commodities | 3 | 1 | 6 | +1.56% |
| Mar 02 | TOTAL | 12 | 55 | 17 | -13.32% |
|  | fx | 9 | 44 | 11 | +3.56% |
|  | indices | 0 | 0 | 0 | — |
|  | crypto | 0 | 0 | 0 | — |
|  | commodities | 3 | 11 | 6 | -16.88% |
| Mar 09 | TOTAL | 14 | 18 | 28 | +20.77% |
|  | fx | 11 | 10 | 24 | +4.74% |
|  | indices | 0 | 0 | 0 | — |
|  | crypto | 0 | 0 | 0 | — |
|  | commodities | 3 | 8 | 4 | +16.03% |
| Mar 16 | TOTAL | 11 | 1 | 14 | -5.27% |
|  | fx | 9 | 0 | 14 | +3.16% |
|  | indices | 0 | 0 | 0 | — |
|  | crypto | 0 | 0 | 0 | — |
|  | commodities | 2 | 1 | 0 | -8.43% |

## Commodity-Only Neutral Results

| Metric | LONG Fills | SHORT Fills | Combined |
| --- | --- | --- | --- |
| Total fills | 53 | 38 | 91 |
| Avg return/fill | +0.52% | +0.13% | +0.36% |
| Total return | +27.42% | +5.00% | +32.42% |
| Win rate | 90.57% | 86.84% | 89.01% |
| TP hit rate | 90.57% | 84.21% | 87.91% |
| Re-entries | 41 | 24 | 65 |

| Week | Neutral Pairs | Long Fills | Short Fills | Total Return |
| --- | --- | --- | --- | --- |
| Jan 19 | 3 | 0 | 0 | — |
| Jan 26 | 3 | 9 | 17 | +2.48% |
| Feb 02 | 3 | 23 | 2 | +38.69% |
| Feb 09 | 3 | 0 | 1 | +0.94% |
| Feb 16 | 3 | 0 | 2 | -1.97% |
| Feb 23 | 3 | 1 | 6 | +1.56% |
| Mar 02 | 3 | 11 | 6 | -16.88% |
| Mar 09 | 3 | 8 | 4 | +16.03% |
| Mar 16 | 2 | 1 | 0 | -8.43% |

| Session | Fills | Total Return | Avg Return/Fill | Win Rate | TP Hit Rate | Re-entries |
| --- | --- | --- | --- | --- | --- | --- |
| Asian | 30 | +28.61% | +0.95% | 96.67% | 96.67% | 20 |
| NY_Afternoon | 14 | +7.06% | +0.50% | 78.57% | 78.57% | 11 |
| Off_Hours | 9 | +3.91% | +0.43% | 88.89% | 77.78% | 7 |
| London | 20 | +0.21% | +0.01% | 90.00% | 90.00% | 15 |
| NY_Overlap | 18 | -7.37% | -0.41% | 83.33% | 83.33% | 12 |

| MAE Bucket (xADR) | Fills | % of Total | Cumulative % | Avg Return | Win Rate |
| --- | --- | --- | --- | --- | --- |
| 0.00 - 0.10 | 23 | 25.27% | 25.27% | +1.11% | 100.00% |
| 0.10 - 0.25 | 28 | 30.77% | 56.04% | +1.26% | 92.86% |
| 0.25 - 0.50 | 10 | 10.99% | 67.03% | +0.65% | 90.00% |
| 0.50 - 0.75 | 8 | 8.79% | 75.82% | +1.08% | 100.00% |
| 0.75 - 1.00 | 7 | 7.69% | 83.52% | +0.46% | 85.71% |
| 1.00 - 1.50 | 4 | 4.40% | 87.91% | +1.72% | 100.00% |
| 1.50+ | 11 | 12.09% | 100.00% | -4.88% | 45.45% |

## FX-Only Neutral Results

| Metric | LONG Fills | SHORT Fills | Combined |
| --- | --- | --- | --- |
| Total fills | 101 | 111 | 212 |
| Avg return/fill | -0.02% | +0.13% | +0.06% |
| Total return | -1.94% | +14.55% | +12.62% |
| Win rate | 84.16% | 84.68% | 84.43% |
| TP hit rate | 83.17% | 81.08% | 82.08% |
| Re-entries | 74 | 71 | 145 |

| Week | Neutral Pairs | Long Fills | Short Fills | Total Return |
| --- | --- | --- | --- | --- |
| Jan 19 | 3 | 0 | 0 | — |
| Jan 26 | 3 | 6 | 4 | +2.08% |
| Feb 02 | 8 | 5 | 27 | +2.93% |
| Feb 09 | 12 | 17 | 2 | -7.84% |
| Feb 16 | 12 | 14 | 11 | +0.91% |
| Feb 23 | 14 | 5 | 18 | +3.07% |
| Mar 02 | 9 | 44 | 11 | +3.56% |
| Mar 09 | 11 | 10 | 24 | +4.74% |
| Mar 16 | 9 | 0 | 14 | +3.16% |

| Session | Fills | Total Return | Avg Return/Fill | Win Rate | TP Hit Rate | Re-entries |
| --- | --- | --- | --- | --- | --- | --- |
| London | 54 | +5.60% | +0.10% | 90.74% | 87.04% | 35 |
| NY_Afternoon | 37 | +4.15% | +0.11% | 89.19% | 86.49% | 31 |
| Asian | 35 | +2.68% | +0.08% | 82.86% | 80.00% | 21 |
| Off_Hours | 9 | +1.67% | +0.19% | 88.89% | 77.78% | 6 |
| NY_Overlap | 77 | -1.48% | -0.02% | 77.92% | 77.92% | 52 |

| MAE Bucket (xADR) | Fills | % of Total | Cumulative % | Avg Return | Win Rate |
| --- | --- | --- | --- | --- | --- |
| 0.00 - 0.10 | 83 | 39.15% | 39.15% | +0.18% | 98.80% |
| 0.10 - 0.25 | 48 | 22.64% | 61.79% | +0.17% | 93.75% |
| 0.25 - 0.50 | 40 | 18.87% | 80.66% | +0.11% | 80.00% |
| 0.50 - 0.75 | 14 | 6.60% | 87.26% | +0.02% | 71.43% |
| 0.75 - 1.00 | 5 | 2.36% | 89.62% | -0.12% | 60.00% |
| 1.00 - 1.50 | 11 | 5.19% | 94.81% | -0.34% | 36.36% |
| 1.50+ | 11 | 5.19% | 100.00% | -0.97% | 27.27% |

