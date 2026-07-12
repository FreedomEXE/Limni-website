# Gate 34 Dealer Rule Candidate Audit

Generated: 2026-06-15T00:27:35.163Z

## Scope

- Dealer source only.
- Week-close baseline rows only; this does not retest fixed TP/SL exits.
- Uses corrected baseline receipts with canonical daily ADR coverage.
- Alternate candidates rescore direction only; price path is not rebuilt here.
- Drawdown shown here is weekly cumulative ADR equity drawdown, not intrabar adverse excursion.

## Candidate Rules

| Variant | Meaning |
| --- | --- |
| current | Current Dealer rule |
| neutral_only | Trade only neutral/tiebreaker rows |
| direct_only | Trade only direct opposed-bias rows |
| direct_inverted | Invert only direct opposed-bias rows |
| direct_ratio_confirmed | Keep direct rows only when directional-ratio agrees |
| direct_ratio_override | Use directional-ratio on direct rows |
| ratio_direction_all | Use directional-ratio direction for every row |
| direct_delta_confirmed | Keep direct rows only when delta-diff agrees |
| direct_delta_override | Use delta-diff direction on direct rows |
| delta_direction_all | Use delta-diff direction for every row |
| direct_signed_spread_confirmed | Keep direct rows only when signed spread score agrees |
| direct_signed_spread_override | Use signed spread score on direct rows |
| signed_spread_all | Use signed spread score for every row |
| signed_spread_all_min0p25 | Use signed spread score when abs(pair score) >= 0.25 |
| signed_spread_all_min0p50 | Use signed spread score when abs(pair score) >= 0.50 |
| direct_subtractive_spread_confirmed | Keep direct rows only when net-minus-spread agrees |
| direct_subtractive_spread_override | Use net-minus-spread on direct rows |
| subtractive_spread_all | Use net-minus-spread score for every row |
| direct_2of3_spread0p25 | Direct rows use raw/delta/spread-clean 2-of-3, spread threshold 0.25 |
| direct_2of3_spread0p50 | Direct rows use raw/delta/spread-clean 2-of-3, spread threshold 0.50 |
| direct_raw_delta_spread0p25 | Direct rows require raw+delta agreement and spread threshold 0.25 |
| direct_raw_delta_spread0p50 | Direct rows require raw+delta agreement and spread threshold 0.50 |
| direct_min_leg_ratio0p50 | Keep direct rows only when both legs have Dealer ratio >= 0.50 |
| direct_min_leg_ratio0p66 | Keep direct rows only when both legs have Dealer ratio >= 0.66 |
| direct_min_leg_ratio0p75 | Keep direct rows only when both legs have Dealer ratio >= 0.75 |
| direct_2of3_leg_ratio0p66 | Direct rows use raw/delta/leg-ratio-clean 2-of-3, threshold 0.66 |
| direct_2of3_leg_ratio0p75 | Direct rows use raw/delta/leg-ratio-clean 2-of-3, threshold 0.75 |
| direct_raw_delta_leg_ratio0p66 | Direct rows require raw+delta agreement and leg ratio >= 0.66 |
| direct_raw_delta_leg_ratio0p75 | Direct rows require raw+delta agreement and leg ratio >= 0.75 |

## clean 2019

Receipt: `app\reports\data-verification\weekly-hold-basket-baseline\fx-28pair-dealer-weekly-hold-baseline-43w-20260615-001910.json`

Window: 2019-01-01 through 2019-12-31 (43 weeks).

### Direct-Rule Agreement Checks

| Direct rows | Ratio agrees | Ratio disagrees | Ratio missing | Delta agrees | Delta disagrees | Delta missing | Signed spread agrees | Signed spread disagrees | Signed spread missing | Net-spread agrees | Net-spread disagrees | Net-spread missing | Spread clean >=0.25 | Spread clean >=0.50 | Min leg ratio >=0.50 | Min leg ratio >=0.66 | Min leg ratio >=0.75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 626 | 267 | 330 | 29 | 328 | 298 | 0 | 626 | 0 | 0 | 626 | 0 | 0 | 626 | 626 | 617 | 594 | 575 |

### Variant Summary

| Variant | Trades | Active weeks | Raw | ADR | Weekly PF | Trade PF | Expectancy/trade | Weekly Sharpe-style | Weekly DD | DD/return | Weekly W/L/F | Trade W/L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 1204 | 43 | -89.37% | -124.90% | 0.61 | 0.84 | -0.104% | -0.197 | +164.15% | n/a | 17/26/0 | 579/624 |
| neutral_only | 578 | 43 | -26.30% | -36.39% | 0.69 | 0.90 | -0.063% | -0.140 | +47.30% | n/a | 18/25/0 | 286/291 |
| direct_only | 626 | 43 | -63.08% | -88.51% | 0.68 | 0.79 | -0.141% | -0.150 | +130.53% | n/a | 20/23/0 | 293/333 |
| direct_inverted | 1204 | 43 | +36.78% | +52.12% | 1.21 | 1.08 | +0.043% | 0.080 | +83.15% | 1.595 | 24/19/0 | 619/584 |
| direct_ratio_confirmed | 845 | 43 | -58.88% | -99.11% | 0.56 | 0.82 | -0.117% | -0.232 | +99.11% | n/a | 17/26/0 | 403/441 |
| direct_ratio_override | 1175 | 43 | -27.35% | -73.40% | 0.67 | 0.90 | -0.062% | -0.154 | +77.89% | n/a | 19/24/0 | 574/600 |
| ratio_direction_all | 1172 | 43 | -26.53% | -71.92% | 0.68 | 0.90 | -0.061% | -0.151 | +76.83% | n/a | 18/25/0 | 573/598 |
| direct_delta_confirmed | 906 | 43 | -43.98% | -56.47% | 0.71 | 0.90 | -0.062% | -0.139 | +80.39% | n/a | 20/23/0 | 449/456 |
| direct_delta_override | 1204 | 43 | +1.42% | +11.97% | 1.07 | 1.02 | +0.010% | 0.029 | +52.76% | 4.410 | 25/18/0 | 617/586 |
| delta_direction_all | 1204 | 43 | +78.57% | +113.44% | 1.60 | 1.17 | +0.094% | 0.200 | +61.16% | 0.539 | 24/19/0 | 642/561 |
| direct_signed_spread_confirmed | 1204 | 43 | -89.37% | -124.90% | 0.61 | 0.84 | -0.104% | -0.197 | +164.15% | n/a | 17/26/0 | 579/624 |
| direct_signed_spread_override | 1204 | 43 | -89.37% | -124.90% | 0.61 | 0.84 | -0.104% | -0.197 | +164.15% | n/a | 17/26/0 | 579/624 |
| signed_spread_all | 1201 | 43 | -28.31% | -49.03% | 0.84 | 0.93 | -0.041% | -0.069 | +108.08% | n/a | 20/23/0 | 587/613 |
| signed_spread_all_min0p25 | 663 | 43 | -53.14% | -82.83% | 0.70 | 0.81 | -0.125% | -0.138 | +117.19% | n/a | 21/22/0 | 317/346 |
| signed_spread_all_min0p50 | 630 | 43 | -55.85% | -81.33% | 0.70 | 0.81 | -0.129% | -0.140 | +125.47% | n/a | 20/23/0 | 297/333 |
| direct_subtractive_spread_confirmed | 1204 | 43 | -89.37% | -124.90% | 0.61 | 0.84 | -0.104% | -0.197 | +164.15% | n/a | 17/26/0 | 579/624 |
| direct_subtractive_spread_override | 1204 | 43 | -89.37% | -124.90% | 0.61 | 0.84 | -0.104% | -0.197 | +164.15% | n/a | 17/26/0 | 579/624 |
| subtractive_spread_all | 1204 | 43 | -93.14% | -124.30% | 0.57 | 0.84 | -0.103% | -0.208 | +152.36% | n/a | 15/28/0 | 572/631 |
| direct_2of3_spread0p25 | 1204 | 43 | -89.37% | -124.90% | 0.61 | 0.84 | -0.104% | -0.197 | +164.15% | n/a | 17/26/0 | 579/624 |
| direct_2of3_spread0p50 | 1204 | 43 | -89.37% | -124.90% | 0.61 | 0.84 | -0.104% | -0.197 | +164.15% | n/a | 17/26/0 | 579/624 |
| direct_raw_delta_spread0p25 | 906 | 43 | -43.98% | -56.47% | 0.71 | 0.90 | -0.062% | -0.139 | +80.39% | n/a | 20/23/0 | 449/456 |
| direct_raw_delta_spread0p50 | 906 | 43 | -43.98% | -56.47% | 0.71 | 0.90 | -0.062% | -0.139 | +80.39% | n/a | 20/23/0 | 449/456 |
| direct_min_leg_ratio0p50 | 1195 | 43 | -72.74% | -108.66% | 0.65 | 0.86 | -0.091% | -0.172 | +153.37% | n/a | 18/25/0 | 579/615 |
| direct_min_leg_ratio0p66 | 1172 | 43 | -67.26% | -97.25% | 0.67 | 0.87 | -0.083% | -0.155 | +146.02% | n/a | 19/24/0 | 571/600 |
| direct_min_leg_ratio0p75 | 1153 | 43 | -67.18% | -95.00% | 0.68 | 0.87 | -0.082% | -0.152 | +144.26% | n/a | 19/24/0 | 561/591 |
| direct_2of3_leg_ratio0p66 | 1188 | 43 | -82.23% | -111.02% | 0.64 | 0.85 | -0.093% | -0.177 | +156.81% | n/a | 18/25/0 | 576/611 |
| direct_2of3_leg_ratio0p75 | 1178 | 43 | -82.17% | -109.68% | 0.64 | 0.85 | -0.093% | -0.176 | +154.83% | n/a | 18/25/0 | 570/607 |
| direct_raw_delta_leg_ratio0p66 | 890 | 43 | -29.00% | -42.70% | 0.78 | 0.92 | -0.048% | -0.104 | +71.99% | n/a | 21/22/0 | 444/445 |
| direct_raw_delta_leg_ratio0p75 | 881 | 43 | -28.99% | -41.79% | 0.78 | 0.92 | -0.047% | -0.102 | +71.99% | n/a | 21/22/0 | 440/440 |

### Current Rule Contribution

| Rule tier | Trades | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| neutral_tier2_delta_persistence | 2 | 1/1 | -0.10% | -0.42% |
| neutral_tier3_oi_confirmed_delta_diff | 1 | 0/1 | -0.72% | -1.06% |
| neutral_tier1_directional_ratio | 575 | 285/289 | -25.47% | -34.91% |
| direct_opposed_bias | 626 | 293/333 | -63.08% | -88.51% |

## clean 2020

Receipt: `app\reports\data-verification\weekly-hold-basket-baseline\fx-28pair-dealer-weekly-hold-baseline-52w-20260615-001931.json`

Window: 2020-01-01 through 2020-12-31 (52 weeks).

### Direct-Rule Agreement Checks

| Direct rows | Ratio agrees | Ratio disagrees | Ratio missing | Delta agrees | Delta disagrees | Delta missing | Signed spread agrees | Signed spread disagrees | Signed spread missing | Net-spread agrees | Net-spread disagrees | Net-spread missing | Spread clean >=0.25 | Spread clean >=0.50 | Min leg ratio >=0.50 | Min leg ratio >=0.66 | Min leg ratio >=0.75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 677 | 322 | 321 | 34 | 392 | 285 | 0 | 677 | 0 | 0 | 676 | 0 | 1 | 677 | 676 | 641 | 638 | 624 |

### Variant Summary

