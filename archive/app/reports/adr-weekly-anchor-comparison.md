# ADR Weekly Anchor Comparison — Test 8

Generated: 2026-03-25T05:22:15.140Z
Week range: Jan 19 → Mar 16
Script: `scripts/adr-weekly-anchor-comparison.ts`

## Variant Legend

- **W (Weekly Open)**: Static anchor at weekly open price. Entry = weekOpen ± 1.0 ADR. One fill max per pair per week.
- **H (Running High/Low)**: Dynamic anchor. For LONG: running weekly high, entry = runningHigh - 1.0 ADR. For SHORT: running weekly low, entry = runningLow + 1.0 ADR. Anchor updates each H1 bar. One fill max per pair per week (first trigger only).

Both variants: TP = 0.25 ADR from fill price. Exit at TP or week close.

## Summary Comparison

| Metric | Weekly Open (W) | Running Extreme (H) |
| --- | --- | --- |
| Total signals | 211 | 211 |
| Eligible signals | 184 | 184 |
| Total fills | 83 | 158 |
| Fill rate | 45.11% | 85.87% |
| Avg return/fill | +0.21% | +0.22% |
| Total return | +17.62% | +34.92% |
| Win rate | 90.36% | 91.14% |
| TP hit rate | 90.36% | 89.87% |
| Avg MAE (xADR) | 0.23 | 0.32 |
| P95 MAE (xADR) | 0.84 | 1.24 |
| Losing weeks | 1 | 0 |

## Per-Week Comparison

| Week | W Fills | W Return | H Fills | H Return |
| --- | --- | --- | --- | --- |
| Jan 19 | 0 | 0.00% | 0 | 0.00% |
| Jan 26 | 8 | +3.14% | 26 | +6.67% |
| Feb 02 | 10 | +2.42% | 23 | +6.65% |
| Feb 09 | 2 | +0.60% | 17 | +3.66% |
| Feb 16 | 4 | +0.19% | 9 | +1.75% |
| Feb 23 | 10 | +2.24% | 16 | +2.46% |
| Mar 02 | 18 | +5.44% | 23 | +4.79% |
| Mar 09 | 15 | -1.18% | 20 | +4.93% |
| Mar 16 | 16 | +4.77% | 24 | +4.02% |

## Per-Asset-Class Breakdown

| Asset Class | W Fills | W Return | H Fills | H Return |
| --- | --- | --- | --- | --- |
| fx | 62 | +8.49% | 128 | +15.86% |
| indices | 11 | +3.43% | 17 | +3.94% |
| crypto | 10 | +5.69% | 12 | +14.43% |
| commodities | 0 | 0.00% | 1 | +0.68% |

## Gated vs Non-Gated Split

### GATED (PASS / NO_DATA)

| Metric | Weekly Open (W) | Running Extreme (H) |
| --- | --- | --- |
| Total signals | 104 | 104 |
| Eligible signals | 92 | 92 |
| Total fills | 42 | 78 |
| Fill rate | 45.65% | 84.78% |
| Avg return/fill | +0.26% | +0.25% |
| Total return | +10.96% | +19.73% |
| Win rate | 88.10% | 94.87% |
| TP hit rate | 88.10% | 93.59% |
| Avg MAE (xADR) | 0.20 | 0.29 |
| P95 MAE (xADR) | 0.57 | 1.08 |
| Losing weeks | 0 | 0 |

### NON_GATED (SKIP / REDUCE)

| Metric | Weekly Open (W) | Running Extreme (H) |
| --- | --- | --- |
| Total signals | 107 | 107 |
| Eligible signals | 92 | 92 |
| Total fills | 41 | 80 |
| Fill rate | 44.57% | 86.96% |
| Avg return/fill | +0.16% | +0.19% |
| Total return | +6.66% | +15.19% |
| Win rate | 92.68% | 87.50% |
| TP hit rate | 92.68% | 86.25% |
| Avg MAE (xADR) | 0.27 | 0.34 |
| P95 MAE (xADR) | 1.06 | 1.28 |
| Losing weeks | 2 | 1 |

## MAE Distribution — Weekly Open (W)

| MAE Bucket (xADR) | Fills | % of Total | Avg Return | Win Rate |
| --- | --- | --- | --- | --- |
| 0.00 - 0.10 | 42 | 50.60% | +0.34% | 100.00% |
| 0.10 - 0.25 | 19 | 22.89% | +0.33% | 100.00% |
| 0.25 - 0.50 | 14 | 16.87% | +0.29% | 85.71% |
| 0.50 - 0.75 | 2 | 2.41% | -0.06% | 50.00% |
| 0.75 - 1.00 | 2 | 2.41% | -0.23% | 50.00% |
| 1.00 - 1.50 | 2 | 2.41% | -2.57% | 0.00% |
| 1.50+ | 2 | 2.41% | -0.58% | 0.00% |

