# Selector Fragility Formula Research

Weeks analyzed: 10 (Mar 22 -> Jan 19).
Baseline: canonical selector strength_tiebreak.
All returns ADR-normalized.

Fragility score = commercial opposed (+1) + high extremity (+1) + building against (+1).

## Master Comparison

| Variant | Trades | Skipped | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk | Skipped Return | Skipped WR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Skip opposed OR building_against | 112 | 248 | +49.32% | 0.11% | 58.0% | 1 | 11.2 | +42.64% | 52.4% |
| Skip fragility 3 | 345 | 15 | +100.39% | 4.01% | 54.8% | 1 | 34.5 | -8.42% | 40.0% |
| Baseline strength_tiebreak | 360 | 0 | +91.96% | 4.01% | 54.2% | 1 | 36.0 | +0.00% | 0.0% |
| Skip building_against | 281 | 79 | +88.92% | 4.57% | 55.9% | 1 | 28.1 | +3.04% | 48.1% |
| Skip building_against + opposed | 311 | 49 | +89.09% | 1.38% | 55.9% | 2 | 31.1 | +2.87% | 42.9% |
| Skip fragility 1-2-3 (score 0 only) | 58 | 302 | +33.34% | 1.43% | 63.8% | 2 | 5.8 | +58.63% | 52.3% |
| Skip fragility 2-3 | 201 | 159 | +75.12% | 10.20% | 58.2% | 3 | 20.1 | +16.85% | 49.1% |
| Skip high_extremity + opposed | 242 | 118 | +82.98% | 14.26% | 56.2% | 3 | 24.2 | +8.99% | 50.0% |

## Asset Breakdown

### Skip opposed OR building_against

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 90 | +29.15% | 55.6% |
| crypto | 7 | +11.89% | 85.7% |
| indices | 7 | +1.20% | 57.1% |
| commodities | 8 | +7.08% | 62.5% |

### Skip fragility 3

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 267 | +50.36% | 53.2% |
| crypto | 20 | +17.17% | 60.0% |
| indices | 29 | +1.07% | 58.6% |
| commodities | 29 | +31.79% | 62.1% |

### Baseline strength_tiebreak

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +42.09% | 52.5% |
| crypto | 20 | +17.17% | 60.0% |
| indices | 30 | +1.17% | 60.0% |
| commodities | 30 | +31.54% | 60.0% |

### Skip building_against

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 229 | +60.26% | 55.0% |
| crypto | 10 | +10.70% | 60.0% |
| indices | 17 | -0.70% | 58.8% |
| commodities | 25 | +18.67% | 60.0% |

### Skip building_against + opposed

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 248 | +55.95% | 54.8% |
| crypto | 18 | +17.40% | 66.7% |
| indices | 20 | -2.93% | 55.0% |
| commodities | 25 | +18.67% | 60.0% |

### Skip fragility 1-2-3 (score 0 only)

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 36 | +13.17% | 61.1% |
| crypto | 7 | +11.89% | 85.7% |
| indices | 7 | +1.20% | 57.1% |
| commodities | 8 | +7.08% | 62.5% |

### Skip fragility 2-3

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 147 | +56.63% | 57.8% |
| crypto | 18 | +17.40% | 66.7% |
| indices | 20 | -2.93% | 55.0% |
| commodities | 16 | +4.01% | 56.3% |

### Skip high_extremity + opposed

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 173 | +47.61% | 54.9% |
| crypto | 20 | +17.17% | 60.0% |
| indices | 29 | +1.07% | 58.6% |
| commodities | 20 | +17.13% | 60.0% |

## Skipped Trades: Skip opposed OR building_against

