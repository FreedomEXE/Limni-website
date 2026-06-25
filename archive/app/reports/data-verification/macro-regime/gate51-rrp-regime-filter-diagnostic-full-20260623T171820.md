# Gate 51A RRP Regime Filter Diagnostic

Generated: 2026-06-23T17:18:20.919Z

## Result

- Status: PASS_RRP_DIAGNOSTIC_ATTRIBUTION
- Gate: Gate 51A: rrp-regime-filter-research-suite diagnostic attribution
- Mode: full
- Variants tested: 35
- Thresholds: 1 RRP percentage points
- Pair attribution rows: 183879
- ADR-normalized reporting: true
- Raw returns reported: false
- Diagnostic against legacy baseline: true
- Full-stack source-promotion claim: false
- Production claim: false
- Source refetch/rebuild: false/false

## Boundary

- RRP is PROMOTED_SOURCE.
- Gate 44 matrix, COT, COT Faces, Dealer/Commercial, Strength, and ADR Grid are FROZEN_LEGACY_DATASET for this diagnostic.
- BPR, PPP, NEER, REER, valuation, and combined macro regime are OUT_OF_SCOPE.
- This receipt uses existing warehouse outcomes and pair contributions; it does not rerun execution, refetch sources, or promote a live decision.

## Top Block-Fade Filters

