# Gate 46 COT Lifecycle Source-Score Audit

Generated: 2026-06-19T17:01:02.793Z
Dataset: 479624d1-f6a2-4928-82f1-981137762bdc
Dataset hash: cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36
Scope: read-only overlay on Gate 44 research matrix pair decisions and pair_contributions; no stops/TP/runners/grid/pair filters changed.

## Formula

For each currency/report date: rolling 156-snapshot empirical percentile, current report included. Minimum displayed window is 52 snapshots; exact full-window slice requires 156 snapshots.

`TEI = (crowd_percentile + (100 - commercial_percentile) + (100 - dealer_raw_long_minus_short_percentile)) / 3`

`score = abs(TEI - 50) * 2`; score buckets: `<30 low_continuation`, `30-70 neutral`, `>70 high_exhaustion`.

Selected-side polarity uses `long_currency_TEI - short_currency_TEI`: negative means selected side fades the crowded/exhausted currency spread; positive means selected side goes with it.

COT snapshots: 388, 2019-01-08 through 2026-06-09.
Eligible non-baseline selected pair-side rows: 183596.

## Existing Warehouse Top Rows

| variant | weeks | selected sides | warehouse final ADR |
| --- | --- | --- | --- |
| strength_friday_snapshot_selected | 372 | 10292 | 1223.29 |
| cot_faces_v1_commercial_delta_contrarian_selected | 372 | 10332 | 1174.87 |
| cot_faces_v1_forced_selected | 372 | 10332 | 1068.88 |
| strength_open_canonical_fade | 372 | 9261 | 1005.18 |
| cot_faces_v1_forced_opposite | 372 | 10332 | 947.68 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_disagree_cot | 372 | 8055 | 911.21 |
| cot_faces_v1_commercial_delta_contrarian_opposite | 372 | 10332 | 841.69 |
| strength_open_canonical_selected | 372 | 9261 | 765.23 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 372 | 5025 | 744.11 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | 372 | 5016 | 731.62 |
| strength_friday_snapshot_open_canonical_fade_agree | 372 | 4618 | 698.41 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_cot | 372 | 5016 | 675.04 |


## Legacy non-commercial crowd leg

Crowd field: `noncomm_net`.
First min-52 score date: 2019-12-31. First full-156 score date: 2021-12-28.

### Minimum 52-snapshot expanding/rolling slice

Coverage: eligible 183596, cot-matched 183512, scored 161747, missing score 21765, not full-window 0.

#### Score Regime Buckets

| bucket | pair-sides | ADR | avg ADR | win % |
| --- | --- | --- | --- | --- |
| low_continuation | 25151 | 4346.59 | 0.1728 | 84.4% |
| neutral | 90203 | 14637.79 | 0.1623 | 84.2% |
| high_exhaustion | 46393 | 1007.06 | 0.0217 | 82.4% |


#### Selected-Side Polarity Buckets

| bucket | pair-sides | ADR | avg ADR | win % |
| --- | --- | --- | --- | --- |
| fade_extreme | 16721 | 1301.42 | 0.0778 | 83.0% |
| fade_lean | 15325 | 4786.05 | 0.3123 | 84.2% |
| neutral_mixed | 85590 | 16303.88 | 0.1905 | 84.1% |
| with_lean | 20821 | 8.13 | 0.0004 | 83.5% |
| with_extreme | 23290 | -2408.04 | -0.1034 | 83.1% |


#### Top Variant Attribution

| variant | scored pair-sides | ADR | avg | fade ADR | fade avg | neutral ADR | with ADR | with avg |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| strength_friday_snapshot_selected | 8935 | 1314.30 | 0.1471 | 394.64 | 0.1879 | 1068.92 | -149.25 | -0.0702 |
| cot_faces_v1_commercial_delta_contrarian_selected | 8887 | 1177.43 | 0.1325 | 263.45 | 0.4319 | 1028.81 | -114.83 | -0.0319 |
| cot_faces_v1_forced_selected | 8887 | 1119.77 | 0.1260 | 260.96 | 0.4306 | 951.64 | -92.83 | -0.0257 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_disagree_cot | 6822 | 943.48 | 0.1383 | 169.73 | 0.3619 | 764.01 | 9.73 | 0.0034 |
| cot_faces_v1_forced_opposite | 8894 | 927.09 | 0.1042 | 433.67 | 0.1201 | 585.80 | -92.37 | -0.1524 |
| strength_open_canonical_selected | 8418 | 900.15 | 0.1069 | 311.83 | 0.1675 | 801.12 | -212.81 | -0.1004 |
| cot_faces_v1_commercial_delta_contrarian_opposite | 8894 | 869.44 | 0.0978 | 431.18 | 0.1196 | 508.62 | -70.37 | -0.1154 |
| strength_open_canonical_fade | 8435 | 833.82 | 0.0989 | 252.47 | 0.1188 | 642.38 | -61.03 | -0.0327 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | 4295 | 785.27 | 0.1828 | 252.03 | 0.1408 | 479.23 | 54.01 | 0.1765 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 4296 | 770.47 | 0.1793 | 279.83 | 0.1562 | 451.26 | 39.38 | 0.1300 |
| dealer_commercial_agreement_selected | 3532 | 690.84 | 0.1956 | 218.95 | 0.3492 | 559.10 | -87.21 | -0.0937 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | 4356 | 690.59 | 0.1585 | 133.36 | 0.4445 | 621.92 | -64.70 | -0.0355 |