| Week | Pair | Direction | Return% | Fragility | Opposed | High Ext | Building Against |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| Jan 19 | AUDCHF | LONG | +0.89% | 2 | Y | Y | N |
| Jan 19 | AUDJPY | LONG | +3.21% | 1 | Y | N | N |
| Jan 19 | AUDNZD | LONG | -0.37% | 2 | Y | Y | N |
| Jan 19 | AUDUSD | LONG | +5.61% | 1 | Y | N | N |
| Jan 19 | BTCUSD | SHORT | +2.13% | 1 | N | N | Y |
| Jan 19 | CADCHF | LONG | -2.05% | 2 | Y | Y | N |
| Jan 19 | CADJPY | LONG | +0.19% | 1 | Y | N | N |
| Jan 19 | CHFJPY | SHORT | -2.29% | 2 | Y | Y | N |
| Jan 19 | EURAUD | LONG | -1.93% | 2 | Y | N | Y |
| Jan 19 | EURCAD | LONG | +1.04% | 2 | Y | N | Y |
| Jan 19 | EURCHF | LONG | -1.02% | 2 | Y | Y | N |
| Jan 19 | EURGBP | LONG | -0.06% | 2 | Y | N | Y |
| Jan 19 | EURJPY | LONG | +1.23% | 2 | Y | N | Y |
| Jan 19 | EURNZD | LONG | -2.31% | 2 | Y | Y | N |
| Jan 19 | EURUSD | LONG | +3.56% | 1 | Y | N | N |
| Jan 19 | GBPAUD | SHORT | +1.88% | 1 | Y | N | N |
| Jan 19 | GBPCAD | SHORT | -1.07% | 2 | Y | N | Y |
| Jan 19 | GBPCHF | LONG | -0.98% | 2 | Y | Y | N |
| Jan 19 | GBPJPY | SHORT | -1.28% | 1 | Y | N | N |
| Jan 19 | GBPNZD | LONG | -2.26% | 2 | Y | Y | N |
| Jan 19 | NDXUSD | LONG | +0.96% | 2 | Y | N | Y |
| Jan 19 | NZDCAD | SHORT | -3.37% | 2 | Y | Y | N |
| Jan 19 | NZDJPY | SHORT | -3.57% | 2 | Y | Y | N |
| Jan 19 | NZDUSD | SHORT | -5.98% | 3 | Y | Y | Y |
| Jan 19 | SPXUSD | LONG | +0.11% | 1 | Y | N | N |
| Jan 19 | USDCAD | SHORT | +2.49% | 1 | Y | N | N |
| Jan 19 | USDCHF | LONG | -4.54% | 3 | Y | Y | Y |
| Jan 19 | WTIUSD | LONG | +2.67% | 2 | Y | Y | N |
| Jan 19 | XAGUSD | LONG | +8.34% | 2 | Y | N | Y |
| Jan 19 | XAUUSD | LONG | +4.84% | 2 | Y | N | Y |
| Jan 26 | AUDCAD | LONG | -0.01% | 2 | Y | N | Y |
| Jan 26 | AUDCHF | LONG | +0.23% | 2 | Y | Y | N |
| Jan 26 | AUDJPY | LONG | +0.45% | 1 | Y | N | N |
| Jan 26 | AUDNZD | LONG | -0.81% | 2 | Y | Y | N |
| Jan 26 | AUDUSD | LONG | +0.70% | 1 | Y | N | N |
| Jan 26 | BTCUSD | SHORT | +3.81% | 1 | N | N | Y |
| Jan 26 | CADCHF | LONG | +0.27% | 2 | Y | Y | N |
| Jan 26 | CADJPY | LONG | +0.60% | 1 | Y | N | N |
| Jan 26 | CHFJPY | SHORT | -0.28% | 2 | Y | Y | N |
| Jan 26 | EURCAD | LONG | -1.38% | 1 | N | N | Y |
| Jan 26 | EURCHF | LONG | -1.06% | 2 | Y | Y | N |
| Jan 26 | EURGBP | SHORT | +0.53% | 1 | N | N | Y |
| Jan 26 | EURJPY | LONG | -0.18% | 1 | Y | N | N |
| Jan 26 | EURUSD | LONG | -0.14% | 1 | Y | N | N |
| Jan 26 | GBPAUD | SHORT | +0.68% | 1 | Y | N | N |
| Jan 26 | GBPCAD | LONG | -0.82% | 1 | N | N | Y |
| Jan 26 | GBPCHF | LONG | -0.32% | 2 | Y | Y | N |
| Jan 26 | GBPUSD | LONG | +0.22% | 1 | Y | N | N |
| Jan 26 | NDXUSD | LONG | +0.51% | 1 | Y | N | N |
| Jan 26 | SPXUSD | LONG | +0.91% | 1 | Y | N | N |
| Jan 26 | USDCAD | SHORT | +1.22% | 1 | Y | N | N |
| Jan 26 | USDCHF | LONG | -0.35% | 2 | Y | Y | N |
| Jan 26 | USDJPY | SHORT | +0.06% | 1 | Y | N | N |
| Jan 26 | WTIUSD | LONG | +2.84% | 2 | Y | Y | N |
| Jan 26 | XAGUSD | LONG | -2.51% | 1 | Y | N | N |
| Jan 26 | XAUUSD | LONG | -0.93% | 1 | Y | N | N |
| Feb 02 | AUDCHF | LONG | +1.17% | 2 | Y | Y | N |
| Feb 02 | AUDJPY | LONG | +1.88% | 2 | Y | Y | N |
| Feb 02 | AUDNZD | LONG | +1.49% | 2 | Y | Y | N |
| Feb 02 | AUDUSD | LONG | +0.78% | 2 | Y | Y | N |
| Feb 02 | BTCUSD | SHORT | +2.13% | 1 | N | N | Y |
| Feb 02 | CADJPY | LONG | +1.12% | 1 | Y | N | N |
| Feb 02 | EURAUD | SHORT | +1.32% | 2 | Y | Y | N |
| Feb 02 | EURGBP | SHORT | -0.69% | 1 | N | N | Y |
| Feb 02 | EURJPY | LONG | +1.42% | 1 | Y | N | N |
| Feb 02 | GBPAUD | SHORT | +1.98% | 2 | Y | Y | N |
| Feb 02 | GBPCAD | LONG | -0.31% | 1 | N | N | Y |
| Feb 02 | GBPJPY | LONG | +0.99% | 1 | N | N | Y |
| Feb 02 | NDXUSD | LONG | -0.78% | 2 | Y | N | Y |
| Feb 02 | NIKKEIUSD | SHORT | -2.25% | 1 | N | N | Y |
| Feb 02 | NZDCHF | SHORT | -0.51% | 2 | N | Y | Y |
| Feb 02 | NZDJPY | SHORT | -1.28% | 3 | Y | Y | Y |
| Feb 02 | NZDUSD | SHORT | -0.05% | 3 | Y | Y | Y |
| Feb 02 | SPXUSD | LONG | +0.16% | 2 | Y | N | Y |
| Feb 02 | USDCAD | SHORT | -0.66% | 1 | Y | N | N |
| Feb 02 | USDCHF | LONG | +0.34% | 1 | Y | N | N |
| Feb 02 | USDJPY | SHORT | -1.38% | 2 | Y | N | Y |
| Feb 02 | WTIUSD | LONG | -0.07% | 2 | Y | Y | N |
| Feb 02 | XAGUSD | LONG | -0.27% | 2 | Y | N | Y |
| Feb 09 | AUDCAD | LONG | +0.37% | 3 | Y | Y | Y |
| Feb 09 | AUDJPY | LONG | -1.73% | 2 | Y | Y | N |
| Feb 09 | AUDNZD | LONG | +0.95% | 2 | Y | Y | N |
| Feb 09 | AUDUSD | LONG | +0.55% | 2 | Y | Y | N |
| Feb 09 | BTCUSD | SHORT | +0.25% | 1 | N | N | Y |
| Feb 09 | CADJPY | LONG | -3.24% | 2 | Y | Y | N |
| Feb 09 | CHFJPY | SHORT | +2.22% | 1 | Y | N | N |
| Feb 09 | ETHUSD | LONG | -0.53% | 1 | Y | N | N |
| Feb 09 | EURAUD | SHORT | +0.28% | 3 | Y | Y | Y |
| Feb 09 | EURCHF | LONG | -1.41% | 2 | Y | Y | N |
| Feb 09 | EURUSD | LONG | +0.55% | 2 | Y | Y | N |
| Feb 09 | GBPAUD | SHORT | +0.39% | 2 | Y | Y | N |
| Feb 09 | GBPCAD | SHORT | -0.01% | 2 | Y | Y | N |
| Feb 09 | GBPCHF | LONG | -0.94% | 2 | Y | N | Y |
| Feb 09 | GBPJPY | SHORT | +2.99% | 1 | Y | N | N |
| Feb 09 | NZDUSD | SHORT | -0.35% | 1 | Y | N | N |
| Feb 09 | SPXUSD | LONG | -0.80% | 1 | Y | N | N |
| Feb 09 | USDCAD | SHORT | +0.57% | 2 | Y | Y | N |
| Feb 09 | USDCHF | LONG | -0.95% | 2 | Y | N | Y |
| Feb 09 | USDJPY | SHORT | +3.28% | 1 | Y | N | N |
| Feb 09 | WTIUSD | LONG | -0.01% | 2 | Y | Y | N |
| Feb 09 | XAUUSD | LONG | +0.21% | 2 | Y | N | Y |
| Feb 16 | AUDCHF | LONG | +1.16% | 2 | Y | Y | N |
| Feb 16 | AUDJPY | LONG | +1.44% | 3 | Y | Y | Y |
| Feb 16 | AUDNZD | LONG | +2.29% | 2 | Y | Y | N |
| Feb 16 | AUDUSD | LONG | +0.25% | 2 | Y | Y | N |
| Feb 16 | BTCUSD | SHORT | +0.29% | 1 | N | N | Y |
| Feb 16 | CADJPY | LONG | +1.17% | 3 | Y | Y | Y |
| Feb 16 | CHFJPY | LONG | +0.67% | 1 | N | N | Y |
| Feb 16 | ETHUSD | LONG | -0.06% | 1 | Y | N | N |
| Feb 16 | GBPAUD | SHORT | +1.87% | 2 | Y | Y | N |
| Feb 16 | GBPCAD | SHORT | +1.43% | 2 | Y | Y | N |
| Feb 16 | GBPJPY | LONG | +0.30% | 1 | N | N | Y |
| Feb 16 | GBPUSD | LONG | -1.96% | 1 | N | N | Y |
| Feb 16 | NDXUSD | SHORT | -0.67% | 1 | N | N | Y |
| Feb 16 | NIKKEIUSD | SHORT | +0.37% | 1 | Y | N | N |
| Feb 16 | NZDCHF | LONG | +0.06% | 1 | Y | N | N |
| Feb 16 | NZDJPY | LONG | +0.65% | 1 | N | N | Y |
| Feb 16 | NZDUSD | SHORT | +0.99% | 1 | Y | N | N |
| Feb 16 | SPXUSD | LONG | +0.86% | 2 | Y | N | Y |
| Feb 16 | USDCHF | LONG | +1.28% | 1 | Y | N | N |
| Feb 16 | USDJPY | LONG | +1.74% | 1 | N | N | Y |
| Feb 16 | WTIUSD | LONG | +2.19% | 2 | Y | Y | N |
| Feb 16 | XAGUSD | LONG | +1.80% | 1 | Y | N | N |
| Feb 23 | AUDCHF | LONG | -0.22% | 2 | Y | Y | N |
| Feb 23 | AUDJPY | LONG | +1.22% | 2 | Y | Y | N |
| Feb 23 | AUDNZD | LONG | +0.39% | 2 | Y | Y | N |
| Feb 23 | AUDUSD | LONG | +0.63% | 2 | Y | Y | N |
| Feb 23 | CADCHF | LONG | -0.86% | 2 | Y | Y | N |
| Feb 23 | CHFJPY | SHORT | -1.89% | 1 | Y | N | N |
| Feb 23 | ETHUSD | LONG | -0.21% | 2 | Y | N | Y |
| Feb 23 | EURUSD | LONG | +0.38% | 2 | Y | Y | N |
| Feb 23 | GBPAUD | SHORT | +0.83% | 2 | Y | Y | N |
| Feb 23 | GBPCAD | SHORT | +0.64% | 2 | Y | Y | N |
| Feb 23 | GBPJPY | SHORT | -0.79% | 1 | Y | N | N |
| Feb 23 | GBPNZD | LONG | -0.62% | 1 | N | N | Y |
| Feb 23 | GBPUSD | SHORT | +0.06% | 1 | Y | N | N |
| Feb 23 | NDXUSD | LONG | -0.18% | 2 | Y | N | Y |
| Feb 23 | NIKKEIUSD | SHORT | -1.78% | 1 | Y | N | N |
| Feb 23 | NZDCAD | SHORT | -0.14% | 2 | Y | Y | N |
| Feb 23 | NZDCHF | LONG | -0.53% | 1 | Y | N | N |
| Feb 23 | NZDJPY | SHORT | -1.13% | 2 | Y | N | Y |
| Feb 23 | NZDUSD | SHORT | -0.43% | 2 | Y | N | Y |
| Feb 23 | SPXUSD | LONG | -0.48% | 2 | Y | N | Y |
| Feb 23 | USDCAD | SHORT | +0.58% | 2 | Y | Y | N |
| Feb 23 | USDCHF | LONG | -1.06% | 2 | Y | N | Y |
| Feb 23 | USDJPY | SHORT | -0.83% | 1 | Y | N | N |
| Feb 23 | WTIUSD | LONG | +0.78% | 2 | Y | Y | N |
| Feb 23 | XAGUSD | LONG | +1.52% | 1 | Y | N | N |
| Mar 02 | AUDCAD | SHORT | +1.35% | 2 | N | Y | Y |
| Mar 02 | AUDCHF | LONG | +0.96% | 2 | Y | Y | N |
| Mar 02 | AUDJPY | LONG | +0.81% | 2 | Y | Y | N |
| Mar 02 | AUDNZD | LONG | +1.38% | 2 | Y | Y | N |
| Mar 02 | AUDUSD | LONG | -0.25% | 2 | Y | Y | N |
| Mar 02 | CADCHF | LONG | +3.20% | 2 | Y | Y | N |
| Mar 02 | CADJPY | LONG | +2.47% | 2 | Y | Y | N |
| Mar 02 | ETHUSD | LONG | -0.02% | 2 | Y | N | Y |
| Mar 02 | EURAUD | SHORT | +1.65% | 2 | Y | Y | N |
| Mar 02 | EURCAD | LONG | -5.74% | 2 | N | Y | Y |
| Mar 02 | EURCHF | LONG | -0.47% | 2 | Y | Y | N |
| Mar 02 | EURJPY | LONG | -0.39% | 2 | Y | Y | N |
| Mar 02 | GBPAUD | SHORT | -0.34% | 2 | Y | Y | N |
| Mar 02 | GBPCAD | SHORT | +1.13% | 2 | Y | Y | N |
| Mar 02 | GBPJPY | SHORT | -1.28% | 1 | Y | N | N |
| Mar 02 | GBPNZD | SHORT | -1.39% | 1 | Y | N | N |
| Mar 02 | GBPUSD | SHORT | -0.02% | 1 | Y | N | N |
| Mar 02 | NDXUSD | SHORT | +0.05% | 1 | Y | N | N |
| Mar 02 | NIKKEIUSD | SHORT | +2.32% | 2 | Y | N | Y |
| Mar 02 | NZDCAD | SHORT | +2.58% | 2 | Y | Y | N |
| Mar 02 | NZDCHF | LONG | +0.26% | 2 | Y | N | Y |
| Mar 02 | USDCHF | LONG | +1.53% | 2 | Y | N | Y |
| Mar 02 | USDJPY | SHORT | -1.37% | 1 | Y | N | N |
| Mar 02 | WTIUSD | LONG | +6.30% | 2 | Y | Y | N |
| Mar 02 | XAGUSD | LONG | -1.77% | 1 | Y | N | N |
| Mar 02 | XAUUSD | LONG | -1.62% | 1 | Y | N | N |
| Mar 08 | AUDCAD | LONG | +0.79% | 2 | N | Y | Y |
| Mar 08 | AUDCHF | LONG | +1.22% | 2 | Y | Y | N |
| Mar 08 | AUDJPY | LONG | +0.76% | 2 | Y | Y | N |
| Mar 08 | AUDNZD | LONG | +2.81% | 2 | Y | Y | N |
| Mar 08 | AUDUSD | LONG | -0.06% | 2 | Y | Y | N |
| Mar 08 | BTCUSD | SHORT | -1.92% | 1 | N | N | Y |
| Mar 08 | CADCHF | LONG | +0.96% | 2 | Y | Y | N |
| Mar 08 | CADJPY | LONG | +0.20% | 2 | Y | Y | N |
| Mar 08 | ETHUSD | SHORT | -1.81% | 1 | N | N | Y |
| Mar 08 | EURAUD | SHORT | +1.27% | 2 | Y | Y | N |
| Mar 08 | EURCAD | SHORT | +0.49% | 2 | Y | Y | N |
| Mar 08 | EURGBP | LONG | -0.65% | 2 | Y | Y | N |
| Mar 08 | EURJPY | LONG | -0.18% | 2 | Y | N | Y |
| Mar 08 | EURNZD | LONG | +0.70% | 2 | Y | N | Y |
| Mar 08 | EURUSD | LONG | -1.59% | 2 | Y | N | Y |
| Mar 08 | GBPAUD | SHORT | +0.89% | 2 | Y | Y | N |
| Mar 08 | GBPCAD | SHORT | -0.00% | 2 | Y | Y | N |
| Mar 08 | GBPCHF | SHORT | -0.88% | 2 | Y | Y | N |
| Mar 08 | GBPJPY | SHORT | -0.20% | 3 | Y | Y | Y |
| Mar 08 | GBPNZD | SHORT | -0.97% | 2 | Y | Y | N |
| Mar 08 | GBPUSD | SHORT | +1.04% | 2 | Y | Y | N |
| Mar 08 | NDXUSD | SHORT | +0.01% | 2 | Y | N | Y |
| Mar 08 | NIKKEIUSD | LONG | +0.10% | 3 | Y | Y | Y |
| Mar 08 | NZDCAD | SHORT | +0.82% | 2 | Y | Y | N |
| Mar 08 | USDCAD | SHORT | -1.64% | 2 | Y | Y | N |
| Mar 08 | USDCHF | LONG | +1.81% | 2 | Y | Y | N |
| Mar 08 | WTIUSD | LONG | -0.24% | 3 | Y | Y | Y |
| Mar 15 | AUDCAD | SHORT | -0.33% | 2 | N | Y | Y |
| Mar 15 | AUDNZD | LONG | -0.44% | 2 | Y | Y | N |
| Mar 15 | BTCUSD | SHORT | +1.82% | 1 | N | N | Y |
| Mar 15 | CADCHF | LONG | -0.42% | 2 | Y | Y | N |
| Mar 15 | CADJPY | LONG | -0.28% | 2 | Y | Y | N |
| Mar 15 | CHFJPY | SHORT | -0.04% | 3 | Y | Y | Y |
| Mar 15 | EURAUD | SHORT | -0.95% | 2 | Y | Y | N |
| Mar 15 | EURCAD | SHORT | -1.83% | 2 | Y | Y | N |
| Mar 15 | EURCHF | LONG | +2.03% | 3 | Y | Y | Y |
| Mar 15 | EURNZD | LONG | +0.87% | 2 | Y | N | Y |
| Mar 15 | GBPCAD | SHORT | -1.16% | 2 | Y | Y | N |
| Mar 15 | GBPCHF | LONG | +0.94% | 2 | N | Y | Y |
| Mar 15 | GBPJPY | SHORT | -0.81% | 3 | Y | Y | Y |
| Mar 15 | GBPNZD | LONG | +0.06% | 2 | N | Y | Y |
| Mar 15 | GBPUSD | SHORT | -0.89% | 2 | Y | Y | N |
| Mar 15 | NDXUSD | SHORT | +0.69% | 1 | N | N | Y |
| Mar 15 | NIKKEIUSD | SHORT | +1.12% | 2 | Y | N | Y |
| Mar 15 | NZDCAD | SHORT | -0.67% | 3 | Y | Y | Y |
| Mar 15 | NZDJPY | SHORT | -0.47% | 2 | Y | N | Y |
| Mar 15 | SPXUSD | LONG | -0.76% | 1 | Y | N | N |
| Mar 15 | USDCHF | LONG | -0.32% | 2 | Y | Y | N |
| Mar 15 | WTIUSD | LONG | -0.12% | 2 | Y | Y | N |
| Mar 22 | AUDCAD | LONG | -0.44% | 2 | Y | Y | N |
| Mar 22 | AUDJPY | LONG | -1.08% | 2 | Y | Y | N |
| Mar 22 | AUDUSD | LONG | -1.30% | 2 | Y | Y | N |
| Mar 22 | CADCHF | LONG | +0.21% | 1 | Y | N | N |
| Mar 22 | ETHUSD | LONG | -0.61% | 1 | Y | N | N |
| Mar 22 | EURCAD | SHORT | -1.40% | 1 | Y | N | N |
| Mar 22 | EURCHF | LONG | +2.36% | 1 | Y | N | N |
| Mar 22 | EURGBP | LONG | +0.41% | 2 | Y | Y | N |
| Mar 22 | EURJPY | LONG | +0.66% | 1 | Y | N | N |
| Mar 22 | GBPAUD | SHORT | -1.71% | 2 | Y | Y | N |
| Mar 22 | GBPCAD | SHORT | -1.11% | 2 | Y | Y | N |
| Mar 22 | GBPCHF | SHORT | -1.26% | 2 | Y | Y | N |
| Mar 22 | GBPJPY | SHORT | -0.38% | 2 | Y | Y | N |
| Mar 22 | GBPNZD | SHORT | -1.32% | 2 | Y | Y | N |
| Mar 22 | GBPUSD | SHORT | +0.41% | 2 | Y | Y | N |
| Mar 22 | NIKKEIUSD | LONG | +0.30% | 1 | Y | N | N |
| Mar 22 | NZDCAD | SHORT | -0.02% | 1 | Y | N | N |
| Mar 22 | NZDJPY | LONG | -0.70% | 1 | Y | N | N |
| Mar 22 | NZDUSD | SHORT | +0.92% | 1 | Y | N | N |
| Mar 22 | SPXUSD | LONG | -0.81% | 1 | Y | N | N |
| Mar 22 | USDCHF | LONG | +1.60% | 1 | Y | N | N |
| Mar 22 | USDJPY | LONG | +0.78% | 1 | Y | N | N |
| Mar 22 | WTIUSD | LONG | +0.08% | 2 | Y | Y | N |
| Mar 22 | XAGUSD | LONG | +0.36% | 1 | Y | N | N |
| Mar 22 | XAUUSD | LONG | +0.08% | 1 | Y | N | N |