| Variant | Trades | Active weeks | Raw | ADR | Weekly PF | Trade PF | Expectancy/trade | Weekly Sharpe-style | Weekly DD | DD/return | Weekly W/L/F | Trade W/L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 1456 | 52 | +28.78% | +118.30% | 1.45 | 1.15 | +0.081% | 0.142 | +89.27% | 0.755 | 29/23/0 | 786/670 |
| neutral_only | 779 | 52 | +96.28% | +116.79% | 1.94 | 1.31 | +0.150% | 0.248 | +22.28% | 0.191 | 30/22/0 | 430/349 |
| direct_only | 677 | 52 | -67.50% | +1.52% | 1.01 | 1.00 | +0.002% | 0.002 | +127.08% | 83.856 | 28/24/0 | 356/321 |
| direct_inverted | 1456 | 52 | +163.78% | +115.27% | 1.40 | 1.15 | +0.079% | 0.111 | +61.56% | 0.534 | 28/24/0 | 751/705 |
| direct_ratio_confirmed | 1101 | 52 | +51.84% | +116.34% | 1.71 | 1.20 | +0.106% | 0.204 | +37.53% | 0.323 | 29/23/0 | 586/515 |
| direct_ratio_override | 1422 | 52 | +69.71% | +118.62% | 1.67 | 1.16 | +0.083% | 0.201 | +54.06% | 0.456 | 26/26/0 | 725/697 |
| ratio_direction_all | 1405 | 52 | +61.51% | +112.27% | 1.61 | 1.15 | +0.080% | 0.189 | +55.79% | 0.497 | 26/26/0 | 714/691 |
| direct_delta_confirmed | 1171 | 52 | +20.21% | +75.69% | 1.38 | 1.12 | +0.065% | 0.121 | +52.58% | 0.695 | 26/26/0 | 630/541 |
| direct_delta_override | 1456 | 52 | +11.64% | +33.07% | 1.15 | 1.04 | +0.023% | 0.055 | +55.84% | 1.689 | 27/25/0 | 759/697 |
| delta_direction_all | 1456 | 52 | -144.32% | -167.62% | 0.57 | 0.82 | -0.115% | -0.224 | +183.60% | n/a | 22/30/0 | 685/771 |
| direct_signed_spread_confirmed | 1456 | 52 | +28.78% | +118.30% | 1.45 | 1.15 | +0.081% | 0.142 | +89.27% | 0.755 | 29/23/0 | 786/670 |
| direct_signed_spread_override | 1456 | 52 | +28.78% | +118.30% | 1.45 | 1.15 | +0.081% | 0.142 | +89.27% | 0.755 | 29/23/0 | 786/670 |
| signed_spread_all | 1439 | 52 | -41.94% | +49.48% | 1.15 | 1.06 | +0.034% | 0.050 | +142.23% | 2.875 | 33/19/0 | 746/693 |
| signed_spread_all_min0p25 | 744 | 52 | -59.79% | +12.20% | 1.04 | 1.03 | +0.016% | 0.015 | +119.59% | 9.805 | 28/24/0 | 392/352 |
| signed_spread_all_min0p50 | 720 | 52 | -67.16% | +2.59% | 1.01 | 1.01 | +0.004% | 0.003 | +120.95% | 46.629 | 27/25/0 | 376/344 |
| direct_subtractive_spread_confirmed | 1455 | 52 | +27.39% | +117.12% | 1.45 | 1.15 | +0.080% | 0.140 | +89.27% | 0.762 | 29/23/0 | 785/670 |
| direct_subtractive_spread_override | 1455 | 52 | +27.39% | +117.12% | 1.45 | 1.15 | +0.080% | 0.140 | +89.27% | 0.762 | 29/23/0 | 785/670 |
| subtractive_spread_all | 1453 | 52 | -79.27% | +0.68% | 1.00 | 1.00 | +0.000% | 0.001 | +110.51% | 163.398 | 26/26/0 | 725/728 |
| direct_2of3_spread0p25 | 1456 | 52 | +28.78% | +118.30% | 1.45 | 1.15 | +0.081% | 0.142 | +89.27% | 0.755 | 29/23/0 | 786/670 |
| direct_2of3_spread0p50 | 1456 | 52 | +28.78% | +118.30% | 1.45 | 1.15 | +0.081% | 0.142 | +89.27% | 0.755 | 29/23/0 | 786/670 |
| direct_raw_delta_spread0p25 | 1171 | 52 | +20.21% | +75.69% | 1.38 | 1.12 | +0.065% | 0.121 | +52.58% | 0.695 | 26/26/0 | 630/541 |
| direct_raw_delta_spread0p50 | 1170 | 52 | +18.82% | +74.51% | 1.37 | 1.12 | +0.064% | 0.118 | +52.58% | 0.706 | 26/26/0 | 629/541 |
| direct_min_leg_ratio0p50 | 1420 | 52 | +20.91% | +108.73% | 1.41 | 1.14 | +0.077% | 0.132 | +87.98% | 0.809 | 29/23/0 | 763/657 |
| direct_min_leg_ratio0p66 | 1417 | 52 | +23.38% | +112.35% | 1.43 | 1.15 | +0.079% | 0.136 | +87.98% | 0.783 | 29/23/0 | 762/655 |
| direct_min_leg_ratio0p75 | 1403 | 52 | +19.14% | +107.38% | 1.40 | 1.14 | +0.077% | 0.130 | +87.98% | 0.819 | 29/23/0 | 753/650 |
| direct_2of3_leg_ratio0p66 | 1441 | 52 | +23.87% | +114.84% | 1.44 | 1.15 | +0.080% | 0.139 | +89.27% | 0.777 | 29/23/0 | 776/665 |
| direct_2of3_leg_ratio0p75 | 1433 | 52 | +22.63% | +111.25% | 1.42 | 1.15 | +0.078% | 0.134 | +89.27% | 0.802 | 29/23/0 | 771/662 |
| direct_raw_delta_leg_ratio0p66 | 1147 | 52 | +19.73% | +73.20% | 1.36 | 1.12 | +0.064% | 0.117 | +53.72% | 0.734 | 26/26/0 | 616/531 |
| direct_raw_delta_leg_ratio0p75 | 1141 | 52 | +16.73% | +71.81% | 1.35 | 1.11 | +0.063% | 0.115 | +53.72% | 0.748 | 26/26/0 | 612/529 |

### Current Rule Contribution

| Rule tier | Trades | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| neutral_tier1_directional_ratio | 762 | 419/343 | +88.09% | +110.44% |
| neutral_tier3_oi_confirmed_delta_diff | 2 | 2/0 | +5.35% | +3.23% |
| direct_opposed_bias | 677 | 356/321 | -67.50% | +1.52% |
| neutral_tier2_delta_persistence | 9 | 4/5 | +1.25% | +1.19% |
| neutral_tier3_oi_confirmed_delta | 3 | 2/1 | +0.86% | +1.05% |
| neutral_tier4_raw_delta_diff | 3 | 3/0 | +0.73% | +0.87% |

## clean 2021

Receipt: `app\reports\data-verification\weekly-hold-basket-baseline\fx-28pair-dealer-weekly-hold-baseline-52w-20260615-001954.json`

Window: 2021-01-01 through 2021-12-31 (52 weeks).

### Direct-Rule Agreement Checks

| Direct rows | Ratio agrees | Ratio disagrees | Ratio missing | Delta agrees | Delta disagrees | Delta missing | Signed spread agrees | Signed spread disagrees | Signed spread missing | Net-spread agrees | Net-spread disagrees | Net-spread missing | Spread clean >=0.25 | Spread clean >=0.50 | Min leg ratio >=0.50 | Min leg ratio >=0.66 | Min leg ratio >=0.75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 634 | 270 | 340 | 24 | 359 | 275 | 0 | 634 | 0 | 0 | 634 | 0 | 0 | 634 | 634 | 612 | 596 | 583 |

### Variant Summary

| Variant | Trades | Active weeks | Raw | ADR | Weekly PF | Trade PF | Expectancy/trade | Weekly Sharpe-style | Weekly DD | DD/return | Weekly W/L/F | Trade W/L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 1456 | 52 | -37.00% | -81.13% | 0.68 | 0.90 | -0.056% | -0.151 | +97.75% | n/a | 25/27/0 | 697/758 |
| neutral_only | 822 | 52 | +28.98% | +39.17% | 1.28 | 1.10 | +0.048% | 0.088 | +65.91% | 1.683 | 26/26/0 | 404/417 |
| direct_only | 634 | 52 | -65.98% | -120.29% | 0.48 | 0.70 | -0.190% | -0.268 | +126.96% | n/a | 22/30/0 | 293/341 |
| direct_inverted | 1456 | 52 | +94.96% | +159.46% | 1.92 | 1.23 | +0.110% | 0.222 | +54.73% | 0.343 | 30/22/0 | 745/710 |
| direct_ratio_confirmed | 1092 | 52 | +5.89% | +4.58% | 1.02 | 1.01 | +0.004% | 0.009 | +73.35% | 16.018 | 26/26/0 | 534/557 |
| direct_ratio_override | 1432 | 52 | +45.75% | +85.16% | 1.43 | 1.12 | +0.059% | 0.135 | +49.65% | 0.583 | 29/23/0 | 722/709 |
| ratio_direction_all | 1412 | 52 | +39.09% | +77.91% | 1.39 | 1.11 | +0.055% | 0.126 | +49.65% | 0.637 | 28/24/0 | 710/701 |
| direct_delta_confirmed | 1181 | 52 | -18.21% | -36.88% | 0.83 | 0.94 | -0.031% | -0.068 | +85.33% | n/a | 21/31/0 | 562/618 |
| direct_delta_override | 1456 | 52 | +0.57% | +7.37% | 1.03 | 1.01 | +0.005% | 0.011 | +73.20% | 9.927 | 26/26/0 | 702/753 |
| delta_direction_all | 1456 | 52 | +53.75% | +86.61% | 1.36 | 1.12 | +0.059% | 0.119 | +101.66% | 1.174 | 26/26/0 | 746/709 |
| direct_signed_spread_confirmed | 1456 | 52 | -37.00% | -81.13% | 0.68 | 0.90 | -0.056% | -0.151 | +97.75% | n/a | 25/27/0 | 697/758 |
| direct_signed_spread_override | 1456 | 52 | -37.00% | -81.13% | 0.68 | 0.90 | -0.056% | -0.151 | +97.75% | n/a | 25/27/0 | 697/758 |
| signed_spread_all | 1436 | 52 | -52.02% | -106.28% | 0.61 | 0.87 | -0.074% | -0.191 | +122.40% | n/a | 23/29/0 | 693/742 |
| signed_spread_all_min0p25 | 695 | 52 | -56.39% | -106.18% | 0.52 | 0.75 | -0.153% | -0.244 | +112.84% | n/a | 22/30/0 | 327/368 |
| signed_spread_all_min0p50 | 650 | 52 | -59.14% | -107.69% | 0.51 | 0.73 | -0.166% | -0.249 | +114.36% | n/a | 23/29/0 | 305/345 |
| direct_subtractive_spread_confirmed | 1456 | 52 | -37.00% | -81.13% | 0.68 | 0.90 | -0.056% | -0.151 | +97.75% | n/a | 25/27/0 | 697/758 |
| direct_subtractive_spread_override | 1456 | 52 | -37.00% | -81.13% | 0.68 | 0.90 | -0.056% | -0.151 | +97.75% | n/a | 25/27/0 | 697/758 |
| subtractive_spread_all | 1455 | 52 | -73.04% | -122.43% | 0.50 | 0.85 | -0.084% | -0.253 | +122.43% | n/a | 23/29/0 | 686/768 |
| direct_2of3_spread0p25 | 1456 | 52 | -37.00% | -81.13% | 0.68 | 0.90 | -0.056% | -0.151 | +97.75% | n/a | 25/27/0 | 697/758 |
| direct_2of3_spread0p50 | 1456 | 52 | -37.00% | -81.13% | 0.68 | 0.90 | -0.056% | -0.151 | +97.75% | n/a | 25/27/0 | 697/758 |
| direct_raw_delta_spread0p25 | 1181 | 52 | -18.21% | -36.88% | 0.83 | 0.94 | -0.031% | -0.068 | +85.33% | n/a | 21/31/0 | 562/618 |
| direct_raw_delta_spread0p50 | 1181 | 52 | -18.21% | -36.88% | 0.83 | 0.94 | -0.031% | -0.068 | +85.33% | n/a | 21/31/0 | 562/618 |
| direct_min_leg_ratio0p50 | 1434 | 52 | -28.21% | -65.74% | 0.73 | 0.92 | -0.046% | -0.122 | +97.75% | n/a | 26/26/0 | 691/742 |
| direct_min_leg_ratio0p66 | 1418 | 52 | -22.10% | -58.60% | 0.75 | 0.92 | -0.041% | -0.110 | +97.03% | n/a | 26/26/0 | 685/732 |
| direct_min_leg_ratio0p75 | 1405 | 52 | -25.61% | -61.41% | 0.74 | 0.92 | -0.044% | -0.116 | +96.83% | n/a | 26/26/0 | 678/726 |
| direct_2of3_leg_ratio0p66 | 1440 | 52 | -28.09% | -65.82% | 0.73 | 0.92 | -0.046% | -0.122 | +97.03% | n/a | 25/27/0 | 694/745 |
| direct_2of3_leg_ratio0p75 | 1432 | 52 | -30.70% | -67.86% | 0.72 | 0.91 | -0.047% | -0.126 | +96.83% | n/a | 25/27/0 | 689/742 |
| direct_raw_delta_leg_ratio0p66 | 1159 | 52 | -12.22% | -29.66% | 0.86 | 0.95 | -0.026% | -0.056 | +85.33% | n/a | 22/30/0 | 553/605 |
| direct_raw_delta_leg_ratio0p75 | 1154 | 52 | -13.12% | -30.43% | 0.86 | 0.95 | -0.026% | -0.057 | +85.33% | n/a | 22/30/0 | 551/602 |

### Current Rule Contribution

| Rule tier | Trades | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| neutral_tier1_directional_ratio | 802 | 392/409 | +22.31% | +31.92% |
| neutral_tier2_delta_persistence | 16 | 10/6 | +6.31% | +7.43% |
| neutral_tier3_oi_confirmed_delta_diff | 1 | 1/0 | +1.46% | +1.67% |
| neutral_tier3_oi_confirmed_delta | 2 | 1/1 | -0.37% | -0.65% |
| neutral_tier4_raw_delta_diff | 1 | 0/1 | -0.74% | -1.21% |
| direct_opposed_bias | 634 | 293/341 | -65.98% | -120.29% |

