# Gate 34 Dealer Weekly Hold 2024-2026 Audit

Generated: 2026-06-14T18:34:53.839Z

## Conclusion

- The corrected receipts show one definite test-harness issue: 2024 and clean 2025 were previously using default FX ADR for fixed bands. Daily ADR bars have now been materialized from canonical 1H bars and the receipts were rerun.
- After correction, 2025 is no longer simply weak on an ADR-normalized basis: week-close raw remains negative, but ADR-normalized week-close is positive. Fixed bands are still profitable, though less spectacular than the prior default-ADR sweep.
- 2024 remains a true Dealer signal failure in this test. It is not explained by missing COT snapshots, frozen-ledger substitution, missing FX price rows, or default ADR coverage.
- The app/test path is internally consistent: receipt directions match live Dealer derivation, source report dates match derived COT weeks, and receipt entry/exit/raw returns recompute from canonical 1H execution bars.

## Corrected Year Summary

| Year | Weeks | Raw | ADR | Weekly ADR PF | Trade ADR PF | ADR DD | ADR Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2024 | 52 | -123.59% | -169.48% | 0.49 | 0.81 | 181.46% | 1456/0 canonical/default |
| clean 2025 | 39 | -11.14% | +21.33% | 1.14 | 1.04 | 50.34% | 1092/0 canonical/default |
| current 2026 | 23 | +50.38% | +73.70% | 2.54 | 1.25 | 29.28% | 644/0 canonical/default |

## Fixed-Band Checkpoints

### 2024

Best broad ADR variant: market_week_tp1x_sl1p5x_adr raw -55.08% / ADR -71.25% / ADR DD 93.43% / Sharpe-style -1.51.

| Variant | Raw | ADR | Weekly PF | Trade PF | Expectancy | ADR DD | DD/Return |
| --- | --- | --- | --- | --- | --- | --- | --- |
| week_close | -123.59% | -169.48% | 0.49 | 0.81 | -0.116 | 181.46% | 0.000 |
| market_week_tp1x_sl2x_adr | -80.71% | -103.50% | 0.50 | 0.83 | -0.071 | 115.02% | 0.000 |
| market_week_tp1x_sl2p45x_adr | -82.26% | -110.30% | 0.49 | 0.82 | -0.076 | 118.66% | 0.000 |
| market_week_tp1p2x_sl2p45x_adr | -94.85% | -130.81% | 0.49 | 0.81 | -0.090 | 137.78% | 0.000 |
| market_week_tp1p6x_sl2p45x_adr | -116.68% | -169.32% | 0.40 | 0.80 | -0.116 | 173.15% | 0.000 |

### clean 2025

Best broad ADR variant: market_week_tp1x_sl2p45x_adr raw +30.17% / ADR +42.26% / ADR DD 25.71% / Sharpe-style 0.92.

| Variant | Raw | ADR | Weekly PF | Trade PF | Expectancy | ADR DD | DD/Return |
| --- | --- | --- | --- | --- | --- | --- | --- |
| week_close | -11.14% | +21.33% | 1.14 | 1.04 | 0.020 | 50.34% | 2.360 |
| market_week_tp1x_sl2x_adr | +19.52% | +31.90% | 1.34 | 1.10 | 0.029 | 28.55% | 0.895 |
| market_week_tp1x_sl2p45x_adr | +30.17% | +42.26% | 1.48 | 1.13 | 0.039 | 25.71% | 0.608 |
| market_week_tp1p2x_sl2p45x_adr | +14.64% | +34.46% | 1.34 | 1.09 | 0.032 | 34.02% | 0.987 |
| market_week_tp1p6x_sl2p45x_adr | +5.39% | +25.97% | 1.22 | 1.06 | 0.024 | 41.30% | 1.591 |

### current 2026

Best broad ADR variant: market_week_tp1p6x_sl2p45x_adr raw +58.14% / ADR +95.77% / ADR DD 15.78% / Sharpe-style 3.55.

