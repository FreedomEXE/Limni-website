# Bitget Bot v4 Backtest Results

Generated (UTC): 2026-02-27T21:53:36.709Z
Alt Symbol Source: docs/bots/alt-pair-rankings.json (recommendedSymbols + weeklyRecommendations)
Alt Symbols Used: SOL, XRP, SUI, LINK, DOGE, ADA, BNB, PEPE, UNI, AVAX, PENGU, ZEC, LTC, HYPE, NEAR, PUMP, HBAR, ENA, WLD, FARTCOIN, AAVE, ONDO, SHIB, SEI, TAO, ASTER, DOT, BCH, VIRTUAL, APT

### Alt Universe By Week

| Week Open UTC | Source | Symbols |
| --- | --- | --- |
| 2026-01-19T00:00:00.000Z | weekly_recommendation | SOL, XRP, DOGE, ADA, LINK, SUI, PEPE, PENGU, HBAR, AVAX, ENA, WLD, FARTCOIN, AAVE, UNI, ONDO, SHIB, SEI |
| 2026-01-26T00:00:00.000Z | weekly_recommendation | SOL, XRP, DOGE, SUI, PEPE, LINK, BNB, ADA, TAO, AVAX, AAVE, HYPE, LTC, HBAR, PUMP, UNI, WLD, PENGU, ASTER, SHIB, NEAR, DOT |
| 2026-02-02T00:00:00.000Z | weekly_recommendation | SOL, XRP, DOGE, SUI, ADA, LINK, BNB, TAO, UNI, PENGU, LTC, AVAX, AAVE, PEPE, NEAR, ONDO, ENA, BCH, DOT |
| 2026-02-09T00:00:00.000Z | weekly_recommendation | SOL, XRP, DOGE, SUI, BNB, LINK, PEPE, ADA, TAO, AVAX, LTC, PENGU, AAVE, VIRTUAL, UNI, DOT, APT, ONDO, NEAR, ASTER, HBAR, SHIB, ENA |
| 2026-02-16T00:00:00.000Z | weekly_recommendation | SOL, XRP, SUI, DOGE, LINK, PEPE, ADA, BNB, AVAX, PENGU, AAVE, TAO, ONDO, HYPE, LTC |

## 1. Week-by-Week Summary

| Week | BTC Bias | ETH Bias | Confidence | Entries | Win/Loss | Weekly Return % | Cumulative % |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 2026-01-18 19:00 ET | HIGH SHORT | HIGH SHORT | BTC 0/3/0; ETH 0/3/0 | 4 | 4/0 | 52.81 | 52.81 |
| 2026-01-25 19:00 ET | HIGH SHORT | HIGH SHORT | BTC 0/3/0; ETH 0/3/0 | 7 | 3/4 | -3.92 | 46.81 |
| 2026-02-01 19:00 ET | HIGH SHORT | HIGH SHORT | BTC 0/3/0; ETH 0/3/0 | 6 | 2/4 | 3.56 | 52.03 |
| 2026-02-08 19:00 ET | HIGH SHORT | HIGH SHORT | BTC 0/3/0; ETH 0/3/0 | 4 | 1/3 | 23.73 | 88.12 |
| 2026-02-15 19:00 ET | HIGH SHORT | HIGH SHORT | BTC 0/3/0; ETH 0/3/0 | 9 | 5/4 | 50.04 | 182.25 |

## 2. Trade Log