## Skipped Trades: Skip fragility 3

| Week | Pair | Direction | Return% | Fragility | Opposed | High Ext | Building Against |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| Jan 19 | NZDUSD | SHORT | -5.98% | 3 | Y | Y | Y |
| Jan 19 | USDCHF | LONG | -4.54% | 3 | Y | Y | Y |
| Feb 02 | NZDJPY | SHORT | -1.28% | 3 | Y | Y | Y |
| Feb 02 | NZDUSD | SHORT | -0.05% | 3 | Y | Y | Y |
| Feb 09 | AUDCAD | LONG | +0.37% | 3 | Y | Y | Y |
| Feb 09 | EURAUD | SHORT | +0.28% | 3 | Y | Y | Y |
| Feb 16 | AUDJPY | LONG | +1.44% | 3 | Y | Y | Y |
| Feb 16 | CADJPY | LONG | +1.17% | 3 | Y | Y | Y |
| Mar 08 | GBPJPY | SHORT | -0.20% | 3 | Y | Y | Y |
| Mar 08 | NIKKEIUSD | LONG | +0.10% | 3 | Y | Y | Y |
| Mar 08 | WTIUSD | LONG | -0.24% | 3 | Y | Y | Y |
| Mar 15 | CHFJPY | SHORT | -0.04% | 3 | Y | Y | Y |
| Mar 15 | EURCHF | LONG | +2.03% | 3 | Y | Y | Y |
| Mar 15 | GBPJPY | SHORT | -0.81% | 3 | Y | Y | Y |
| Mar 15 | NZDCAD | SHORT | -0.67% | 3 | Y | Y | Y |