#### Non-Commercial Min-52 Year x Polarity

| year | bucket | pair-sides | ADR | avg | win % |
| --- | --- | --- | --- | --- | --- |
| 2020 | fade_extreme | 3107 | -696.78 | -0.2243 | 80.4% |
| 2020 | fade_lean | 2674 | 623.72 | 0.2333 | 82.7% |
| 2020 | neutral_mixed | 13358 | -689.06 | -0.0516 | 82.6% |
| 2020 | with_lean | 3238 | -850.26 | -0.2626 | 83.1% |
| 2020 | with_extreme | 3769 | -253.42 | -0.0672 | 84.0% |
| 2021 | fade_extreme | 2277 | 432.59 | 0.1900 | 82.6% |
| 2021 | fade_lean | 1852 | 631.82 | 0.3412 | 84.9% |
| 2021 | neutral_mixed | 14090 | 2592.97 | 0.1840 | 83.3% |
| 2021 | with_lean | 2640 | 251.67 | 0.0953 | 84.3% |
| 2021 | with_extreme | 3658 | 469.57 | 0.1284 | 85.4% |
| 2022 | fade_extreme | 1521 | -356.36 | -0.2343 | 81.5% |
| 2022 | fade_lean | 2495 | 324.64 | 0.1301 | 84.4% |
| 2022 | neutral_mixed | 16173 | 5224.40 | 0.3230 | 85.5% |
| 2022 | with_lean | 3923 | 1623.95 | 0.4140 | 88.8% |
| 2022 | with_extreme | 2529 | -539.10 | -0.2132 | 85.9% |
| 2023 | fade_extreme | 2011 | 288.14 | 0.1433 | 84.1% |
| 2023 | fade_lean | 2834 | 428.02 | 0.1510 | 82.9% |
| 2023 | neutral_mixed | 14378 | 3001.97 | 0.2088 | 85.0% |
| 2023 | with_lean | 4063 | 454.29 | 0.1118 | 83.6% |
| 2023 | with_extreme | 3031 | 26.60 | 0.0088 | 83.7% |
| 2024 | fade_extreme | 3961 | 269.33 | 0.0680 | 82.9% |
| 2024 | fade_lean | 2144 | 1502.36 | 0.7007 | 88.3% |
| 2024 | neutral_mixed | 12986 | 297.04 | 0.0229 | 80.9% |
| 2024 | with_lean | 2303 | -1327.07 | -0.5762 | 78.8% |
| 2024 | with_extreme | 4670 | -5463.97 | -1.1700 | 73.9% |
| 2025 | fade_extreme | 2083 | 1515.40 | 0.7275 | 89.9% |
| 2025 | fade_lean | 2235 | 791.58 | 0.3542 | 82.2% |
| 2025 | neutral_mixed | 9499 | 4327.70 | 0.4556 | 87.0% |
| 2025 | with_lean | 3258 | 269.00 | 0.0826 | 82.0% |
| 2025 | with_extreme | 3150 | 1931.51 | 0.6132 | 85.2% |
| 2026 | fade_extreme | 1761 | -150.90 | -0.0857 | 79.8% |
| 2026 | fade_lean | 1091 | 483.89 | 0.4435 | 84.8% |
| 2026 | neutral_mixed | 5106 | 1548.86 | 0.3033 | 85.1% |
| 2026 | with_lean | 1396 | -413.45 | -0.2962 | 78.2% |
| 2026 | with_extreme | 2483 | 1420.76 | 0.5722 | 89.3% |


### Exact 156-snapshot full-window slice

Coverage: eligible 183596, cot-matched 183512, scored 111084, missing score 21765, not full-window 50663.

#### Score Regime Buckets

| bucket | pair-sides | ADR | avg ADR | win % |
| --- | --- | --- | --- | --- |
| low_continuation | 19018 | 4508.23 | 0.2371 | 84.8% |
| neutral | 65717 | 14312.07 | 0.2178 | 84.6% |
| high_exhaustion | 26349 | -1341.68 | -0.0509 | 81.8% |