| # | Strategy | Symbol | Dir | Day | Window | Gate | Entry Mode | Risk Model | Entry | Stop | Exit | Exit Reason | PnL% | R:R | Init Lev | Max Lev | BE | Milestones | Freed Margin |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- | ---: |
| 1 | L) Weekly Bias Hold (Scaling, No Sweep) | ETH | SHORT | 2026-01-19 | WEEKLY_BIAS_HOLD | none | independent | scaling | 3282.54 | 3610.79 | 3223.64 | TRAILING_STOP | 1.79 | 0.18 | 5x | 50x | yes | [1,2,3] | 224.64 |
| 2 | L) Weekly Bias Hold (Scaling, No Sweep) | BTC | SHORT | 2026-01-19 | WEEKLY_BIAS_HOLD | none | independent | scaling | 93632.60 | 102995.86 | 90718.20 | TRAILING_STOP | 3.11 | 0.31 | 5x | 75x | yes | [1,2,3,4] | 448.00 |
| 3 | Daily NY Open Short | BTC | SHORT | 2026-01-19 | NY_OPEN_BASELINE | none | independent | v3_current | 93025.60 | 94420.98 | 93100.50 | EOD_CLOSE | -0.08 | -0.05 | 25x | 25x | no | [] | 0.00 |
| 4 | Daily NY Open Short | ETH | SHORT | 2026-01-19 | NY_OPEN_BASELINE | none | independent | v3_current | 3223.59 | 3271.94 | 3212.66 | EOD_CLOSE | 0.34 | 0.23 | 25x | 25x | no | [] | 0.00 |
| 5 | Daily NY Open Short | ETH | SHORT | 2026-01-20 | NY_OPEN_BASELINE | none | independent | v3_current | 3109.92 | 3156.57 | 3016.62 | TAKE_PROFIT | 3.00 | 2.00 | 25x | 25x | no | [] | 0.00 |
| 6 | Daily NY Open Short | BTC | SHORT | 2026-01-20 | NY_OPEN_BASELINE | none | independent | v3_current | 91240.10 | 92608.70 | 89711.10 | EOD_CLOSE | 1.68 | 1.12 | 25x | 25x | no | [] | 0.00 |
| 7 | Daily NY Open Short | ETH | SHORT | 2026-01-21 | NY_OPEN_BASELINE | none | independent | v3_current | 2930.14 | 2974.09 | 2974.09 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 8 | Daily NY Open Short | BTC | SHORT | 2026-01-21 | NY_OPEN_BASELINE | none | independent | v3_current | 88700.50 | 90031.01 | 90031.01 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 9 | A) Handshake + Current Risk | ETH | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | v3_current | 2990.00 | 3022.83 | 2921.42 | TRAILING_STOP | 2.29 | 2.09 | 25x | 25x | no | [] | 0.00 |
| 10 | A) Handshake + Current Risk | BTC | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | v3_current | 89972.10 | 90522.88 | 88949.10 | TRAILING_STOP | 1.14 | 1.86 | 25x | 25x | no | [] | 0.00 |
| 11 | B) Independent + Scaling Risk | BTC | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | scaling | 89972.10 | 98969.31 | 88513.07 | TRAILING_STOP | 1.62 | 0.16 | 5x | 50x | yes | [1,2,3] | 900.00 |
| 12 | C) Handshake + Scaling + Overnight Hold | ETH | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2990.00 | 3289.00 | 2894.63 | TRAILING_STOP | 3.19 | 0.32 | 5x | 75x | yes | [1,2,3,4] | 233.33 |
| 13 | C) Handshake + Scaling + Overnight Hold | BTC | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 89972.10 | 98969.31 | 88513.07 | TRAILING_STOP | 1.62 | 0.16 | 5x | 50x | yes | [1,2,3] | 450.00 |
| 14 | E) Handshake + Scaling + Overnight + Funding Filter | ETH | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2990.00 | 3289.00 | 2894.63 | TRAILING_STOP | 3.19 | 0.32 | 5x | 75x | yes | [1,2,3,4] | 233.33 |
| 15 | E) Handshake + Scaling + Overnight + Funding Filter | BTC | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 89972.10 | 98969.31 | 88513.07 | TRAILING_STOP | 1.62 | 0.16 | 5x | 50x | yes | [1,2,3] | 450.00 |
| 16 | F) Handshake + Scaling + Overnight + OI Delta Filter | ETH | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2990.00 | 3289.00 | 2894.63 | TRAILING_STOP | 3.19 | 0.32 | 5x | 75x | yes | [1,2,3,4] | 233.33 |
| 17 | F) Handshake + Scaling + Overnight + OI Delta Filter | BTC | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 89972.10 | 98969.31 | 88513.07 | TRAILING_STOP | 1.62 | 0.16 | 5x | 50x | yes | [1,2,3] | 450.00 |
| 18 | G) Handshake + Scaling + Overnight + Funding + OI | ETH | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2990.00 | 3289.00 | 2894.63 | TRAILING_STOP | 3.19 | 0.32 | 5x | 75x | yes | [1,2,3,4] | 233.33 |
| 19 | G) Handshake + Scaling + Overnight + Funding + OI | BTC | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 89972.10 | 98969.31 | 88513.07 | TRAILING_STOP | 1.62 | 0.16 | 5x | 50x | yes | [1,2,3] | 450.00 |
| 20 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | ETH | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2990.00 | 3289.00 | 2894.63 | TRAILING_STOP | 3.19 | 0.32 | 5x | 75x | yes | [1,2,3,4] | 233.33 |
| 21 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | LINK | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 12.41 | 13.65 | 12.00 | TRAILING_STOP | 3.27 | 0.33 | 5x | 75x | yes | [1,2,3,4] | 23.33 |
| 22 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | UNI | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 4.94 | 5.43 | 4.83 | TRAILING_STOP | 2.22 | 0.22 | 5x | 50x | yes | [1,2,3] | 20.25 |
| 23 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | BTC | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 89972.10 | 98969.31 | 88513.07 | TRAILING_STOP | 1.62 | 0.16 | 5x | 50x | yes | [1,2,3] | 450.00 |
| 24 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 2990.00 | 3022.83 | 2921.42 | TRAILING_STOP | 2.29 | 2.09 | 25x | 25x | no | [] | 0.00 |
| 25 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 89972.10 | 90522.88 | 88949.10 | TRAILING_STOP | 1.14 | 1.86 | 25x | 25x | no | [] | 0.00 |
| 26 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | PEPE | SHORT | 2026-01-21 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 0.00 | 0.00 | 0.00 | TRAILING_STOP | 2.12 | 0.21 | 5x | 50x | yes | [1,2,3] | 18.23 |
| 27 | Daily NY Open Short | BTC | SHORT | 2026-01-22 | NY_OPEN_BASELINE | none | independent | v3_current | 89980.80 | 91330.51 | 89370.40 | EOD_CLOSE | 0.68 | 0.45 | 25x | 25x | no | [] | 0.00 |
| 28 | Daily NY Open Short | ETH | SHORT | 2026-01-22 | NY_OPEN_BASELINE | none | independent | v3_current | 2989.94 | 3034.79 | 2937.56 | EOD_CLOSE | 1.75 | 1.17 | 25x | 25x | no | [] | 0.00 |
| 29 | Daily NY Open Short | ETH | SHORT | 2026-01-23 | NY_OPEN_BASELINE | none | independent | v3_current | 2933.63 | 2977.63 | 2977.63 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 30 | Daily NY Open Short | BTC | SHORT | 2026-01-23 | NY_OPEN_BASELINE | none | independent | v3_current | 89219.10 | 90557.39 | 90557.39 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 31 | B) Independent + Scaling Risk | ETH | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | scaling | 2978.86 | 3276.75 | 2938.85 | EOD_CLOSE | 1.34 | 0.13 | 5x | 10x | no | [1] | 540.54 |
| 32 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 2978.86 | 2996.38 | 2938.85 | EOD_CLOSE | 1.34 | 2.28 | 25x | 25x | no | [] | 0.00 |
| 33 | A) Handshake + Current Risk | BTC | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | v3_current | 89936.90 | 90551.72 | 89460.60 | EOD_CLOSE | 0.53 | 0.77 | 25x | 25x | no | [] | 0.00 |
| 34 | A) Handshake + Current Risk | ETH | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | v3_current | 2962.71 | 2996.33 | 2938.85 | EOD_CLOSE | 0.81 | 0.71 | 25x | 25x | no | [] | 0.00 |
| 35 | C) Handshake + Scaling + Overnight Hold | ETH | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2962.71 | 3258.98 | 2872.07 | TRAILING_STOP | 3.06 | 0.31 | 5x | 75x | yes | [1,2,3,4] | 252.10 |
| 36 | C) Handshake + Scaling + Overnight Hold | BTC | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 89936.90 | 98930.59 | 86634.80 | WEEK_CLOSE | 3.67 | 0.37 | 5x | 75x | yes | [1,2,3,4] | 504.19 |
| 37 | E) Handshake + Scaling + Overnight + Funding Filter | ETH | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2962.71 | 3258.98 | 2872.07 | TRAILING_STOP | 3.06 | 0.31 | 5x | 75x | yes | [1,2,3,4] | 252.10 |
| 38 | E) Handshake + Scaling + Overnight + Funding Filter | BTC | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 89936.90 | 98930.59 | 86634.80 | WEEK_CLOSE | 3.67 | 0.37 | 5x | 75x | yes | [1,2,3,4] | 504.19 |
| 39 | F) Handshake + Scaling + Overnight + OI Delta Filter | ETH | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2962.71 | 3258.98 | 2872.07 | TRAILING_STOP | 3.06 | 0.31 | 5x | 75x | yes | [1,2,3,4] | 252.10 |
| 40 | F) Handshake + Scaling + Overnight + OI Delta Filter | BTC | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 89936.90 | 98930.59 | 86634.80 | WEEK_CLOSE | 3.67 | 0.37 | 5x | 75x | yes | [1,2,3,4] | 504.19 |
| 41 | G) Handshake + Scaling + Overnight + Funding + OI | ETH | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2962.71 | 3258.98 | 2872.07 | TRAILING_STOP | 3.06 | 0.31 | 5x | 75x | yes | [1,2,3,4] | 252.10 |
| 42 | G) Handshake + Scaling + Overnight + Funding + OI | BTC | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 89936.90 | 98930.59 | 86634.80 | WEEK_CLOSE | 3.67 | 0.37 | 5x | 75x | yes | [1,2,3,4] | 504.19 |
| 43 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | ETH | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2962.71 | 3258.98 | 2872.07 | TRAILING_STOP | 3.06 | 0.31 | 5x | 75x | yes | [1,2,3,4] | 254.13 |
| 44 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | BTC | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 89936.90 | 98930.59 | 86634.80 | WEEK_CLOSE | 3.67 | 0.37 | 5x | 75x | yes | [1,2,3,4] | 508.26 |
| 45 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 89936.90 | 90551.72 | 89460.60 | EOD_CLOSE | 0.53 | 0.77 | 25x | 25x | no | [] | 0.00 |
| 46 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | HBAR | SHORT | 2026-01-23 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 0.11 | 0.12 | 0.11 | TRAILING_STOP | 2.20 | 0.22 | 5x | 50x | yes | [1,2,3] | 24.51 |
| 47 | L) Weekly Bias Hold (Scaling, No Sweep) | ETH | SHORT | 2026-01-26 | WEEKLY_BIAS_HOLD | none | independent | scaling | 2816.41 | 3098.05 | 2816.41 | BREAKEVEN_STOP | 0.00 | 0.00 | 5x | 25x | yes | [1,2] | 219.07 |
| 48 | L) Weekly Bias Hold (Scaling, No Sweep) | BTC | SHORT | 2026-01-26 | WEEKLY_BIAS_HOLD | none | independent | scaling | 86634.80 | 95298.28 | 84571.12 | TRAILING_STOP | 2.38 | 0.24 | 5x | 50x | yes | [1,2,3] | 473.95 |
| 49 | Daily NY Open Short | ETH | SHORT | 2026-01-26 | NY_OPEN_BASELINE | none | independent | v3_current | 2901.11 | 2944.63 | 2944.63 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 50 | Daily NY Open Short | BTC | SHORT | 2026-01-26 | NY_OPEN_BASELINE | none | independent | v3_current | 87758.30 | 89074.67 | 87592.40 | EOD_CLOSE | 0.19 | 0.13 | 25x | 25x | no | [] | 0.00 |
| 51 | B) Independent + Scaling Risk | ETH | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | scaling | 2929.09 | 3222.00 | 2900.51 | EOD_CLOSE | 0.98 | 0.10 | 5x | 10x | no | [1] | 576.84 |
| 52 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | NEAR | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 1.48 | 1.62 | 1.48 | BREAKEVEN_STOP | 0.00 | 0.00 | 5x | 25x | yes | [1,2] | 88.83 |
| 53 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | SHIB | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 0.00 | 0.00 | 0.00 | TRAILING_STOP | 5.09 | 0.51 | 5x | 75x | yes | [1,2,3,4] | 115.15 |
| 54 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 2929.09 | 2954.28 | 2900.51 | EOD_CLOSE | 0.98 | 1.13 | 25x | 25x | no | [] | 0.00 |
| 55 | A) Handshake + Current Risk | BTC | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | v3_current | 88265.00 | 88659.32 | 87592.40 | EOD_CLOSE | 0.76 | 1.71 | 25x | 25x | no | [] | 0.00 |
| 56 | A) Handshake + Current Risk | ETH | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | v3_current | 2913.95 | 2954.28 | 2900.51 | EOD_CLOSE | 0.46 | 0.33 | 25x | 25x | no | [] | 0.00 |
| 57 | C) Handshake + Scaling + Overnight Hold | ETH | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2913.95 | 3205.34 | 2823.19 | TRAILING_STOP | 3.11 | 0.31 | 5x | 75x | yes | [1,2,3,4] | 284.88 |
| 58 | C) Handshake + Scaling + Overnight Hold | BTC | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 88265.00 | 97091.50 | 85084.12 | TRAILING_STOP | 3.60 | 0.36 | 5x | 75x | yes | [1,2,3,4] | 569.75 |
| 59 | E) Handshake + Scaling + Overnight + Funding Filter | ETH | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2913.95 | 3205.34 | 2823.19 | TRAILING_STOP | 3.11 | 0.31 | 5x | 75x | yes | [1,2,3,4] | 284.88 |
| 60 | E) Handshake + Scaling + Overnight + Funding Filter | BTC | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 88265.00 | 97091.50 | 85084.12 | TRAILING_STOP | 3.60 | 0.36 | 5x | 75x | yes | [1,2,3,4] | 569.75 |
| 61 | F) Handshake + Scaling + Overnight + OI Delta Filter | ETH | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2913.95 | 3205.34 | 2823.19 | TRAILING_STOP | 3.11 | 0.31 | 5x | 75x | yes | [1,2,3,4] | 284.88 |
| 62 | F) Handshake + Scaling + Overnight + OI Delta Filter | BTC | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 88265.00 | 97091.50 | 85084.12 | TRAILING_STOP | 3.60 | 0.36 | 5x | 75x | yes | [1,2,3,4] | 569.75 |
| 63 | G) Handshake + Scaling + Overnight + Funding + OI | ETH | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2913.95 | 3205.34 | 2823.19 | TRAILING_STOP | 3.11 | 0.31 | 5x | 75x | yes | [1,2,3,4] | 284.88 |
| 64 | G) Handshake + Scaling + Overnight + Funding + OI | BTC | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 88265.00 | 97091.50 | 85084.12 | TRAILING_STOP | 3.60 | 0.36 | 5x | 75x | yes | [1,2,3,4] | 569.75 |
| 65 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | DOGE | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 0.12 | 0.13 | 0.12 | TRAILING_STOP | 3.62 | 0.36 | 5x | 75x | yes | [1,2,3,4] | 23.32 |
| 66 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | ETH | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2913.95 | 3205.34 | 2823.19 | TRAILING_STOP | 3.11 | 0.31 | 5x | 75x | yes | [1,2,3,4] | 233.18 |
| 67 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | BTC | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 88265.00 | 97091.50 | 85084.12 | TRAILING_STOP | 3.60 | 0.36 | 5x | 75x | yes | [1,2,3,4] | 466.36 |
| 68 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-01-26 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 88265.00 | 88659.32 | 87592.40 | EOD_CLOSE | 0.76 | 1.71 | 25x | 25x | no | [] | 0.00 |
| 69 | Daily NY Open Short | ETH | SHORT | 2026-01-27 | NY_OPEN_BASELINE | none | independent | v3_current | 2916.88 | 2960.63 | 2960.63 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 70 | Daily NY Open Short | BTC | SHORT | 2026-01-27 | NY_OPEN_BASELINE | none | independent | v3_current | 87948.10 | 89267.32 | 89267.32 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 71 | B) Independent + Scaling Risk | ETH | SHORT | 2026-01-27 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | scaling | 2935.04 | 3228.54 | 3019.21 | EOD_CLOSE | -2.87 | -0.29 | 5x | 5x | no | [] | 0.00 |
| 72 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-01-27 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 2935.04 | 2976.96 | 2976.96 | STOP_LOSS | -1.43 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 73 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-01-27 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 88863.50 | 89243.66 | 89243.66 | STOP_LOSS | -0.43 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 74 | A) Handshake + Current Risk | ETH | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | v3_current | 3022.62 | 3034.53 | 3034.53 | STOP_LOSS | -0.39 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 75 | A) Handshake + Current Risk | BTC | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | v3_current | 89417.60 | 89804.51 | 89804.51 | STOP_LOSS | -0.43 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 76 | B) Independent + Scaling Risk | BTC | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | scaling | 89417.60 | 98359.36 | 89960.80 | EOD_CLOSE | -0.61 | -0.06 | 5x | 5x | no | [] | 0.00 |
| 77 | C) Handshake + Scaling + Overnight Hold | ETH | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 3022.62 | 3324.88 | 2868.41 | TRAILING_STOP | 5.10 | 0.51 | 5x | 75x | yes | [1,2,3,4] | 321.63 |
| 78 | C) Handshake + Scaling + Overnight Hold | BTC | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 89417.60 | 98359.36 | 85084.12 | TRAILING_STOP | 4.85 | 0.48 | 5x | 75x | yes | [1,2,3,4] | 643.27 |
| 79 | E) Handshake + Scaling + Overnight + Funding Filter | ETH | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 3022.62 | 3324.88 | 2868.41 | TRAILING_STOP | 5.10 | 0.51 | 5x | 75x | yes | [1,2,3,4] | 321.63 |
| 80 | E) Handshake + Scaling + Overnight + Funding Filter | BTC | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 89417.60 | 98359.36 | 85084.12 | TRAILING_STOP | 4.85 | 0.48 | 5x | 75x | yes | [1,2,3,4] | 643.27 |
| 81 | F) Handshake + Scaling + Overnight + OI Delta Filter | ETH | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 3022.62 | 3324.88 | 2868.41 | TRAILING_STOP | 5.10 | 0.51 | 5x | 75x | yes | [1,2,3,4] | 321.63 |
| 82 | F) Handshake + Scaling + Overnight + OI Delta Filter | BTC | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 89417.60 | 98359.36 | 85084.12 | TRAILING_STOP | 4.85 | 0.48 | 5x | 75x | yes | [1,2,3,4] | 643.27 |
| 83 | G) Handshake + Scaling + Overnight + Funding + OI | ETH | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 3022.62 | 3324.88 | 2868.41 | TRAILING_STOP | 5.10 | 0.51 | 5x | 75x | yes | [1,2,3,4] | 321.63 |
| 84 | G) Handshake + Scaling + Overnight + Funding + OI | BTC | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 89417.60 | 98359.36 | 85084.12 | TRAILING_STOP | 4.85 | 0.48 | 5x | 75x | yes | [1,2,3,4] | 643.27 |
| 85 | H) Handshake + Scaling + Overnight + Funding Reverse | ETH | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 3022.62 | 3324.88 | 2868.41 | TRAILING_STOP | 5.10 | 0.51 | 5x | 75x | yes | [1,2,3,4] | 233.33 |
| 86 | H) Handshake + Scaling + Overnight + Funding Reverse | BTC | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 89417.60 | 98359.36 | 85084.12 | TRAILING_STOP | 4.85 | 0.48 | 5x | 75x | yes | [1,2,3,4] | 466.67 |
| 87 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | HBAR | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | 3way_handshake | independent | scaling | 0.11 | 0.12 | 0.10 | TRAILING_STOP | 3.73 | 0.37 | 5x | 75x | yes | [1,2,3,4] | 29.37 |
| 88 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | ETH | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 3022.62 | 3324.88 | 2868.41 | TRAILING_STOP | 5.10 | 0.51 | 5x | 75x | yes | [1,2,3,4] | 326.34 |
| 89 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | XRP | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | 3way_handshake | independent | scaling | 1.93 | 2.12 | 1.82 | TRAILING_STOP | 5.68 | 0.57 | 5x | 75x | yes | [1,2,3,4] | 32.63 |
| 90 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | BTC | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 89417.60 | 98359.36 | 85084.12 | TRAILING_STOP | 4.85 | 0.48 | 5x | 75x | yes | [1,2,3,4] | 652.69 |
| 91 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | v3_current | 3022.62 | 3034.53 | 3034.53 | STOP_LOSS | -0.39 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 92 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | v3_current | 89417.60 | 89804.51 | 89804.51 | STOP_LOSS | -0.43 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 93 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | SOL | SHORT | 2026-01-28 | US_RANGE_ASIA_LONDON_ENTRY | 3way_handshake | independent | scaling | 127.44 | 140.19 | 122.60 | TRAILING_STOP | 3.80 | 0.38 | 5x | 75x | yes | [1,2,3,4] | 26.43 |
| 94 | Daily NY Open Short | BTC | SHORT | 2026-01-28 | NY_OPEN_BASELINE | none | independent | v3_current | 89960.80 | 91310.21 | 89101.20 | EOD_CLOSE | 0.96 | 0.64 | 25x | 25x | no | [] | 0.00 |
| 95 | Daily NY Open Short | ETH | SHORT | 2026-01-28 | NY_OPEN_BASELINE | none | independent | v3_current | 3029.78 | 3075.23 | 3010.46 | EOD_CLOSE | 0.64 | 0.43 | 25x | 25x | no | [] | 0.00 |
| 96 | B) Independent + Scaling Risk | BTC | SHORT | 2026-01-28 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | scaling | 90125.60 | 99138.16 | 89101.20 | EOD_CLOSE | 1.14 | 0.11 | 5x | 10x | no | [1] | 502.50 |
| 97 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-01-28 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 90125.60 | 90702.55 | 89101.20 | EOD_CLOSE | 1.14 | 1.78 | 25x | 25x | no | [] | 0.00 |
| 98 | Daily NY Open Short | ETH | SHORT | 2026-01-29 | NY_OPEN_BASELINE | none | independent | v3_current | 2935.36 | 2979.39 | 2847.30 | TAKE_PROFIT | 3.00 | 2.00 | 25x | 25x | no | [] | 0.00 |
| 99 | Daily NY Open Short | BTC | SHORT | 2026-01-29 | NY_OPEN_BASELINE | none | independent | v3_current | 88075.40 | 89396.53 | 85433.14 | TAKE_PROFIT | 3.00 | 2.00 | 25x | 25x | no | [] | 0.00 |
| 100 | Daily NY Open Short | ETH | SHORT | 2026-01-30 | NY_OPEN_BASELINE | none | independent | v3_current | 2739.15 | 2780.24 | 2656.98 | TAKE_PROFIT | 3.00 | 2.00 | 25x | 25x | no | [] | 0.00 |
| 101 | Daily NY Open Short | BTC | SHORT | 2026-01-30 | NY_OPEN_BASELINE | none | independent | v3_current | 82754.20 | 83995.51 | 83995.51 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 102 | L) Weekly Bias Hold (Scaling, No Sweep) | ETH | SHORT | 2026-02-02 | WEEKLY_BIAS_HOLD | none | independent | scaling | 2269.19 | 2496.11 | 2191.06 | TRAILING_STOP | 3.44 | 0.34 | 5x | 75x | yes | [1,2,3,4] | 270.19 |
| 103 | L) Weekly Bias Hold (Scaling, No Sweep) | BTC | SHORT | 2026-02-02 | WEEKLY_BIAS_HOLD | none | independent | scaling | 76926.50 | 84619.15 | 75668.25 | TRAILING_STOP | 1.64 | 0.16 | 5x | 50x | yes | [1,2,3] | 501.04 |
| 104 | Daily NY Open Short | ETH | SHORT | 2026-02-02 | NY_OPEN_BASELINE | none | independent | v3_current | 2310.22 | 2344.87 | 2344.87 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 105 | Daily NY Open Short | BTC | SHORT | 2026-02-02 | NY_OPEN_BASELINE | none | independent | v3_current | 77940.20 | 79109.30 | 79109.30 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 106 | B) Independent + Scaling Risk | ETH | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | scaling | 2320.89 | 2552.98 | 2320.56 | EOD_CLOSE | 0.01 | 0.00 | 5x | 10x | no | [1] | 531.05 |
| 107 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | DOGE | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 0.11 | 0.12 | 0.10 | TRAILING_STOP | 2.47 | 0.25 | 5x | 50x | yes | [1,2,3] | 151.06 |
| 108 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 2320.89 | 2337.96 | 2337.96 | STOP_LOSS | -0.74 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 109 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | SUI | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 1.14 | 1.25 | 1.09 | TRAILING_STOP | 3.68 | 0.37 | 5x | 75x | yes | [1,2,3,4] | 140.99 |
| 110 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | BCH | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 529.42 | 582.36 | 516.69 | TRAILING_STOP | 2.41 | 0.24 | 5x | 50x | yes | [1,2,3] | 122.36 |
| 111 | A) Handshake + Current Risk | ETH | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | v3_current | 2343.60 | 2364.98 | 2364.98 | STOP_LOSS | -0.91 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 112 | A) Handshake + Current Risk | BTC | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | v3_current | 78230.00 | 78959.26 | 78959.26 | STOP_LOSS | -0.93 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 113 | B) Independent + Scaling Risk | BTC | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | scaling | 78230.00 | 86053.00 | 77969.90 | EOD_CLOSE | 0.33 | 0.03 | 5x | 5x | no | [] | 0.00 |
| 114 | C) Handshake + Scaling + Overnight Hold | ETH | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2343.60 | 2577.96 | 2343.60 | BREAKEVEN_STOP | 0.00 | 0.00 | 5x | 25x | yes | [1,2] | 326.67 |
| 115 | C) Handshake + Scaling + Overnight Hold | BTC | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 78230.00 | 86053.00 | 73633.65 | TRAILING_STOP | 5.88 | 0.59 | 5x | 75x | yes | [1,2,3,4] | 762.23 |
| 116 | H) Handshake + Scaling + Overnight + Funding Reverse | ETH | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2343.60 | 2577.96 | 2343.60 | BREAKEVEN_STOP | 0.00 | 0.00 | 5x | 25x | yes | [1,2] | 236.99 |
| 117 | H) Handshake + Scaling + Overnight + Funding Reverse | BTC | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 78230.00 | 86053.00 | 73633.65 | TRAILING_STOP | 5.88 | 0.59 | 5x | 75x | yes | [1,2,3,4] | 552.97 |
| 118 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | ETH | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2343.60 | 2577.96 | 2343.60 | BREAKEVEN_STOP | 0.00 | 0.00 | 5x | 25x | yes | [1,2] | 244.72 |
| 119 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | BTC | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 78230.00 | 86053.00 | 73633.65 | TRAILING_STOP | 5.88 | 0.59 | 5x | 75x | yes | [1,2,3,4] | 571.01 |
| 120 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 78230.00 | 78959.26 | 78959.26 | STOP_LOSS | -0.93 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 121 | Daily NY Open Short | ETH | SHORT | 2026-02-03 | NY_OPEN_BASELINE | none | independent | v3_current | 2300.28 | 2334.78 | 2231.27 | TAKE_PROFIT | 3.00 | 2.00 | 25x | 25x | no | [] | 0.00 |
| 122 | Daily NY Open Short | BTC | SHORT | 2026-02-03 | NY_OPEN_BASELINE | none | independent | v3_current | 78285.60 | 79459.88 | 75937.03 | TAKE_PROFIT | 3.00 | 2.00 | 25x | 25x | no | [] | 0.00 |
| 123 | Daily NY Open Short | ETH | SHORT | 2026-02-04 | NY_OPEN_BASELINE | none | independent | v3_current | 2243.08 | 2276.73 | 2175.79 | TAKE_PROFIT | 3.00 | 2.00 | 25x | 25x | no | [] | 0.00 |
| 124 | Daily NY Open Short | BTC | SHORT | 2026-02-04 | NY_OPEN_BASELINE | none | independent | v3_current | 76145.70 | 77287.89 | 73861.33 | TAKE_PROFIT | 3.00 | 2.00 | 25x | 25x | no | [] | 0.00 |
| 125 | Daily NY Open Short | BTC | SHORT | 2026-02-05 | NY_OPEN_BASELINE | none | independent | v3_current | 69527.70 | 70570.62 | 70570.62 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 126 | Daily NY Open Short | ETH | SHORT | 2026-02-05 | NY_OPEN_BASELINE | none | independent | v3_current | 2062.97 | 2093.91 | 2093.91 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 127 | Daily NY Open Short | ETH | SHORT | 2026-02-06 | NY_OPEN_BASELINE | none | independent | v3_current | 1920.00 | 1948.80 | 1948.80 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 128 | Daily NY Open Short | BTC | SHORT | 2026-02-06 | NY_OPEN_BASELINE | none | independent | v3_current | 66513.60 | 67511.30 | 67511.30 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 129 | B) Independent + Scaling Risk | BTC | SHORT | 2026-02-06 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | scaling | 66594.00 | 73253.40 | 69933.00 | EOD_CLOSE | -5.01 | -0.50 | 5x | 5x | no | [] | 0.00 |
| 130 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-02-06 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 66594.00 | 66983.02 | 66983.02 | STOP_LOSS | -0.58 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 131 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-02-06 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 1962.04 | 1983.31 | 1983.31 | STOP_LOSS | -1.08 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 132 | B) Independent + Scaling Risk | BTC | SHORT | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | scaling | 71105.20 | 78215.72 | 68579.00 | TRAILING_STOP | 3.55 | 0.36 | 5x | 75x | yes | [1,2,3,4] | 749.48 |
| 133 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | v3_current | 71105.20 | 71757.48 | 68634.17 | TRAILING_STOP | 3.48 | 3.79 | 25x | 25x | no | [] | 0.00 |
| 134 | A) Handshake + Current Risk | BTC | SHORT | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | v3_current | 70832.40 | 71757.48 | 68634.17 | TRAILING_STOP | 3.10 | 2.38 | 25x | 25x | no | [] | 0.00 |
| 135 | A) Handshake + Current Risk | ETH | SHORT | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | v3_current | 2088.12 | 2106.08 | 2033.26 | TRAILING_STOP | 2.63 | 3.05 | 25x | 25x | no | [] | 0.00 |
| 136 | C) Handshake + Scaling + Overnight Hold | BTC | SHORT | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 70832.40 | 77915.64 | 68579.00 | TRAILING_STOP | 3.18 | 0.32 | 5x | 75x | yes | [1,2,3,4] | 874.19 |
| 137 | C) Handshake + Scaling + Overnight Hold | ETH | SHORT | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 2088.12 | 2296.93 | 2013.32 | TRAILING_STOP | 3.58 | 0.36 | 5x | 75x | yes | [1,2,3,4] | 437.09 |
| 138 | H) Handshake + Scaling + Overnight + Funding Reverse | BTC | SHORT | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 70832.40 | 77915.64 | 68579.00 | TRAILING_STOP | 3.18 | 0.32 | 5x | 75x | yes | [1,2,3,4] | 634.19 |
| 139 | H) Handshake + Scaling + Overnight + Funding Reverse | ETH | SHORT | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 2088.12 | 2296.93 | 2013.32 | TRAILING_STOP | 3.58 | 0.36 | 5x | 75x | yes | [1,2,3,4] | 317.10 |
| 140 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | BTC | SHORT | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 70832.40 | 77915.64 | 68579.00 | TRAILING_STOP | 3.18 | 0.32 | 5x | 75x | yes | [1,2,3,4] | 897.44 |
| 141 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | ETH | SHORT | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | core_handshake | handshake | scaling | 2088.12 | 2296.93 | 2013.32 | TRAILING_STOP | 3.58 | 0.36 | 5x | 75x | yes | [1,2,3,4] | 448.72 |
| 142 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | AAVE | SHORT | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | 3way_handshake | independent | scaling | 115.20 | 126.72 | 111.13 | TRAILING_STOP | 3.53 | 0.35 | 5x | 75x | yes | [1,2,3,4] | 44.87 |
| 143 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | v3_current | 2088.12 | 2106.08 | 2033.26 | TRAILING_STOP | 2.63 | 3.05 | 25x | 25x | no | [] | 0.00 |
| 144 | L) Weekly Bias Hold (Scaling, No Sweep) | ETH | SHORT | 2026-02-09 | WEEKLY_BIAS_HOLD | none | independent | scaling | 2088.48 | 2297.33 | 2042.42 | TRAILING_STOP | 2.21 | 0.22 | 5x | 50x | yes | [1,2,3] | 281.96 |
| 145 | L) Weekly Bias Hold (Scaling, No Sweep) | BTC | SHORT | 2026-02-09 | WEEKLY_BIAS_HOLD | none | independent | scaling | 70291.00 | 77320.10 | 70291.00 | BREAKEVEN_STOP | 0.00 | 0.00 | 5x | 25x | yes | [1,2] | 481.99 |
| 146 | Daily NY Open Short | ETH | SHORT | 2026-02-09 | NY_OPEN_BASELINE | none | independent | v3_current | 2034.77 | 2065.29 | 2065.29 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 147 | Daily NY Open Short | BTC | SHORT | 2026-02-09 | NY_OPEN_BASELINE | none | independent | v3_current | 69111.60 | 70148.27 | 70148.27 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 148 | Daily NY Open Short | ETH | SHORT | 2026-02-10 | NY_OPEN_BASELINE | none | independent | v3_current | 2006.87 | 2036.97 | 2036.97 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 149 | Daily NY Open Short | BTC | SHORT | 2026-02-10 | NY_OPEN_BASELINE | none | independent | v3_current | 68567.50 | 69596.01 | 69596.01 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 150 | Daily NY Open Short | ETH | SHORT | 2026-02-11 | NY_OPEN_BASELINE | none | independent | v3_current | 1951.40 | 1980.67 | 1980.67 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 151 | Daily NY Open Short | BTC | SHORT | 2026-02-11 | NY_OPEN_BASELINE | none | independent | v3_current | 67109.30 | 68115.94 | 68115.94 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 152 | Daily NY Open Short | ETH | SHORT | 2026-02-12 | NY_OPEN_BASELINE | none | independent | v3_current | 1979.95 | 2009.65 | 1920.55 | TAKE_PROFIT | 3.00 | 2.00 | 25x | 25x | no | [] | 0.00 |
| 153 | Daily NY Open Short | BTC | SHORT | 2026-02-12 | NY_OPEN_BASELINE | none | independent | v3_current | 67836.60 | 68854.15 | 65801.50 | TAKE_PROFIT | 3.00 | 2.00 | 25x | 25x | no | [] | 0.00 |
| 154 | B) Independent + Scaling Risk | BTC | SHORT | 2026-02-12 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | scaling | 67980.60 | 74778.66 | 65738.88 | TRAILING_STOP | 3.30 | 0.33 | 5x | 75x | yes | [1,2,3,4] | 882.62 |
| 155 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-02-12 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 67980.60 | 68476.56 | 65404.80 | EOD_CLOSE | 3.79 | 5.19 | 25x | 25x | no | [] | 0.00 |
| 156 | Daily NY Open Short | ETH | SHORT | 2026-02-13 | NY_OPEN_BASELINE | none | independent | v3_current | 1960.21 | 1989.61 | 1989.61 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 157 | Daily NY Open Short | BTC | SHORT | 2026-02-13 | NY_OPEN_BASELINE | none | independent | v3_current | 67043.90 | 68049.56 | 68049.56 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 158 | A) Handshake + Current Risk | BTC | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | v3_current | 67132.70 | 67485.68 | 67485.68 | STOP_LOSS | -0.53 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 159 | A) Handshake + Current Risk | ETH | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | v3_current | 1965.97 | 1977.01 | 1977.01 | STOP_LOSS | -0.56 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 160 | B) Independent + Scaling Risk | BTC | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | scaling | 67132.70 | 73845.97 | 68744.00 | EOD_CLOSE | -2.40 | -0.24 | 5x | 5x | no | [] | 0.00 |
| 161 | C) Handshake + Scaling + Overnight Hold | BTC | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 67132.70 | 73845.97 | 68799.90 | WEEK_CLOSE | -2.48 | -0.25 | 5x | 5x | no | [] | 0.00 |
| 162 | C) Handshake + Scaling + Overnight Hold | ETH | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 1965.97 | 2162.57 | 1965.61 | WEEK_CLOSE | 0.02 | 0.00 | 5x | 10x | no | [1] | 263.27 |
| 163 | E) Handshake + Scaling + Overnight + Funding Filter | BTC | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 67132.70 | 73845.97 | 68799.90 | WEEK_CLOSE | -2.48 | -0.25 | 5x | 5x | no | [] | 0.00 |
| 164 | E) Handshake + Scaling + Overnight + Funding Filter | ETH | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 1965.97 | 2162.57 | 1965.61 | WEEK_CLOSE | 0.02 | 0.00 | 5x | 10x | no | [1] | 204.17 |
| 165 | F) Handshake + Scaling + Overnight + OI Delta Filter | BTC | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 67132.70 | 73845.97 | 68799.90 | WEEK_CLOSE | -2.48 | -0.25 | 5x | 5x | no | [] | 0.00 |
| 166 | F) Handshake + Scaling + Overnight + OI Delta Filter | ETH | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 1965.97 | 2162.57 | 1965.61 | WEEK_CLOSE | 0.02 | 0.00 | 5x | 10x | no | [1] | 204.17 |
| 167 | G) Handshake + Scaling + Overnight + Funding + OI | BTC | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 67132.70 | 73845.97 | 68799.90 | WEEK_CLOSE | -2.48 | -0.25 | 5x | 5x | no | [] | 0.00 |
| 168 | G) Handshake + Scaling + Overnight + Funding + OI | ETH | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 1965.97 | 2162.57 | 1965.61 | WEEK_CLOSE | 0.02 | 0.00 | 5x | 10x | no | [1] | 204.17 |
| 169 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | BTC | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 67132.70 | 73845.97 | 68799.90 | WEEK_CLOSE | -2.48 | -0.25 | 5x | 5x | no | [] | 0.00 |
| 170 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | ETH | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 1965.97 | 2162.57 | 1965.61 | WEEK_CLOSE | 0.02 | 0.00 | 5x | 10x | no | [1] | 271.33 |
| 171 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | LTC | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 53.41 | 58.75 | 55.02 | WEEK_CLOSE | -3.01 | -0.30 | 5x | 5x | no | [] | 0.00 |
| 172 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 67132.70 | 67485.68 | 67485.68 | STOP_LOSS | -0.53 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 173 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 1965.97 | 1977.01 | 1977.01 | STOP_LOSS | -0.56 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 174 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | DOGE | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 0.09 | 0.10 | 0.10 | STOP_LOSS | -10.00 | -1.00 | 5x | 5x | no | [] | 0.00 |
| 175 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | PEPE | SHORT | 2026-02-13 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 0.00 | 0.00 | 0.00 | STOP_LOSS | -10.00 | -1.00 | 5x | 5x | no | [] | 0.00 |
| 176 | B) Independent + Scaling Risk | ETH | SHORT | 2026-02-14 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | scaling | 2069.72 | 2276.69 | 2069.84 | EOD_CLOSE | -0.01 | -0.00 | 5x | 5x | no | [] | 0.00 |
| 177 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-02-14 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | v3_current | 2069.72 | 2079.52 | 2079.52 | STOP_LOSS | -0.47 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 178 | L) Weekly Bias Hold (Scaling, No Sweep) | BTC | SHORT | 2026-02-16 | WEEKLY_BIAS_HOLD | none | independent | scaling | 68799.90 | 75679.89 | 68799.90 | BREAKEVEN_STOP | 0.00 | 0.00 | 5x | 25x | yes | [1,2] | 495.25 |
| 179 | L) Weekly Bias Hold (Scaling, No Sweep) | ETH | SHORT | 2026-02-16 | WEEKLY_BIAS_HOLD | none | independent | scaling | 1965.61 | 2162.17 | 1965.61 | BREAKEVEN_STOP | 0.00 | 0.00 | 5x | 25x | yes | [1,2] | 257.53 |
| 180 | Daily NY Open Short | BTC | SHORT | 2026-02-16 | NY_OPEN_BASELINE | none | independent | v3_current | 69723.10 | 70768.95 | 67631.41 | TAKE_PROFIT | 3.00 | 2.00 | 25x | 25x | no | [] | 0.00 |
| 181 | Daily NY Open Short | ETH | SHORT | 2026-02-16 | NY_OPEN_BASELINE | none | independent | v3_current | 2005.60 | 2035.68 | 1945.43 | TAKE_PROFIT | 3.00 | 2.00 | 25x | 25x | no | [] | 0.00 |
| 182 | B) Independent + Scaling Risk | BTC | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | scaling | 69705.60 | 76676.16 | 68258.85 | TRAILING_STOP | 2.08 | 0.21 | 5x | 50x | yes | [1,2,3] | 872.20 |
| 183 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 69705.60 | 70195.13 | 68499.90 | EOD_CLOSE | 1.73 | 2.46 | 25x | 25x | no | [] | 0.00 |
| 184 | A) Handshake + Current Risk | ETH | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | v3_current | 2008.36 | 2024.68 | 1975.01 | TRAILING_STOP | 1.66 | 2.04 | 25x | 25x | no | [] | 0.00 |
| 185 | A) Handshake + Current Risk | BTC | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | v3_current | 69620.80 | 70195.13 | 68499.90 | EOD_CLOSE | 1.61 | 1.95 | 25x | 25x | no | [] | 0.00 |
| 186 | C) Handshake + Scaling + Overnight Hold | ETH | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2008.36 | 2209.20 | 1965.32 | TRAILING_STOP | 2.14 | 0.21 | 5x | 50x | yes | [1,2,3] | 444.56 |
| 187 | C) Handshake + Scaling + Overnight Hold | BTC | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 69620.80 | 76582.88 | 68258.85 | TRAILING_STOP | 1.96 | 0.20 | 5x | 50x | yes | [1,2,3] | 889.13 |
| 188 | E) Handshake + Scaling + Overnight + Funding Filter | ETH | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2008.36 | 2209.20 | 1965.32 | TRAILING_STOP | 2.14 | 0.21 | 5x | 50x | yes | [1,2,3] | 344.77 |
| 189 | E) Handshake + Scaling + Overnight + Funding Filter | BTC | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 69620.80 | 76582.88 | 68258.85 | TRAILING_STOP | 1.96 | 0.20 | 5x | 50x | yes | [1,2,3] | 689.54 |
| 190 | F) Handshake + Scaling + Overnight + OI Delta Filter | ETH | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2008.36 | 2209.20 | 1965.32 | TRAILING_STOP | 2.14 | 0.21 | 5x | 50x | yes | [1,2,3] | 344.77 |
| 191 | F) Handshake + Scaling + Overnight + OI Delta Filter | BTC | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 69620.80 | 76582.88 | 68258.85 | TRAILING_STOP | 1.96 | 0.20 | 5x | 50x | yes | [1,2,3] | 689.54 |
| 192 | G) Handshake + Scaling + Overnight + Funding + OI | ETH | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2008.36 | 2209.20 | 1965.32 | TRAILING_STOP | 2.14 | 0.21 | 5x | 50x | yes | [1,2,3] | 344.77 |
| 193 | G) Handshake + Scaling + Overnight + Funding + OI | BTC | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 69620.80 | 76582.88 | 68258.85 | TRAILING_STOP | 1.96 | 0.20 | 5x | 50x | yes | [1,2,3] | 689.54 |
| 194 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | ETH | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 2008.36 | 2209.20 | 1965.32 | TRAILING_STOP | 2.14 | 0.21 | 5x | 50x | yes | [1,2,3] | 445.90 |
| 195 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | SUI | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 0.99 | 1.09 | 0.97 | TRAILING_STOP | 1.95 | 0.19 | 5x | 50x | yes | [1,2,3] | 44.59 |
| 196 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | LINK | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | 3way_handshake | independent | scaling | 8.91 | 9.80 | 8.77 | TRAILING_STOP | 1.61 | 0.16 | 5x | 50x | yes | [1,2,3] | 40.13 |
| 197 | K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | BTC | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | core_handshake | handshake | scaling | 69620.80 | 76582.88 | 68258.85 | TRAILING_STOP | 1.96 | 0.20 | 5x | 50x | yes | [1,2,3] | 891.80 |
| 198 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-02-16 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 2008.36 | 2024.68 | 1975.01 | TRAILING_STOP | 1.66 | 2.04 | 25x | 25x | no | [] | 0.00 |
| 199 | Daily NY Open Short | ETH | SHORT | 2026-02-17 | NY_OPEN_BASELINE | none | independent | v3_current | 1968.64 | 1998.17 | 1998.17 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 200 | Daily NY Open Short | BTC | SHORT | 2026-02-17 | NY_OPEN_BASELINE | none | independent | v3_current | 67888.60 | 68906.93 | 67718.10 | EOD_CLOSE | 0.25 | 0.17 | 25x | 25x | no | [] | 0.00 |
| 201 | B) Independent + Scaling Risk | ETH | SHORT | 2026-02-17 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | scaling | 2006.04 | 2206.64 | 1993.63 | EOD_CLOSE | 0.62 | 0.06 | 5x | 5x | no | [] | 0.00 |
| 202 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-02-17 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 2006.04 | 2018.27 | 1993.63 | EOD_CLOSE | 0.62 | 1.01 | 25x | 25x | no | [] | 0.00 |
| 203 | B) Independent + Scaling Risk | BTC | SHORT | 2026-02-18 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | scaling | 68239.00 | 75062.90 | 67429.20 | EOD_CLOSE | 1.19 | 0.12 | 5x | 10x | no | [1] | 551.38 |
| 204 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-02-18 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | v3_current | 68239.00 | 68532.65 | 67429.20 | EOD_CLOSE | 1.19 | 2.76 | 25x | 25x | no | [] | 0.00 |
| 205 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-02-18 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | v3_current | 2011.78 | 2020.44 | 1981.56 | EOD_CLOSE | 1.50 | 3.49 | 25x | 25x | no | [] | 0.00 |
| 206 | Daily NY Open Short | ETH | SHORT | 2026-02-18 | NY_OPEN_BASELINE | none | independent | v3_current | 1981.56 | 2011.28 | 1922.11 | TAKE_PROFIT | 3.00 | 2.00 | 25x | 25x | no | [] | 0.00 |
| 207 | Daily NY Open Short | BTC | SHORT | 2026-02-18 | NY_OPEN_BASELINE | none | independent | v3_current | 67429.20 | 68440.64 | 66241.60 | EOD_CLOSE | 1.76 | 1.17 | 25x | 25x | no | [] | 0.00 |
| 208 | Daily NY Open Short | BTC | SHORT | 2026-02-19 | NY_OPEN_BASELINE | none | independent | v3_current | 66485.40 | 67482.68 | 67109.10 | EOD_CLOSE | -0.94 | -0.63 | 25x | 25x | no | [] | 0.00 |
| 209 | Daily NY Open Short | ETH | SHORT | 2026-02-19 | NY_OPEN_BASELINE | none | independent | v3_current | 1946.98 | 1976.18 | 1949.24 | EOD_CLOSE | -0.12 | -0.08 | 25x | 25x | no | [] | 0.00 |
| 210 | B) Independent + Scaling Risk | ETH | SHORT | 2026-02-20 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | scaling | 1950.02 | 2145.02 | 1948.81 | EOD_CLOSE | 0.06 | 0.01 | 5x | 10x | no | [1] | 584.10 |
| 211 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-02-20 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | v3_current | 1950.02 | 1957.00 | 1957.00 | STOP_LOSS | -0.36 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 212 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-02-20 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | v3_current | 67138.70 | 67384.43 | 67384.43 | STOP_LOSS | -0.37 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 213 | Daily NY Open Short | ETH | SHORT | 2026-02-20 | NY_OPEN_BASELINE | none | independent | v3_current | 1948.81 | 1978.04 | 1978.04 | STOP_LOSS | -1.50 | -1.00 | 25x | 25x | no | [] | 0.00 |
| 214 | Daily NY Open Short | BTC | SHORT | 2026-02-20 | NY_OPEN_BASELINE | none | independent | v3_current | 67510.10 | 68522.75 | 67711.60 | EOD_CLOSE | -0.30 | -0.20 | 25x | 25x | no | [] | 0.00 |
| 215 | B) Independent + Scaling Risk | ETH | SHORT | 2026-02-20 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | scaling | 1968.29 | 2165.12 | 1970.12 | EOD_CLOSE | -0.09 | -0.01 | 5x | 5x | no | [] | 0.00 |
| 216 | D) v3 Baseline (Independent + Current Risk) | ETH | SHORT | 2026-02-20 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 1968.29 | 1983.69 | 1970.12 | EOD_CLOSE | -0.09 | -0.12 | 25x | 25x | no | [] | 0.00 |
| 217 | B) Independent + Scaling Risk | ETH | SHORT | 2026-02-21 | US_RANGE_ASIA_LONDON_ENTRY | none | independent | scaling | 1979.49 | 2177.44 | 1975.19 | EOD_CLOSE | 0.22 | 0.02 | 5x | 5x | no | [] | 0.00 |
| 218 | B) Independent + Scaling Risk | ETH | SHORT | 2026-02-21 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | scaling | 1987.59 | 2186.35 | 1973.18 | EOD_CLOSE | 0.72 | 0.07 | 5x | 5x | no | [] | 0.00 |
| 219 | D) v3 Baseline (Independent + Current Risk) | BTC | SHORT | 2026-02-21 | ASIA_LONDON_RANGE_NY_ENTRY | none | independent | v3_current | 68226.60 | 68497.19 | 68497.19 | STOP_LOSS | -0.40 | -1.00 | 25x | 25x | no | [] | 0.00 |

