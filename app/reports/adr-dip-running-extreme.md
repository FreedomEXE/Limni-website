# ADR Dip Running Extreme — Test 7

Generated: 2026-03-24T22:45:02.659Z
Week range: Jan 19 -> Mar 16
Script: `scripts/adr-dip-running-extreme.ts`

## Variant Legend

- **W**: Weekly baseline — one fill per pair per week, anchored to weekly open
- **A**: Fresh Start — running extreme, reset anchor after each exit
- **B**: Consumed Trigger — running extreme, anchor stays but cannot re-trigger until new extreme beyond old
- **C**: Side Flip — running extreme, after exit the fill area becomes the anchor for the opposite direction

## Summary Comparison

| Metric | Weekly (W) | Fresh Start (A) | Consumed (B) | Side Flip (C) |
| --- | --- | --- | --- | --- |
| Total signals | 211 | 211 | 211 | 211 |
| Eligible signals | 184 | 184 | 184 | 184 |
| Total fills | 83 | 330 | 198 | 330 |
| Avg fills/pair-week | 0.45 | 1.79 | 1.08 | 1.79 |
| Fill rate | 45.11% | 179.35% | 107.61% | 179.35% |
| Avg return/fill | +0.21% | +0.24% | +0.21% | +0.24% |
| Total return | +17.62% | +79.57% | +40.93% | +79.57% |
| Win rate | 90.36% | 92.73% | 92.42% | 92.73% |
| TP hit rate | 90.36% | 91.21% | 91.41% | 91.21% |
| Avg MAE (xADR) | 0.23 | 0.29 | 0.32 | 0.29 |
| P95 MAE (xADR) | 0.84 | 1.16 | 1.24 | 1.16 |
| Losing weeks | 1 | 0 | 0 | 0 |

## Per-Week Comparison

| Week | W Fills | W Return | A Fills | A Return | B Fills | B Return | C Fills | C Return |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Jan 19 | 0 | 0.00% | 0 | 0.00% | 0 | 0.00% | 0 | 0.00% |
| Jan 26 | 8 | +3.14% | 70 | +17.79% | 40 | +11.36% | 70 | +17.79% |
| Feb 02 | 10 | +2.42% | 54 | +9.77% | 34 | +2.63% | 54 | +9.77% |
| Feb 09 | 2 | +0.60% | 19 | +3.91% | 17 | +3.66% | 19 | +3.91% |
| Feb 16 | 4 | +0.19% | 13 | +2.38% | 9 | +1.75% | 13 | +2.38% |
| Feb 23 | 10 | +2.24% | 27 | +9.08% | 23 | +6.03% | 27 | +9.08% |
| Mar 02 | 18 | +5.44% | 72 | +18.16% | 28 | +5.87% | 72 | +18.16% |
| Mar 09 | 15 | -1.18% | 31 | +10.32% | 21 | +5.14% | 31 | +10.32% |
| Mar 16 | 16 | +4.77% | 44 | +8.16% | 26 | +4.49% | 44 | +8.16% |

## Per-Asset-Class Breakdown

| Asset Class | W Fills | W Return | A Fills | A Return | B Fills | B Return | C Fills | C Return |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fx | 62 | +8.49% | 250 | +32.39% | 153 | +20.48% | 250 | +32.39% |
| indices | 11 | +3.43% | 39 | +13.38% | 21 | +5.47% | 39 | +13.38% |
| crypto | 10 | +5.69% | 39 | +32.43% | 23 | +14.30% | 39 | +32.43% |
| commodities | 0 | 0.00% | 2 | +1.37% | 1 | +0.68% | 2 | +1.37% |

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

## MAE Distribution — Fresh Start (A)

| MAE Bucket (xADR) | Fills | % of Total | Avg Return | Win Rate |
| --- | --- | --- | --- | --- |
| 0.00 - 0.10 | 151 | 45.76% | +0.33% | 99.34% |
| 0.10 - 0.25 | 81 | 24.55% | +0.31% | 97.53% |
| 0.25 - 0.50 | 40 | 12.12% | +0.28% | 90.00% |
| 0.50 - 0.75 | 20 | 6.06% | +0.30% | 85.00% |
| 0.75 - 1.00 | 11 | 3.33% | +0.18% | 90.91% |
| 1.00 - 1.50 | 18 | 5.45% | -0.02% | 66.67% |
| 1.50+ | 9 | 2.73% | -1.56% | 22.22% |

## MAE Distribution — Consumed (B)