## MAE Distribution — Running Extreme (H)

| MAE Bucket (xADR) | Fills | % of Total | Avg Return | Win Rate |
| --- | --- | --- | --- | --- |
| 0.00 - 0.10 | 76 | 48.10% | +0.33% | 100.00% |
| 0.10 - 0.25 | 37 | 23.42% | +0.29% | 100.00% |
| 0.25 - 0.50 | 13 | 8.23% | +0.30% | 84.62% |
| 0.50 - 0.75 | 7 | 4.43% | -0.12% | 57.14% |
| 0.75 - 1.00 | 8 | 5.06% | +0.23% | 100.00% |
| 1.00 - 1.50 | 13 | 8.23% | -0.07% | 61.54% |
| 1.50+ | 4 | 2.53% | -1.16% | 0.00% |

## Variant H — Per-Pair Performance

| Pair | Class | Fills | Win Rate | Avg Return | Total Return | Avg MAE (xADR) | P95 MAE (xADR) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ETHUSD | crypto | 6 | 100.00% | +1.41% | +8.46% | 0.08 | 0.17 |
| BTCUSD | crypto | 6 | 100.00% | +1.00% | +5.97% | 0.19 | 0.44 |
| NDXUSD | indices | 6 | 100.00% | +0.50% | +3.02% | 0.31 | 0.89 |
| AUDUSD | fx | 7 | 100.00% | +0.26% | +1.83% | 0.08 | 0.15 |
| GBPAUD | fx | 7 | 100.00% | +0.19% | +1.35% | 0.20 | 0.70 |
| NZDCAD | fx | 7 | 100.00% | +0.19% | +1.34% | 0.24 | 0.87 |
| CADCHF | fx | 8 | 100.00% | +0.17% | +1.32% | 0.25 | 0.70 |
| NZDCHF | fx | 6 | 100.00% | +0.22% | +1.31% | 0.30 | 0.75 |
| NIKKEIUSD | indices | 5 | 80.00% | +0.19% | +0.94% | 0.76 | 2.16 |
| NZDUSD | fx | 3 | 100.00% | +0.29% | +0.87% | 0.41 | 0.96 |
| AUDCAD | fx | 5 | 100.00% | +0.17% | +0.86% | 0.14 | 0.23 |
| USDCAD | fx | 6 | 100.00% | +0.14% | +0.83% | 0.12 | 0.24 |
| EURCHF | fx | 7 | 100.00% | +0.12% | +0.83% | 0.33 | 1.08 |
| XAUUSD | commodities | 1 | 100.00% | +0.68% | +0.68% | 0.07 | 0.07 |
| GBPJPY | fx | 3 | 100.00% | +0.22% | +0.65% | 0.54 | 0.95 |
| CHFJPY | fx | 3 | 100.00% | +0.21% | +0.63% | 0.45 | 1.17 |
| GBPCHF | fx | 7 | 85.71% | +0.09% | +0.61% | 0.31 | 1.20 |
| EURUSD | fx | 3 | 100.00% | +0.20% | +0.59% | 0.43 | 0.85 |
| AUDJPY | fx | 3 | 66.67% | +0.18% | +0.54% | 0.43 | 1.12 |
| NZDJPY | fx | 2 | 100.00% | +0.26% | +0.53% | 0.53 | 0.96 |
| EURAUD | fx | 7 | 85.71% | +0.07% | +0.51% | 0.30 | 0.79 |
| EURCAD | fx | 3 | 100.00% | +0.15% | +0.45% | 0.11 | 0.17 |
| CADJPY | fx | 2 | 100.00% | +0.20% | +0.39% | 0.75 | 1.15 |
| AUDNZD | fx | 6 | 83.33% | +0.06% | +0.38% | 0.21 | 0.53 |
| EURNZD | fx | 3 | 100.00% | +0.12% | +0.36% | 0.27 | 0.53 |
| USDCHF | fx | 8 | 87.50% | +0.04% | +0.32% | 0.36 | 1.32 |
| GBPUSD | fx | 3 | 66.67% | +0.11% | +0.32% | 0.36 | 0.91 |
| GBPCAD | fx | 2 | 100.00% | +0.15% | +0.30% | 0.07 | 0.08 |
| EURJPY | fx | 3 | 66.67% | +0.10% | +0.29% | 0.63 | 1.19 |
| GBPNZD | fx | 6 | 83.33% | +0.01% | +0.07% | 0.35 | 0.98 |
| SPXUSD | indices | 6 | 83.33% | -0.00% | -0.02% | 0.50 | 1.26 |
| AUDCHF | fx | 3 | 33.33% | -0.11% | -0.33% | 0.29 | 0.42 |
| USDJPY | fx | 2 | 50.00% | -0.24% | -0.48% | 0.37 | 0.62 |
| EURGBP | fx | 3 | 66.67% | -0.26% | -0.79% | 0.86 | 2.29 |

