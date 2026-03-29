# ADR Daily Anchor Comparison — Test 9

Generated: 2026-03-25T06:10:40.975Z
Week range: Jan 19 → Mar 16
Script: `scripts/adr-daily-anchor-comparison.ts`

## Variant Legend

- **D (Daily Open)**: Static anchor at daily open price. Entry = dayOpen ± 1.0 ADR. One fill max per pair per day.
- **DH (Running Daily High/Low)**: Dynamic anchor. For LONG: running daily high, entry = runningHigh - 1.0 ADR. For SHORT: running daily low, entry = runningLow + 1.0 ADR. Anchor updates each H1 bar. One fill max per pair per day (first trigger only).

Both variants: TP = 0.25 ADR from fill price. Exit at TP or day close.

## Summary Comparison

| Metric | Daily Open (D) | Running Extreme (DH) |
| --- | --- | --- |
| Total signals | 1091 | 1091 |
| Eligible signals | 936 | 936 |
| Total fills | 112 | 230 |
| Fill rate | 11.97% | 24.57% |
| Avg return/fill | +0.19% | +0.20% |
| Total return | +20.89% | +45.94% |
| Win rate | 86.61% | 82.17% |
| TP hit rate | 79.46% | 76.09% |
| Avg MAE (xADR) | 0.21 | 0.20 |
| P95 MAE (xADR) | 0.73 | 0.73 |
| Losing days | 4 | 5 |

## Per-Week Aggregate

| Week | D Fills | D Return | DH Fills | DH Return |
| --- | --- | --- | --- | --- |
| Jan 19 | 0 | 0.00% | 0 | 0.00% |
| Jan 26 | 25 | +3.56% | 54 | +10.77% |
| Feb 02 | 10 | +2.05% | 35 | +12.93% |
| Feb 09 | 1 | +0.42% | 8 | +1.41% |
| Feb 16 | 3 | +0.50% | 3 | +0.06% |
| Feb 23 | 6 | +1.78% | 16 | +5.51% |
| Mar 02 | 39 | +10.53% | 61 | +10.68% |
| Mar 09 | 8 | +0.78% | 20 | +3.33% |
| Mar 16 | 20 | +1.27% | 33 | +1.25% |

## Per-Day Comparison (Last 20 Days)

| Day | D Fills | D Return | DH Fills | DH Return |
| --- | --- | --- | --- | --- |
| Mar 10 | 0 | 0.00% | 0 | 0.00% |
| Mar 10 | 0 | 0.00% | 0 | 0.00% |
| Mar 11 | 1 | +0.02% | 3 | +0.08% |
| Mar 11 | 0 | 0.00% | 0 | 0.00% |
| Mar 12 | 2 | +0.02% | 6 | +0.79% |
| Mar 12 | 0 | 0.00% | 0 | 0.00% |
| Mar 13 | 0 | 0.00% | 0 | 0.00% |
| Mar 14 | 0 | 0.00% | 0 | 0.00% |
| Mar 15 | 3 | +0.24% | 6 | -0.19% |
| Mar 15 | 1 | +1.15% | 1 | +1.15% |
| Mar 16 | 0 | 0.00% | 1 | +0.10% |
| Mar 16 | 0 | 0.00% | 0 | 0.00% |
| Mar 17 | 4 | -0.26% | 5 | -0.08% |
| Mar 17 | 0 | 0.00% | 0 | 0.00% |
| Mar 18 | 10 | -0.12% | 16 | +0.44% |
| Mar 18 | 0 | 0.00% | 0 | 0.00% |
| Mar 19 | 2 | +0.26% | 4 | -0.18% |
| Mar 19 | 0 | 0.00% | 0 | 0.00% |
| Mar 20 | 0 | 0.00% | 0 | 0.00% |
| Mar 21 | 0 | 0.00% | 0 | 0.00% |

## Per-Asset-Class Breakdown