| MAE Bucket (xADR) | Fills | % of Total | Avg Return | Win Rate |
| --- | --- | --- | --- | --- |
| 0.00 - 0.10 | 90 | 45.45% | +0.33% | 100.00% |
| 0.10 - 0.25 | 48 | 24.24% | +0.32% | 100.00% |
| 0.25 - 0.50 | 19 | 9.60% | +0.31% | 89.47% |
| 0.50 - 0.75 | 13 | 6.57% | +0.20% | 76.92% |
| 0.75 - 1.00 | 9 | 4.55% | +0.22% | 100.00% |
| 1.00 - 1.50 | 13 | 6.57% | -0.07% | 61.54% |
| 1.50+ | 6 | 3.03% | -2.28% | 16.67% |

## MAE Distribution — Side Flip (C)

| MAE Bucket (xADR) | Fills | % of Total | Avg Return | Win Rate |
| --- | --- | --- | --- | --- |
| 0.00 - 0.10 | 151 | 45.76% | +0.33% | 99.34% |
| 0.10 - 0.25 | 81 | 24.55% | +0.31% | 97.53% |
| 0.25 - 0.50 | 40 | 12.12% | +0.28% | 90.00% |
| 0.50 - 0.75 | 20 | 6.06% | +0.30% | 85.00% |
| 0.75 - 1.00 | 11 | 3.33% | +0.18% | 90.91% |
| 1.00 - 1.50 | 18 | 5.45% | -0.02% | 66.67% |
| 1.50+ | 9 | 2.73% | -1.56% | 22.22% |

## Fill Frequency Analysis — Fresh Start (A)

| Pair | Signal Weeks | Total Fills | Avg Fills/Signal Week | Weeks w/ Fill | Avg Fills/Filled Week |
| --- | --- | --- | --- | --- | --- |
| AUDCAD | 7 | 20 | 2.86 | 5 | 4.00 |
| BTCUSD | 9 | 23 | 2.56 | 6 | 3.83 |
| AUDUSD | 8 | 20 | 2.50 | 7 | 2.86 |
| USDCAD | 7 | 16 | 2.29 | 6 | 2.67 |
| SPXUSD | 7 | 15 | 2.14 | 6 | 2.50 |
| EURCAD | 5 | 10 | 2.00 | 3 | 3.33 |
| GBPCAD | 3 | 6 | 2.00 | 2 | 3.00 |
| NIKKEIUSD | 7 | 14 | 2.00 | 5 | 2.80 |
| NZDCAD | 8 | 16 | 2.00 | 7 | 2.29 |
| USDJPY | 2 | 4 | 2.00 | 2 | 2.00 |
| XAUUSD | 1 | 2 | 2.00 | 1 | 2.00 |
| ETHUSD | 9 | 16 | 1.78 | 6 | 2.67 |
| GBPUSD | 4 | 7 | 1.75 | 3 | 2.33 |
| GBPAUD | 9 | 15 | 1.67 | 7 | 2.14 |
| EURAUD | 9 | 14 | 1.56 | 7 | 2.00 |
| GBPJPY | 4 | 6 | 1.50 | 3 | 2.00 |
| NDXUSD | 7 | 10 | 1.43 | 6 | 1.67 |
| NZDCHF | 7 | 10 | 1.43 | 6 | 1.67 |
| EURUSD | 5 | 7 | 1.40 | 3 | 2.33 |
| GBPNZD | 8 | 11 | 1.38 | 6 | 1.83 |
| USDCHF | 9 | 12 | 1.33 | 8 | 1.50 |
| AUDJPY | 4 | 5 | 1.25 | 3 | 1.67 |
| NZDUSD | 4 | 5 | 1.25 | 3 | 1.67 |
| AUDNZD | 9 | 10 | 1.11 | 6 | 1.67 |
| CADCHF | 9 | 10 | 1.11 | 8 | 1.25 |
| EURCHF | 9 | 10 | 1.11 | 7 | 1.43 |
| GBPCHF | 9 | 10 | 1.11 | 7 | 1.43 |
| EURNZD | 5 | 5 | 1.00 | 3 | 1.67 |
| NZDJPY | 3 | 3 | 1.00 | 2 | 1.50 |
| AUDCHF | 5 | 4 | 0.80 | 3 | 1.33 |
| CHFJPY | 5 | 4 | 0.80 | 3 | 1.33 |
| EURGBP | 5 | 4 | 0.80 | 3 | 1.33 |
| CADJPY | 4 | 3 | 0.75 | 2 | 1.50 |
| EURJPY | 5 | 3 | 0.60 | 3 | 1.00 |

## Gated Vs Non-Gated Split

### GATED (PASS / NO_DATA)