## 3. Baseline Comparison

| Strategy | Total Return | Win Rate | Avg R:R | Max DD | Trades | Trades/Week |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A) Handshake + Current Risk | 123.74% | 62.50% | 0.681 | 23.86% | 16 | 3.20 |
| B) Independent + Scaling Risk | 22.18% | 70.00% | 0.031 | 33.63% | 20 | 4.00 |
| C) Handshake + Scaling + Overnight Hold | 112.54% | 87.50% | 0.266 | 6.19% | 16 | 3.20 |
| E) Handshake + Scaling + Overnight + Funding Filter | 64.83% | 91.67% | 0.249 | 6.19% | 12 | 2.40 |
| F) Handshake + Scaling + Overnight + OI Delta Filter | 64.83% | 91.67% | 0.249 | 6.19% | 12 | 2.40 |
| G) Handshake + Scaling + Overnight + Funding + OI | 64.83% | 91.67% | 0.249 | 6.19% | 12 | 2.40 |
| H) Handshake + Scaling + Overnight + Funding Reverse | 52.79% | 83.33% | 0.376 | 0.00% | 6 | 1.20 |
| I) Handshake + Scaling + Overnight + OI Reverse | 0.00% | 0.00% | 0.000 | 0.00% | 0 | 0.00 |
| J) Handshake + Scaling + Overnight + Funding + OI Reverse | 0.00% | 0.00% | 0.000 | 0.00% | 0 | 0.00 |
| K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | 114.02% | 82.86% | 0.191 | 8.70% | 35 | 7.00 |
| D) v3 Baseline (Independent + Current Risk) | 182.25% | 50.00% | 0.710 | 45.96% | 30 | 6.00 |
| L) Weekly Bias Hold (Scaling, No Sweep) | 28.97% | 60.00% | 0.146 | 0.00% | 10 | 2.00 |
| Daily NY Open Short | -34.25% | 44.00% | 0.131 | 79.78% | 50 | 10.00 |