## clean 2022

Receipt: `app\reports\data-verification\weekly-hold-basket-baseline\fx-28pair-dealer-weekly-hold-baseline-52w-20260615-002017.json`

Window: 2022-01-01 through 2022-12-31 (52 weeks).

### Direct-Rule Agreement Checks

| Direct rows | Ratio agrees | Ratio disagrees | Ratio missing | Delta agrees | Delta disagrees | Delta missing | Signed spread agrees | Signed spread disagrees | Signed spread missing | Net-spread agrees | Net-spread disagrees | Net-spread missing | Spread clean >=0.25 | Spread clean >=0.50 | Min leg ratio >=0.50 | Min leg ratio >=0.66 | Min leg ratio >=0.75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 735 | 413 | 295 | 27 | 383 | 352 | 0 | 735 | 0 | 0 | 735 | 0 | 0 | 735 | 735 | 730 | 720 | 706 |

### Variant Summary

| Variant | Trades | Active weeks | Raw | ADR | Weekly PF | Trade PF | Expectancy/trade | Weekly Sharpe-style | Weekly DD | DD/return | Weekly W/L/F | Trade W/L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 1456 | 52 | +165.06% | +208.66% | 2.27 | 1.31 | +0.143% | 0.317 | +56.51% | 0.271 | 32/20/0 | 796/660 |
| neutral_only | 721 | 52 | +92.03% | +101.48% | 2.41 | 1.31 | +0.141% | 0.306 | +16.37% | 0.161 | 35/17/0 | 393/328 |
| direct_only | 735 | 52 | +73.03% | +107.17% | 1.57 | 1.31 | +0.146% | 0.176 | +48.81% | 0.455 | 32/20/0 | 403/332 |
| direct_inverted | 1456 | 52 | +19.01% | -5.69% | 0.98 | 0.99 | -0.004% | -0.008 | +117.94% | n/a | 24/28/0 | 725/731 |
| direct_ratio_confirmed | 1134 | 52 | +168.12% | +211.64% | 2.99 | 1.42 | +0.187% | 0.413 | +36.23% | 0.171 | 33/19/0 | 634/500 |
| direct_ratio_override | 1429 | 52 | +173.19% | +218.14% | 2.88 | 1.33 | +0.153% | 0.388 | +32.04% | 0.147 | 35/17/0 | 781/648 |
| ratio_direction_all | 1420 | 52 | +173.76% | +218.40% | 2.87 | 1.33 | +0.154% | 0.384 | +35.08% | 0.161 | 35/17/0 | 776/644 |
| direct_delta_confirmed | 1104 | 52 | +113.07% | +145.24% | 2.40 | 1.28 | +0.132% | 0.326 | +40.28% | 0.277 | 33/19/0 | 611/493 |
| direct_delta_override | 1456 | 52 | +61.07% | +81.81% | 1.76 | 1.11 | +0.056% | 0.192 | +47.63% | 0.582 | 33/19/0 | 778/678 |
| delta_direction_all | 1456 | 52 | -10.34% | -2.77% | 0.99 | 1.00 | -0.002% | -0.005 | +89.79% | n/a | 24/28/0 | 746/710 |
| direct_signed_spread_confirmed | 1456 | 52 | +165.06% | +208.66% | 2.27 | 1.31 | +0.143% | 0.317 | +56.51% | 0.271 | 32/20/0 | 796/660 |
| direct_signed_spread_override | 1456 | 52 | +165.06% | +208.66% | 2.27 | 1.31 | +0.143% | 0.317 | +56.51% | 0.271 | 32/20/0 | 796/660 |
| signed_spread_all | 1447 | 52 | -6.01% | +32.70% | 1.11 | 1.04 | +0.023% | 0.040 | +91.54% | 2.799 | 27/25/0 | 734/713 |
| signed_spread_all_min0p25 | 747 | 52 | +77.26% | +113.50% | 1.61 | 1.32 | +0.152% | 0.185 | +48.81% | 0.430 | 30/22/0 | 409/338 |
| signed_spread_all_min0p50 | 737 | 52 | +71.26% | +105.24% | 1.56 | 1.30 | +0.143% | 0.172 | +48.81% | 0.464 | 31/21/0 | 403/334 |
| direct_subtractive_spread_confirmed | 1456 | 52 | +165.06% | +208.66% | 2.27 | 1.31 | +0.143% | 0.317 | +56.51% | 0.271 | 32/20/0 | 796/660 |
| direct_subtractive_spread_override | 1456 | 52 | +165.06% | +208.66% | 2.27 | 1.31 | +0.143% | 0.317 | +56.51% | 0.271 | 32/20/0 | 796/660 |
| subtractive_spread_all | 1456 | 52 | +50.12% | +75.41% | 1.28 | 1.10 | +0.052% | 0.095 | +89.05% | 1.181 | 31/21/0 | 752/704 |
| direct_2of3_spread0p25 | 1456 | 52 | +165.06% | +208.66% | 2.27 | 1.31 | +0.143% | 0.317 | +56.51% | 0.271 | 32/20/0 | 796/660 |
| direct_2of3_spread0p50 | 1456 | 52 | +165.06% | +208.66% | 2.27 | 1.31 | +0.143% | 0.317 | +56.51% | 0.271 | 32/20/0 | 796/660 |
| direct_raw_delta_spread0p25 | 1104 | 52 | +113.07% | +145.24% | 2.40 | 1.28 | +0.132% | 0.326 | +40.28% | 0.277 | 33/19/0 | 611/493 |
| direct_raw_delta_spread0p50 | 1104 | 52 | +113.07% | +145.24% | 2.40 | 1.28 | +0.132% | 0.326 | +40.28% | 0.277 | 33/19/0 | 611/493 |
| direct_min_leg_ratio0p50 | 1451 | 52 | +162.02% | +205.27% | 2.25 | 1.30 | +0.141% | 0.313 | +56.51% | 0.275 | 32/20/0 | 793/658 |
| direct_min_leg_ratio0p66 | 1441 | 52 | +168.52% | +210.52% | 2.28 | 1.31 | +0.146% | 0.320 | +56.51% | 0.268 | 32/20/0 | 789/652 |
| direct_min_leg_ratio0p75 | 1427 | 52 | +169.82% | +211.21% | 2.28 | 1.32 | +0.148% | 0.317 | +56.51% | 0.268 | 32/20/0 | 782/645 |
| direct_2of3_leg_ratio0p66 | 1447 | 52 | +171.23% | +213.36% | 2.30 | 1.32 | +0.147% | 0.324 | +56.51% | 0.265 | 32/20/0 | 793/654 |
| direct_2of3_leg_ratio0p75 | 1442 | 52 | +167.20% | +209.52% | 2.27 | 1.31 | +0.145% | 0.319 | +56.51% | 0.270 | 32/20/0 | 789/653 |
| direct_raw_delta_leg_ratio0p66 | 1098 | 52 | +110.36% | +142.40% | 2.38 | 1.27 | +0.130% | 0.322 | +40.28% | 0.283 | 33/19/0 | 607/491 |
| direct_raw_delta_leg_ratio0p75 | 1089 | 52 | +115.69% | +146.93% | 2.42 | 1.29 | +0.135% | 0.322 | +40.28% | 0.274 | 33/19/0 | 604/485 |

### Current Rule Contribution

| Rule tier | Trades | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| direct_opposed_bias | 735 | 403/332 | +73.03% | +107.17% |
| neutral_tier1_directional_ratio | 712 | 388/324 | +92.60% | +101.74% |
| neutral_tier2_delta_persistence | 7 | 4/3 | +0.43% | +0.75% |
| neutral_tier4_raw_delta_diff | 1 | 1/0 | +0.35% | +0.44% |
| neutral_tier3_oi_confirmed_delta | 1 | 0/1 | -1.35% | -1.45% |

## clean 2023

Receipt: `app\reports\data-verification\weekly-hold-basket-baseline\fx-28pair-dealer-weekly-hold-baseline-45w-20260615-002037.json`

Window: 2023-01-01 through 2023-12-31 (45 weeks).

### Direct-Rule Agreement Checks

| Direct rows | Ratio agrees | Ratio disagrees | Ratio missing | Delta agrees | Delta disagrees | Delta missing | Signed spread agrees | Signed spread disagrees | Signed spread missing | Net-spread agrees | Net-spread disagrees | Net-spread missing | Spread clean >=0.25 | Spread clean >=0.50 | Min leg ratio >=0.50 | Min leg ratio >=0.66 | Min leg ratio >=0.75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 630 | 360 | 250 | 20 | 344 | 286 | 0 | 630 | 0 | 0 | 630 | 0 | 0 | 630 | 630 | 609 | 586 | 571 |

### Variant Summary

| Variant | Trades | Active weeks | Raw | ADR | Weekly PF | Trade PF | Expectancy/trade | Weekly Sharpe-style | Weekly DD | DD/return | Weekly W/L/F | Trade W/L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 1260 | 45 | +5.03% | -21.13% | 0.92 | 0.97 | -0.017% | -0.034 | +91.00% | n/a | 21/24/0 | 617/643 |
| neutral_only | 630 | 45 | -2.84% | -10.45% | 0.91 | 0.97 | -0.017% | -0.036 | +47.77% | n/a | 25/20/0 | 310/320 |
| direct_only | 630 | 45 | +7.87% | -10.68% | 0.95 | 0.97 | -0.017% | -0.020 | +81.15% | n/a | 21/24/0 | 307/323 |
| direct_inverted | 1260 | 45 | -10.71% | +0.22% | 1.00 | 1.00 | +0.000% | 0.000 | +95.21% | 423.739 | 25/20/0 | 633/627 |
| direct_ratio_confirmed | 990 | 45 | -24.66% | -57.33% | 0.75 | 0.90 | -0.058% | -0.114 | +86.58% | n/a | 23/22/0 | 477/513 |
| direct_ratio_override | 1240 | 45 | -53.79% | -91.49% | 0.61 | 0.87 | -0.074% | -0.186 | +97.61% | n/a | 18/27/0 | 596/644 |
| ratio_direction_all | 1236 | 45 | -55.32% | -93.63% | 0.60 | 0.87 | -0.076% | -0.191 | +98.30% | n/a | 18/27/0 | 593/643 |
| direct_delta_confirmed | 974 | 45 | -31.07% | -56.36% | 0.73 | 0.90 | -0.058% | -0.120 | +99.76% | n/a | 20/25/0 | 468/506 |
| direct_delta_override | 1260 | 45 | -67.17% | -91.60% | 0.56 | 0.87 | -0.073% | -0.215 | +140.62% | n/a | 21/24/0 | 605/655 |
| delta_direction_all | 1260 | 45 | -179.21% | -223.25% | 0.32 | 0.71 | -0.177% | -0.425 | +233.92% | n/a | 13/32/0 | 566/694 |
| direct_signed_spread_confirmed | 1260 | 45 | +5.03% | -21.13% | 0.92 | 0.97 | -0.017% | -0.034 | +91.00% | n/a | 21/24/0 | 617/643 |
| direct_signed_spread_override | 1260 | 45 | +5.03% | -21.13% | 0.92 | 0.97 | -0.017% | -0.034 | +91.00% | n/a | 21/24/0 | 617/643 |
| signed_spread_all | 1256 | 45 | +12.28% | +0.73% | 1.00 | 1.00 | +0.001% | 0.001 | +94.94% | 129.893 | 21/24/0 | 634/622 |
| signed_spread_all_min0p25 | 684 | 45 | -5.51% | -30.02% | 0.87 | 0.92 | -0.044% | -0.055 | +95.30% | n/a | 20/25/0 | 327/357 |
| signed_spread_all_min0p50 | 649 | 45 | +6.81% | -12.79% | 0.94 | 0.96 | -0.020% | -0.024 | +85.32% | n/a | 21/24/0 | 317/332 |
| direct_subtractive_spread_confirmed | 1260 | 45 | +5.03% | -21.13% | 0.92 | 0.97 | -0.017% | -0.034 | +91.00% | n/a | 21/24/0 | 617/643 |
| direct_subtractive_spread_override | 1260 | 45 | +5.03% | -21.13% | 0.92 | 0.97 | -0.017% | -0.034 | +91.00% | n/a | 21/24/0 | 617/643 |
| subtractive_spread_all | 1260 | 45 | +13.76% | -9.86% | 0.96 | 0.99 | -0.008% | -0.016 | +76.30% | n/a | 19/26/0 | 631/629 |
| direct_2of3_spread0p25 | 1260 | 45 | +5.03% | -21.13% | 0.92 | 0.97 | -0.017% | -0.034 | +91.00% | n/a | 21/24/0 | 617/643 |
| direct_2of3_spread0p50 | 1260 | 45 | +5.03% | -21.13% | 0.92 | 0.97 | -0.017% | -0.034 | +91.00% | n/a | 21/24/0 | 617/643 |
| direct_raw_delta_spread0p25 | 974 | 45 | -31.07% | -56.36% | 0.73 | 0.90 | -0.058% | -0.120 | +99.76% | n/a | 20/25/0 | 468/506 |
| direct_raw_delta_spread0p50 | 974 | 45 | -31.07% | -56.36% | 0.73 | 0.90 | -0.058% | -0.120 | +99.76% | n/a | 20/25/0 | 468/506 |
| direct_min_leg_ratio0p50 | 1239 | 45 | +2.47% | -24.65% | 0.90 | 0.96 | -0.020% | -0.040 | +91.72% | n/a | 22/23/0 | 609/630 |
| direct_min_leg_ratio0p66 | 1216 | 45 | -7.02% | -35.06% | 0.86 | 0.95 | -0.029% | -0.058 | +90.75% | n/a | 21/24/0 | 593/623 |
| direct_min_leg_ratio0p75 | 1201 | 45 | -2.68% | -34.08% | 0.86 | 0.95 | -0.028% | -0.058 | +90.75% | n/a | 21/24/0 | 586/615 |
| direct_2of3_leg_ratio0p66 | 1243 | 45 | -3.52% | -29.73% | 0.88 | 0.96 | -0.024% | -0.049 | +90.02% | n/a | 21/24/0 | 607/636 |
| direct_2of3_leg_ratio0p75 | 1237 | 45 | +3.88% | -24.64% | 0.90 | 0.96 | -0.020% | -0.041 | +90.02% | n/a | 21/24/0 | 605/632 |
| direct_raw_delta_leg_ratio0p66 | 947 | 45 | -34.56% | -61.69% | 0.70 | 0.89 | -0.065% | -0.134 | +101.33% | n/a | 20/25/0 | 454/493 |
| direct_raw_delta_leg_ratio0p75 | 938 | 45 | -37.63% | -65.81% | 0.69 | 0.88 | -0.070% | -0.146 | +105.45% | n/a | 19/26/0 | 449/489 |