| Metric | Weekly (W) | Fresh Start (A) | Consumed (B) | Side Flip (C) |
| --- | --- | --- | --- | --- |
| Total signals | 104 | 104 | 104 | 104 |
| Eligible signals | 92 | 92 | 92 | 92 |
| Total fills | 42 | 160 | 96 | 160 |
| Avg fills/pair-week | 0.46 | 1.74 | 1.04 | 1.74 |
| Fill rate | 45.65% | 173.91% | 104.35% | 173.91% |
| Avg return/fill | +0.26% | +0.27% | +0.23% | +0.27% |
| Total return | +10.96% | +42.49% | +21.75% | +42.49% |
| Win rate | 88.10% | 93.13% | 94.79% | 93.13% |
| TP hit rate | 88.10% | 91.88% | 93.75% | 91.88% |
| Avg MAE (xADR) | 0.20 | 0.29 | 0.32 | 0.29 |
| P95 MAE (xADR) | 0.57 | 1.15 | 1.18 | 1.15 |
| Losing weeks | 0 | 0 | 0 | 0 |

### NON_GATED (SKIP / REDUCE)

| Metric | Weekly (W) | Fresh Start (A) | Consumed (B) | Side Flip (C) |
| --- | --- | --- | --- | --- |
| Total signals | 107 | 107 | 107 | 107 |
| Eligible signals | 92 | 92 | 92 | 92 |
| Total fills | 41 | 170 | 102 | 170 |
| Avg fills/pair-week | 0.45 | 1.85 | 1.11 | 1.85 |
| Fill rate | 44.57% | 184.78% | 110.87% | 184.78% |
| Avg return/fill | +0.16% | +0.22% | +0.19% | +0.22% |
| Total return | +6.66% | +37.08% | +19.18% | +37.08% |
| Win rate | 92.68% | 92.35% | 90.20% | 92.35% |
| TP hit rate | 92.68% | 90.59% | 89.22% | 90.59% |
| Avg MAE (xADR) | 0.27 | 0.29 | 0.31 | 0.29 |
| P95 MAE (xADR) | 1.06 | 1.14 | 1.23 | 1.14 |
| Losing weeks | 2 | 1 | 1 | 1 |

## Option A — Per-Asset-Class Deep Dive

| Asset Class | Fills | Win Rate | Avg Return | Total Return | Avg MAE (xADR) | P95 MAE (xADR) | Max MAE (xADR) | Max Consec Losses | Peak Drawdown |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fx | 250 | 92.00% | +0.13% | +32.39% | 0.28 | 1.07 | 2.54 | 2 | -2.76% |
| indices | 39 | 92.31% | +0.34% | +13.38% | 0.36 | 1.31 | 2.50 | 1 | -1.96% |
| crypto | 39 | 97.44% | +0.83% | +32.43% | 0.32 | 1.73 | 2.06 | 1 | -10.29% |
| commodities | 2 | 100.00% | +0.68% | +1.37% | 0.15 | 0.23 | 0.23 | 0 | 0.00% |

## Option A — Equity Curve & Drawdown

| Week | Fills | Week Return | Cumulative Return | Peak | Drawdown |
| --- | --- | --- | --- | --- | --- |
| Jan 26 | 70 | +17.79% | +17.79% | +17.79% | 0.00% |
| Feb 02 | 54 | +9.77% | +27.56% | +27.56% | 0.00% |
| Feb 09 | 19 | +3.91% | +31.47% | +31.47% | 0.00% |
| Feb 16 | 13 | +2.38% | +33.85% | +33.85% | 0.00% |
| Feb 23 | 27 | +9.08% | +42.93% | +42.93% | 0.00% |
| Mar 02 | 72 | +18.16% | +61.09% | +61.09% | 0.00% |
| Mar 09 | 31 | +10.32% | +71.41% | +71.41% | 0.00% |
| Mar 16 | 44 | +8.16% | +79.57% | +79.57% | 0.00% |

**Max Peak-to-Trough Drawdown**: 0.00% (week of N/A)
**Final Cumulative Return**: +79.57%
**Recovery**: No drawdown

## Option A — Per-Pair Performance