| Variant | Raw | ADR | Weekly PF | Trade PF | Expectancy | ADR DD | DD/Return |
| --- | --- | --- | --- | --- | --- | --- | --- |
| week_close | +50.38% | +73.70% | 2.54 | 1.25 | 0.114 | 29.28% | 0.397 |
| market_week_tp1x_sl2x_adr | +40.51% | +60.39% | 4.43 | 1.35 | 0.094 | 14.07% | 0.233 |
| market_week_tp1x_sl2p45x_adr | +43.80% | +64.99% | 3.98 | 1.39 | 0.102 | 16.13% | 0.248 |
| market_week_tp1p2x_sl2p45x_adr | +50.93% | +79.01% | 5.59 | 1.41 | 0.123 | 12.54% | 0.159 |
| market_week_tp1p6x_sl2p45x_adr | +58.14% | +95.77% | 6.79 | 1.39 | 0.149 | 15.78% | 0.165 |

## Integrity Checks

| Year | COT Dates | Frozen Weeks | Missing Snapshots | Live Direction Mismatches | Price Mismatches | Missing Bars | Missing Exact Opens | Max Raw Diff |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2024 | 52 | 0 | 0 | 0 | 0 | 0 | 0 | 0.000000 |
| clean 2025 | 39 | 0 | 0 | 0 | 0 | 0 | 0 | 0.000000 |
| current 2026 | 23 | 16 | 0 | 0 | 0 | 0 | 0 | 0.000000 |

## Dealer Rule Contribution

### 2024

| Rule Tier | Rows | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| neutral_tier1_directional_ratio | 702 | 341/361 | +7.60% | +3.39% |
| neutral_tier3_oi_confirmed_delta_diff | 3 | 3/0 | +2.46% | +3.35% |
| neutral_tier2_delta_persistence | 2 | 1/1 | -0.30% | -0.47% |
| neutral_tier3_oi_confirmed_delta | 1 | 0/1 | -1.84% | -2.26% |
| direct_opposed_bias | 748 | 351/397 | -131.51% | -173.48% |

Inverted week-close check: raw +123.59% / ADR +169.48% / weekly ADR PF 2.04.

### clean 2025

| Rule Tier | Rows | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| direct_opposed_bias | 556 | 266/290 | -13.57% | +15.70% |
| neutral_tier2_delta_persistence | 10 | 6/4 | +3.37% | +3.99% |
| neutral_tier1_directional_ratio | 510 | 252/258 | -1.50% | +1.70% |
| neutral_tier3_oi_confirmed_delta | 6 | 2/4 | +0.11% | +0.19% |
| neutral_tier4_raw_delta_diff | 9 | 5/4 | +0.64% | +0.06% |
| neutral_tier3_oi_confirmed_delta_diff | 1 | 0/1 | -0.19% | -0.30% |

Inverted week-close check: raw +11.14% / ADR -21.33% / weekly ADR PF 0.88.

### current 2026

| Rule Tier | Rows | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| neutral_tier1_directional_ratio | 279 | 157/122 | +30.16% | +47.56% |
| direct_opposed_bias | 347 | 174/172 | +23.38% | +29.99% |
| neutral_tier4_raw_delta_diff | 5 | 2/3 | +1.02% | +2.56% |
| neutral_tier3_oi_confirmed_delta | 4 | 3/1 | +1.89% | +2.39% |
| neutral_tier3_oi_confirmed_delta_diff | 1 | 0/1 | -1.03% | -1.90% |
| neutral_tier2_delta_persistence | 8 | 3/5 | -5.04% | -6.91% |

Inverted week-close check: raw -50.38% / ADR -73.70% / weekly ADR PF 0.39.

## Worst Weeks

### 2024