### Current Rule Contribution

| Rule tier | Trades | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| neutral_tier2_delta_persistence | 2 | 2/0 | +1.30% | +1.76% |
| neutral_tier3_oi_confirmed_delta_diff | 1 | 1/0 | +0.39% | +0.61% |
| neutral_tier3_oi_confirmed_delta | 1 | 0/1 | -0.15% | -0.24% |
| direct_opposed_bias | 630 | 307/323 | +7.87% | -10.68% |
| neutral_tier1_directional_ratio | 626 | 307/319 | -4.37% | -12.59% |

## 2024

Receipt: `app\reports\data-verification\weekly-hold-basket-baseline\fx-28pair-dealer-weekly-hold-baseline-52w-20260614-182222.json`

Window: 2024-01-09 through 2024-12-31 (52 weeks).

### Direct-Rule Agreement Checks

| Direct rows | Ratio agrees | Ratio disagrees | Ratio missing | Delta agrees | Delta disagrees | Delta missing | Signed spread agrees | Signed spread disagrees | Signed spread missing | Net-spread agrees | Net-spread disagrees | Net-spread missing | Spread clean >=0.25 | Spread clean >=0.50 | Min leg ratio >=0.50 | Min leg ratio >=0.66 | Min leg ratio >=0.75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 748 | 361 | 380 | 7 | 396 | 352 | 0 | 748 | 0 | 0 | 747 | 0 | 1 | 748 | 747 | 692 | 662 | 633 |

### Variant Summary

| Variant | Trades | Active weeks | Raw | ADR | Weekly PF | Trade PF | Expectancy/trade | Weekly Sharpe-style | Weekly DD | DD/return | Weekly W/L/F | Trade W/L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 1456 | 52 | -123.59% | -169.48% | 0.49 | 0.81 | -0.116% | -0.269 | +228.08% | n/a | 22/30/0 | 696/760 |
| neutral_only | 708 | 52 | +7.92% | +4.00% | 1.03 | 1.01 | +0.006% | 0.010 | +46.77% | 11.687 | 25/27/0 | 345/363 |
| direct_only | 748 | 52 | -131.51% | -173.48% | 0.39 | 0.66 | -0.232% | -0.336 | +195.16% | n/a | 20/32/0 | 351/397 |
| direct_inverted | 1456 | 52 | +139.43% | +177.48% | 1.98 | 1.24 | +0.122% | 0.267 | +39.83% | 0.224 | 33/19/0 | 742/714 |
| direct_ratio_confirmed | 1069 | 52 | -9.84% | -19.89% | 0.91 | 0.97 | -0.019% | -0.035 | +105.42% | n/a | 22/30/0 | 535/534 |
| direct_ratio_override | 1449 | 52 | +101.52% | +127.88% | 1.62 | 1.17 | +0.088% | 0.178 | +85.33% | 0.667 | 30/22/0 | 757/692 |
| ratio_direction_all | 1443 | 52 | +101.20% | +127.26% | 1.61 | 1.17 | +0.088% | 0.177 | +84.86% | 0.667 | 30/22/0 | 753/690 |
| direct_delta_confirmed | 1104 | 52 | -72.46% | -101.16% | 0.59 | 0.85 | -0.092% | -0.201 | +160.99% | n/a | 22/30/0 | 521/583 |
| direct_delta_override | 1456 | 52 | -21.33% | -32.83% | 0.85 | 0.96 | -0.023% | -0.059 | +96.85% | n/a | 23/29/0 | 698/758 |
| delta_direction_all | 1456 | 52 | -45.68% | -60.70% | 0.79 | 0.93 | -0.042% | -0.092 | +117.83% | n/a | 25/27/0 | 695/761 |
| direct_signed_spread_confirmed | 1456 | 52 | -123.59% | -169.48% | 0.49 | 0.81 | -0.116% | -0.269 | +228.08% | n/a | 22/30/0 | 696/760 |
| direct_signed_spread_override | 1456 | 52 | -123.59% | -169.48% | 0.49 | 0.81 | -0.116% | -0.269 | +228.08% | n/a | 22/30/0 | 696/760 |
| signed_spread_all | 1450 | 52 | -159.55% | -218.74% | 0.43 | 0.77 | -0.151% | -0.318 | +272.63% | n/a | 21/31/0 | 694/756 |
| signed_spread_all_min0p25 | 848 | 52 | -106.84% | -136.78% | 0.51 | 0.75 | -0.161% | -0.247 | +200.50% | n/a | 23/29/0 | 419/429 |
| signed_spread_all_min0p50 | 780 | 52 | -129.45% | -166.53% | 0.42 | 0.68 | -0.214% | -0.316 | +198.53% | n/a | 21/31/0 | 371/409 |
| direct_subtractive_spread_confirmed | 1455 | 52 | -124.78% | -170.95% | 0.48 | 0.81 | -0.117% | -0.272 | +228.08% | n/a | 22/30/0 | 695/760 |
| direct_subtractive_spread_override | 1455 | 52 | -124.78% | -170.95% | 0.48 | 0.81 | -0.117% | -0.272 | +228.08% | n/a | 22/30/0 | 695/760 |
| subtractive_spread_all | 1451 | 52 | -75.71% | -78.83% | 0.70 | 0.91 | -0.054% | -0.142 | +141.25% | n/a | 27/25/0 | 743/708 |
| direct_2of3_spread0p25 | 1456 | 52 | -123.59% | -169.48% | 0.49 | 0.81 | -0.116% | -0.269 | +228.08% | n/a | 22/30/0 | 696/760 |
| direct_2of3_spread0p50 | 1456 | 52 | -123.59% | -169.48% | 0.49 | 0.81 | -0.116% | -0.269 | +228.08% | n/a | 22/30/0 | 696/760 |
| direct_raw_delta_spread0p25 | 1104 | 52 | -72.46% | -101.16% | 0.59 | 0.85 | -0.092% | -0.201 | +160.99% | n/a | 22/30/0 | 521/583 |
| direct_raw_delta_spread0p50 | 1103 | 52 | -73.65% | -102.63% | 0.58 | 0.85 | -0.093% | -0.205 | +160.99% | n/a | 22/30/0 | 520/583 |
| direct_min_leg_ratio0p50 | 1400 | 52 | -110.75% | -146.27% | 0.53 | 0.83 | -0.104% | -0.232 | +213.48% | n/a | 24/28/0 | 673/727 |
| direct_min_leg_ratio0p66 | 1370 | 52 | -101.79% | -135.42% | 0.57 | 0.84 | -0.099% | -0.208 | +216.50% | n/a | 23/29/0 | 662/708 |
| direct_min_leg_ratio0p75 | 1341 | 52 | -103.15% | -137.40% | 0.55 | 0.84 | -0.102% | -0.216 | +223.39% | n/a | 24/28/0 | 648/693 |
| direct_2of3_leg_ratio0p66 | 1424 | 52 | -120.95% | -161.68% | 0.50 | 0.82 | -0.114% | -0.257 | +230.01% | n/a | 22/30/0 | 680/744 |
| direct_2of3_leg_ratio0p75 | 1410 | 52 | -120.43% | -160.18% | 0.51 | 0.82 | -0.114% | -0.254 | +235.52% | n/a | 22/30/0 | 674/736 |
| direct_raw_delta_leg_ratio0p66 | 1050 | 52 | -53.30% | -74.90% | 0.67 | 0.88 | -0.071% | -0.146 | +147.47% | n/a | 22/30/0 | 503/547 |
| direct_raw_delta_leg_ratio0p75 | 1035 | 52 | -55.18% | -78.38% | 0.65 | 0.88 | -0.076% | -0.156 | +148.86% | n/a | 21/31/0 | 495/540 |

### Current Rule Contribution

| Rule tier | Trades | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| neutral_tier1_directional_ratio | 702 | 341/361 | +7.60% | +3.39% |
| neutral_tier3_oi_confirmed_delta_diff | 3 | 3/0 | +2.46% | +3.35% |
| neutral_tier2_delta_persistence | 2 | 1/1 | -0.30% | -0.47% |
| neutral_tier3_oi_confirmed_delta | 1 | 0/1 | -1.84% | -2.26% |
| direct_opposed_bias | 748 | 351/397 | -131.51% | -173.48% |

## clean 2025

Receipt: `app\reports\data-verification\weekly-hold-basket-baseline\fx-28pair-dealer-weekly-hold-baseline-39w-20260614-181048.json`

Window: 2025-01-06 through 2025-09-29 (39 weeks).

### Direct-Rule Agreement Checks

| Direct rows | Ratio agrees | Ratio disagrees | Ratio missing | Delta agrees | Delta disagrees | Delta missing | Signed spread agrees | Signed spread disagrees | Signed spread missing | Net-spread agrees | Net-spread disagrees | Net-spread missing | Spread clean >=0.25 | Spread clean >=0.50 | Min leg ratio >=0.50 | Min leg ratio >=0.66 | Min leg ratio >=0.75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 556 | 190 | 353 | 13 | 325 | 231 | 0 | 556 | 0 | 0 | 555 | 0 | 1 | 556 | 556 | 545 | 537 | 515 |

### Variant Summary