### Handshake Diagnostics

- Handshake triggered: 8
- Single-symbol signals (missed handshake): 6
- Both signalled but outside 1hr window: 5
- Handshake trigger rate: 42.11%

### 3-Way Handshake Diagnostics (Variant K)

- Total BTC+ETH handshakes that could gate alts: 8
| Alt | Signals Within 60m | Missed 60m Window | Trigger Rate % (per core handshake) |
| --- | ---: | ---: | ---: |
| SOL | 1 | 7 | 12.50 |
| XRP | 1 | 4 | 12.50 |
| SUI | 2 | 3 | 25.00 |
| LINK | 2 | 5 | 25.00 |
| DOGE | 3 | 2 | 37.50 |
| ADA | 1 | 4 | 12.50 |
| BNB | 1 | 3 | 12.50 |
| PEPE | 2 | 3 | 25.00 |
| UNI | 2 | 2 | 25.00 |
| AVAX | 1 | 5 | 12.50 |
| PENGU | 1 | 4 | 12.50 |
| ZEC | 0 | 0 | 0.00 |
| LTC | 2 | 0 | 25.00 |
| HYPE | 1 | 0 | 12.50 |
| NEAR | 1 | 1 | 12.50 |
| PUMP | 0 | 1 | 0.00 |
| HBAR | 2 | 2 | 25.00 |
| ENA | 1 | 2 | 12.50 |
| WLD | 0 | 3 | 0.00 |
| FARTCOIN | 0 | 1 | 0.00 |
| AAVE | 2 | 4 | 25.00 |
| ONDO | 0 | 3 | 0.00 |
| SHIB | 2 | 2 | 25.00 |
| SEI | 0 | 2 | 0.00 |
| TAO | 1 | 2 | 12.50 |
| ASTER | 0 | 2 | 0.00 |
| DOT | 1 | 1 | 12.50 |
| BCH | 1 | 0 | 12.50 |
| VIRTUAL | 0 | 1 | 0.00 |
| APT | 0 | 0 | 0.00 |

