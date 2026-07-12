# ADR Dip Session Breakdown

Generated: 2026-03-24T09:52:44.065Z

## What We're Building And Why

This test isolates the Test 3 winner: TP 0.25 ADR with unlimited re-entry and no session gating. Instead of asking whether a hard session filter improves returns, the goal here is twofold: identify which UTC session actually produces the best fills, and measure how far filled trades typically travel against the position before recovering so execution and sizing can be tuned together.

The engine is otherwise unchanged from Test 3. It uses the same Tiered V3 directional universe, the same 1x ADR dip-entry anchor, the same H1 OANDA candles, and the same unlimited re-entry state machine.

## Universe Summary

| Metric | Value |
| --- | --- |
| Signals processed | 211 |
| Eligible pair-weeks | 184 |
| Skipped pair-weeks | 27 |
| Total fills | 261 |
| Total return | +62.30% |

| Gate Decision | Signals |
| --- | --- |
| PASS | 92 |
| NO_DATA | 12 |
| REDUCE | 16 |
| SKIP | 91 |

| Skip Reason | Signals |
| --- | --- |
| insufficient_adr | 27 |

## Session Summary

| Session | Fills | Total Return | Avg Return/Fill | Win Rate | TP Hit Rate | Re-entries |
| --- | --- | --- | --- | --- | --- | --- |
| NY_Overlap | 81 | +22.41% | +0.28% | 91.36% | 91.36% | 56 |
| NY_Afternoon | 54 | +21.03% | +0.39% | 98.15% | 92.59% | 38 |
| Asian | 36 | +8.49% | +0.24% | 94.44% | 91.67% | 20 |
| London | 74 | +6.98% | +0.09% | 87.84% | 87.84% | 55 |
| Off_Hours | 16 | +3.39% | +0.21% | 87.50% | 68.75% | 11 |

## Session x Asset Class Breakdown

| Session | Asset Class | Fills | Total Return | Avg Return/Fill | Win Rate |
| --- | --- | --- | --- | --- | --- |
| NY_Overlap | crypto | 6 | +9.58% | +1.60% | 100.00% |
| NY_Overlap | fx | 61 | +6.65% | +0.11% | 88.52% |
| NY_Overlap | indices | 14 | +6.17% | +0.44% | 100.00% |
| NY_Overlap | commodities | 0 | — | — | — |
| NY_Afternoon | crypto | 10 | +12.56% | +1.26% | 100.00% |
| NY_Afternoon | fx | 36 | +5.63% | +0.16% | 97.22% |
| NY_Afternoon | indices | 8 | +2.84% | +0.35% | 100.00% |
| NY_Afternoon | commodities | 0 | — | — | — |
| Asian | fx | 23 | +3.87% | +0.17% | 100.00% |
| Asian | indices | 6 | +2.77% | +0.46% | 83.33% |
| Asian | crypto | 7 | +1.84% | +0.26% | 85.71% |
| Asian | commodities | 0 | — | — | — |
| London | fx | 62 | +4.90% | +0.08% | 88.71% |
| London | crypto | 6 | +1.90% | +0.32% | 83.33% |
| London | indices | 6 | +0.18% | +0.03% | 83.33% |
| London | commodities | 0 | — | — | — |
| Off_Hours | crypto | 3 | +2.29% | +0.76% | 100.00% |
| Off_Hours | indices | 3 | +0.85% | +0.28% | 100.00% |
| Off_Hours | fx | 10 | +0.25% | +0.02% | 80.00% |
| Off_Hours | commodities | 0 | — | — | — |

## Per-Hour Heatmap

| Hour (UTC) | Fills | Total Return | Avg Return/Fill | Win Rate | Session |
| --- | --- | --- | --- | --- | --- |
| 00 | 5 | +1.05% | +0.21% | 100.00% | Asian |
| 01 | 10 | +3.50% | +0.35% | 100.00% | Asian |
| 02 | 6 | -3.66% | -0.61% | 83.33% | Asian |
| 03 | 2 | +0.55% | +0.27% | 50.00% | Asian |
| 04 | 3 | +1.86% | +0.62% | 100.00% | Asian |
| 05 | 2 | +1.28% | +0.64% | 100.00% | Asian |
| 06 | 4 | +1.45% | +0.36% | 100.00% | Asian |
| 07 | 9 | +2.76% | +0.31% | 100.00% | London |
| 08 | 18 | +5.22% | +0.29% | 83.33% | London |
| 09 | 18 | +1.06% | +0.06% | 88.89% | London |
| 10 | 16 | -3.45% | -0.22% | 81.25% | London |
| 11 | 13 | +1.40% | +0.11% | 92.31% | London |
| 12 | 9 | +0.08% | +0.01% | 77.78% | NY_Overlap |
| 13 | 22 | +6.50% | +0.30% | 100.00% | NY_Overlap |
| 14 | 27 | +6.71% | +0.25% | 85.19% | NY_Overlap |
| 15 | 23 | +9.12% | +0.40% | 95.65% | NY_Overlap |
| 16 | 16 | +9.62% | +0.60% | 93.75% | NY_Afternoon |
| 17 | 12 | +3.56% | +0.30% | 100.00% | NY_Afternoon |
| 18 | 14 | +4.37% | +0.31% | 100.00% | NY_Afternoon |
| 19 | 12 | +3.48% | +0.29% | 100.00% | NY_Afternoon |
| 20 | 11 | +1.24% | +0.11% | 81.82% | Off_Hours |
| 21 | 5 | +2.14% | +0.43% | 100.00% | Off_Hours |
| 22 | 2 | +1.03% | +0.52% | 100.00% | Asian |
| 23 | 2 | +1.41% | +0.71% | 100.00% | Asian |

## Best Session Per Asset Class

