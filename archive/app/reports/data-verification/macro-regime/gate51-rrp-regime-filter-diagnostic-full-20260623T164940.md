# Gate 51A RRP Regime Filter Diagnostic

Generated: 2026-06-23T16:49:40.550Z

## Result

- Status: PASS_RRP_DIAGNOSTIC_ATTRIBUTION
- Gate: Gate 51A: rrp-regime-filter-research-suite diagnostic attribution
- Mode: full
- Variants tested: 35
- Thresholds: 0, 0.25, 0.5, 1 RRP percentage points
- Pair attribution rows: 183879
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

| Variant | Thr | Rows | Total ADR | Delta vs Base | Max DD | R/DD | Win Active | Worst Year |
| strength_friday_snapshot_open_canonical_fade_agree | 1.00 | 3410 | 463.39 | -235.02 | -162.19 | 2.86 | 0.71 | 2021 -10.74 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 1.00 | 3909 | 682.63 | -61.48 | -242.49 | 2.82 | 0.70 | 2020 -67.46 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | 1.00 | 3902 | 635.62 | -96.00 | -255.71 | 2.49 | 0.71 | 2026 -76.74 |
| strength_friday_snapshot_selected | 1.00 | 7565 | 818.63 | -404.66 | -331.68 | 2.47 | 0.68 | 2024 -107.99 |
| strength_friday_snapshot_open_canonical_fade_agree | 0.50 | 2934 | 390.30 | -308.11 | -204.48 | 1.91 | 0.74 | 2021 -41.02 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 0.50 | 3365 | 440.52 | -303.59 | -252.49 | 1.74 | 0.71 | 2020 -98.95 |
| dealer_commercial_agreement_open_strength_agree | 1.00 | 1228 | 346.05 | 5.81 | -208.82 | 1.66 | 0.79 | 2024 -76.67 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | 0.50 | 3349 | 393.10 | -338.53 | -258.71 | 1.52 | 0.71 | 2020 -97.53 |
| dealer_commercial_agreement_open_friday_strength_agree | 1.00 | 619 | 214.24 | 88.49 | -152.64 | 1.40 | 0.80 | 2024 -122.81 |
| dealer_commercial_agreement_open_friday_strength_agree | 0.50 | 534 | 191.44 | 65.69 | -143.27 | 1.34 | 0.81 | 2024 -117.70 |
| dealer_commercial_agreement_selected | 1.00 | 2718 | 398.92 | -204.22 | -299.60 | 1.33 | 0.74 | 2024 -173.26 |
| strength_friday_snapshot_selected | 0.50 | 6523 | 530.59 | -692.70 | -409.64 | 1.30 | 0.67 | 2021 -136.45 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 0.00 | 2730 | 346.89 | -397.22 | -272.04 | 1.28 | 0.72 | 2020 -105.94 |
| cot_faces_v1_forced_strength_open_canonical_disagree_cot | 1.00 | 3066 | 355.01 | -265.05 | -288.26 | 1.23 | 0.72 | 2021 -53.06 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | 0.50 | 2794 | 375.36 | -254.86 | -308.42 | 1.22 | 0.73 | 2024 -123.34 |
| dealer_commercial_agreement_open_strength_agree | 0.50 | 1049 | 248.86 | -91.38 | -206.23 | 1.21 | 0.78 | 2024 -92.65 |
| strength_friday_snapshot_open_canonical_fade_friday_remainder | 1.00 | 4155 | 355.24 | -169.64 | -296.58 | 1.20 | 0.72 | 2024 -100.46 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 0.25 | 3034 | 380.17 | -363.94 | -320.49 | 1.19 | 0.72 | 2020 -145.37 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | 1.00 | 3226 | 428.08 | -202.15 | -365.83 | 1.17 | 0.74 | 2020 -113.79 |
| dealer_commercial_agreement_friday_strength_fade_agree | 1.00 | 1337 | 148.97 | -169.68 | -128.28 | 1.16 | 0.77 | 2019 -94.68 |