### Alt Breakdown (Variant K)

| Alt | Signals | Entries | Win Rate % | Net PnL USD | Avg Unlevered PnL % |
| --- | ---: | ---: | ---: | ---: | ---: |
| SOL | 8 | 1 | 100.00 | 5.38 | 3.80 |
| XRP | 5 | 1 | 100.00 | 9.93 | 5.68 |
| SUI | 5 | 2 | 100.00 | 32.64 | 2.81 |
| LINK | 7 | 2 | 100.00 | 7.67 | 2.44 |
| DOGE | 5 | 3 | 66.67 | 0.83 | -1.30 |
| ADA | 5 | 0 | 0.00 | 0.00 | 0.00 |
| BNB | 4 | 0 | 0.00 | 0.00 | 0.00 |
| PEPE | 5 | 2 | 50.00 | -19.83 | -3.94 |
| UNI | 4 | 1 | 100.00 | 2.50 | 2.22 |
| AVAX | 6 | 0 | 0.00 | 0.00 | 0.00 |
| PENGU | 5 | 0 | 0.00 | 0.00 | 0.00 |
| ZEC | 0 | 0 | 0.00 | 0.00 | 0.00 |
| LTC | 2 | 1 | 0.00 | -8.18 | -3.01 |
| HYPE | 1 | 0 | 0.00 | 0.00 | 0.00 |
| NEAR | 2 | 1 | 0.00 | 0.00 | 0.00 |
| PUMP | 1 | 0 | 0.00 | 0.00 | 0.00 |
| HBAR | 4 | 2 | 100.00 | 8.87 | 2.97 |
| ENA | 3 | 0 | 0.00 | 0.00 | 0.00 |
| WLD | 3 | 0 | 0.00 | 0.00 | 0.00 |
| FARTCOIN | 1 | 0 | 0.00 | 0.00 | 0.00 |
| AAVE | 6 | 1 | 100.00 | 8.49 | 3.53 |
| ONDO | 3 | 0 | 0.00 | 0.00 | 0.00 |
| SHIB | 4 | 1 | 100.00 | 31.40 | 5.09 |
| SEI | 2 | 0 | 0.00 | 0.00 | 0.00 |
| TAO | 3 | 0 | 0.00 | 0.00 | 0.00 |
| ASTER | 2 | 0 | 0.00 | 0.00 | 0.00 |
| DOT | 2 | 0 | 0.00 | 0.00 | 0.00 |
| BCH | 1 | 1 | 100.00 | 16.35 | 2.41 |
| VIRTUAL | 1 | 0 | 0.00 | 0.00 | 0.00 |
| APT | 0 | 0 | 0.00 | 0.00 | 0.00 |

