# Weekly Dip Threshold Matrix Study

Generated: 2026-03-23T14:25:45.104Z

Methodology:
- Observation basis: unique_pair_week_direction_occurrences_across_all_26_canonical_systems
- Unique observations: 512
- Reference threshold: 1.00%
- Mode: fallback only
- Path assumption: canonical_daily_high_low_proxy_for_non_intraday_path; useful for first-pass threshold mapping, not final intraday-exact execution research
- Recommendation rule: highest avg fallback return among thresholds with fill rate >= 15% and post-fill <= -1% rate <= 15%; otherwise highest avg fallback return overall

Asset-Class Recommendations:

| Asset Class | Sample | Recommended | Best Avg Return | Cleanest Post-Fill | Confidence |
|---|---:|---:|---:|---:|---|
| Fx | 391 | 0.75% | 0.75% | 1.00% | high |
| Indices | 49 | 2.00% | 2.00% | 1.50% | high |
| Crypto | 18 | 3.00% | 3.00% | 3.00% | medium |
| Commodities | 54 | 2.00% | 2.00% | 1.00% | high |

Symbol Recommendations:

| Symbol | Asset | Sample | Recommended | Source | vs Asset Class | Confidence |
|---|---|---:|---:|---|---:|---|
| EURUSD | fx | 17 | 1.50% | symbol | +0.75% | medium |
| GBPUSD | fx | 8 | 0.75% | asset_class_fallback | +0.00% | low |
| AUDUSD | fx | 16 | 1.25% | symbol | +0.50% | medium |
| NZDUSD | fx | 8 | 0.75% | asset_class_fallback | +0.00% | low |
| USDJPY | fx | 14 | 1.00% | symbol | +0.25% | medium |
| USDCHF | fx | 13 | 1.00% | symbol | +0.25% | medium |
| USDCAD | fx | 15 | 0.50% | symbol | -0.25% | medium |
| EURGBP | fx | 18 | 0.50% | symbol | -0.25% | medium |
| EURJPY | fx | 16 | 0.75% | symbol | +0.00% | medium |
| EURCHF | fx | 18 | 0.50% | symbol | -0.25% | medium |
| EURAUD | fx | 9 | 0.75% | asset_class_fallback | +0.00% | low |
| EURNZD | fx | 18 | 1.00% | symbol | +0.25% | medium |
| EURCAD | fx | 8 | 0.75% | asset_class_fallback | +0.00% | low |
| GBPJPY | fx | 15 | 1.00% | symbol | +0.25% | medium |
| GBPCHF | fx | 9 | 0.75% | asset_class_fallback | +0.00% | low |
| GBPAUD | fx | 18 | 1.00% | symbol | +0.25% | medium |
| GBPNZD | fx | 8 | 0.75% | asset_class_fallback | +0.00% | low |
| GBPCAD | fx | 14 | 0.50% | symbol | -0.25% | medium |
| AUDJPY | fx | 16 | 1.25% | symbol | +0.50% | medium |
| AUDCHF | fx | 18 | 0.75% | symbol | +0.00% | medium |
| AUDCAD | fx | 10 | 1.00% | symbol | +0.25% | medium |
| AUDNZD | fx | 18 | 0.50% | symbol | -0.25% | medium |
| NZDJPY | fx | 17 | 0.75% | symbol | +0.00% | medium |
| NZDCHF | fx | 7 | 0.75% | asset_class_fallback | +0.00% | low |
| NZDCAD | fx | 15 | 1.25% | symbol | +0.50% | medium |
| CADJPY | fx | 15 | 1.00% | symbol | +0.25% | medium |
| CADCHF | fx | 15 | 0.50% | symbol | -0.25% | medium |
| CHFJPY | fx | 18 | 1.50% | symbol | +0.75% | medium |
| SPXUSD | indices | 13 | 2.00% | symbol | +0.00% | medium |
| NDXUSD | indices | 18 | 1.25% | symbol | -0.75% | medium |
| NIKKEIUSD | indices | 18 | 2.00% | symbol | +0.00% | medium |
| BTCUSD | crypto | 9 | 3.00% | asset_class_fallback | +0.00% | low |
| ETHUSD | crypto | 9 | 3.00% | asset_class_fallback | +0.00% | low |
| XAUUSD | commodities | 18 | 2.00% | symbol | +0.00% | medium |
| XAGUSD | commodities | 18 | 2.00% | symbol | +0.00% | medium |
| WTIUSD | commodities | 18 | 2.00% | symbol | +0.00% | medium |

Reference Comparison by Asset Class:

| Asset Class | Threshold | Fill Rate | Avg Fallback Return | Delta vs Open | Delta vs 1.00% | Post-Fill <= -1% |
|---|---:|---:|---:|---:|---:|---:|
| Fx | 0.50% | 58.06% | 0.36% | +0.29% | -0.02% | 25.99% |
| Fx | 0.75% | 42.71% | 0.39% | +0.32% | +0.01% | 21.56% |
| Fx | 1.00% | 31.20% | 0.38% | +0.31% | +0.00% | 21.31% |
| Fx | 1.25% | 20.20% | 0.32% | +0.25% | -0.06% | 22.78% |
| Fx | 1.50% | 14.83% | 0.29% | +0.22% | -0.09% | 24.14% |
| Indices | 0.75% | 89.80% | 0.60% | +0.67% | -0.21% | 56.82% |
| Indices | 1.00% | 87.76% | 0.80% | +0.88% | +0.00% | 53.49% |
| Indices | 1.25% | 75.51% | 0.87% | +0.95% | +0.07% | 48.65% |
| Indices | 1.50% | 63.27% | 0.87% | +0.95% | +0.07% | 48.39% |
| Indices | 2.00% | 48.98% | 0.90% | +0.98% | +0.10% | 50.00% |
| Crypto | 1.00% | 88.89% | 5.57% | +0.92% | +0.00% | 87.50% |
| Crypto | 1.50% | 88.89% | 6.03% | +1.38% | +0.46% | 87.50% |
| Crypto | 2.00% | 77.78% | 6.26% | +1.62% | +0.70% | 92.86% |
| Crypto | 2.50% | 77.78% | 6.67% | +2.02% | +1.10% | 78.57% |
| Crypto | 3.00% | 72.22% | 6.89% | +2.25% | +1.33% | 76.92% |
| Commodities | 0.75% | 90.74% | 1.07% | +0.68% | -0.19% | 85.71% |
| Commodities | 1.00% | 87.04% | 1.26% | +0.87% | +0.00% | 85.11% |
| Commodities | 1.25% | 83.33% | 1.43% | +1.04% | +0.17% | 86.67% |
| Commodities | 1.50% | 79.63% | 1.58% | +1.19% | +0.32% | 90.70% |
| Commodities | 2.00% | 74.07% | 1.86% | +1.47% | +0.60% | 92.50% |

JSON: reports\weekly-dip-threshold-matrix-study.json
