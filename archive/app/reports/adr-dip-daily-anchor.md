# ADR Dip Daily Anchor — Test 6

Generated: 2026-03-24T20:42:49.065Z
Week range: Jan 19 -> Mar 16
Script: `scripts/adr-dip-daily-anchor.ts`

## Summary Comparison

| Metric | Weekly (W) | Daily (D) |
| --- | --- | --- |
| Total signals | 211 | 1073 |
| Eligible signals | 184 | 938 |
| Total fills | 83 | 108 |
| Fill rate | 45.11% | 11.51% |
| Avg return/fill | +0.21% | +0.16% |
| Total return | +17.62% | +16.81% |
| Win rate | 90.36% | 82.41% |
| TP hit rate | 90.36% | 75.00% |
| Avg MAE (xADR) | 0.23 | 0.23 |
| P95 MAE (xADR) | 0.84 | 0.75 |
| Losing weeks | 1 | 2 |

## Per-Week Comparison

| Week | W Fills | W Return | D Fills | D Return | Delta |
| --- | --- | --- | --- | --- | --- |
| Jan 19 | 0 | 0.00% | 0 | 0.00% | 0.00% |
| Jan 26 | 8 | +3.14% | 18 | +2.91% | -0.23% |
| Feb 02 | 10 | +2.42% | 12 | -0.11% | -2.53% |
| Feb 09 | 2 | +0.60% | 1 | +0.43% | -0.17% |
| Feb 16 | 4 | +0.19% | 3 | +0.48% | +0.29% |
| Feb 23 | 10 | +2.24% | 7 | -1.26% | -3.50% |
| Mar 02 | 18 | +5.44% | 35 | +10.08% | +4.65% |
| Mar 09 | 15 | -1.18% | 9 | +2.64% | +3.82% |
| Mar 16 | 16 | +4.77% | 23 | +1.64% | -3.13% |

## Per-Asset-Class Breakdown

| Asset Class | W Fills | W Return | D Fills | D Return | Delta |
| --- | --- | --- | --- | --- | --- |
| fx | 62 | +8.49% | 84 | +8.04% | -0.45% |
| indices | 11 | +3.43% | 13 | +3.95% | +0.52% |
| crypto | 10 | +5.69% | 11 | +4.81% | -0.88% |
| commodities | 0 | 0.00% | 0 | 0.00% | 0.00% |

## MAE Distribution — Weekly (W)

| MAE Bucket (xADR) | Fills | % of Total | Avg Return | Win Rate |
| --- | --- | --- | --- | --- |
| 0.00 - 0.10 | 42 | 50.60% | +0.34% | 100.00% |
| 0.10 - 0.25 | 19 | 22.89% | +0.33% | 100.00% |
| 0.25 - 0.50 | 14 | 16.87% | +0.29% | 85.71% |
| 0.50 - 0.75 | 2 | 2.41% | -0.06% | 50.00% |
| 0.75 - 1.00 | 2 | 2.41% | -0.23% | 50.00% |
| 1.00 - 1.50 | 2 | 2.41% | -2.57% | 0.00% |
| 1.50+ | 2 | 2.41% | -0.58% | 0.00% |

## MAE Distribution — Daily (D)

| MAE Bucket (xADR) | Fills | % of Total | Avg Return | Win Rate |
| --- | --- | --- | --- | --- |
| 0.00 - 0.10 | 48 | 44.44% | +0.34% | 95.83% |
| 0.10 - 0.25 | 29 | 26.85% | +0.24% | 89.66% |
| 0.25 - 0.50 | 20 | 18.52% | +0.18% | 70.00% |
| 0.50 - 0.75 | 5 | 4.63% | -0.06% | 60.00% |
| 0.75 - 1.00 | 2 | 1.85% | -2.39% | 0.00% |
| 1.00 - 1.50 | 3 | 2.78% | -0.36% | 0.00% |
| 1.50+ | 1 | 0.93% | -3.85% | 0.00% |

## Fill Frequency Analysis — Daily (D)

Overall avg fills per pair-week: 0.51

| Pair | Signal Weeks | Total Fills | Avg Fills/Signal Week | Weeks w/ Fill | Avg Fills/Filled Week |
| --- | --- | --- | --- | --- | --- |
| EURUSD | 5 | 5 | 1.00 | 3 | 1.67 |
| SPXUSD | 7 | 7 | 1.00 | 5 | 1.40 |
| USDCAD | 7 | 6 | 0.86 | 4 | 1.50 |
| GBPUSD | 4 | 3 | 0.75 | 3 | 1.00 |
| NZDCAD | 8 | 6 | 0.75 | 4 | 1.50 |
| NZDCHF | 7 | 5 | 0.71 | 4 | 1.25 |
| ETHUSD | 9 | 6 | 0.67 | 5 | 1.20 |
| GBPCAD | 3 | 2 | 0.67 | 2 | 1.00 |
| AUDUSD | 8 | 5 | 0.63 | 3 | 1.67 |
| CHFJPY | 5 | 3 | 0.60 | 3 | 1.00 |
| EURCAD | 5 | 3 | 0.60 | 3 | 1.00 |
| EURGBP | 5 | 3 | 0.60 | 2 | 1.50 |
| EURJPY | 5 | 3 | 0.60 | 3 | 1.00 |
| AUDCAD | 7 | 4 | 0.57 | 2 | 2.00 |
| BTCUSD | 9 | 5 | 0.56 | 4 | 1.25 |
| GBPCHF | 9 | 5 | 0.56 | 4 | 1.25 |
| AUDJPY | 4 | 2 | 0.50 | 2 | 1.00 |
| CADJPY | 4 | 2 | 0.50 | 2 | 1.00 |
| NZDUSD | 4 | 2 | 0.50 | 1 | 2.00 |
| USDJPY | 2 | 1 | 0.50 | 1 | 1.00 |
| CADCHF | 9 | 4 | 0.44 | 3 | 1.33 |
| EURCHF | 9 | 4 | 0.44 | 3 | 1.33 |
| USDCHF | 9 | 4 | 0.44 | 3 | 1.33 |
| NDXUSD | 7 | 3 | 0.43 | 3 | 1.00 |
| NIKKEIUSD | 7 | 3 | 0.43 | 2 | 1.50 |
| EURAUD | 9 | 3 | 0.33 | 2 | 1.50 |
| NZDJPY | 3 | 1 | 0.33 | 1 | 1.00 |
| GBPJPY | 4 | 1 | 0.25 | 1 | 1.00 |
| GBPNZD | 8 | 2 | 0.25 | 2 | 1.00 |
| GBPAUD | 9 | 2 | 0.22 | 1 | 2.00 |
| AUDCHF | 5 | 1 | 0.20 | 1 | 1.00 |
| EURNZD | 5 | 1 | 0.20 | 1 | 1.00 |
| AUDNZD | 9 | 1 | 0.11 | 1 | 1.00 |
| XAUUSD | 1 | 0 | 0.00 | 0 | — |