### Alt Session Window Breakdown (Variant K)

| Session Window | Trades | Win Rate % | Total PnL USD | Avg R |
| --- | ---: | ---: | ---: | ---: |
| ASIA_LONDON_RANGE_NY_ENTRY | 15 | 73.33 | 66.38 | 0.051 |
| US_RANGE_ASIA_LONDON_ENTRY | 4 | 100.00 | 29.67 | 0.419 |

### Alt Spike Analysis at Entry Time

| Symbol | Trade # | 4h Change% | BTC 4h Change% | Relative Spike | Z-Score | PnL% | Hit BE? | Max Milestone |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| LINK | 21 | 0.98 | 0.76 | 1.28 | 0.06 | 3.27 | yes | 4 |
| UNI | 22 | 0.53 | 0.76 | 0.69 | -0.35 | 2.22 | yes | 3 |
| PEPE | 26 | 4.43 | 1.45 | 3.06 | 1.80 | 2.12 | yes | 3 |
| HBAR | 46 | 0.90 | 0.77 | 1.17 | -0.15 | 2.20 | yes | 3 |
| NEAR | 52 | 1.50 | 0.69 | 2.18 | 0.25 | 0.00 | yes | 2 |
| SHIB | 53 | 1.19 | 0.69 | 1.72 | 0.10 | 5.09 | yes | 4 |
| DOGE | 65 | 1.59 | 0.58 | 2.74 | 0.34 | 3.62 | yes | 4 |
| HBAR | 87 | 0.67 | 0.21 | 3.21 | -0.39 | 3.73 | yes | 4 |
| XRP | 89 | 0.54 | 0.21 | 2.60 | -0.55 | 5.68 | yes | 4 |
| SOL | 93 | 0.40 | 0.29 | 1.40 | -0.52 | 3.80 | yes | 4 |
| DOGE | 107 | 1.82 | 0.43 | 4.26 | 0.11 | 2.47 | yes | 3 |
| SUI | 109 | 0.94 | 0.34 | 2.77 | -0.55 | 3.68 | yes | 4 |
| BCH | 110 | 0.38 | 0.34 | 1.12 | -0.90 | 2.41 | yes | 3 |
| AAVE | 142 | 2.69 | 1.56 | 1.72 | 0.52 | 3.53 | yes | 4 |
| LTC | 171 | 0.45 | 0.47 | 0.96 | -0.63 | -3.01 | no | 0 |
| DOGE | 174 | 0.04 | 0.96 | 0.04 | -1.03 | -10.00 | no | 0 |
| PEPE | 175 | 0.79 | 0.96 | 0.83 | -0.47 | -10.00 | no | 0 |
| SUI | 195 | 1.97 | 1.12 | 1.77 | 1.41 | 1.95 | yes | 3 |
| LINK | 196 | 0.87 | 1.12 | 0.78 | 0.11 | 1.61 | yes | 3 |

