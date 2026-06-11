# Weekly ADR Threshold Matrix Study

Generated: 2026-03-23T14:46:57.143Z

Methodology:
- Observation basis: unique_pair_week_direction_occurrences_across_all_26_canonical_systems
- Unique observations: 512
- Eligible observations with ADR history: 455
- ADR lookback: 10 days (min 5)
- Reference multiplier: 1.00 ADR
- Mode: fallback only
- Path assumption: canonical_daily_high_low_proxy_for_weekly_path; ADR is computed from prior daily ranges only, so this is a first-pass weekly execution study, not final intraday trigger research
- Recommendation rule: highest avg fallback return among multipliers with fill rate >= 15% and post-fill <= -1% rate <= 15%; otherwise highest avg fallback return overall

Asset-Class Recommendations:

| Asset Class | Sample | Recommended | Best Avg Return | Cleanest Post-Fill | Avg ADR | Confidence |
|---|---:|---:|---:|---:|---:|---|
| Fx | 348 | 1.25 ADR | 1.00 ADR | 1.25 ADR | 0.77% | high |
| Indices | 43 | 0.75 ADR | 0.75 ADR | 1.25 ADR | 2.12% | high |
| Crypto | 16 | 1.50 ADR | 1.50 ADR | 1.50 ADR | 5.67% | medium |
| Commodities | 48 | 1.00 ADR | 1.00 ADR | 1.00 ADR | 5.78% | high |

Symbol Recommendations:

| Symbol | Asset | Sample | Recommended | Source | vs Asset Class | Confidence |
|---|---|---:|---:|---|---:|---|
| EURUSD | fx | 15 | 1.50 ADR | symbol | +0.25 ADR | medium |
| GBPUSD | fx | 7 | 1.25 ADR | asset_class_fallback | +0.00 ADR | low |
| AUDUSD | fx | 14 | 1.25 ADR | symbol | +0.00 ADR | medium |
| NZDUSD | fx | 7 | 1.25 ADR | asset_class_fallback | +0.00 ADR | low |
| USDJPY | fx | 13 | 1.25 ADR | symbol | +0.00 ADR | medium |
| USDCHF | fx | 12 | 0.75 ADR | symbol | -0.50 ADR | medium |
| USDCAD | fx | 14 | 1.25 ADR | symbol | +0.00 ADR | medium |
| EURGBP | fx | 16 | 1.00 ADR | symbol | -0.25 ADR | medium |
| EURJPY | fx | 14 | 1.00 ADR | symbol | -0.25 ADR | medium |
| EURCHF | fx | 16 | 1.25 ADR | symbol | +0.00 ADR | medium |
| EURAUD | fx | 8 | 1.25 ADR | asset_class_fallback | +0.00 ADR | low |
| EURNZD | fx | 16 | 0.75 ADR | symbol | -0.50 ADR | medium |
| EURCAD | fx | 6 | 1.25 ADR | asset_class_fallback | +0.00 ADR | low |
| GBPJPY | fx | 13 | 1.00 ADR | symbol | -0.25 ADR | medium |
| GBPCHF | fx | 8 | 1.25 ADR | asset_class_fallback | +0.00 ADR | low |
| GBPAUD | fx | 16 | 1.50 ADR | symbol | +0.25 ADR | medium |
| GBPNZD | fx | 7 | 1.25 ADR | asset_class_fallback | +0.00 ADR | low |
| GBPCAD | fx | 13 | 1.00 ADR | symbol | -0.25 ADR | medium |
| AUDJPY | fx | 14 | 1.50 ADR | symbol | +0.25 ADR | medium |
| AUDCHF | fx | 16 | 0.75 ADR | symbol | -0.50 ADR | medium |
| AUDCAD | fx | 8 | 1.25 ADR | asset_class_fallback | +0.00 ADR | low |
| AUDNZD | fx | 16 | 1.50 ADR | symbol | +0.25 ADR | medium |
| NZDJPY | fx | 15 | 0.75 ADR | symbol | -0.50 ADR | medium |
| NZDCHF | fx | 7 | 1.25 ADR | asset_class_fallback | +0.00 ADR | low |
| NZDCAD | fx | 14 | 1.50 ADR | symbol | +0.25 ADR | medium |
| CADJPY | fx | 13 | 1.00 ADR | symbol | -0.25 ADR | medium |
| CADCHF | fx | 14 | 0.75 ADR | symbol | -0.50 ADR | medium |
| CHFJPY | fx | 16 | 1.00 ADR | symbol | -0.25 ADR | medium |
| SPXUSD | indices | 11 | 1.50 ADR | symbol | +0.75 ADR | medium |
| NDXUSD | indices | 16 | 0.75 ADR | symbol | +0.00 ADR | medium |
| NIKKEIUSD | indices | 16 | 0.75 ADR | symbol | +0.00 ADR | medium |
| BTCUSD | crypto | 8 | 1.50 ADR | asset_class_fallback | +0.00 ADR | low |
| ETHUSD | crypto | 8 | 1.50 ADR | asset_class_fallback | +0.00 ADR | low |
| XAUUSD | commodities | 16 | 1.00 ADR | symbol | +0.00 ADR | medium |
| XAGUSD | commodities | 16 | 1.00 ADR | symbol | +0.00 ADR | medium |
| WTIUSD | commodities | 16 | 1.25 ADR | symbol | +0.25 ADR | medium |