| Variant | Thr | Rows | Total ADR | Delta vs Base | Max DD | R/DD | Path Sharpe | Profit Factor | Win Active | Worst Year |
| strength_friday_snapshot_open_canonical_fade_agree | 1.00 | 3410 | 463.39 | -235.02 | -162.19 | 2.86 | 0.55 | 1.25 | 0.71 | 2021 -10.74 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 1.00 | 3909 | 682.63 | -61.48 | -242.49 | 2.82 | 0.78 | 1.35 | 0.70 | 2020 -67.46 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | 1.00 | 3902 | 635.62 | -96.00 | -255.71 | 2.49 | 0.71 | 1.32 | 0.71 | 2026 -76.74 |
| strength_friday_snapshot_selected | 1.00 | 7565 | 818.63 | -404.66 | -331.68 | 2.47 | 0.49 | 1.22 | 0.68 | 2024 -107.99 |
| dealer_commercial_agreement_open_strength_agree | 1.00 | 1228 | 346.05 | 5.81 | -208.82 | 1.66 | 0.62 | 1.48 | 0.79 | 2024 -76.67 |
| dealer_commercial_agreement_open_friday_strength_agree | 1.00 | 619 | 214.24 | 88.49 | -152.64 | 1.40 | 0.60 | 1.65 | 0.80 | 2024 -122.81 |
| dealer_commercial_agreement_selected | 1.00 | 2718 | 398.92 | -204.22 | -299.60 | 1.33 | 0.48 | 1.24 | 0.74 | 2024 -173.26 |
| cot_faces_v1_forced_strength_open_canonical_disagree_cot | 1.00 | 3066 | 355.01 | -265.05 | -288.26 | 1.23 | 0.40 | 1.19 | 0.72 | 2021 -53.06 |
| strength_friday_snapshot_open_canonical_fade_friday_remainder | 1.00 | 4155 | 355.24 | -169.64 | -296.58 | 1.20 | 0.27 | 1.14 | 0.72 | 2024 -100.46 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | 1.00 | 3226 | 428.08 | -202.15 | -365.83 | 1.17 | 0.32 | 1.22 | 0.74 | 2020 -113.79 |
| dealer_commercial_agreement_friday_strength_fade_agree | 1.00 | 1337 | 148.97 | -169.68 | -128.28 | 1.16 | 0.28 | 1.14 | 0.77 | 2019 -94.68 |
| dealer_commercial_agreement_friday_strength_agree | 1.00 | 1348 | 270.52 | -34.54 | -237.26 | 1.14 | 0.50 | 1.32 | 0.79 | 2024 -191.67 |
| cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree | 1.00 | 1692 | 264.55 | -127.90 | -237.35 | 1.11 | 0.34 | 1.24 | 0.76 | 2024 -115.41 |
| cot_faces_v1_commercial_delta_contrarian_selected | 1.00 | 7085 | 599.56 | -575.32 | -542.70 | 1.10 | 0.32 | 1.16 | 0.74 | 2020 -112.30 |
| cot_faces_v1_forced_opposite | 1.00 | 7912 | 650.94 | -296.75 | -595.40 | 1.09 | 0.38 | 1.16 | 0.67 | 2020 -270.32 |
| strength_open_canonical_fade | 1.00 | 6727 | 497.00 | -508.19 | -488.45 | 1.02 | 0.32 | 1.14 | 0.67 | 2023 -331.72 |
| cot_faces_v1_forced_selected | 1.00 | 7093 | 511.06 | -557.82 | -559.56 | 0.91 | 0.27 | 1.13 | 0.71 | 2024 -144.47 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree | 1.00 | 1572 | 163.40 | -100.26 | -179.50 | 0.91 | 0.31 | 1.15 | 0.74 | 2024 -72.82 |
| cot_faces_v1_commercial_delta_contrarian_opposite | 1.00 | 7920 | 562.44 | -279.25 | -630.27 | 0.89 | 0.32 | 1.14 | 0.67 | 2020 -266.84 |
| cot_faces_v1_commercial_delta_contrarian_open_strength_fade_agree | 1.00 | 3027 | 282.82 | -254.13 | -317.51 | 0.89 | 0.30 | 1.14 | 0.73 | 2023 -154.23 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_disagree_cot | 1.00 | 3027 | 282.82 | -254.13 | -317.51 | 0.89 | 0.30 | 1.14 | 0.73 | 2023 -154.23 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_cot | 1.00 | 3362 | 393.22 | -281.82 | -463.91 | 0.85 | 0.33 | 1.19 | 0.76 | 2020 -181.76 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_disagree_cot | 1.00 | 5513 | 436.16 | -475.05 | -543.50 | 0.80 | 0.25 | 1.14 | 0.72 | 2020 -127.60 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_agree | 1.00 | 3627 | 273.50 | -293.50 | -341.82 | 0.80 | 0.24 | 1.12 | 0.71 | 2024 -188.23 |
| cot_faces_v1_forced_strength_open_canonical_agree | 1.00 | 3189 | 294.01 | -174.18 | -389.26 | 0.76 | 0.22 | 1.14 | 0.72 | 2020 -138.41 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_cot | 1.00 | 3377 | 351.72 | -229.80 | -468.18 | 0.75 | 0.31 | 1.16 | 0.74 | 2020 -177.56 |
| strength_open_canonical_selected | 1.00 | 6731 | 506.71 | -258.52 | -674.64 | 0.75 | 0.26 | 1.13 | 0.68 | 2020 -293.32 |
| cot_faces_v1_forced_strength_friday_snapshot_agree | 1.00 | 3620 | 226.49 | -328.02 | -366.78 | 0.62 | 0.20 | 1.10 | 0.71 | 2024 -216.63 |
| cot_faces_v1_forced_strength_open_canonical_disagree_strength | 1.00 | 3485 | 266.88 | -57.21 | -478.42 | 0.56 | 0.26 | 1.12 | 0.71 | 2020 -184.95 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_disagree_strength | 1.00 | 3448 | 132.81 | -29.24 | -472.73 | 0.28 | 0.12 | 1.06 | 0.71 | 2020 -209.56 |
| strength_friday_snapshot_fade | 1.00 | 7359 | 102.18 | -503.69 | -724.44 | 0.14 | 0.05 | 1.02 | 0.69 | 2020 -383.28 |
| dealer_commercial_agreement_open_strength_fade_agree | 1.00 | 1208 | 17.17 | -113.17 | -234.49 | 0.07 | 0.03 | 1.02 | 0.75 | 2024 -96.58 |
| strength_friday_snapshot_open_canonical_fade_open_fade_remainder | 1.00 | 3317 | 33.60 | -273.17 | -562.30 | 0.06 | 0.03 | 1.01 | 0.72 | 2023 -413.32 |
| dealer_commercial_agreement_friday_open_fade_agree | 1.00 | 622 | 9.05 | -37.14 | -154.41 | 0.06 | 0.03 | 1.02 | 0.79 | 2024 -68.86 |

## Top Confirm vs Fade Separation