| Variant | Trades | Active weeks | Raw | ADR | Weekly PF | Trade PF | Expectancy/trade | Weekly Sharpe-style | Weekly DD | DD/return | Weekly W/L/F | Trade W/L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 1092 | 39 | -11.14% | +21.33% | 1.14 | 1.04 | +0.020% | 0.044 | +61.46% | 2.881 | 16/23/0 | 531/561 |
| neutral_only | 536 | 39 | +2.43% | +5.64% | 1.06 | 1.02 | +0.011% | 0.024 | +38.70% | 6.867 | 19/20/0 | 265/271 |
| direct_only | 556 | 39 | -13.57% | +15.70% | 1.12 | 1.06 | +0.028% | 0.040 | +55.57% | 3.540 | 22/17/0 | 266/290 |
| direct_inverted | 1092 | 39 | +16.01% | -10.06% | 0.94 | 0.98 | -0.009% | -0.023 | +49.47% | n/a | 19/20/0 | 555/537 |
| direct_ratio_confirmed | 726 | 39 | -9.96% | +5.41% | 1.04 | 1.01 | +0.007% | 0.016 | +53.32% | 9.850 | 18/21/0 | 356/370 |
| direct_ratio_override | 1079 | 39 | -15.30% | -18.30% | 0.89 | 0.97 | -0.017% | -0.045 | +54.67% | n/a | 17/22/0 | 537/542 |
| ratio_direction_all | 1053 | 39 | -19.23% | -22.24% | 0.87 | 0.96 | -0.021% | -0.054 | +57.93% | n/a | 17/22/0 | 524/529 |
| direct_delta_confirmed | 861 | 39 | +20.69% | +58.08% | 1.53 | 1.14 | +0.067% | 0.150 | +39.66% | 0.683 | 18/21/0 | 429/432 |
| direct_delta_override | 1092 | 39 | +52.53% | +94.82% | 2.04 | 1.19 | +0.087% | 0.250 | +32.50% | 0.343 | 21/18/0 | 558/534 |
| delta_direction_all | 1092 | 39 | +47.29% | +96.95% | 1.86 | 1.19 | +0.089% | 0.215 | +23.62% | 0.244 | 18/21/0 | 552/540 |
| direct_signed_spread_confirmed | 1092 | 39 | -11.14% | +21.33% | 1.14 | 1.04 | +0.020% | 0.044 | +61.46% | 2.881 | 16/23/0 | 531/561 |
| direct_signed_spread_override | 1092 | 39 | -11.14% | +21.33% | 1.14 | 1.04 | +0.020% | 0.044 | +61.46% | 2.881 | 16/23/0 | 531/561 |
| signed_spread_all | 1066 | 39 | -34.15% | -6.44% | 0.96 | 0.99 | -0.006% | -0.015 | +75.05% | n/a | 18/21/0 | 522/544 |
| signed_spread_all_min0p25 | 590 | 39 | -26.40% | -5.22% | 0.96 | 0.98 | -0.009% | -0.013 | +57.26% | n/a | 21/18/0 | 278/312 |
| signed_spread_all_min0p50 | 564 | 39 | -16.04% | +11.76% | 1.09 | 1.04 | +0.021% | 0.030 | +55.57% | 4.725 | 22/17/0 | 269/295 |
| direct_subtractive_spread_confirmed | 1091 | 39 | -11.97% | +20.18% | 1.13 | 1.04 | +0.018% | 0.042 | +61.46% | 3.046 | 16/23/0 | 530/561 |
| direct_subtractive_spread_override | 1091 | 39 | -11.97% | +20.18% | 1.13 | 1.04 | +0.018% | 0.042 | +61.46% | 3.046 | 16/23/0 | 530/561 |
| subtractive_spread_all | 1091 | 39 | +22.92% | +60.82% | 1.46 | 1.12 | +0.056% | 0.132 | +34.57% | 0.568 | 21/18/0 | 550/541 |
| direct_2of3_spread0p25 | 1092 | 39 | -11.14% | +21.33% | 1.14 | 1.04 | +0.020% | 0.044 | +61.46% | 2.881 | 16/23/0 | 531/561 |
| direct_2of3_spread0p50 | 1092 | 39 | -11.14% | +21.33% | 1.14 | 1.04 | +0.020% | 0.044 | +61.46% | 2.881 | 16/23/0 | 531/561 |
| direct_raw_delta_spread0p25 | 861 | 39 | +20.69% | +58.08% | 1.53 | 1.14 | +0.067% | 0.150 | +39.66% | 0.683 | 18/21/0 | 429/432 |
| direct_raw_delta_spread0p50 | 861 | 39 | +20.69% | +58.08% | 1.53 | 1.14 | +0.067% | 0.150 | +39.66% | 0.683 | 18/21/0 | 429/432 |
| direct_min_leg_ratio0p50 | 1081 | 39 | -15.23% | +15.00% | 1.09 | 1.03 | +0.014% | 0.031 | +62.47% | 4.165 | 16/23/0 | 523/558 |
| direct_min_leg_ratio0p66 | 1073 | 39 | -19.37% | +7.36% | 1.05 | 1.01 | +0.007% | 0.016 | +63.79% | 8.669 | 16/23/0 | 517/556 |
| direct_min_leg_ratio0p75 | 1051 | 39 | -18.79% | +6.49% | 1.04 | 1.01 | +0.006% | 0.014 | +61.62% | 9.500 | 16/23/0 | 506/545 |
| direct_2of3_leg_ratio0p66 | 1087 | 39 | -13.28% | +17.87% | 1.11 | 1.03 | +0.016% | 0.037 | +61.52% | 3.443 | 16/23/0 | 527/560 |
| direct_2of3_leg_ratio0p75 | 1079 | 39 | -13.83% | +15.64% | 1.10 | 1.03 | +0.014% | 0.033 | +60.62% | 3.875 | 16/23/0 | 523/556 |
| direct_raw_delta_leg_ratio0p66 | 847 | 39 | +14.61% | +47.57% | 1.43 | 1.11 | +0.056% | 0.126 | +40.67% | 0.855 | 18/21/0 | 419/428 |
| direct_raw_delta_leg_ratio0p75 | 833 | 39 | +15.73% | +48.92% | 1.44 | 1.12 | +0.059% | 0.130 | +40.67% | 0.831 | 18/21/0 | 412/421 |

### Current Rule Contribution

| Rule tier | Trades | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| direct_opposed_bias | 556 | 266/290 | -13.57% | +15.70% |
| neutral_tier2_delta_persistence | 10 | 6/4 | +3.37% | +3.99% |
| neutral_tier1_directional_ratio | 510 | 252/258 | -1.50% | +1.70% |
| neutral_tier3_oi_confirmed_delta | 6 | 2/4 | +0.11% | +0.19% |
| neutral_tier4_raw_delta_diff | 9 | 5/4 | +0.64% | +0.06% |
| neutral_tier3_oi_confirmed_delta_diff | 1 | 0/1 | -0.19% | -0.30% |

## current 2026

Receipt: `app\reports\data-verification\weekly-hold-basket-baseline\fx-28pair-dealer-weekly-hold-baseline-23w-20260614-223345.json`

Window: 2026-01-01 through 2026-06-08 (23 weeks).

### Direct-Rule Agreement Checks

| Direct rows | Ratio agrees | Ratio disagrees | Ratio missing | Delta agrees | Delta disagrees | Delta missing | Signed spread agrees | Signed spread disagrees | Signed spread missing | Net-spread agrees | Net-spread disagrees | Net-spread missing | Spread clean >=0.25 | Spread clean >=0.50 | Min leg ratio >=0.50 | Min leg ratio >=0.66 | Min leg ratio >=0.75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 347 | 170 | 172 | 5 | 195 | 152 | 0 | 347 | 0 | 0 | 347 | 0 | 0 | 347 | 347 | 330 | 296 | 276 |

### Variant Summary

| Variant | Trades | Active weeks | Raw | ADR | Weekly PF | Trade PF | Expectancy/trade | Weekly Sharpe-style | Weekly DD | DD/return | Weekly W/L/F | Trade W/L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 644 | 23 | +50.38% | +73.70% | 2.54 | 1.25 | +0.114% | 0.330 | +31.57% | 0.428 | 17/6/0 | 339/304 |
| neutral_only | 297 | 23 | +27.00% | +43.71% | 2.35 | 1.32 | +0.147% | 0.345 | +10.44% | 0.239 | 16/7/0 | 165/132 |
| direct_only | 347 | 23 | +23.38% | +29.99% | 1.57 | 1.19 | +0.086% | 0.164 | +28.03% | 0.935 | 13/10/0 | 174/172 |
| direct_inverted | 644 | 23 | +3.62% | +13.72% | 1.17 | 1.04 | +0.021% | 0.062 | +23.55% | 1.717 | 15/8/0 | 337/306 |
| direct_ratio_confirmed | 467 | 23 | +48.83% | +75.40% | 2.84 | 1.36 | +0.161% | 0.389 | +24.48% | 0.325 | 16/7/0 | 260/206 |
| direct_ratio_override | 639 | 23 | +45.36% | +74.22% | 2.28 | 1.25 | +0.116% | 0.345 | +26.43% | 0.356 | 16/7/0 | 355/283 |
| ratio_direction_all | 621 | 23 | +48.52% | +78.08% | 2.40 | 1.28 | +0.126% | 0.363 | +26.43% | 0.339 | 16/7/0 | 347/273 |
| direct_delta_confirmed | 492 | 23 | +49.64% | +74.25% | 2.69 | 1.35 | +0.151% | 0.388 | +27.92% | 0.376 | 15/8/0 | 270/222 |
| direct_delta_override | 644 | 23 | +48.89% | +74.81% | 2.33 | 1.25 | +0.116% | 0.349 | +24.27% | 0.324 | 14/9/0 | 352/291 |
| delta_direction_all | 644 | 23 | +24.17% | +41.69% | 1.50 | 1.13 | +0.065% | 0.172 | +54.27% | 1.302 | 14/9/0 | 338/305 |
| direct_signed_spread_confirmed | 644 | 23 | +50.38% | +73.70% | 2.54 | 1.25 | +0.114% | 0.330 | +31.57% | 0.428 | 17/6/0 | 339/304 |
| direct_signed_spread_override | 644 | 23 | +50.38% | +73.70% | 2.54 | 1.25 | +0.114% | 0.330 | +31.57% | 0.428 | 17/6/0 | 339/304 |
| signed_spread_all | 626 | 23 | +7.98% | +8.80% | 1.10 | 1.03 | +0.014% | 0.034 | +56.52% | 6.421 | 11/12/0 | 313/312 |
| signed_spread_all_min0p25 | 398 | 23 | +25.65% | +37.13% | 1.65 | 1.20 | +0.093% | 0.192 | +28.40% | 0.765 | 13/10/0 | 201/196 |
| signed_spread_all_min0p50 | 356 | 23 | +18.81% | +23.86% | 1.40 | 1.14 | +0.067% | 0.127 | +34.89% | 1.462 | 13/10/0 | 177/178 |
| direct_subtractive_spread_confirmed | 644 | 23 | +50.38% | +73.70% | 2.54 | 1.25 | +0.114% | 0.330 | +31.57% | 0.428 | 17/6/0 | 339/304 |
| direct_subtractive_spread_override | 644 | 23 | +50.38% | +73.70% | 2.54 | 1.25 | +0.114% | 0.330 | +31.57% | 0.428 | 17/6/0 | 339/304 |
| subtractive_spread_all | 643 | 23 | +3.94% | -11.04% | 0.88 | 0.97 | -0.017% | -0.054 | +31.20% | n/a | 11/12/0 | 318/324 |
| direct_2of3_spread0p25 | 644 | 23 | +50.38% | +73.70% | 2.54 | 1.25 | +0.114% | 0.330 | +31.57% | 0.428 | 17/6/0 | 339/304 |
| direct_2of3_spread0p50 | 644 | 23 | +50.38% | +73.70% | 2.54 | 1.25 | +0.114% | 0.330 | +31.57% | 0.428 | 17/6/0 | 339/304 |
| direct_raw_delta_spread0p25 | 492 | 23 | +49.64% | +74.25% | 2.69 | 1.35 | +0.151% | 0.388 | +27.92% | 0.376 | 15/8/0 | 270/222 |
| direct_raw_delta_spread0p50 | 492 | 23 | +49.64% | +74.25% | 2.69 | 1.35 | +0.151% | 0.388 | +27.92% | 0.376 | 15/8/0 | 270/222 |
| direct_min_leg_ratio0p50 | 627 | 23 | +48.67% | +69.83% | 2.52 | 1.24 | +0.111% | 0.318 | +31.57% | 0.452 | 18/5/0 | 332/294 |
| direct_min_leg_ratio0p66 | 593 | 23 | +51.45% | +76.03% | 2.84 | 1.28 | +0.128% | 0.359 | +31.74% | 0.417 | 18/5/0 | 318/274 |
| direct_min_leg_ratio0p75 | 573 | 23 | +54.56% | +82.26% | 3.49 | 1.31 | +0.144% | 0.443 | +23.00% | 0.280 | 18/5/0 | 307/265 |
| direct_2of3_leg_ratio0p66 | 617 | 23 | +51.24% | +74.68% | 2.68 | 1.26 | +0.121% | 0.345 | +32.27% | 0.432 | 18/5/0 | 327/289 |
| direct_2of3_leg_ratio0p75 | 610 | 23 | +52.18% | +75.69% | 2.70 | 1.27 | +0.124% | 0.348 | +32.27% | 0.426 | 18/5/0 | 324/285 |
| direct_raw_delta_leg_ratio0p66 | 468 | 23 | +49.85% | +75.60% | 2.86 | 1.37 | +0.162% | 0.407 | +27.39% | 0.362 | 16/7/0 | 261/207 |
| direct_raw_delta_leg_ratio0p75 | 455 | 23 | +52.02% | +80.82% | 3.40 | 1.42 | +0.178% | 0.499 | +18.65% | 0.231 | 15/8/0 | 253/202 |

### Current Rule Contribution

| Rule tier | Trades | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| neutral_tier1_directional_ratio | 279 | 157/122 | +30.16% | +47.56% |
| direct_opposed_bias | 347 | 174/172 | +23.38% | +29.99% |
| neutral_tier4_raw_delta_diff | 5 | 2/3 | +1.02% | +2.56% |
| neutral_tier3_oi_confirmed_delta | 4 | 3/1 | +1.89% | +2.39% |
| neutral_tier3_oi_confirmed_delta_diff | 1 | 0/1 | -1.03% | -1.90% |
| neutral_tier2_delta_persistence | 8 | 3/5 | -5.04% | -6.91% |

## clean 2025 + current 2026

Receipt: `app\reports\data-verification\weekly-hold-basket-baseline\fx-28pair-dealer-weekly-hold-baseline-62w-20260614-184050.json`

Window: 2025-01-06 through 2026-06-08 (62 weeks).

### Direct-Rule Agreement Checks