### Spike Magnitude vs Outcome

| Relative Spike Bucket | Trades | Win Rate | Avg PnL% | Avg Max Milestone |
| --- | ---: | ---: | ---: | ---: |
| < 1.0 (moved less than BTC) | 5 | 40.00% | -3.84 | 1.20 |
| 1.0 - 1.5 | 4 | 100.00% | 2.92 | 3.50 |
| 1.5 - 2.0 | 3 | 100.00% | 3.52 | 3.67 |
| > 2.0 (moved 2x+ BTC) | 7 | 85.71% | 3.04 | 3.43 |

### Scaling Milestones

#### B) Independent + Scaling Risk

| Milestone | Times Reached | % of Trades |
| --- | ---: | ---: |
| +1.0% (->10x) | 10 | 50.00% |
| +2.0% (->25x, breakeven) | 4 | 20.00% |
| +3.0% (->50x, trailing) | 4 | 20.00% |
| +4.0% (->75x cap) | 2 | 10.00% |

#### C) Handshake + Scaling + Overnight Hold

| Milestone | Times Reached | % of Trades |
| --- | ---: | ---: |
| +1.0% (->10x) | 15 | 93.75% |
| +2.0% (->25x, breakeven) | 14 | 87.50% |
| +3.0% (->50x, trailing) | 13 | 81.25% |
| +4.0% (->75x cap) | 10 | 62.50% |