| Pair | Class | Fills | Win Rate | Avg Return | Total Return | Avg MAE (xADR) | P95 MAE (xADR) | Max Consec Loss |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BTCUSD | crypto | 23 | 100.00% | +0.95% | +21.86% | 0.19 | 0.63 | 0 |
| ETHUSD | crypto | 16 | 93.75% | +0.66% | +10.57% | 0.51 | 1.92 | 1 |
| NIKKEIUSD | indices | 14 | 85.71% | +0.46% | +6.39% | 0.40 | 1.81 | 1 |
| AUDUSD | fx | 20 | 100.00% | +0.24% | +4.76% | 0.20 | 0.58 | 0 |
| NDXUSD | indices | 10 | 100.00% | +0.44% | +4.43% | 0.30 | 0.90 | 0 |
| AUDCAD | fx | 20 | 100.00% | +0.16% | +3.21% | 0.23 | 1.10 | 0 |
| NZDCAD | fx | 16 | 100.00% | +0.18% | +2.89% | 0.22 | 0.85 | 0 |
| GBPAUD | fx | 15 | 100.00% | +0.18% | +2.71% | 0.14 | 0.43 | 0 |
| SPXUSD | indices | 15 | 93.33% | +0.17% | +2.56% | 0.35 | 1.19 | 1 |
| NZDCHF | fx | 10 | 100.00% | +0.22% | +2.18% | 0.24 | 0.73 | 0 |
| NZDUSD | fx | 5 | 100.00% | +0.29% | +1.46% | 0.36 | 0.93 | 0 |
| EURCAD | fx | 10 | 100.00% | +0.14% | +1.41% | 0.11 | 0.24 | 0 |
| XAUUSD | commodities | 2 | 100.00% | +0.68% | +1.37% | 0.15 | 0.23 | 0 |
| EURAUD | fx | 14 | 85.71% | +0.09% | +1.31% | 0.33 | 0.85 | 1 |
| EURCHF | fx | 10 | 100.00% | +0.12% | +1.18% | 0.28 | 0.96 | 0 |
| AUDJPY | fx | 5 | 80.00% | +0.22% | +1.11% | 0.40 | 1.12 | 1 |
| GBPUSD | fx | 7 | 85.71% | +0.15% | +1.08% | 0.21 | 0.76 | 1 |
| GBPCHF | fx | 10 | 90.00% | +0.10% | +1.00% | 0.26 | 1.02 | 1 |
| USDCAD | fx | 16 | 93.75% | +0.06% | +0.98% | 0.25 | 0.77 | 1 |
| AUDNZD | fx | 10 | 90.00% | +0.09% | +0.89% | 0.20 | 0.64 | 1 |
| GBPCAD | fx | 6 | 100.00% | +0.14% | +0.87% | 0.08 | 0.17 | 0 |
| GBPJPY | fx | 6 | 83.33% | +0.14% | +0.83% | 0.35 | 0.89 | 1 |
| CHFJPY | fx | 4 | 100.00% | +0.20% | +0.78% | 0.42 | 1.15 | 0 |
| CADCHF | fx | 10 | 90.00% | +0.08% | +0.76% | 0.41 | 1.52 | 1 |
| NZDJPY | fx | 3 | 100.00% | +0.25% | +0.75% | 0.37 | 0.91 | 0 |
| USDCHF | fx | 12 | 83.33% | +0.06% | +0.75% | 0.30 | 1.18 | 1 |
| EURNZD | fx | 5 | 100.00% | +0.14% | +0.72% | 0.29 | 0.61 | 0 |
| CADJPY | fx | 3 | 100.00% | +0.20% | +0.61% | 0.52 | 1.10 | 0 |
| EURUSD | fx | 7 | 71.43% | +0.09% | +0.60% | 0.43 | 0.88 | 1 |
| EURJPY | fx | 3 | 66.67% | +0.10% | +0.29% | 0.63 | 1.19 | 1 |
| GBPNZD | fx | 11 | 81.82% | +0.02% | +0.26% | 0.33 | 1.07 | 2 |
| AUDCHF | fx | 4 | 50.00% | -0.03% | -0.11% | 0.36 | 0.56 | 2 |
| USDJPY | fx | 4 | 75.00% | -0.04% | -0.18% | 0.32 | 0.62 | 1 |
| EURGBP | fx | 4 | 75.00% | -0.18% | -0.70% | 0.71 | 2.20 | 1 |

## Option A — Worst 10 Fills

| Pair | Week | Direction | Return | MAE (xADR) | TP Hit | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| ETHUSD | Feb 02 | SHORT | -10.29% | 1.71 | No | NO_DATA |
| NIKKEIUSD | Feb 23 | SHORT | -1.96% | 2.50 | No | SKIP |
| SPXUSD | Mar 16 | LONG | -1.87% | 1.30 | No | PASS |
| USDCHF | Mar 09 | SHORT | -1.27% | 1.57 | No | PASS |
| EURGBP | Mar 02 | LONG | -1.00% | 2.54 | No | SKIP |
| USDCAD | Mar 09 | SHORT | -0.77% | 1.73 | No | SKIP |
| GBPNZD | Mar 09 | SHORT | -0.74% | 1.08 | No | SKIP |
| CADCHF | Mar 02 | SHORT | -0.71% | 2.08 | No | PASS |
| USDJPY | Feb 02 | SHORT | -0.64% | 0.65 | No | PASS |
| EURAUD | Mar 09 | SHORT | -0.52% | 0.61 | No | SKIP |