| Asset Class | Best Session | Fills | Total Return | Win Rate |
| --- | --- | --- | --- | --- |
| fx | NY_Overlap | 61 | +6.65% | 88.52% |
| indices | NY_Overlap | 14 | +6.17% | 100.00% |
| crypto | NY_Afternoon | 10 | +12.56% | 100.00% |
| commodities | No fills | 0 | — | — |

## Gated Vs Non-Gated Session Split

| Session | Mode | Fills | Total Return | Avg Return/Fill | Win Rate |
| --- | --- | --- | --- | --- | --- |
| NY_Overlap | GATED (PASS/NO_DATA) | 29 | +6.85% | +0.24% | 86.21% |
| NY_Overlap | NON-GATED (SKIP/REDUCE) | 52 | +15.56% | +0.30% | 94.23% |
| NY_Afternoon | GATED (PASS/NO_DATA) | 25 | +9.83% | +0.39% | 96.00% |
| NY_Afternoon | NON-GATED (SKIP/REDUCE) | 29 | +11.20% | +0.39% | 100.00% |
| Asian | GATED (PASS/NO_DATA) | 21 | +7.87% | +0.37% | 100.00% |
| Asian | NON-GATED (SKIP/REDUCE) | 15 | +0.61% | +0.04% | 86.67% |
| London | GATED (PASS/NO_DATA) | 32 | +0.33% | +0.01% | 84.38% |
| London | NON-GATED (SKIP/REDUCE) | 42 | +6.65% | +0.16% | 90.48% |
| Off_Hours | GATED (PASS/NO_DATA) | 10 | +2.64% | +0.26% | 90.00% |
| Off_Hours | NON-GATED (SKIP/REDUCE) | 6 | +0.74% | +0.12% | 83.33% |

## "Can You Trade One Session?" Analysis

Best session: **NY_Overlap**.
It captures **31.0%** of all fills and **36.0%** of total return.
Skipping every other session would leave **+39.88%** of return on the table.
Recommendation: No. NY_Overlap leads, but the edge is too distributed across the day to justify a one-session-only rule.

## MAE Distribution

| MAE Bucket (xADR) | Fills | % of Total | Cumulative % | Avg Return | Win Rate |
| --- | --- | --- | --- | --- | --- |
| 0.00 - 0.10 | 93 | 35.63% | 35.63% | +0.42% | 98.92% |
| 0.10 - 0.25 | 68 | 26.05% | 61.69% | +0.29% | 98.53% |
| 0.25 - 0.50 | 49 | 18.77% | 80.46% | +0.27% | 95.92% |
| 0.50 - 0.75 | 15 | 5.75% | 86.21% | +0.24% | 93.33% |
| 0.75 - 1.00 | 13 | 4.98% | 91.19% | -0.42% | 61.54% |
| 1.00 - 1.50 | 16 | 6.13% | 97.32% | -0.28% | 62.50% |
| 1.50+ | 7 | 2.68% | 100.00% | -0.44% | 28.57% |

## MAE Per Asset Class

| Asset Class | Avg MAE (xADR) | Median MAE (xADR) | P95 MAE (xADR) | Max MAE (xADR) |
| --- | --- | --- | --- | --- |
| fx | 0.37 | 0.18 | 1.26 | 3.94 |
| indices | 0.24 | 0.11 | 1.29 | 1.44 |
| crypto | 0.34 | 0.11 | 1.13 | 1.70 |
| commodities | — | — | — | — |

## MAE Vs Outcome

| Outcome | Count | Avg MAE (xADR) | Median MAE (xADR) | P95 MAE (xADR) |
| --- | --- | --- | --- | --- |
| TP Hit | 233 | 0.26 | 0.15 | 1.00 |
| Fallback Win | 7 | 0.18 | 0.06 | 0.63 |
| Fallback Loss | 21 | 1.37 | 1.18 | 3.53 |

## Worst Fills

| Rank | Pair | Week | Direction | MAE (xADR) | maePct | Bars to MAE | Final Return | TP Hit? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CADCHF | Mar 02 | SHORT | 3.94 | +1.74% | 28 | -1.31% | NO |
| 2 | USDCHF | Mar 02 | SHORT | 3.53 | +2.06% | 27 | -0.52% | NO |
| 3 | EURGBP | Mar 02 | LONG | 2.80 | +1.01% | 97 | -0.94% | NO |
| 4 | GBPCHF | Mar 02 | SHORT | 2.33 | +1.22% | 47 | -0.58% | NO |
| 5 | NZDCAD | Mar 02 | LONG | 2.03 | +1.10% | 27 | -0.98% | NO |
| 6 | EURCHF | Mar 02 | SHORT | 1.94 | +0.70% | 4 | +0.09% | YES |
| 7 | BTCUSD | Mar 02 | SHORT | 1.70 | +7.70% | 12 | +1.13% | YES |
| 8 | NIKKEIUSD | Feb 23 | SHORT | 1.44 | +3.05% | 18 | -0.57% | NO |
| 9 | NIKKEIUSD | Feb 02 | SHORT | 1.40 | +3.02% | 11 | -2.97% | NO |
| 10 | NZDCAD | Mar 02 | LONG | 1.38 | +0.75% | 7 | +0.14% | YES |

## Position Sizing Implications

At 0.50x ADR stop: 19.5% of fills would be stopped out.
At 0.75x ADR stop: 13.8% of fills would be stopped out.
At 1.00x ADR stop: 8.8% of fills would be stopped out.
Combined P95 MAE: 1.27x ADR.
Recommended maximum risk per trade: Inference: size each fill assuming at least a 1.27x ADR adverse move, and because re-entries can cluster, keep per-fill account risk conservative rather than using an aggressive full-size weekly position.