#### Selected-Side Polarity Buckets

| bucket | pair-sides | ADR | avg ADR | win % |
| --- | --- | --- | --- | --- |
| fade_extreme | 11337 | 1565.61 | 0.1381 | 83.7% |
| fade_lean | 10799 | 3530.51 | 0.3269 | 84.4% |
| neutral_mixed | 58142 | 14399.97 | 0.2477 | 84.6% |
| with_lean | 14943 | 606.72 | 0.0406 | 83.4% |
| with_extreme | 15863 | -2624.20 | -0.1654 | 82.3% |


#### Top Variant Attribution

| variant | scored pair-sides | ADR | avg | fade ADR | fade avg | neutral ADR | with ADR | with avg |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| strength_friday_snapshot_selected | 6036 | 1178.96 | 0.1953 | 371.79 | 0.2548 | 961.23 | -154.06 | -0.1089 |
| cot_faces_v1_forced_opposite | 6010 | 1052.67 | 0.1752 | 344.49 | 0.1388 | 770.39 | -62.21 | -0.1629 |
| cot_faces_v1_commercial_delta_contrarian_selected | 6003 | 1025.78 | 0.1709 | 205.82 | 0.5277 | 855.04 | -35.08 | -0.0142 |
| cot_faces_v1_commercial_delta_contrarian_opposite | 6010 | 1022.85 | 0.1702 | 382.39 | 0.1546 | 682.05 | -41.59 | -0.1066 |
| cot_faces_v1_forced_selected | 6003 | 995.96 | 0.1659 | 243.71 | 0.6380 | 766.70 | -14.46 | -0.0058 |
| strength_open_canonical_fade | 5959 | 856.08 | 0.1437 | 203.30 | 0.1419 | 726.96 | -74.18 | -0.0525 |
| strength_open_canonical_selected | 5942 | 819.60 | 0.1379 | 349.80 | 0.2477 | 573.72 | -103.92 | -0.0728 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_disagree_cot | 4557 | 802.19 | 0.1760 | 138.98 | 0.4664 | 586.90 | 76.31 | 0.0402 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | 2894 | 727.84 | 0.2515 | 222.41 | 0.1786 | 489.78 | 15.65 | 0.0846 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 2894 | 707.36 | 0.2444 | 229.90 | 0.1841 | 471.82 | 5.65 | 0.0312 |
| strength_friday_snapshot_open_canonical_fade_agree | 2892 | 698.38 | 0.2415 | 207.91 | 0.2932 | 550.16 | -59.69 | -0.0888 |
| strength_friday_snapshot_fade | 6033 | 616.52 | 0.1022 | 191.15 | 0.1348 | 411.35 | 14.01 | 0.0096 |


## TFF leveraged-money sensitivity

Crowd field: `lev_money_net`.
First min-52 score date: 2019-12-31. First full-156 score date: 2021-12-28.

### Minimum 52-snapshot expanding/rolling slice

Coverage: eligible 183596, cot-matched 183512, scored 161747, missing score 21765, not full-window 0.

#### Score Regime Buckets

| bucket | pair-sides | ADR | avg ADR | win % |
| --- | --- | --- | --- | --- |
| low_continuation | 35001 | 7887.83 | 0.2254 | 84.4% |
| neutral | 92171 | 11397.55 | 0.1237 | 84.0% |
| high_exhaustion | 34575 | 706.07 | 0.0204 | 82.5% |


#### Selected-Side Polarity Buckets

| bucket | pair-sides | ADR | avg ADR | win % |
| --- | --- | --- | --- | --- |
| fade_extreme | 13233 | 679.05 | 0.0513 | 82.5% |
| fade_lean | 15700 | 2072.24 | 0.1320 | 83.0% |
| neutral_mixed | 92398 | 19683.85 | 0.2130 | 84.2% |
| with_lean | 21577 | 848.59 | 0.0393 | 84.4% |
| with_extreme | 18839 | -3292.29 | -0.1748 | 82.4% |


#### Top Variant Attribution