| Asset Class | D Fills | D Return | DH Fills | DH Return |
| --- | --- | --- | --- | --- |
| fx | 87 | +8.57% | 181 | +16.82% |
| indices | 16 | +1.16% | 27 | +4.13% |
| crypto | 9 | +11.16% | 21 | +24.31% |
| commodities | 0 | 0.00% | 1 | +0.68% |

## Gated vs Non-Gated Split

### GATED (PASS / NO_DATA)

| Metric | Daily Open (D) | Running Extreme (DH) |
| --- | --- | --- |
| Total signals | 544 | 544 |
| Eligible signals | 470 | 470 |
| Total fills | 57 | 114 |
| Fill rate | 12.13% | 24.26% |
| Avg return/fill | +0.15% | +0.23% |
| Total return | +8.72% | +26.35% |
| Win rate | 84.21% | 79.82% |
| TP hit rate | 70.18% | 71.93% |
| Avg MAE (xADR) | 0.23 | 0.20 |
| P95 MAE (xADR) | 0.76 | 0.66 |
| Losing days | 4 | 4 |

### NON_GATED (SKIP / REDUCE)

| Metric | Daily Open (D) | Running Extreme (DH) |
| --- | --- | --- |
| Total signals | 547 | 547 |
| Eligible signals | 466 | 466 |
| Total fills | 55 | 116 |
| Fill rate | 11.80% | 24.89% |
| Avg return/fill | +0.22% | +0.17% |
| Total return | +12.17% | +19.59% |
| Win rate | 89.09% | 84.48% |
| TP hit rate | 89.09% | 80.17% |
| Avg MAE (xADR) | 0.20 | 0.20 |
| P95 MAE (xADR) | 0.72 | 0.84 |
| Losing days | 1 | 2 |

## MAE Distribution — Daily Open (D)

| MAE Bucket (xADR) | Fills | % of Total | Avg Return | Win Rate |
| --- | --- | --- | --- | --- |
| 0.00 - 0.10 | 51 | 45.54% | +0.32% | 98.04% |
| 0.10 - 0.25 | 31 | 27.68% | +0.23% | 93.55% |
| 0.25 - 0.50 | 20 | 17.86% | +0.13% | 75.00% |
| 0.50 - 0.75 | 4 | 3.57% | -0.31% | 50.00% |
| 0.75 - 1.00 | 2 | 1.79% | -0.20% | 50.00% |
| 1.00 - 1.50 | 4 | 3.57% | -0.86% | 0.00% |
| 1.50+ | 0 | 0.00% | — | — |

## MAE Distribution — Running Extreme (DH)

| MAE Bucket (xADR) | Fills | % of Total | Avg Return | Win Rate |
| --- | --- | --- | --- | --- |
| 0.00 - 0.10 | 114 | 49.57% | +0.24% | 93.86% |
| 0.10 - 0.25 | 59 | 25.65% | +0.33% | 86.44% |
| 0.25 - 0.50 | 35 | 15.22% | +0.15% | 65.71% |
| 0.50 - 0.75 | 10 | 4.35% | -0.13% | 50.00% |
| 0.75 - 1.00 | 5 | 2.17% | -0.39% | 40.00% |
| 1.00 - 1.50 | 6 | 2.61% | -0.73% | 0.00% |
| 1.50+ | 1 | 0.43% | +1.25% | 100.00% |

## Variant DH — Per-Pair Performance