| Direct rows | Ratio agrees | Ratio disagrees | Ratio missing | Delta agrees | Delta disagrees | Delta missing | Signed spread agrees | Signed spread disagrees | Signed spread missing | Net-spread agrees | Net-spread disagrees | Net-spread missing | Spread clean >=0.25 | Spread clean >=0.50 | Min leg ratio >=0.50 | Min leg ratio >=0.66 | Min leg ratio >=0.75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 903 | 360 | 525 | 18 | 520 | 383 | 0 | 903 | 0 | 0 | 902 | 0 | 1 | 903 | 903 | 875 | 833 | 791 |

### Variant Summary

| Variant | Trades | Active weeks | Raw | ADR | Weekly PF | Trade PF | Expectancy/trade | Weekly Sharpe-style | Weekly DD | DD/return | Weekly W/L/F | Trade W/L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 1736 | 62 | +39.23% | +95.03% | 1.46 | 1.11 | +0.055% | 0.134 | +61.46% | 0.647 | 33/29/0 | 870/865 |
| neutral_only | 833 | 62 | +29.43% | +49.34% | 1.40 | 1.12 | +0.059% | 0.138 | +38.70% | 0.784 | 35/27/0 | 430/403 |
| direct_only | 903 | 62 | +9.80% | +45.69% | 1.24 | 1.11 | +0.051% | 0.079 | +55.57% | 1.216 | 35/27/0 | 440/462 |
| direct_inverted | 1736 | 62 | +19.62% | +3.66% | 1.02 | 1.00 | +0.002% | 0.006 | +62.73% | 17.152 | 34/28/0 | 892/843 |
| direct_ratio_confirmed | 1193 | 62 | +38.87% | +80.81% | 1.47 | 1.14 | +0.068% | 0.150 | +53.32% | 0.660 | 34/28/0 | 616/576 |
| direct_ratio_override | 1718 | 62 | +30.06% | +55.92% | 1.24 | 1.07 | +0.033% | 0.089 | +54.67% | 0.978 | 33/29/0 | 892/825 |
| ratio_direction_all | 1674 | 62 | +29.29% | +55.84% | 1.25 | 1.07 | +0.033% | 0.088 | +57.93% | 1.037 | 33/29/0 | 871/802 |
| direct_delta_confirmed | 1353 | 62 | +70.33% | +132.33% | 1.86 | 1.21 | +0.098% | 0.229 | +39.66% | 0.300 | 33/29/0 | 699/654 |
| direct_delta_override | 1736 | 62 | +101.42% | +169.63% | 2.15 | 1.21 | +0.098% | 0.287 | +32.50% | 0.192 | 35/27/0 | 910/825 |
| delta_direction_all | 1736 | 62 | +71.46% | +138.64% | 1.71 | 1.17 | +0.080% | 0.201 | +54.27% | 0.391 | 32/30/0 | 890/845 |
| direct_signed_spread_confirmed | 1736 | 62 | +39.23% | +95.03% | 1.46 | 1.11 | +0.055% | 0.134 | +61.46% | 0.647 | 33/29/0 | 870/865 |
| direct_signed_spread_override | 1736 | 62 | +39.23% | +95.03% | 1.46 | 1.11 | +0.055% | 0.134 | +61.46% | 0.647 | 33/29/0 | 870/865 |
| signed_spread_all | 1692 | 62 | -26.16% | +2.36% | 1.01 | 1.00 | +0.001% | 0.003 | +75.05% | 31.799 | 29/33/0 | 835/856 |
| signed_spread_all_min0p25 | 988 | 62 | -0.75% | +31.91% | 1.15 | 1.07 | +0.032% | 0.054 | +57.26% | 1.795 | 34/28/0 | 479/508 |
| signed_spread_all_min0p50 | 920 | 62 | +2.77% | +35.62% | 1.18 | 1.08 | +0.039% | 0.061 | +55.57% | 1.560 | 35/27/0 | 446/473 |
| direct_subtractive_spread_confirmed | 1735 | 62 | +38.41% | +93.87% | 1.46 | 1.11 | +0.054% | 0.132 | +61.46% | 0.655 | 33/29/0 | 869/865 |
| direct_subtractive_spread_override | 1735 | 62 | +38.41% | +93.87% | 1.46 | 1.11 | +0.054% | 0.132 | +61.46% | 0.655 | 33/29/0 | 869/865 |
| subtractive_spread_all | 1734 | 62 | +26.86% | +49.78% | 1.22 | 1.06 | +0.029% | 0.075 | +36.25% | 0.728 | 32/30/0 | 868/865 |
| direct_2of3_spread0p25 | 1736 | 62 | +39.23% | +95.03% | 1.46 | 1.11 | +0.055% | 0.134 | +61.46% | 0.647 | 33/29/0 | 870/865 |
| direct_2of3_spread0p50 | 1736 | 62 | +39.23% | +95.03% | 1.46 | 1.11 | +0.055% | 0.134 | +61.46% | 0.647 | 33/29/0 | 870/865 |
| direct_raw_delta_spread0p25 | 1353 | 62 | +70.33% | +132.33% | 1.86 | 1.21 | +0.098% | 0.229 | +39.66% | 0.300 | 33/29/0 | 699/654 |
| direct_raw_delta_spread0p50 | 1353 | 62 | +70.33% | +132.33% | 1.86 | 1.21 | +0.098% | 0.229 | +39.66% | 0.300 | 33/29/0 | 699/654 |
| direct_min_leg_ratio0p50 | 1708 | 62 | +33.44% | +84.83% | 1.41 | 1.10 | +0.050% | 0.121 | +62.47% | 0.736 | 34/28/0 | 855/852 |
| direct_min_leg_ratio0p66 | 1666 | 62 | +32.08% | +83.39% | 1.42 | 1.10 | +0.050% | 0.122 | +63.79% | 0.765 | 34/28/0 | 835/830 |
| direct_min_leg_ratio0p75 | 1624 | 62 | +35.77% | +88.74% | 1.46 | 1.11 | +0.055% | 0.134 | +61.62% | 0.694 | 34/28/0 | 813/810 |
| direct_2of3_leg_ratio0p66 | 1704 | 62 | +37.95% | +92.55% | 1.46 | 1.11 | +0.054% | 0.132 | +61.52% | 0.665 | 34/28/0 | 854/849 |
| direct_2of3_leg_ratio0p75 | 1689 | 62 | +38.35% | +91.33% | 1.45 | 1.11 | +0.054% | 0.131 | +60.62% | 0.664 | 34/28/0 | 847/841 |
| direct_raw_delta_leg_ratio0p66 | 1315 | 62 | +64.46% | +123.17% | 1.81 | 1.20 | +0.094% | 0.219 | +40.67% | 0.330 | 34/28/0 | 680/635 |
| direct_raw_delta_leg_ratio0p75 | 1288 | 62 | +67.75% | +129.74% | 1.90 | 1.21 | +0.101% | 0.238 | +40.67% | 0.313 | 33/29/0 | 665/623 |

### Current Rule Contribution

| Rule tier | Trades | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| neutral_tier1_directional_ratio | 789 | 409/380 | +28.66% | +49.26% |
| direct_opposed_bias | 903 | 440/462 | +9.80% | +45.69% |
| neutral_tier4_raw_delta_diff | 14 | 7/7 | +1.66% | +2.62% |
| neutral_tier3_oi_confirmed_delta | 10 | 5/5 | +2.00% | +2.58% |
| neutral_tier3_oi_confirmed_delta_diff | 2 | 0/2 | -1.22% | -2.20% |
| neutral_tier2_delta_persistence | 18 | 9/9 | -1.66% | -2.93% |

## source-clean 2019-2023

Receipt: `combined from source-clean 2019, 2020, 2021, 2022, and 2023 baseline receipts`

Window: 2019-01-01 through 2023-12-31 (244 weeks).

### Direct-Rule Agreement Checks

| Direct rows | Ratio agrees | Ratio disagrees | Ratio missing | Delta agrees | Delta disagrees | Delta missing | Signed spread agrees | Signed spread disagrees | Signed spread missing | Net-spread agrees | Net-spread disagrees | Net-spread missing | Spread clean >=0.25 | Spread clean >=0.50 | Min leg ratio >=0.50 | Min leg ratio >=0.66 | Min leg ratio >=0.75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3302 | 1632 | 1536 | 134 | 1806 | 1496 | 0 | 3302 | 0 | 0 | 3301 | 0 | 1 | 3302 | 3301 | 3209 | 3134 | 3059 |

### Variant Summary

| Variant | Trades | Active weeks | Raw | ADR | Weekly PF | Trade PF | Expectancy/trade | Weekly Sharpe-style | Weekly DD | DD/return | Weekly W/L/F | Trade W/L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 6832 | 244 | +72.50% | +99.80% | 1.08 | 1.03 | +0.015% | 0.030 | +164.15% | 1.645 | 124/120/0 | 3475/3355 |
| neutral_only | 3530 | 244 | +188.16% | +210.59% | 1.36 | 1.12 | +0.060% | 0.115 | +65.91% | 0.313 | 134/110/0 | 1823/1705 |
| direct_only | 3302 | 244 | -115.66% | -110.79% | 0.91 | 0.94 | -0.034% | -0.036 | +278.28% | n/a | 123/121/0 | 1652/1650 |
| direct_inverted | 6832 | 244 | +303.82% | +321.39% | 1.27 | 1.09 | +0.047% | 0.085 | +130.32% | 0.405 | 131/113/0 | 3473/3357 |
| direct_ratio_confirmed | 5162 | 244 | +142.30% | +176.12% | 1.19 | 1.06 | +0.034% | 0.068 | +99.11% | 0.563 | 128/116/0 | 2634/2526 |
| direct_ratio_override | 6698 | 244 | +207.51% | +257.03% | 1.27 | 1.07 | +0.038% | 0.092 | +97.61% | 0.380 | 127/117/0 | 3398/3298 |
| ratio_direction_all | 6645 | 244 | +192.51% | +243.04% | 1.25 | 1.07 | +0.037% | 0.087 | +98.30% | 0.404 | 125/119/0 | 3366/3277 |
| direct_delta_confirmed | 5336 | 244 | +40.02% | +71.21% | 1.08 | 1.02 | +0.013% | 0.028 | +99.76% | 1.401 | 120/124/0 | 2720/2614 |
| direct_delta_override | 6832 | 244 | +7.53% | +42.62% | 1.05 | 1.01 | +0.006% | 0.017 | +140.62% | 3.299 | 132/112/0 | 3461/3369 |
| delta_direction_all | 6832 | 244 | -201.55% | -193.59% | 0.86 | 0.95 | -0.028% | -0.061 | +338.35% | n/a | 109/135/0 | 3385/3445 |
| direct_signed_spread_confirmed | 6832 | 244 | +72.50% | +99.80% | 1.08 | 1.03 | +0.015% | 0.030 | +164.15% | 1.645 | 124/120/0 | 3475/3355 |
| direct_signed_spread_override | 6832 | 244 | +72.50% | +99.80% | 1.08 | 1.03 | +0.015% | 0.030 | +164.15% | 1.645 | 124/120/0 | 3475/3355 |
| signed_spread_all | 6779 | 244 | -116.02% | -72.40% | 0.95 | 0.98 | -0.011% | -0.019 | +202.64% | n/a | 124/120/0 | 3394/3383 |
| signed_spread_all_min0p25 | 3533 | 244 | -97.56% | -93.33% | 0.92 | 0.95 | -0.026% | -0.030 | +240.14% | n/a | 121/123/0 | 1772/1761 |
| signed_spread_all_min0p50 | 3386 | 244 | -104.08% | -93.99% | 0.92 | 0.95 | -0.028% | -0.031 | +259.53% | n/a | 122/122/0 | 1698/1688 |
| direct_subtractive_spread_confirmed | 6831 | 244 | +71.11% | +98.62% | 1.08 | 1.03 | +0.014% | 0.030 | +164.15% | 1.665 | 124/120/0 | 3474/3355 |
| direct_subtractive_spread_override | 6831 | 244 | +71.11% | +98.62% | 1.08 | 1.03 | +0.014% | 0.030 | +164.15% | 1.665 | 124/120/0 | 3474/3355 |
| subtractive_spread_all | 6828 | 244 | -181.57% | -180.49% | 0.87 | 0.95 | -0.026% | -0.054 | +338.26% | n/a | 114/130/0 | 3366/3460 |
| direct_2of3_spread0p25 | 6832 | 244 | +72.50% | +99.80% | 1.08 | 1.03 | +0.015% | 0.030 | +164.15% | 1.645 | 124/120/0 | 3475/3355 |
| direct_2of3_spread0p50 | 6832 | 244 | +72.50% | +99.80% | 1.08 | 1.03 | +0.015% | 0.030 | +164.15% | 1.645 | 124/120/0 | 3475/3355 |
| direct_raw_delta_spread0p25 | 5336 | 244 | +40.02% | +71.21% | 1.08 | 1.02 | +0.013% | 0.028 | +99.76% | 1.401 | 120/124/0 | 2720/2614 |
| direct_raw_delta_spread0p50 | 5335 | 244 | +38.62% | +70.03% | 1.08 | 1.02 | +0.013% | 0.028 | +99.76% | 1.424 | 120/124/0 | 2719/2614 |
| direct_min_leg_ratio0p50 | 6739 | 244 | +84.44% | +114.95% | 1.09 | 1.03 | +0.017% | 0.035 | +153.37% | 1.334 | 127/117/0 | 3435/3302 |
| direct_min_leg_ratio0p66 | 6664 | 244 | +95.53% | +131.96% | 1.11 | 1.04 | +0.020% | 0.040 | +146.02% | 1.107 | 127/117/0 | 3400/3262 |
| direct_min_leg_ratio0p75 | 6589 | 244 | +93.49% | +128.10% | 1.11 | 1.04 | +0.019% | 0.039 | +144.26% | 1.126 | 127/117/0 | 3360/3227 |
| direct_2of3_leg_ratio0p66 | 6759 | 244 | +81.25% | +121.63% | 1.10 | 1.03 | +0.018% | 0.037 | +156.81% | 1.289 | 125/119/0 | 3446/3311 |
| direct_2of3_leg_ratio0p75 | 6722 | 244 | +80.84% | +118.60% | 1.10 | 1.03 | +0.018% | 0.036 | +154.83% | 1.306 | 125/119/0 | 3424/3296 |
| direct_raw_delta_leg_ratio0p66 | 5241 | 244 | +54.30% | +81.55% | 1.09 | 1.03 | +0.016% | 0.033 | +101.33% | 1.243 | 122/122/0 | 2674/2565 |
| direct_raw_delta_leg_ratio0p75 | 5203 | 244 | +52.67% | +80.72% | 1.09 | 1.03 | +0.016% | 0.032 | +105.45% | 1.306 | 121/123/0 | 2656/2545 |