| variant | scored pair-sides | ADR | avg | fade ADR | fade avg | neutral ADR | with ADR | with avg |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| strength_friday_snapshot_selected | 8935 | 1314.30 | 0.1471 | 154.65 | 0.0818 | 1244.32 | -84.67 | -0.0431 |
| cot_faces_v1_commercial_delta_contrarian_selected | 8887 | 1177.43 | 0.1325 | 142.66 | 0.2792 | 1216.09 | -181.32 | -0.0544 |
| cot_faces_v1_forced_selected | 8887 | 1119.77 | 0.1260 | 75.84 | 0.1523 | 1227.16 | -183.23 | -0.0548 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_disagree_cot | 6822 | 943.48 | 0.1383 | 135.53 | 0.3457 | 893.50 | -85.55 | -0.0326 |
| cot_faces_v1_forced_opposite | 8894 | 927.09 | 0.1042 | 288.12 | 0.0861 | 726.20 | -87.23 | -0.1752 |
| strength_open_canonical_selected | 8418 | 900.15 | 0.1069 | 53.81 | 0.0324 | 1138.75 | -292.41 | -0.1492 |
| cot_faces_v1_commercial_delta_contrarian_opposite | 8894 | 869.44 | 0.0978 | 221.31 | 0.0664 | 737.27 | -89.14 | -0.1744 |
| strength_open_canonical_fade | 8435 | 833.82 | 0.0989 | 125.65 | 0.0639 | 751.61 | -43.44 | -0.0261 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | 4295 | 785.27 | 0.1828 | 142.90 | 0.0876 | 514.69 | 127.67 | 0.4949 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 4296 | 770.47 | 0.1793 | 175.75 | 0.1073 | 478.02 | 116.69 | 0.4649 |
| dealer_commercial_agreement_selected | 3532 | 690.84 | 0.1956 | 125.01 | 0.2174 | 563.99 | 1.84 | 0.0022 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | 4356 | 690.59 | 0.1585 | 60.94 | 0.2518 | 777.89 | -148.24 | -0.0871 |


### Exact 156-snapshot full-window slice

Coverage: eligible 183596, cot-matched 183512, scored 111084, missing score 21765, not full-window 50663.

#### Score Regime Buckets

| bucket | pair-sides | ADR | avg ADR | win % |
| --- | --- | --- | --- | --- |
| low_continuation | 29289 | 8367.08 | 0.2857 | 84.7% |
| neutral | 64396 | 10959.24 | 0.1702 | 84.4% |
| high_exhaustion | 17399 | -1847.70 | -0.1062 | 81.4% |


#### Selected-Side Polarity Buckets

| bucket | pair-sides | ADR | avg ADR | win % |
| --- | --- | --- | --- | --- |
| fade_extreme | 8028 | 331.12 | 0.0412 | 82.6% |
| fade_lean | 11183 | 2202.39 | 0.1969 | 83.8% |
| neutral_mixed | 64528 | 15896.26 | 0.2463 | 84.6% |
| with_lean | 15794 | 2693.99 | 0.1706 | 84.9% |
| with_extreme | 11551 | -3645.13 | -0.3156 | 80.7% |


#### Top Variant Attribution

| variant | scored pair-sides | ADR | avg | fade ADR | fade avg | neutral ADR | with ADR | with avg |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| strength_friday_snapshot_selected | 6036 | 1178.96 | 0.1953 | 195.53 | 0.1548 | 1021.76 | -38.34 | -0.0303 |
| cot_faces_v1_forced_opposite | 6010 | 1052.67 | 0.1752 | 151.63 | 0.0678 | 891.48 | 9.57 | 0.0344 |
| cot_faces_v1_commercial_delta_contrarian_selected | 6003 | 1025.78 | 0.1709 | 144.29 | 0.4908 | 902.76 | -21.28 | -0.0096 |
| cot_faces_v1_commercial_delta_contrarian_opposite | 6010 | 1022.85 | 0.1702 | 138.29 | 0.0622 | 879.73 | 4.83 | 0.0164 |
| cot_faces_v1_forced_selected | 6003 | 995.96 | 0.1659 | 130.95 | 0.4710 | 891.02 | -26.02 | -0.0116 |
| strength_open_canonical_fade | 5959 | 856.08 | 0.1437 | 146.32 | 0.1140 | 737.02 | -27.26 | -0.0222 |
| strength_open_canonical_selected | 5942 | 819.60 | 0.1379 | 117.07 | 0.0953 | 774.56 | -72.03 | -0.0564 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_disagree_cot | 4557 | 802.19 | 0.1760 | 125.70 | 0.5587 | 620.84 | 55.65 | 0.0326 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | 2894 | 727.84 | 0.2515 | 128.53 | 0.1168 | 500.99 | 98.32 | 0.6973 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 2894 | 707.36 | 0.2444 | 131.81 | 0.1186 | 480.54 | 95.01 | 0.6986 |
| strength_friday_snapshot_open_canonical_fade_agree | 2892 | 698.38 | 0.2415 | 124.42 | 0.2013 | 584.11 | -10.14 | -0.0172 |
| strength_friday_snapshot_fade | 6033 | 616.52 | 0.1022 | 62.38 | 0.0492 | 597.88 | -43.75 | -0.0347 |