| Pair | Class | Fills | Win Rate | Avg Return | Total Return | Avg MAE (xADR) | P95 MAE (xADR) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ETHUSD | crypto | 9 | 100.00% | +1.41% | +12.73% | 0.38 | 1.38 |
| BTCUSD | crypto | 12 | 100.00% | +0.96% | +11.58% | 0.17 | 0.48 |
| SPXUSD | indices | 12 | 91.67% | +0.28% | +3.41% | 0.18 | 0.41 |
| AUDUSD | fx | 10 | 90.00% | +0.18% | +1.80% | 0.16 | 0.41 |
| AUDCAD | fx | 11 | 100.00% | +0.16% | +1.71% | 0.16 | 0.37 |
| GBPAUD | fx | 7 | 100.00% | +0.18% | +1.24% | 0.20 | 0.69 |
| USDCAD | fx | 10 | 100.00% | +0.12% | +1.22% | 0.15 | 0.40 |
| GBPUSD | fx | 6 | 100.00% | +0.19% | +1.15% | 0.05 | 0.08 |
| AUDJPY | fx | 5 | 80.00% | +0.22% | +1.11% | 0.40 | 1.10 |
| NDXUSD | indices | 5 | 80.00% | +0.21% | +1.05% | 0.28 | 0.58 |
| CADCHF | fx | 7 | 100.00% | +0.15% | +1.03% | 0.16 | 0.38 |
| GBPCHF | fx | 8 | 75.00% | +0.10% | +0.76% | 0.14 | 0.29 |
| AUDNZD | fx | 7 | 85.71% | +0.10% | +0.72% | 0.18 | 0.53 |
| NZDCAD | fx | 12 | 83.33% | +0.06% | +0.70% | 0.19 | 0.52 |
| EURCHF | fx | 10 | 80.00% | +0.07% | +0.70% | 0.14 | 0.36 |
| GBPCAD | fx | 5 | 100.00% | +0.14% | +0.69% | 0.05 | 0.08 |
| XAUUSD | commodities | 1 | 100.00% | +0.68% | +0.68% | 0.11 | 0.11 |
| EURCAD | fx | 9 | 88.89% | +0.07% | +0.66% | 0.24 | 0.79 |
| USDCHF | fx | 9 | 66.67% | +0.07% | +0.59% | 0.11 | 0.36 |
| EURAUD | fx | 10 | 70.00% | +0.06% | +0.57% | 0.20 | 0.74 |
| EURJPY | fx | 3 | 100.00% | +0.18% | +0.55% | 0.01 | 0.02 |
| NZDCHF | fx | 7 | 57.14% | +0.08% | +0.54% | 0.18 | 0.29 |
| EURNZD | fx | 5 | 60.00% | +0.11% | +0.54% | 0.08 | 0.21 |
| GBPJPY | fx | 4 | 75.00% | +0.10% | +0.41% | 0.12 | 0.29 |
| CHFJPY | fx | 4 | 75.00% | +0.09% | +0.35% | 0.28 | 0.47 |
| AUDCHF | fx | 3 | 66.67% | +0.11% | +0.34% | 0.28 | 0.54 |
| GBPNZD | fx | 8 | 62.50% | +0.03% | +0.23% | 0.21 | 0.58 |
| NZDJPY | fx | 2 | 50.00% | +0.10% | +0.21% | 0.53 | 0.96 |
| NZDUSD | fx | 4 | 50.00% | +0.04% | +0.18% | 0.20 | 0.39 |
| USDJPY | fx | 1 | 100.00% | +0.15% | +0.15% | 0.04 | 0.04 |
| EURGBP | fx | 5 | 60.00% | -0.06% | -0.32% | 0.45 | 1.01 |
| NIKKEIUSD | indices | 10 | 70.00% | -0.03% | -0.33% | 0.29 | 1.17 |
| CADJPY | fx | 3 | 66.67% | -0.11% | -0.34% | 0.51 | 1.09 |
| EURUSD | fx | 6 | 50.00% | -0.11% | -0.65% | 0.35 | 0.72 |

## Variant DH — Worst 10 Fills