### Current Rule Contribution

| Rule tier | Trades | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| neutral_tier1_directional_ratio | 3477 | 1791/1684 | +173.16% | +196.61% |
| neutral_tier2_delta_persistence | 36 | 21/15 | +9.19% | +10.71% |
| neutral_tier3_oi_confirmed_delta_diff | 5 | 4/1 | +6.48% | +4.46% |
| neutral_tier4_raw_delta_diff | 5 | 4/1 | +0.33% | +0.10% |
| neutral_tier3_oi_confirmed_delta | 7 | 3/4 | -1.00% | -1.28% |
| direct_opposed_bias | 3302 | 1652/1650 | -115.66% | -110.79% |

## source-clean 2019-2024

Receipt: `combined from source-clean 2019-2023 and corrected 2024 baseline receipts`

Window: 2019-01-01 through 2024-12-31 (296 weeks).

### Direct-Rule Agreement Checks

| Direct rows | Ratio agrees | Ratio disagrees | Ratio missing | Delta agrees | Delta disagrees | Delta missing | Signed spread agrees | Signed spread disagrees | Signed spread missing | Net-spread agrees | Net-spread disagrees | Net-spread missing | Spread clean >=0.25 | Spread clean >=0.50 | Min leg ratio >=0.50 | Min leg ratio >=0.66 | Min leg ratio >=0.75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4050 | 1993 | 1916 | 141 | 2202 | 1848 | 0 | 4050 | 0 | 0 | 4048 | 0 | 2 | 4050 | 4048 | 3901 | 3796 | 3692 |

### Variant Summary

| Variant | Trades | Active weeks | Raw | ADR | Weekly PF | Trade PF | Expectancy/trade | Weekly Sharpe-style | Weekly DD | DD/return | Weekly W/L/F | Trade W/L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 8288 | 296 | -51.09% | -69.68% | 0.96 | 0.98 | -0.008% | -0.017 | +286.93% | n/a | 146/150/0 | 4171/4115 |
| neutral_only | 4238 | 296 | +196.08% | +214.60% | 1.29 | 1.10 | +0.051% | 0.097 | +65.91% | 0.307 | 159/137/0 | 2168/2068 |
| direct_only | 4050 | 296 | -247.17% | -284.28% | 0.81 | 0.88 | -0.070% | -0.079 | +335.39% | n/a | 143/153/0 | 2003/2047 |
| direct_inverted | 8288 | 296 | +443.24% | +498.87% | 1.36 | 1.11 | +0.060% | 0.113 | +130.32% | 0.261 | 164/132/0 | 4215/4071 |
| direct_ratio_confirmed | 6231 | 296 | +132.46% | +156.23% | 1.14 | 1.05 | +0.025% | 0.050 | +134.95% | 0.864 | 150/146/0 | 3169/3060 |
| direct_ratio_override | 8147 | 296 | +309.04% | +384.91% | 1.33 | 1.09 | +0.047% | 0.109 | +100.76% | 0.262 | 157/139/0 | 4155/3990 |
| ratio_direction_all | 8088 | 296 | +293.72% | +370.30% | 1.32 | 1.09 | +0.046% | 0.105 | +101.06% | 0.273 | 155/141/0 | 4119/3967 |
| direct_delta_confirmed | 6440 | 296 | -32.44% | -29.94% | 0.97 | 0.99 | -0.005% | -0.010 | +216.43% | n/a | 142/154/0 | 3241/3197 |
| direct_delta_override | 8288 | 296 | -13.79% | +9.79% | 1.01 | 1.00 | +0.001% | 0.003 | +169.11% | 17.273 | 155/141/0 | 4159/4127 |
| delta_direction_all | 8288 | 296 | -247.23% | -254.29% | 0.84 | 0.95 | -0.031% | -0.066 | +417.09% | n/a | 134/162/0 | 4080/4206 |
| direct_signed_spread_confirmed | 8288 | 296 | -51.09% | -69.68% | 0.96 | 0.98 | -0.008% | -0.017 | +286.93% | n/a | 146/150/0 | 4171/4115 |
| direct_signed_spread_override | 8288 | 296 | -51.09% | -69.68% | 0.96 | 0.98 | -0.008% | -0.017 | +286.93% | n/a | 146/150/0 | 4171/4115 |
| signed_spread_all | 8229 | 296 | -275.57% | -291.14% | 0.84 | 0.94 | -0.035% | -0.065 | +359.93% | n/a | 145/151/0 | 4088/4139 |
| signed_spread_all_min0p25 | 4381 | 296 | -204.40% | -230.10% | 0.84 | 0.91 | -0.053% | -0.063 | +273.96% | n/a | 144/152/0 | 2191/2190 |
| signed_spread_all_min0p50 | 4166 | 296 | -233.53% | -260.52% | 0.82 | 0.89 | -0.063% | -0.072 | +313.75% | n/a | 143/153/0 | 2069/2097 |
| direct_subtractive_spread_confirmed | 8286 | 296 | -53.67% | -72.33% | 0.95 | 0.98 | -0.009% | -0.018 | +286.93% | n/a | 146/150/0 | 4169/4115 |
| direct_subtractive_spread_override | 8286 | 296 | -53.67% | -72.33% | 0.95 | 0.98 | -0.009% | -0.018 | +286.93% | n/a | 146/150/0 | 4169/4115 |
| subtractive_spread_all | 8279 | 296 | -257.28% | -259.32% | 0.84 | 0.95 | -0.031% | -0.066 | +338.26% | n/a | 141/155/0 | 4109/4168 |
| direct_2of3_spread0p25 | 8288 | 296 | -51.09% | -69.68% | 0.96 | 0.98 | -0.008% | -0.017 | +286.93% | n/a | 146/150/0 | 4171/4115 |
| direct_2of3_spread0p50 | 8288 | 296 | -51.09% | -69.68% | 0.96 | 0.98 | -0.008% | -0.017 | +286.93% | n/a | 146/150/0 | 4171/4115 |
| direct_raw_delta_spread0p25 | 6440 | 296 | -32.44% | -29.94% | 0.97 | 0.99 | -0.005% | -0.010 | +216.43% | n/a | 142/154/0 | 3241/3197 |
| direct_raw_delta_spread0p50 | 6438 | 296 | -35.03% | -32.59% | 0.97 | 0.99 | -0.005% | -0.011 | +216.43% | n/a | 142/154/0 | 3239/3197 |
| direct_min_leg_ratio0p50 | 8139 | 296 | -26.31% | -31.32% | 0.98 | 0.99 | -0.004% | -0.008 | +260.99% | n/a | 151/145/0 | 4108/4029 |
| direct_min_leg_ratio0p66 | 8034 | 296 | -6.26% | -3.46% | 1.00 | 1.00 | +0.000% | -0.001 | +252.90% | n/a | 150/146/0 | 4062/3970 |
| direct_min_leg_ratio0p75 | 7930 | 296 | -9.66% | -9.30% | 0.99 | 1.00 | -0.001% | -0.002 | +256.37% | n/a | 151/145/0 | 4008/3920 |
| direct_2of3_leg_ratio0p66 | 8183 | 296 | -39.71% | -40.05% | 0.97 | 0.99 | -0.005% | -0.010 | +278.16% | n/a | 147/149/0 | 4126/4055 |
| direct_2of3_leg_ratio0p75 | 8132 | 296 | -39.59% | -41.59% | 0.97 | 0.99 | -0.005% | -0.011 | +280.39% | n/a | 147/149/0 | 4098/4032 |
| direct_raw_delta_leg_ratio0p66 | 6291 | 296 | +1.00% | +6.65% | 1.01 | 1.00 | +0.001% | 0.002 | +192.02% | 28.896 | 144/152/0 | 3177/3112 |
| direct_raw_delta_leg_ratio0p75 | 6238 | 296 | -2.51% | +2.34% | 1.00 | 1.00 | +0.000% | 0.001 | +197.37% | 84.253 | 142/154/0 | 3151/3085 |

### Current Rule Contribution

| Rule tier | Trades | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| neutral_tier1_directional_ratio | 4179 | 2132/2045 | +180.76% | +199.99% |
| neutral_tier2_delta_persistence | 38 | 22/16 | +8.88% | +10.24% |
| neutral_tier3_oi_confirmed_delta_diff | 8 | 7/1 | +8.95% | +7.81% |
| neutral_tier4_raw_delta_diff | 5 | 4/1 | +0.33% | +0.10% |
| neutral_tier3_oi_confirmed_delta | 8 | 3/5 | -2.84% | -3.55% |
| direct_opposed_bias | 4050 | 2003/2047 | -247.17% | -284.28% |

## 2024 + clean 2025 + current 2026

Receipt: `combined from corrected 2024, clean 2025, and current 2026 baseline receipts`

Window: 2024-01-09 through 2026-06-08 (114 weeks).

### Direct-Rule Agreement Checks

| Direct rows | Ratio agrees | Ratio disagrees | Ratio missing | Delta agrees | Delta disagrees | Delta missing | Signed spread agrees | Signed spread disagrees | Signed spread missing | Net-spread agrees | Net-spread disagrees | Net-spread missing | Spread clean >=0.25 | Spread clean >=0.50 | Min leg ratio >=0.50 | Min leg ratio >=0.66 | Min leg ratio >=0.75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1651 | 721 | 905 | 25 | 916 | 735 | 0 | 1651 | 0 | 0 | 1649 | 0 | 2 | 1651 | 1650 | 1567 | 1495 | 1424 |

### Variant Summary