## Option A — Consecutive Loss Analysis

**Overall max consecutive losses**: 2 (total impact: -0.23%)
**Total losing fills**: 24 of 330 (7.27%)

| Asset Class | Max Consec Losses | Streak Impact | Total Losses | Loss Rate |
| --- | --- | --- | --- | --- |
| fx | 2 | -0.23% | 20 | 8.00% |
| indices | 1 | -0.03% | 3 | 7.69% |
| crypto | 1 | -10.29% | 1 | 2.56% |
| commodities | 0 | 0.00% | 0 | 0.00% |

## Position Sizing Scenarios — Option A

Simulations assume each fill risks `Risk%` of account equity, with stop at `Stop (xADR)` distance.
Return per fill is actual backtest return, scaled by (riskPct / stopDistance).

| Risk % | Stop (xADR) | Final Equity | Max DD | Max DD % | Avg Fill P/L $ | Worst Week |
| --- | --- | --- | --- | --- | --- | --- |
| 0.25% | 0.5x | $13447 | $-249 | -1.90% | $10.45 | $123 |
| 0.25% | 0.75x | $12184 | $-152 | -1.27% | $6.62 | $76 |
| 0.25% | 1x | $11598 | $-109 | -0.95% | $4.84 | $55 |
| 0.25% | 1.25x | $11259 | $-85 | -0.76% | $3.82 | $43 |
| 0.25% | 1.5x | $11039 | $-70 | -0.64% | $3.15 | $35 |
| 0.5% | 0.5x | $18065 | $-651 | -3.78% | $24.44 | $315 |
| 0.5% | 0.75x | $14839 | $-363 | -2.53% | $14.66 | $179 |
| 0.5% | 1x | $13447 | $-249 | -1.90% | $10.45 | $123 |
| 0.5% | 1.25x | $12675 | $-189 | -1.52% | $8.11 | $94 |
| 0.5% | 1.5x | $12184 | $-152 | -1.27% | $6.62 | $76 |
| 1% | 0.5x | $32508 | $-2208 | -7.47% | $68.21 | $1023 |
| 1% | 0.75x | $21983 | $-1035 | -5.02% | $36.31 | $494 |
| 1% | 1x | $18065 | $-651 | -3.78% | $24.44 | $315 |
| 1% | 1.25x | $16055 | $-468 | -3.03% | $18.35 | $229 |
| 1% | 1.5x | $14839 | $-363 | -2.53% | $14.66 | $179 |
| 1.5% | 0.5x | $58269 | $-5605 | -11.08% | $146.27 | $2316 |
| 1.5% | 0.75x | $32508 | $-2208 | -7.47% | $68.21 | $1023 |
| 1.5% | 1x | $24245 | $-1272 | -5.64% | $43.17 | $603 |
| 1.5% | 1.25x | $20324 | $-868 | -4.52% | $31.28 | $417 |
| 1.5% | 1.5x | $18065 | $-651 | -3.78% | $24.44 | $315 |
| 2% | 0.5x | $104025 | $-12607 | -14.60% | $284.92 | $4219 |
| 2% | 0.75x | $47990 | $-4182 | -9.89% | $115.12 | $1855 |
| 2% | 1x | $32508 | $-2208 | -7.47% | $68.21 | $1023 |
| 2% | 1.25x | $25712 | $-1430 | -6.00% | $47.61 | $675 |
| 2% | 1.5x | $21983 | $-1035 | -5.02% | $36.31 | $494 |

Starting equity: $10,000. Fills processed chronologically.
Formula: `equityReturn = (riskPct / stopPct) * fillReturn` where `stopPct = adrPct * stopXAdr`.

## Notes

- Weekly baseline uses one fill maximum per pair per week from weekly open. No re-entries.
- Running extreme variants track H1 bar highs/lows within each week to form dynamic anchors.
- All variants use weekly scope boundary: anchor resets at each canonical week open.
- ADR: 10-day lookback, 5-day minimum, recalculated at week boundary.
- Trigger: 1.0x ADR from running extreme. TP: 0.25x ADR from fill price. Exit: TP or week close.
- LONG bias tracks running highs (pullback entries). SHORT bias tracks running lows (rally entries).
- NEUTRAL pairs: A/B track both sides independently. C alternates via side flip.
- Direction source: Tiered V3 weekly system.