| Week | W/L | Raw | ADR | ADR Adv DD |
| --- | --- | --- | --- | --- |
| 2024-09-30 | 5/23 | -32.90% | -36.41% | 47.90% |
| 2024-10-21 | 6/22 | -15.90% | -24.05% | 37.32% |
| 2024-07-08 | 8/20 | -9.24% | -19.88% | 37.57% |
| 2024-08-26 | 7/21 | -13.34% | -19.46% | 28.90% |
| 2024-11-26 | 9/19 | -16.47% | -18.25% | 25.37% |
| 2024-08-19 | 9/19 | -13.71% | -18.09% | 23.92% |
| 2024-07-22 | 12/16 | -18.21% | -17.45% | 29.04% |
| 2024-07-29 | 13/15 | -19.90% | -16.90% | 35.26% |

### clean 2025

| Week | W/L | Raw | ADR | ADR Adv DD |
| --- | --- | --- | --- | --- |
| 2025-07-07 | 4/24 | -18.70% | -28.88% | 33.66% |
| 2025-04-07 | 9/19 | -30.86% | -24.81% | 40.74% |
| 2025-02-04 | 11/17 | -13.77% | -18.81% | 34.24% |
| 2025-02-11 | 13/15 | -15.65% | -13.96% | 19.19% |
| 2025-09-08 | 11/17 | -5.68% | -12.97% | 19.14% |
| 2025-08-04 | 9/19 | -8.13% | -10.60% | 16.37% |
| 2025-04-28 | 9/19 | -6.84% | -8.46% | 27.26% |
| 2025-06-02 | 11/17 | -6.69% | -7.88% | 17.67% |

### current 2026

| Week | W/L | Raw | ADR | ADR Adv DD |
| --- | --- | --- | --- | --- |
| 2026-04-27 | 7/21 | -12.78% | -26.06% | 48.08% |
| 2026-05-18 | 12/16 | -5.73% | -11.45% | 17.19% |
| 2026-04-13 | 15/13 | -3.74% | -4.21% | 13.60% |
| 2026-01-13 | 12/16 | -1.01% | -2.97% | 14.27% |
| 2026-03-23 | 13/15 | -1.88% | -1.84% | 17.87% |
| 2026-04-20 | 12/16 | +0.27% | -1.29% | 7.49% |
| 2026-06-08 | 12/15 | -0.92% | +0.29% | 11.51% |
| 2026-01-27 | 15/13 | +3.49% | +1.73% | 21.86% |

## Pair Contribution

### 2024 - Worst Pairs

| Pair | Rows | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| EURNZD | 52 | 21/31 | -11.11% | -19.37% |
| GBPNZD | 52 | 18/34 | -10.33% | -17.19% |
| GBPJPY | 52 | 21/31 | -12.15% | -15.99% |
| CHFJPY | 52 | 25/27 | -11.27% | -15.86% |
| AUDNZD | 52 | 20/32 | -5.81% | -15.43% |
| GBPCHF | 52 | 19/33 | -7.67% | -15.00% |
| NZDJPY | 52 | 27/25 | -10.45% | -14.02% |
| GBPCAD | 52 | 25/27 | -5.49% | -13.35% |

### 2024 - Best Pairs

| Pair | Rows | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| USDCAD | 52 | 30/22 | +6.80% | +14.36% |
| CADCHF | 52 | 27/25 | +5.30% | +10.13% |
| AUDCHF | 52 | 26/26 | +1.54% | +5.23% |
| CADJPY | 52 | 27/25 | +1.23% | +5.04% |
| NZDUSD | 52 | 29/23 | +2.06% | +3.56% |
| USDCHF | 52 | 33/19 | +2.84% | +3.30% |
| EURCAD | 52 | 27/25 | +0.24% | +2.01% |
| AUDJPY | 52 | 27/25 | -1.01% | -0.19% |

### clean 2025 - Worst Pairs

| Pair | Rows | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| USDCHF | 39 | 14/25 | -9.48% | -15.64% |
| CHFJPY | 39 | 15/24 | -7.92% | -12.22% |
| GBPCHF | 39 | 18/21 | -3.37% | -6.79% |
| AUDUSD | 39 | 13/26 | -8.80% | -6.04% |
| GBPUSD | 39 | 19/20 | -5.14% | -5.82% |
| GBPAUD | 39 | 20/19 | -3.54% | -5.36% |
| EURJPY | 39 | 17/22 | -1.55% | -3.50% |
| GBPCAD | 39 | 18/21 | -0.85% | -2.91% |