## Top Confirm vs Fade Separation

| Variant | Thr | Confirm Rows | Fade Rows | Confirm ADR/Pair | Fade ADR/Pair | Spread | Block-Fade Delta |
| dealer_commercial_agreement_open_friday_strength_agree | 1.00 | 212 | 284 | 0.0646 | -0.3116 | 0.3761 | 88.49 |
| dealer_commercial_agreement_open_friday_strength_agree | 0.25 | 354 | 423 | 0.1832 | -0.0959 | 0.2791 | 40.58 |
| dealer_commercial_agreement_open_strength_agree | 1.00 | 403 | 561 | 0.2634 | -0.0104 | 0.2738 | 5.81 |
| dealer_commercial_agreement_open_friday_strength_agree | 0.50 | 298 | 369 | 0.0597 | -0.1780 | 0.2377 | 65.69 |
| dealer_commercial_agreement_open_friday_strength_agree | 0.00 | 412 | 491 | 0.2477 | 0.0482 | 0.1995 | -23.68 |
| dealer_commercial_agreement_open_strength_agree | 0.50 | 583 | 740 | 0.2651 | 0.1235 | 0.1416 | -91.38 |
| cot_faces_v1_forced_strength_open_canonical_disagree_strength | 1.00 | 1420 | 1001 | 0.1882 | 0.0572 | 0.1311 | -57.21 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_disagree_strength | 1.00 | 1415 | 994 | 0.1061 | 0.0294 | 0.0766 | -29.24 |
| dealer_commercial_agreement_open_strength_agree | 0.25 | 702 | 857 | 0.1924 | 0.1174 | 0.0750 | -100.61 |
| cot_faces_v1_forced_strength_open_canonical_disagree_strength | 0.25 | 2141 | 1780 | 0.1249 | 0.0667 | 0.0582 | -118.81 |
| dealer_commercial_agreement_friday_strength_agree | 0.25 | 786 | 963 | 0.1440 | 0.0911 | 0.0529 | -87.72 |
| cot_faces_v1_forced_strength_open_canonical_disagree_strength | 0.50 | 1862 | 1479 | 0.1759 | 0.1448 | 0.0311 | -214.10 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree | 0.50 | 768 | 936 | 0.1104 | 0.0808 | 0.0297 | -75.59 |
| dealer_commercial_agreement_friday_strength_agree | 0.50 | 660 | 837 | 0.0508 | 0.0358 | 0.0150 | -29.98 |
| dealer_commercial_agreement_friday_strength_agree | 0.00 | 896 | 1108 | 0.1567 | 0.1486 | 0.0080 | -164.70 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 1.00 | 1648 | 1116 | 0.0593 | 0.0551 | 0.0042 | -61.48 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_disagree_strength | 0.25 | 2116 | 1768 | 0.0534 | 0.0507 | 0.0026 | -89.70 |
| cot_faces_v1_forced_strength_open_canonical_disagree_strength | 0.00 | 2419 | 2067 | 0.0696 | 0.0754 | -0.0058 | -155.76 |
| dealer_commercial_agreement_open_strength_agree | 0.00 | 809 | 980 | 0.1836 | 0.1956 | -0.0120 | -191.71 |
| dealer_commercial_agreement_friday_strength_fade_agree | 0.50 | 612 | 919 | 0.2536 | 0.2668 | -0.0132 | -245.15 |

## Files

- JSON: app\reports\data-verification\macro-regime\gate51-rrp-regime-filter-diagnostic-full-20260623T164940.json
- Markdown: app\reports\data-verification\macro-regime\gate51-rrp-regime-filter-diagnostic-full-20260623T164940.md

No live, ACTIVE, production-ready, portfolio-ready, BPR, PPP, NEER, REER, valuation, or combined-regime claim is made by this receipt.