| Variant | Thr | Confirm Rows | Fade Rows | Confirm ADR/Pair | Fade ADR/Pair | Spread | Block-Fade Delta |
| dealer_commercial_agreement_open_friday_strength_agree | 1.00 | 212 | 284 | 0.0646 | -0.3116 | 0.3761 | 88.49 |
| dealer_commercial_agreement_open_strength_agree | 1.00 | 403 | 561 | 0.2634 | -0.0104 | 0.2738 | 5.81 |
| cot_faces_v1_forced_strength_open_canonical_disagree_strength | 1.00 | 1420 | 1001 | 0.1882 | 0.0572 | 0.1311 | -57.21 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_disagree_strength | 1.00 | 1415 | 994 | 0.1061 | 0.0294 | 0.0766 | -29.24 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 1.00 | 1648 | 1116 | 0.0593 | 0.0551 | 0.0042 | -61.48 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | 1.00 | 1654 | 1114 | 0.0464 | 0.0862 | -0.0398 | -96.00 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree | 1.00 | 526 | 705 | 0.0236 | 0.1422 | -0.1186 | -100.26 |
| dealer_commercial_agreement_friday_strength_agree | 1.00 | 468 | 656 | -0.0708 | 0.0527 | -0.1234 | -34.54 |
| dealer_commercial_agreement_selected | 1.00 | 891 | 1361 | 0.0013 | 0.1501 | -0.1488 | -204.22 |
| cot_faces_v1_forced_opposite | 1.00 | 3239 | 2420 | -0.0318 | 0.1226 | -0.1545 | -296.75 |
| strength_friday_snapshot_open_canonical_fade_agree | 1.00 | 1323 | 1208 | 0.0363 | 0.1946 | -0.1583 | -235.02 |
| strength_open_canonical_selected | 1.00 | 2534 | 2530 | -0.0575 | 0.1022 | -0.1597 | -258.52 |
| dealer_commercial_agreement_friday_strength_fade_agree | 1.00 | 418 | 705 | 0.0789 | 0.2407 | -0.1617 | -169.68 |
| cot_faces_v1_commercial_delta_contrarian_opposite | 1.00 | 3247 | 2412 | -0.0567 | 0.1158 | -0.1725 | -279.25 |
| strength_friday_snapshot_selected | 1.00 | 2933 | 2727 | -0.1211 | 0.1484 | -0.2695 | -404.66 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_cot | 1.00 | 1114 | 1654 | -0.1507 | 0.1704 | -0.3211 | -281.82 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | 1.00 | 1104 | 1509 | -0.1922 | 0.1340 | -0.3261 | -202.15 |
| cot_faces_v1_forced_strength_open_canonical_disagree_cot | 1.00 | 1001 | 1420 | -0.1530 | 0.1867 | -0.3396 | -265.05 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_cot | 1.00 | 1116 | 1648 | -0.2043 | 0.1394 | -0.3437 | -229.80 |
| strength_friday_snapshot_open_canonical_fade_friday_remainder | 1.00 | 1610 | 1519 | -0.2504 | 0.1117 | -0.3621 | -169.64 |
| dealer_commercial_agreement_friday_open_fade_agree | 1.00 | 222 | 280 | -0.2447 | 0.1326 | -0.3773 | -37.14 |
| cot_faces_v1_commercial_delta_contrarian_open_strength_fade_agree | 1.00 | 994 | 1415 | -0.1982 | 0.1796 | -0.3778 | -254.13 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_disagree_cot | 1.00 | 994 | 1415 | -0.1982 | 0.1796 | -0.3778 | -254.13 |
| strength_friday_snapshot_fade | 1.00 | 2727 | 2933 | -0.2166 | 0.1717 | -0.3883 | -503.69 |
| cot_faces_v1_commercial_delta_contrarian_selected | 1.00 | 2412 | 3247 | -0.2171 | 0.1772 | -0.3943 | -575.32 |
| cot_faces_v1_forced_strength_open_canonical_agree | 1.00 | 1099 | 1502 | -0.2997 | 0.1160 | -0.4156 | -174.18 |
| strength_open_canonical_fade | 1.00 | 2530 | 2534 | -0.2161 | 0.2005 | -0.4166 | -508.19 |
| cot_faces_v1_forced_selected | 1.00 | 2420 | 3239 | -0.2499 | 0.1722 | -0.4221 | -557.82 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_agree | 1.00 | 1272 | 1593 | -0.2660 | 0.1842 | -0.4503 | -293.50 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_disagree_cot | 1.00 | 1886 | 2542 | -0.2842 | 0.1869 | -0.4711 | -475.05 |
| cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree | 1.00 | 604 | 716 | -0.3030 | 0.1786 | -0.4816 | -127.90 |
| cot_faces_v1_forced_strength_friday_snapshot_agree | 1.00 | 1278 | 1591 | -0.2812 | 0.2062 | -0.4874 | -328.02 |
| dealer_commercial_agreement_open_strength_fade_agree | 1.00 | 408 | 606 | -0.3666 | 0.1867 | -0.5533 | -113.17 |
| strength_friday_snapshot_open_canonical_fade_open_fade_remainder | 1.00 | 1207 | 1326 | -0.4927 | 0.2060 | -0.6987 | -273.17 |

## Files

- JSON: app\reports\data-verification\macro-regime\gate51-rrp-regime-filter-diagnostic-full-20260623T171820.json
- Markdown: app\reports\data-verification\macro-regime\gate51-rrp-regime-filter-diagnostic-full-20260623T171820.md

No live, ACTIVE, production-ready, portfolio-ready, BPR, PPP, NEER, REER, valuation, or combined-regime claim is made by this receipt.