#### E) Handshake + Scaling + Overnight + Funding Filter

| Milestone | Times Reached | % of Trades |
| --- | ---: | ---: |
| +1.0% (->10x) | 11 | 91.67% |
| +2.0% (->25x, breakeven) | 10 | 83.33% |
| +3.0% (->50x, trailing) | 10 | 83.33% |
| +4.0% (->75x cap) | 7 | 58.33% |

#### F) Handshake + Scaling + Overnight + OI Delta Filter

| Milestone | Times Reached | % of Trades |
| --- | ---: | ---: |
| +1.0% (->10x) | 11 | 91.67% |
| +2.0% (->25x, breakeven) | 10 | 83.33% |
| +3.0% (->50x, trailing) | 10 | 83.33% |
| +4.0% (->75x cap) | 7 | 58.33% |

#### G) Handshake + Scaling + Overnight + Funding + OI

| Milestone | Times Reached | % of Trades |
| --- | ---: | ---: |
| +1.0% (->10x) | 11 | 91.67% |
| +2.0% (->25x, breakeven) | 10 | 83.33% |
| +3.0% (->50x, trailing) | 10 | 83.33% |
| +4.0% (->75x cap) | 7 | 58.33% |

#### H) Handshake + Scaling + Overnight + Funding Reverse

| Milestone | Times Reached | % of Trades |
| --- | ---: | ---: |
| +1.0% (->10x) | 6 | 100.00% |
| +2.0% (->25x, breakeven) | 6 | 100.00% |
| +3.0% (->50x, trailing) | 5 | 83.33% |
| +4.0% (->75x cap) | 5 | 83.33% |

#### I) Handshake + Scaling + Overnight + OI Reverse

| Milestone | Times Reached | % of Trades |
| --- | ---: | ---: |
| +1.0% (->10x) | 0 | 0.00% |
| +2.0% (->25x, breakeven) | 0 | 0.00% |
| +3.0% (->50x, trailing) | 0 | 0.00% |
| +4.0% (->75x cap) | 0 | 0.00% |

#### J) Handshake + Scaling + Overnight + Funding + OI Reverse

| Milestone | Times Reached | % of Trades |
| --- | ---: | ---: |
| +1.0% (->10x) | 0 | 0.00% |
| +2.0% (->25x, breakeven) | 0 | 0.00% |
| +3.0% (->50x, trailing) | 0 | 0.00% |
| +4.0% (->75x cap) | 0 | 0.00% |

#### K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion)

| Milestone | Times Reached | % of Trades |
| --- | ---: | ---: |
| +1.0% (->10x) | 31 | 88.57% |
| +2.0% (->25x, breakeven) | 30 | 85.71% |
| +3.0% (->50x, trailing) | 28 | 80.00% |
| +4.0% (->75x cap) | 18 | 51.43% |

### Tier 1 Filter Diagnostics

- OI delta method: Volume-expansion proxy: ((quoteVolume last 4h - prior 4h) / prior 4h) * 100.

#### E) Funding Filter Impact vs C

- Filtered C trades: 4
- Removed winners: 3
- Removed losers: 0
- Removed flats: 1
| Symbol | Week Open | Day | Window | Entry UTC | Funding Rate | Fail Reason | C Outcome | C PnL USD |
| --- | --- | --- | --- | --- | ---: | --- | --- | ---: |
| BTC | 2026-02-02T00:00:00.000Z | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | 2026-02-02T14:45:00.000Z | -0.000047 | pair_fail | WIN | 239.92 |
| ETH | 2026-02-02T00:00:00.000Z | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | 2026-02-02T14:45:00.000Z | -0.000114 | self_fail | FLAT | 0.00 |
| BTC | 2026-02-02T00:00:00.000Z | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | 2026-02-07T04:35:00.000Z | -0.000246 | self_fail | WIN | 148.99 |
| ETH | 2026-02-02T00:00:00.000Z | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | 2026-02-07T04:35:00.000Z | -0.000033 | pair_fail | WIN | 83.87 |

#### F) OI Delta Filter Impact vs C

- Filtered C trades: 4
- Removed winners: 3
- Removed losers: 0
- Removed flats: 1
| Symbol | Week Open | Day | Window | Entry UTC | OI Delta % | Fail Reason | C Outcome | C PnL USD |
| --- | --- | --- | --- | --- | ---: | --- | --- | ---: |
| BTC | 2026-02-02T00:00:00.000Z | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | 2026-02-02T14:45:00.000Z | 21.28 | pair_fail | WIN | 239.92 |
| ETH | 2026-02-02T00:00:00.000Z | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | 2026-02-02T14:45:00.000Z | -3.40 | self_fail | FLAT | 0.00 |
| BTC | 2026-02-02T00:00:00.000Z | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | 2026-02-07T04:35:00.000Z | -10.56 | self_fail | WIN | 148.99 |
| ETH | 2026-02-02T00:00:00.000Z | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | 2026-02-07T04:35:00.000Z | 25.44 | pair_fail | WIN | 83.87 |

#### G) Funding + OI Combined Filter Impact vs C

- Filtered C trades: 4
- Removed winners: 3
- Removed losers: 0
- Removed flats: 1
| Symbol | Week Open | Day | Window | Entry UTC | Funding Rate | OI Delta % | Fail Reason | C Outcome | C PnL USD |
| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | ---: |
| BTC | 2026-02-02T00:00:00.000Z | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | 2026-02-02T14:45:00.000Z | -0.000047 | 21.28 | pair_fail | WIN | 239.92 |
| ETH | 2026-02-02T00:00:00.000Z | 2026-02-02 | ASIA_LONDON_RANGE_NY_ENTRY | 2026-02-02T14:45:00.000Z | -0.000114 | -3.40 | self_fail | FLAT | 0.00 |
| BTC | 2026-02-02T00:00:00.000Z | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | 2026-02-07T04:35:00.000Z | -0.000246 | -10.56 | self_fail | WIN | 148.99 |
| ETH | 2026-02-02T00:00:00.000Z | 2026-02-07 | US_RANGE_ASIA_LONDON_ENTRY | 2026-02-07T04:35:00.000Z | -0.000033 | 25.44 | pair_fail | WIN | 83.87 |

### Tier 1 Reverse Filter Diagnostics

#### H) Funding Reverse Impact vs C

- Filtered C trades: 10
- Removed winners: 9
- Removed losers: 1
- Removed flats: 0

#### I) OI Reverse Impact vs C

- Filtered C trades: 16
- Removed winners: 14
- Removed losers: 1
- Removed flats: 1

#### J) Funding + OI Reverse Impact vs C

- Filtered C trades: 16
- Removed winners: 14
- Removed losers: 1
- Removed flats: 1

## 4. Primary Strategy Metrics

- Primary strategy: D) v3 Baseline (Independent + Current Risk)
- Total return: 182.25%
- Win rate: 50.00%
- Average R:R: 0.710
- Max drawdown: 45.96%
- Average trades per week: 6.00

### Day-of-Week Breakdown (Primary)

| Day | Trades | Win Rate % | Total PnL USD | Avg R |
| --- | ---: | ---: | ---: | ---: |
| Monday | 6 | 66.67 | 557.67 | 0.891 |
| Tuesday | 3 | 33.33 | -197.60 | -0.328 |
| Wednesday | 7 | 71.43 | 974.42 | 1.424 |
| Thursday | 1 | 100.00 | 691.26 | 5.194 |
| Friday | 9 | 22.22 | -507.49 | -0.340 |
| Saturday | 4 | 50.00 | 304.26 | 1.211 |

## 5. Recommendations

- Handshake + scaling did not beat v3 baseline; refine entry coupling or risk ladder.
- Funding filter did not improve C returns in this sample.
- OI delta filter did not improve C returns in this sample.
- Combined funding + OI filters did not improve C returns in this sample.
- Funding reverse filter did not improve C returns in this sample.
- OI reverse filter did not improve C returns in this sample.
- Combined funding + OI reverse filters did not improve C returns in this sample.
- 3-way alt expansion outperformed core C strategy in this sample.
- C outperformed weekly bias hold; sweep/handshake timing adds value in this sample.
- Handshake alone did not improve current-risk performance.
- Scaling model underperformed with independent entries; test narrower initial stop or lower initial leverage.
- Next risk test: compare 5x vs 2.5x initial leverage for scaling model.
