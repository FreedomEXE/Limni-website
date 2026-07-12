# Gate 51A RRP Regime Filter Diagnostic

Generated: 2026-06-23T16:48:30.623Z

## Result

- Status: PASS_RRP_DIAGNOSTIC_ATTRIBUTION
- Gate: Gate 51A: rrp-regime-filter-research-suite diagnostic attribution
- Mode: full
- Variants tested: 35
- Thresholds: 0, 0.25, 0.5, 1 RRP percentage points
- Pair attribution rows: 183596
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
| strength_friday_snapshot_open_canonical_fade_agree | 1.00 | 3409 | 463.39 | -235.02 | -162.19 | 2.86 | 0.71 | 2021 -10.74 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 1.00 | 3906 | 682.63 | -61.48 | -242.49 | 2.82 | 0.70 | 2020 -67.46 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | 1.00 | 3899 | 635.62 | -96.00 | -255.71 | 2.49 | 0.71 | 2026 -76.74 |
| strength_friday_snapshot_selected | 1.00 | 7556 | 818.63 | -404.66 | -331.68 | 2.47 | 0.68 | 2024 -107.99 |
| strength_friday_snapshot_open_canonical_fade_agree | 0.50 | 2933 | 390.30 | -308.11 | -204.48 | 1.91 | 0.74 | 2021 -41.02 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 0.50 | 3363 | 440.52 | -303.59 | -252.49 | 1.74 | 0.71 | 2020 -98.95 |
| dealer_commercial_agreement_open_strength_agree | 1.00 | 1223 | 346.05 | 5.81 | -208.82 | 1.66 | 0.79 | 2024 -76.67 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | 0.50 | 3347 | 393.10 | -338.53 | -258.71 | 1.52 | 0.71 | 2020 -97.53 |
| dealer_commercial_agreement_open_friday_strength_agree | 1.00 | 616 | 214.24 | 88.49 | -152.64 | 1.40 | 0.80 | 2024 -122.81 |
| dealer_commercial_agreement_open_friday_strength_agree | 0.50 | 531 | 191.44 | 65.69 | -143.27 | 1.34 | 0.81 | 2024 -117.70 |
| dealer_commercial_agreement_selected | 1.00 | 2712 | 398.92 | -204.22 | -299.60 | 1.33 | 0.74 | 2024 -173.26 |
| strength_friday_snapshot_selected | 0.50 | 6515 | 530.59 | -692.70 | -409.64 | 1.30 | 0.67 | 2021 -136.45 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 0.00 | 2728 | 346.89 | -397.22 | -272.04 | 1.28 | 0.72 | 2020 -105.94 |
| cot_faces_v1_forced_strength_open_canonical_disagree_cot | 1.00 | 3064 | 355.01 | -265.05 | -288.26 | 1.23 | 0.72 | 2021 -53.06 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | 0.50 | 2785 | 375.36 | -254.86 | -308.42 | 1.22 | 0.73 | 2024 -123.34 |
| dealer_commercial_agreement_open_strength_agree | 0.50 | 1045 | 248.86 | -91.38 | -206.23 | 1.21 | 0.78 | 2024 -92.65 |
| strength_friday_snapshot_open_canonical_fade_friday_remainder | 1.00 | 4147 | 355.24 | -169.64 | -296.58 | 1.20 | 0.72 | 2024 -100.46 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 0.25 | 3032 | 380.17 | -363.94 | -320.49 | 1.19 | 0.72 | 2020 -145.37 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | 1.00 | 3216 | 428.08 | -202.15 | -365.83 | 1.17 | 0.74 | 2020 -113.79 |
| dealer_commercial_agreement_friday_strength_fade_agree | 1.00 | 1334 | 148.97 | -169.68 | -128.28 | 1.16 | 0.77 | 2019 -94.68 |

## Top Confirm vs Fade Separation

| Variant | Thr | Confirm Rows | Fade Rows | Confirm ADR/Pair | Fade ADR/Pair | Spread | Block-Fade Delta |
| dealer_commercial_agreement_open_friday_strength_agree | 1.00 | 212 | 283 | 0.0646 | -0.3127 | 0.3772 | 88.49 |
| dealer_commercial_agreement_open_friday_strength_agree | 0.25 | 354 | 422 | 0.1832 | -0.0962 | 0.2794 | 40.58 |
| dealer_commercial_agreement_open_strength_agree | 1.00 | 403 | 557 | 0.2634 | -0.0104 | 0.2739 | 5.81 |
| dealer_commercial_agreement_open_friday_strength_agree | 0.50 | 298 | 368 | 0.0597 | -0.1785 | 0.2382 | 65.69 |
| dealer_commercial_agreement_open_friday_strength_agree | 0.00 | 412 | 487 | 0.2477 | 0.0486 | 0.1991 | -23.68 |
| dealer_commercial_agreement_open_strength_agree | 0.50 | 583 | 735 | 0.2651 | 0.1243 | 0.1408 | -91.38 |
| cot_faces_v1_forced_strength_open_canonical_disagree_strength | 1.00 | 1418 | 999 | 0.1885 | 0.0573 | 0.1312 | -57.21 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_disagree_strength | 1.00 | 1413 | 992 | 0.1062 | 0.0295 | 0.0767 | -29.24 |
| dealer_commercial_agreement_open_strength_agree | 0.25 | 702 | 852 | 0.1924 | 0.1181 | 0.0743 | -100.61 |
| cot_faces_v1_forced_strength_open_canonical_disagree_strength | 0.25 | 2138 | 1775 | 0.1251 | 0.0669 | 0.0581 | -118.81 |
| dealer_commercial_agreement_friday_strength_agree | 0.25 | 786 | 962 | 0.1440 | 0.0912 | 0.0528 | -87.72 |
| cot_faces_v1_forced_strength_open_canonical_disagree_strength | 0.50 | 1860 | 1474 | 0.1761 | 0.1452 | 0.0308 | -214.10 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree | 0.50 | 767 | 936 | 0.1106 | 0.0808 | 0.0298 | -75.59 |
| dealer_commercial_agreement_friday_strength_agree | 0.50 | 660 | 836 | 0.0508 | 0.0359 | 0.0150 | -29.98 |
| dealer_commercial_agreement_friday_strength_agree | 0.00 | 896 | 1104 | 0.1567 | 0.1492 | 0.0075 | -164.70 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | 1.00 | 1646 | 1115 | 0.0594 | 0.0551 | 0.0042 | -61.48 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_disagree_strength | 0.25 | 2113 | 1763 | 0.0534 | 0.0509 | 0.0026 | -89.70 |
| cot_faces_v1_forced_strength_open_canonical_disagree_strength | 0.00 | 2416 | 2062 | 0.0697 | 0.0755 | -0.0059 | -155.76 |
| dealer_commercial_agreement_open_strength_agree | 0.00 | 808 | 972 | 0.1838 | 0.1972 | -0.0134 | -191.71 |
| dealer_commercial_agreement_friday_strength_fade_agree | 0.50 | 612 | 912 | 0.2536 | 0.2688 | -0.0152 | -245.15 |

## Files

- JSON: app\reports\data-verification\macro-regime\gate51-rrp-regime-filter-diagnostic-full-20260623T164830.json
- Markdown: app\reports\data-verification\macro-regime\gate51-rrp-regime-filter-diagnostic-full-20260623T164830.md

No live, ACTIVE, production-ready, portfolio-ready, BPR, PPP, NEER, REER, valuation, or combined-regime claim is made by this receipt.