## Variant H — Worst 10 Fills

| Pair | Week | Direction | Return | MAE (xADR) | TP Hit | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| NIKKEIUSD | Feb 23 | SHORT | -1.96% | 2.50 | No | SKIP |
| SPXUSD | Mar 16 | LONG | -1.87% | 1.30 | No | PASS |
| USDCHF | Mar 09 | SHORT | -1.27% | 1.57 | No | PASS |
| EURGBP | Mar 02 | LONG | -1.00% | 2.54 | No | SKIP |
| GBPNZD | Mar 09 | SHORT | -0.74% | 1.08 | No | SKIP |
| USDJPY | Feb 02 | SHORT | -0.64% | 0.65 | No | PASS |
| EURAUD | Mar 09 | SHORT | -0.52% | 0.61 | No | SKIP |
| GBPCHF | Mar 02 | SHORT | -0.38% | 1.60 | No | SKIP |
| AUDCHF | Mar 16 | LONG | -0.34% | 0.42 | No | SKIP |
| AUDNZD | Mar 16 | LONG | -0.27% | 0.61 | No | SKIP |

## Delta Analysis — Where Both W and H Filled

**Total pair-weeks where both filled**: 83
**H beat W**: 4 (4.82%)
**W beat H**: 9 (10.84%)
**Ties**: 70
**Avg delta (H - W)**: +0.01%

| Pair | Week | Direction | W Return | H Return | Delta |
| --- | --- | --- | --- | --- | --- |
| BTCUSD | Mar 09 | SHORT | -4.73% | +1.35% | +6.08% |
| USDCAD | Mar 09 | SHORT | -0.41% | +0.13% | +0.54% |
| USDCHF | Feb 16 | SHORT | -0.24% | +0.18% | +0.43% |
| USDCHF | Mar 02 | SHORT | -0.10% | +0.18% | +0.29% |
| BTCUSD | Jan 26 | SHORT | +0.74% | +0.74% | 0.00% |
| ETHUSD | Jan 26 | SHORT | +1.25% | +1.25% | 0.00% |
| EURJPY | Jan 26 | LONG | +0.24% | +0.24% | 0.00% |
| EURCAD | Jan 26 | LONG | +0.12% | +0.12% | 0.00% |
| AUDCHF | Jan 26 | LONG | +0.22% | +0.22% | 0.00% |
| GBPJPY | Jan 26 | LONG | +0.22% | +0.22% | 0.00% |
| GBPCAD | Jan 26 | LONG | +0.13% | +0.13% | 0.00% |
| CADJPY | Jan 26 | LONG | +0.22% | +0.22% | 0.00% |
| SPXUSD | Feb 02 | LONG | +0.33% | +0.33% | 0.00% |
| NDXUSD | Feb 02 | SHORT | +0.45% | +0.45% | 0.00% |
| NIKKEIUSD | Feb 02 | SHORT | +0.59% | +0.59% | 0.00% |
| EURCHF | Feb 02 | SHORT | +0.13% | +0.13% | 0.00% |
| GBPJPY | Feb 02 | SHORT | +0.22% | +0.22% | 0.00% |
| NZDUSD | Feb 02 | LONG | +0.27% | +0.27% | 0.00% |
| NZDCHF | Feb 02 | SHORT | +0.25% | +0.25% | 0.00% |
| NZDCAD | Feb 02 | LONG | +0.18% | +0.18% | 0.00% |

(Showing top 20 by delta)

## Notes

- Both variants enforce one fill maximum per pair per week. No re-entries.
- Variant W anchors to the first H1 bar open price of the canonical week (static, known at week start).
- Variant H anchors to the running weekly high (LONG) or low (SHORT), which updates each H1 bar (dynamic).
- ADR: 10-day lookback, 5-day minimum, recalculated at week boundary.
- Trigger: 1.0x ADR from anchor. TP: 0.25x ADR from fill price. Exit: TP or week close.
- Direction source: Tiered V3 weekly system.
- Key question: Does the dynamic anchor improve fill rate, returns, or risk profile vs static open?