## Gated Vs Non-Gated Split

### GATED (PASS / NO_DATA)

| Metric | Weekly (W) | Daily (D) |
| --- | --- | --- |
| Total signals | 104 | 532 |
| Eligible signals | 92 | 472 |
| Total fills | 42 | 50 |
| Fill rate | 45.65% | 10.59% |
| Avg return/fill | +0.26% | +0.02% |
| Total return | +10.96% | +0.88% |
| Win rate | 88.10% | 74.00% |
| TP hit rate | 88.10% | 68.00% |
| Avg MAE (xADR) | 0.20 | 0.25 |
| P95 MAE (xADR) | 0.57 | 0.90 |
| Losing weeks | 0 | 3 |

### NON_GATED (SKIP / REDUCE)

| Metric | Weekly (W) | Daily (D) |
| --- | --- | --- |
| Total signals | 107 | 541 |
| Eligible signals | 92 | 466 |
| Total fills | 41 | 58 |
| Fill rate | 44.57% | 12.45% |
| Avg return/fill | +0.16% | +0.27% |
| Total return | +6.66% | +15.93% |
| Win rate | 92.68% | 89.66% |
| TP hit rate | 92.68% | 81.03% |
| Avg MAE (xADR) | 0.27 | 0.21 |
| P95 MAE (xADR) | 1.06 | 0.63 |
| Losing weeks | 2 | 0 |

## Top 10 Pairs By Return Delta (D - W)

| Pair | Asset Class | W Fills | W Return | D Fills | D Return | Delta |
| --- | --- | --- | --- | --- | --- | --- |
| ETHUSD | crypto | 5 | +6.81% | 6 | +9.44% | +2.63% |
| SPXUSD | indices | 4 | +0.99% | 7 | +2.55% | +1.56% |
| USDCHF | fx | 3 | -0.96% | 4 | +0.29% | +1.25% |
| NIKKEIUSD | indices | 3 | +0.58% | 3 | +1.64% | +1.05% |
| AUDJPY | fx | 0 | 0.00% | 2 | +0.55% | +0.55% |
| AUDUSD | fx | 2 | +0.42% | 5 | +0.90% | +0.48% |
| USDCAD | fx | 3 | -0.18% | 6 | +0.10% | +0.29% |
| CHFJPY | fx | 2 | +0.35% | 3 | +0.58% | +0.23% |
| EURAUD | fx | 1 | +0.16% | 3 | +0.39% | +0.23% |
| USDJPY | fx | 2 | -0.06% | 1 | +0.16% | +0.21% |

## Bottom 10 Pairs By Return Delta (D - W)

| Pair | Asset Class | W Fills | W Return | D Fills | D Return | Delta |
| --- | --- | --- | --- | --- | --- | --- |
| BTCUSD | crypto | 5 | -1.12% | 5 | -4.63% | -3.51% |
| NDXUSD | indices | 4 | +1.86% | 3 | -0.24% | -2.10% |
| NZDCAD | fx | 6 | +1.14% | 6 | -0.46% | -1.61% |
| GBPUSD | fx | 2 | +0.41% | 3 | -0.36% | -0.77% |
| NZDUSD | fx | 2 | +0.60% | 2 | +0.01% | -0.59% |
| GBPJPY | fx | 3 | +0.65% | 1 | +0.21% | -0.44% |
| NZDCHF | fx | 4 | +0.88% | 5 | +0.45% | -0.43% |
| CADCHF | fx | 3 | +0.44% | 4 | +0.23% | -0.21% |
| GBPNZD | fx | 3 | +0.49% | 2 | +0.32% | -0.18% |
| GBPCHF | fx | 4 | +0.59% | 5 | +0.47% | -0.12% |

## Notes

- Weekly baseline uses one fill maximum per pair per week. No re-entries.
- Daily variant uses one fill maximum per pair per rollover-defined trading day.
- Direction is still weekly. Only the anchor granularity changes between variants.
- Daily anchor periods are segmented from H1 bars using the 17:00 ET rollover rule.
- Exit is TP or period close only. No stop loss, no confirmation logic.