## Skipped Trades: Baseline strength_tiebreak

| Week | Pair | Direction | Return% | Fragility | Opposed | High Ext | Building Against |
| --- | --- | --- | ---: | ---: | --- | --- | --- |

## Per-Week Profile

| Week | Baseline Trades | Baseline Return | Skip opposed OR building_against Trades | Skip opposed OR building_against Return | Skip fragility 3 Trades | Skip fragility 3 Return | Baseline strength_tiebreak Trades | Baseline strength_tiebreak Return |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mar 22 | 36 | +5.27% | 11 | +9.26% | 36 | +5.27% | 36 | +5.27% |
| Mar 15 | 36 | +0.65% | 14 | +2.59% | 32 | +0.13% | 36 | +0.65% |
| Mar 08 | 36 | +6.09% | 9 | +2.38% | 33 | +6.44% | 36 | +6.09% |
| Mar 02 | 36 | +14.64% | 10 | +3.28% | 36 | +14.64% | 36 | +14.64% |
| Feb 23 | 36 | -4.01% | 11 | +0.12% | 36 | -4.01% | 36 | -4.01% |
| Feb 16 | 36 | +18.03% | 14 | -0.11% | 34 | +15.42% | 36 | +18.03% |
| Feb 09 | 36 | +6.92% | 14 | +4.27% | 34 | +6.27% | 36 | +6.92% |
| Feb 02 | 36 | +13.76% | 13 | +7.24% | 34 | +15.10% | 36 | +13.76% |
| Jan 26 | 36 | +11.40% | 10 | +7.15% | 36 | +11.40% | 36 | +11.40% |
| Jan 19 | 36 | +19.21% | 6 | +13.14% | 34 | +29.73% | 36 | +19.21% |