| Pair | Day | Direction | Return | MAE (xADR) | TP Hit | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| NIKKEIUSD | Mar 03 | SHORT | -2.80% | 1.41 | No | PASS |
| NIKKEIUSD | Feb 24 | SHORT | -1.50% | 0.87 | No | SKIP |
| CADJPY | Mar 18 | LONG | -0.77% | 1.18 | No | SKIP |
| NDXUSD | Mar 03 | SHORT | -0.75% | 0.65 | No | PASS |
| NZDCAD | Mar 18 | SHORT | -0.54% | 0.64 | No | SKIP |
| EURUSD | Mar 18 | SHORT | -0.42% | 0.77 | No | PASS |
| EURCAD | Jan 27 | LONG | -0.41% | 1.17 | No | PASS |
| EURUSD | Mar 08 | SHORT | -0.40% | 0.57 | No | PASS |
| EURGBP | Mar 01 | LONG | -0.34% | 0.84 | No | SKIP |
| USDCHF | Mar 17 | SHORT | -0.33% | 0.49 | No | PASS |

## Delta Analysis — Where Both D and DH Filled

**Total pair-days where both filled**: 112
**DH beat D**: 11 (9.82%)
**D beat DH**: 27 (24.11%)
**Ties**: 74
**Avg delta (DH - D)**: -0.04%

| Pair | Day | Direction | D Return | DH Return | Delta |
| --- | --- | --- | --- | --- | --- |
| NIKKEIUSD | Feb 05 | SHORT | -2.49% | +0.59% | +3.08% |
| EURCAD | Mar 18 | SHORT | -0.53% | +0.17% | +0.70% |
| NZDCAD | Mar 02 | LONG | -0.38% | +0.15% | +0.53% |
| EURCHF | Mar 01 | SHORT | -0.40% | +0.11% | +0.51% |
| AUDUSD | Mar 12 | LONG | -0.11% | +0.32% | +0.43% |
| CADCHF | Mar 17 | SHORT | -0.21% | +0.14% | +0.35% |
| AUDCAD | Mar 02 | LONG | -0.17% | +0.16% | +0.33% |
| GBPUSD | Jan 29 | LONG | -0.15% | +0.18% | +0.33% |
| SPXUSD | Mar 19 | LONG | +0.17% | +0.47% | +0.30% |
| USDCHF | Jan 27 | SHORT | +0.15% | +0.27% | +0.12% |
| GBPCAD | Jan 28 | LONG | +0.04% | +0.13% | +0.09% |
| EURJPY | Jan 25 | LONG | +0.24% | +0.24% | 0.00% |
| GBPJPY | Jan 25 | LONG | +0.22% | +0.22% | 0.00% |
| CADJPY | Jan 25 | LONG | +0.22% | +0.22% | 0.00% |
| CHFJPY | Jan 25 | LONG | +0.28% | +0.28% | 0.00% |
| EURUSD | Jan 27 | LONG | +0.19% | +0.19% | 0.00% |
| EURCHF | Jan 27 | SHORT | +0.11% | +0.11% | 0.00% |
| AUDCAD | Jan 27 | LONG | +0.13% | +0.13% | 0.00% |
| GBPCHF | Jan 27 | SHORT | +0.17% | +0.17% | 0.00% |
| GBPCAD | Jan 27 | LONG | +0.13% | +0.13% | 0.00% |

(Showing top 20 by delta)

## Notes

- Both variants enforce one fill maximum per pair per day. No re-entries.
- Variant D anchors to the first H1 bar open price of the canonical trading day (static, known at day start).
- Variant DH anchors to the running daily high (LONG) or low (SHORT), which updates each H1 bar (dynamic).
- ADR: 10-day lookback, 5-day minimum, calculated at week boundary and reused for all days in that week.
- Trigger: 1.0x ADR from anchor. TP: 0.25x ADR from fill price. Exit: TP or day close.
- Direction source: Tiered V3 weekly system (direction determined at week level, applied to each day).
- Gate evaluation: Once per week per pair, applied to all days in that week.
- Key question: Does the dynamic daily anchor improve fill rate, returns, or risk profile vs static day open?