| Variant | Trades | Active weeks | Raw | ADR | Weekly PF | Trade PF | Expectancy/trade | Weekly Sharpe-style | Weekly DD | DD/return | Weekly W/L/F | Trade W/L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 3192 | 114 | -84.36% | -74.45% | 0.86 | 0.96 | -0.023% | -0.055 | +228.08% | n/a | 55/59/0 | 1566/1625 |
| neutral_only | 1541 | 114 | +37.35% | +53.35% | 1.19 | 1.07 | +0.035% | 0.071 | +46.77% | 0.877 | 60/54/0 | 775/766 |
| direct_only | 1651 | 114 | -121.71% | -127.80% | 0.73 | 0.86 | -0.077% | -0.114 | +201.67% | n/a | 55/59/0 | 791/859 |
| direct_inverted | 3192 | 114 | +159.05% | +181.14% | 1.43 | 1.11 | +0.057% | 0.136 | +62.73% | 0.346 | 67/47/0 | 1634/1557 |
| direct_ratio_confirmed | 2262 | 114 | +29.03% | +60.93% | 1.15 | 1.05 | +0.027% | 0.055 | +105.42% | 1.730 | 56/58/0 | 1151/1110 |
| direct_ratio_override | 3167 | 114 | +131.58% | +183.80% | 1.42 | 1.11 | +0.058% | 0.135 | +85.33% | 0.464 | 63/51/0 | 1649/1517 |
| ratio_direction_all | 3117 | 114 | +130.49% | +183.10% | 1.42 | 1.12 | +0.059% | 0.134 | +84.86% | 0.463 | 63/51/0 | 1624/1492 |
| direct_delta_confirmed | 2457 | 114 | -2.13% | +31.17% | 1.08 | 1.02 | +0.013% | 0.028 | +160.99% | 5.164 | 55/59/0 | 1220/1237 |
| direct_delta_override | 3192 | 114 | +80.09% | +136.80% | 1.37 | 1.08 | +0.043% | 0.118 | +96.85% | 0.708 | 58/56/0 | 1608/1583 |
| delta_direction_all | 3192 | 114 | +25.78% | +77.94% | 1.16 | 1.05 | +0.024% | 0.057 | +117.83% | 1.512 | 57/57/0 | 1585/1606 |
| direct_signed_spread_confirmed | 3192 | 114 | -84.36% | -74.45% | 0.86 | 0.96 | -0.023% | -0.055 | +228.08% | n/a | 55/59/0 | 1566/1625 |
| direct_signed_spread_override | 3192 | 114 | -84.36% | -74.45% | 0.86 | 0.96 | -0.023% | -0.055 | +228.08% | n/a | 55/59/0 | 1566/1625 |
| signed_spread_all | 3142 | 114 | -185.71% | -216.38% | 0.67 | 0.88 | -0.069% | -0.156 | +328.16% | n/a | 50/64/0 | 1529/1612 |
| signed_spread_all_min0p25 | 1836 | 114 | -107.58% | -104.87% | 0.78 | 0.90 | -0.057% | -0.091 | +213.41% | n/a | 57/57/0 | 898/937 |
| signed_spread_all_min0p50 | 1700 | 114 | -126.68% | -130.92% | 0.73 | 0.86 | -0.077% | -0.116 | +206.42% | n/a | 56/58/0 | 817/882 |
| direct_subtractive_spread_confirmed | 3190 | 114 | -86.37% | -77.08% | 0.86 | 0.96 | -0.024% | -0.057 | +228.08% | n/a | 55/59/0 | 1564/1625 |
| direct_subtractive_spread_override | 3190 | 114 | -86.37% | -77.08% | 0.86 | 0.96 | -0.024% | -0.057 | +228.08% | n/a | 55/59/0 | 1564/1625 |
| subtractive_spread_all | 3185 | 114 | -48.85% | -29.05% | 0.94 | 0.98 | -0.009% | -0.024 | +150.18% | n/a | 59/55/0 | 1611/1573 |
| direct_2of3_spread0p25 | 3192 | 114 | -84.36% | -74.45% | 0.86 | 0.96 | -0.023% | -0.055 | +228.08% | n/a | 55/59/0 | 1566/1625 |
| direct_2of3_spread0p50 | 3192 | 114 | -84.36% | -74.45% | 0.86 | 0.96 | -0.023% | -0.055 | +228.08% | n/a | 55/59/0 | 1566/1625 |
| direct_raw_delta_spread0p25 | 2457 | 114 | -2.13% | +31.17% | 1.08 | 1.02 | +0.013% | 0.028 | +160.99% | 5.164 | 55/59/0 | 1220/1237 |
| direct_raw_delta_spread0p50 | 2456 | 114 | -3.32% | +29.70% | 1.07 | 1.02 | +0.012% | 0.027 | +160.99% | 5.420 | 55/59/0 | 1219/1237 |
| direct_min_leg_ratio0p50 | 3108 | 114 | -77.31% | -61.45% | 0.88 | 0.96 | -0.020% | -0.046 | +213.48% | n/a | 58/56/0 | 1528/1579 |
| direct_min_leg_ratio0p66 | 3036 | 114 | -69.71% | -52.03% | 0.90 | 0.97 | -0.017% | -0.039 | +216.50% | n/a | 57/57/0 | 1497/1538 |
| direct_min_leg_ratio0p75 | 2965 | 114 | -67.38% | -48.66% | 0.90 | 0.97 | -0.016% | -0.037 | +223.39% | n/a | 58/56/0 | 1461/1503 |
| direct_2of3_leg_ratio0p66 | 3128 | 114 | -83.00% | -69.13% | 0.87 | 0.96 | -0.022% | -0.051 | +230.01% | n/a | 56/58/0 | 1534/1593 |
| direct_2of3_leg_ratio0p75 | 3099 | 114 | -82.08% | -68.85% | 0.87 | 0.96 | -0.022% | -0.051 | +235.52% | n/a | 56/58/0 | 1521/1577 |
| direct_raw_delta_leg_ratio0p66 | 2365 | 114 | +11.16% | +48.27% | 1.13 | 1.04 | +0.020% | 0.044 | +147.47% | 3.055 | 56/58/0 | 1183/1182 |
| direct_raw_delta_leg_ratio0p75 | 2323 | 114 | +12.56% | +51.36% | 1.14 | 1.04 | +0.022% | 0.048 | +148.86% | 2.898 | 54/60/0 | 1160/1163 |

### Current Rule Contribution

| Rule tier | Trades | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| neutral_tier1_directional_ratio | 1491 | 750/741 | +36.26% | +52.65% |
| neutral_tier4_raw_delta_diff | 14 | 7/7 | +1.66% | +2.62% |
| neutral_tier3_oi_confirmed_delta_diff | 5 | 3/2 | +1.24% | +1.15% |
| neutral_tier3_oi_confirmed_delta | 11 | 5/6 | +0.16% | +0.32% |
| neutral_tier2_delta_persistence | 20 | 10/10 | -1.97% | -3.40% |
| direct_opposed_bias | 1651 | 791/859 | -121.71% | -127.80% |

## source-clean 2019-current

Receipt: `combined from source-clean 2019-2024, clean 2025, and current 2026 baseline receipts`

Window: 2019-01-01 through 2026-06-08 (358 weeks).

### Direct-Rule Agreement Checks

| Direct rows | Ratio agrees | Ratio disagrees | Ratio missing | Delta agrees | Delta disagrees | Delta missing | Signed spread agrees | Signed spread disagrees | Signed spread missing | Net-spread agrees | Net-spread disagrees | Net-spread missing | Spread clean >=0.25 | Spread clean >=0.50 | Min leg ratio >=0.50 | Min leg ratio >=0.66 | Min leg ratio >=0.75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4953 | 2353 | 2441 | 159 | 2722 | 2231 | 0 | 4953 | 0 | 0 | 4950 | 0 | 3 | 4953 | 4951 | 4776 | 4629 | 4483 |

### Variant Summary

| Variant | Trades | Active weeks | Raw | ADR | Weekly PF | Trade PF | Expectancy/trade | Weekly Sharpe-style | Weekly DD | DD/return | Weekly W/L/F | Trade W/L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 10024 | 358 | -11.86% | +25.35% | 1.01 | 1.00 | +0.003% | 0.005 | +286.93% | 11.319 | 179/179/0 | 5041/4980 |
| neutral_only | 5071 | 358 | +225.50% | +263.94% | 1.31 | 1.10 | +0.052% | 0.102 | +65.91% | 0.250 | 194/164/0 | 2598/2471 |
| direct_only | 4953 | 358 | -237.36% | -238.59% | 0.86 | 0.92 | -0.048% | -0.057 | +341.90% | n/a | 178/180/0 | 2443/2509 |
| direct_inverted | 10024 | 358 | +462.87% | +502.53% | 1.31 | 1.10 | +0.050% | 0.098 | +130.32% | 0.259 | 198/160/0 | 5107/4914 |
| direct_ratio_confirmed | 7424 | 358 | +171.33% | +237.05% | 1.18 | 1.06 | +0.032% | 0.064 | +134.95% | 0.569 | 184/174/0 | 3785/3636 |
| direct_ratio_override | 9865 | 358 | +339.10% | +440.83% | 1.32 | 1.09 | +0.045% | 0.106 | +100.76% | 0.229 | 190/168/0 | 5047/4815 |
| ratio_direction_all | 9762 | 358 | +323.01% | +426.14% | 1.31 | 1.08 | +0.044% | 0.103 | +101.06% | 0.237 | 188/170/0 | 4990/4769 |
| direct_delta_confirmed | 7793 | 358 | +37.89% | +102.39% | 1.08 | 1.02 | +0.013% | 0.028 | +216.43% | 2.114 | 175/183/0 | 3940/3851 |
| direct_delta_override | 10024 | 358 | +87.63% | +179.42% | 1.14 | 1.03 | +0.018% | 0.049 | +169.11% | 0.943 | 190/168/0 | 5069/4952 |
| delta_direction_all | 10024 | 358 | -175.76% | -115.65% | 0.94 | 0.98 | -0.012% | -0.025 | +417.09% | n/a | 166/192/0 | 4970/5051 |
| direct_signed_spread_confirmed | 10024 | 358 | -11.86% | +25.35% | 1.01 | 1.00 | +0.003% | 0.005 | +286.93% | 11.319 | 179/179/0 | 5041/4980 |
| direct_signed_spread_override | 10024 | 358 | -11.86% | +25.35% | 1.01 | 1.00 | +0.003% | 0.005 | +286.93% | 11.319 | 179/179/0 | 5041/4980 |
| signed_spread_all | 9921 | 358 | -301.73% | -288.78% | 0.86 | 0.95 | -0.029% | -0.055 | +415.46% | n/a | 174/184/0 | 4923/4995 |
| signed_spread_all_min0p25 | 5369 | 358 | -205.15% | -198.20% | 0.88 | 0.94 | -0.037% | -0.047 | +286.86% | n/a | 178/180/0 | 2670/2698 |
| signed_spread_all_min0p50 | 5086 | 358 | -230.76% | -224.90% | 0.86 | 0.92 | -0.044% | -0.054 | +321.65% | n/a | 178/180/0 | 2515/2570 |
| direct_subtractive_spread_confirmed | 10021 | 358 | -15.27% | +21.54% | 1.01 | 1.00 | +0.002% | 0.005 | +286.93% | 13.320 | 179/179/0 | 5038/4980 |
| direct_subtractive_spread_override | 10021 | 358 | -15.27% | +21.54% | 1.01 | 1.00 | +0.002% | 0.005 | +286.93% | 13.320 | 179/179/0 | 5038/4980 |
| subtractive_spread_all | 10013 | 358 | -230.42% | -209.54% | 0.89 | 0.96 | -0.021% | -0.046 | +338.26% | n/a | 173/185/0 | 4977/5033 |
| direct_2of3_spread0p25 | 10024 | 358 | -11.86% | +25.35% | 1.01 | 1.00 | +0.003% | 0.005 | +286.93% | 11.319 | 179/179/0 | 5041/4980 |
| direct_2of3_spread0p50 | 10024 | 358 | -11.86% | +25.35% | 1.01 | 1.00 | +0.003% | 0.005 | +286.93% | 11.319 | 179/179/0 | 5041/4980 |
| direct_raw_delta_spread0p25 | 7793 | 358 | +37.89% | +102.39% | 1.08 | 1.02 | +0.013% | 0.028 | +216.43% | 2.114 | 175/183/0 | 3940/3851 |
| direct_raw_delta_spread0p50 | 7791 | 358 | +35.30% | +99.74% | 1.08 | 1.02 | +0.013% | 0.028 | +216.43% | 2.170 | 175/183/0 | 3938/3851 |
| direct_min_leg_ratio0p50 | 9847 | 358 | +7.13% | +53.50% | 1.03 | 1.01 | +0.005% | 0.011 | +260.99% | 4.878 | 185/173/0 | 4963/4881 |
| direct_min_leg_ratio0p66 | 9700 | 358 | +25.82% | +79.93% | 1.05 | 1.02 | +0.008% | 0.017 | +252.90% | 3.164 | 184/174/0 | 4897/4800 |
| direct_min_leg_ratio0p75 | 9554 | 358 | +26.11% | +79.44% | 1.05 | 1.02 | +0.008% | 0.017 | +256.37% | 3.227 | 185/173/0 | 4821/4730 |
| direct_2of3_leg_ratio0p66 | 9887 | 358 | -1.75% | +52.49% | 1.03 | 1.01 | +0.005% | 0.011 | +278.16% | 5.299 | 181/177/0 | 4980/4904 |
| direct_2of3_leg_ratio0p75 | 9821 | 358 | -1.24% | +49.75% | 1.03 | 1.01 | +0.005% | 0.011 | +280.39% | 5.637 | 181/177/0 | 4945/4873 |
| direct_raw_delta_leg_ratio0p66 | 7606 | 358 | +65.46% | +129.82% | 1.10 | 1.03 | +0.017% | 0.036 | +192.02% | 1.479 | 178/180/0 | 3857/3747 |
| direct_raw_delta_leg_ratio0p75 | 7526 | 358 | +65.24% | +132.08% | 1.10 | 1.03 | +0.018% | 0.037 | +197.37% | 1.494 | 175/183/0 | 3816/3708 |

### Current Rule Contribution

| Rule tier | Trades | W/L | Raw | ADR |
| --- | --- | --- | --- | --- |
| neutral_tier1_directional_ratio | 4968 | 2541/2425 | +209.41% | +249.26% |
| neutral_tier2_delta_persistence | 56 | 31/25 | +7.22% | +7.32% |
| neutral_tier3_oi_confirmed_delta_diff | 10 | 7/3 | +7.72% | +5.61% |
| neutral_tier4_raw_delta_diff | 19 | 11/8 | +1.99% | +2.72% |
| neutral_tier3_oi_confirmed_delta | 18 | 8/10 | -0.84% | -0.96% |
| direct_opposed_bias | 4953 | 2443/2509 | -237.36% | -238.59% |