Reference Comparison by Asset Class:

| Asset Class | Multiplier | Fill Rate | Avg Fallback Return | Delta vs Open | Delta vs 1.00 ADR | Post-Fill <= -1% |
|---|---:|---:|---:|---:|---:|---:|
| Fx | 0.50 ADR | 70.40% | 0.29% | +0.27% | -0.07% | 22.45% |
| Fx | 0.75 ADR | 56.90% | 0.35% | +0.32% | -0.02% | 19.19% |
| Fx | 1.00 ADR | 45.11% | 0.36% | +0.34% | +0.00% | 16.56% |
| Fx | 1.25 ADR | 36.21% | 0.36% | +0.34% | -0.00% | 13.49% |
| Fx | 1.50 ADR | 25.57% | 0.30% | +0.28% | -0.06% | 15.73% |
| Indices | 0.50 ADR | 88.37% | 0.85% | +0.94% | -0.00% | 55.26% |
| Indices | 0.75 ADR | 67.44% | 0.99% | +1.08% | +0.14% | 41.38% |
| Indices | 1.00 ADR | 48.84% | 0.86% | +0.95% | +0.00% | 47.62% |
| Indices | 1.25 ADR | 34.88% | 0.71% | +0.80% | -0.14% | 40.00% |
| Indices | 1.50 ADR | 20.93% | 0.46% | +0.55% | -0.40% | 55.56% |
| Crypto | 0.50 ADR | 75.00% | 5.55% | +1.86% | -1.14% | 100.00% |
| Crypto | 0.75 ADR | 75.00% | 6.48% | +2.79% | -0.21% | 83.33% |
| Crypto | 1.00 ADR | 62.50% | 6.68% | +3.00% | +0.00% | 80.00% |
| Crypto | 1.25 ADR | 50.00% | 6.86% | +3.18% | +0.18% | 87.50% |
| Crypto | 1.50 ADR | 50.00% | 7.50% | +3.81% | +0.81% | 75.00% |
| Commodities | 0.50 ADR | 68.75% | 2.27% | +1.88% | -0.90% | 93.94% |
| Commodities | 0.75 ADR | 60.42% | 2.62% | +2.22% | -0.55% | 89.66% |
| Commodities | 1.00 ADR | 56.25% | 3.17% | +2.77% | +0.00% | 70.37% |
| Commodities | 1.25 ADR | 41.67% | 2.78% | +2.38% | -0.39% | 85.00% |
| Commodities | 1.50 ADR | 33.33% | 2.79% | +2.40% | -0.38% | 93.75% |

JSON: reports\weekly-adr-threshold-matrix-study.json