### clean 2025 - Best Pairs

| Pair | Rows | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| EURCAD | 39 | 23/16 | +9.54% | +17.59% |
| EURNZD | 39 | 20/19 | +7.25% | +14.84% |
| EURAUD | 39 | 21/18 | +6.93% | +13.10% |
| CADCHF | 39 | 21/18 | +7.07% | +9.96% |
| EURGBP | 39 | 23/16 | +1.20% | +9.23% |
| NZDJPY | 39 | 22/17 | +2.12% | +7.22% |
| AUDCHF | 39 | 18/21 | +2.53% | +4.58% |
| CADJPY | 39 | 21/18 | +1.93% | +4.10% |

### current 2026 - Worst Pairs

| Pair | Rows | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| EURNZD | 23 | 8/15 | -4.46% | -9.68% |
| EURUSD | 23 | 9/14 | -4.56% | -8.21% |
| USDJPY | 23 | 8/15 | -4.86% | -7.37% |
| GBPCHF | 23 | 11/12 | -2.67% | -6.27% |
| NZDUSD | 23 | 11/12 | -3.47% | -5.93% |
| EURGBP | 23 | 9/14 | -1.59% | -4.61% |
| GBPUSD | 23 | 12/11 | -1.69% | -2.87% |
| USDCHF | 23 | 9/13 | -1.44% | -2.01% |

### current 2026 - Best Pairs

| Pair | Rows | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| AUDCHF | 23 | 18/5 | +10.41% | +13.39% |
| AUDCAD | 23 | 15/8 | +8.34% | +12.56% |
| AUDJPY | 23 | 16/7 | +10.96% | +12.46% |
| GBPAUD | 23 | 16/7 | +7.64% | +12.07% |
| EURCAD | 23 | 14/9 | +4.48% | +11.14% |
| NZDCAD | 23 | 13/10 | +4.69% | +10.11% |
| AUDNZD | 23 | 12/11 | +4.89% | +8.85% |
| NZDJPY | 23 | 12/11 | +6.55% | +8.66% |

## Files

- JSON audit: C:\Users\User\Documents\GitHub\limni-website\app\reports\data-verification\weekly-hold-audit\dealer-weekly-hold-2024-2026-audit-20260614.json
- 2024 baseline: C:\Users\User\Documents\GitHub\limni-website\app\reports\data-verification\weekly-hold-basket-baseline\fx-28pair-dealer-weekly-hold-baseline-52w-20260614-182222.json
- 2024 fixed-band: C:\Users\User\Documents\GitHub\limni-website\app\reports\data-verification\weekly-hold-exit-sweep\fx-28pair-dealer-weekly-hold-fixed-band-sweep-52w-20260614-182928.json
- clean 2025 baseline: C:\Users\User\Documents\GitHub\limni-website\app\reports\data-verification\weekly-hold-basket-baseline\fx-28pair-dealer-weekly-hold-baseline-39w-20260614-181048.json
- clean 2025 fixed-band: C:\Users\User\Documents\GitHub\limni-website\app\reports\data-verification\weekly-hold-exit-sweep\fx-28pair-dealer-weekly-hold-fixed-band-sweep-39w-20260614-181610.json
- current 2026 baseline: C:\Users\User\Documents\GitHub\limni-website\app\reports\data-verification\weekly-hold-basket-baseline\fx-28pair-dealer-weekly-hold-baseline-23w-20260614-180424.json
- current 2026 fixed-band: C:\Users\User\Documents\GitHub\limni-website\app\reports\data-verification\weekly-hold-exit-sweep\fx-28pair-dealer-weekly-hold-fixed-band-sweep-23w-20260614-180610.json

