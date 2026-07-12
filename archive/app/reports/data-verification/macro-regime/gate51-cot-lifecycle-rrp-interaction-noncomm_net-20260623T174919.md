# Gate 51B COT Lifecycle x RRP Interaction Diagnostic

Generated: 2026-06-23T17:49:19.605Z

## Result

- Status: PASS_COT_LIFECYCLE_RRP_INTERACTION_DIAGNOSTIC
- Gate: Gate 51B: cot-lifecycle-rrp-interaction-diagnostic
- Variants tested: 35
- Pair rows with lifecycle and RRP: 111204
- Crowd leg: noncomm_net
- Lifecycle lookback: 156
- RRP threshold: 1
- ADR-normalized reporting: true
- Raw returns reported: false

## Boundary

- This is a read-only diagnostic against the frozen Gate 44 matrix and promoted Gate 50 RRP dataset.
- It does not rerun ADR Grid execution, refetch COT/RRP sources, change lifecycle controls, or make a live/production/promotion claim.
- COT lifecycle is a research baseline candidate only unless later promotion gates audit and lock it.

## Gate 46 Reproduction Check

- Exact match to prior Gate 46 published counts: false

## Top Lifecycle Polarity x RRP Buckets

| Variant | Lifecycle | RRP | Rows | Total ADR | Avg ADR/Pair | R/DD | Sharpe | PF |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_cot | fade_lean | confirm | 116 | 120.13 | 1.0356 | 7.70 | 1.75 | 6.33 |
| dealer_commercial_agreement_friday_strength_fade_agree | with_lean | weak | 95 | 95.70 | 1.0073 | 14.18 | 1.66 | 5.03 |
| cot_faces_v1_forced_strength_open_canonical_disagree_cot | fade_lean | confirm | 107 | 97.78 | 0.9139 | 6.27 | 1.49 | 4.74 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree | fade_lean | confirm | 54 | 45.69 | 0.8462 | 8.79 | 1.48 | 5.89 |
| dealer_commercial_agreement_selected | with_lean | weak | 206 | 172.18 | 0.8358 | 9.86 | 1.96 | 3.95 |
| dealer_commercial_agreement_open_strength_fade_agree | with_lean | weak | 109 | 88.91 | 0.8157 | 9.54 | 1.52 | 3.73 |
| dealer_commercial_agreement_open_strength_agree | with_lean | weak | 93 | 74.59 | 0.8021 | 7.28 | 1.26 | 3.45 |
| dealer_commercial_agreement_open_friday_strength_agree | fade_lean | weak | 56 | 44.17 | 0.7888 | 4.41 | 1.18 | 3.94 |
| cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree | fade_lean | weak | 70 | 53.43 | 0.7632 | 7.28 | 1.34 | 3.49 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree | fade_lean | all | 172 | 130.81 | 0.7605 | 15.21 | 1.93 | 4.48 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_agree | fade_lean | weak | 133 | 98.82 | 0.7430 | 9.11 | 1.56 | 3.29 |
| dealer_commercial_agreement_friday_strength_agree | fade_lean | confirm | 79 | 58.60 | 0.7418 | 13.40 | 1.61 | 4.52 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree | fade_lean | fade | 56 | 41.32 | 0.7379 | 6.23 | 1.18 | 3.70 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | fade_lean | confirm | 124 | 91.49 | 0.7378 | 10.44 | 1.41 | 3.20 |
| cot_faces_v1_forced_selected | fade_lean | confirm | 234 | 167.01 | 0.7137 | 5.24 | 1.56 | 2.97 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree | fade_lean | weak | 62 | 43.79 | 0.7063 | 2.90 | 0.91 | 2.53 |
| dealer_commercial_agreement_selected | fade_lean | confirm | 141 | 98.99 | 0.7020 | 2.66 | 1.04 | 2.84 |
| dealer_commercial_agreement_friday_strength_fade_agree | neutral_mixed | weak | 202 | 140.62 | 0.6962 | 8.26 | 1.49 | 2.82 |
| dealer_commercial_agreement_open_friday_strength_agree | with_lean | weak | 57 | 39.35 | 0.6904 | 4.23 | 0.86 | 2.72 |
| dealer_commercial_agreement_open_strength_fade_agree | fade_lean | confirm | 64 | 44.13 | 0.6896 | 2.00 | 0.64 | 2.59 |
| dealer_commercial_agreement_friday_strength_agree | with_lean | weak | 111 | 76.49 | 0.6891 | 4.76 | 1.23 | 2.88 |
| dealer_commercial_agreement_friday_open_fade_agree | with_lean | weak | 54 | 37.13 | 0.6877 | 4.12 | 1.01 | 3.04 |
| cot_faces_v1_forced_strength_friday_snapshot_agree | fade_lean | weak | 131 | 89.74 | 0.6851 | 8.27 | 1.42 | 2.85 |
| dealer_commercial_agreement_open_strength_agree | fade_lean | confirm | 75 | 50.50 | 0.6733 | 2.59 | 0.80 | 2.91 |
| cot_faces_v1_forced_strength_open_canonical_disagree_strength | fade_extreme | weak | 51 | 34.00 | 0.6666 | 2.76 | 0.81 | 2.43 |
| cot_faces_v1_forced_strength_open_canonical_agree | fade_lean | weak | 119 | 79.18 | 0.6654 | 3.07 | 0.89 | 2.49 |
| dealer_commercial_agreement_friday_strength_fade_agree | fade_lean | confirm | 62 | 40.38 | 0.6514 | 1.13 | 0.49 | 2.06 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | fade_lean | weak | 119 | 75.37 | 0.6334 | 2.92 | 0.86 | 2.42 |
| cot_faces_v1_forced_strength_open_canonical_disagree_cot | with_lean | weak | 368 | 228.82 | 0.6218 | 6.89 | 1.47 | 2.58 |
| cot_faces_v1_commercial_delta_contrarian_open_strength_fade_agree | with_lean | weak | 368 | 228.75 | 0.6216 | 6.57 | 1.46 | 2.59 |

## Top Lifecycle Score x RRP Buckets

| Variant | Lifecycle | RRP | Rows | Total ADR | Avg ADR/Pair | R/DD | Sharpe | PF |
| dealer_commercial_agreement_friday_strength_fade_agree | low_continuation | weak | 345 | 213.41 | 0.6186 | 2.69 | 0.92 | 2.16 |
| dealer_commercial_agreement_open_friday_strength_agree | low_continuation | weak | 206 | 125.10 | 0.6073 | 6.81 | 1.27 | 2.44 |
| dealer_commercial_agreement_open_strength_agree | low_continuation | weak | 362 | 203.78 | 0.5629 | 3.31 | 1.05 | 2.33 |
| cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree | low_continuation | weak | 542 | 274.58 | 0.5066 | 6.75 | 1.35 | 2.31 |
| dealer_commercial_agreement_selected | low_continuation | weak | 726 | 352.63 | 0.4857 | 4.39 | 1.02 | 1.99 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | neutral | fade | 91 | 43.74 | 0.4806 | 2.25 | 0.56 | 1.84 |
| strength_friday_snapshot_open_canonical_fade_open_fade_remainder | low_continuation | weak | 1005 | 476.43 | 0.4741 | 5.99 | 1.35 | 2.14 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_disagree_cot | low_continuation | weak | 1458 | 645.72 | 0.4429 | 8.83 | 1.47 | 2.29 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree | neutral | confirm | 62 | 27.02 | 0.4358 | 2.12 | 0.50 | 1.99 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_cot | low_continuation | weak | 908 | 375.11 | 0.4131 | 4.17 | 1.00 | 1.85 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_agree | low_continuation | weak | 1006 | 405.50 | 0.4031 | 5.48 | 1.10 | 1.91 |
| cot_faces_v1_forced_selected | low_continuation | weak | 1912 | 769.24 | 0.4023 | 8.92 | 1.36 | 2.07 |
| strength_open_canonical_fade | low_continuation | weak | 1886 | 758.42 | 0.4021 | 8.57 | 1.35 | 2.02 |
| cot_faces_v1_commercial_delta_contrarian_selected | low_continuation | weak | 1912 | 765.03 | 0.4001 | 9.42 | 1.37 | 2.09 |
| cot_faces_v1_forced_strength_open_canonical_agree | low_continuation | weak | 962 | 383.92 | 0.3991 | 5.38 | 1.00 | 1.89 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_cot | low_continuation | weak | 906 | 359.53 | 0.3968 | 4.00 | 0.98 | 1.82 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | low_continuation | weak | 969 | 384.17 | 0.3965 | 5.38 | 1.01 | 1.90 |
| cot_faces_v1_forced_strength_friday_snapshot_agree | low_continuation | weak | 1004 | 394.13 | 0.3926 | 5.11 | 1.07 | 1.88 |
| cot_faces_v1_commercial_delta_contrarian_open_strength_fade_agree | low_continuation | weak | 917 | 348.53 | 0.3801 | 5.18 | 0.88 | 1.71 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_disagree_cot | low_continuation | weak | 917 | 348.53 | 0.3801 | 5.18 | 0.88 | 1.71 |
| cot_faces_v1_forced_strength_open_canonical_disagree_cot | low_continuation | weak | 924 | 350.80 | 0.3797 | 5.01 | 0.89 | 1.72 |
| dealer_commercial_agreement_open_strength_fade_agree | low_continuation | weak | 352 | 131.73 | 0.3742 | 1.77 | 0.53 | 1.55 |
| strength_friday_snapshot_open_canonical_fade_friday_remainder | low_continuation | weak | 1031 | 378.54 | 0.3672 | 3.66 | 1.03 | 1.79 |
| dealer_commercial_agreement_friday_strength_agree | low_continuation | weak | 381 | 139.22 | 0.3654 | 1.81 | 0.55 | 1.59 |
| dealer_commercial_agreement_friday_strength_fade_agree | low_continuation | fade | 375 | 135.27 | 0.3607 | 2.38 | 0.72 | 1.71 |
| dealer_commercial_agreement_friday_strength_fade_agree | low_continuation | all | 967 | 337.91 | 0.3494 | 3.19 | 0.87 | 1.66 |
| strength_friday_snapshot_selected | low_continuation | weak | 1912 | 660.53 | 0.3455 | 6.52 | 1.11 | 1.84 |
| strength_friday_snapshot_open_canonical_fade_agree | low_continuation | weak | 881 | 281.99 | 0.3201 | 4.45 | 0.75 | 1.57 |
| strength_friday_snapshot_fade | low_continuation | weak | 1912 | 608.99 | 0.3185 | 2.82 | 0.94 | 1.72 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | low_continuation | weak | 908 | 266.39 | 0.2934 | 2.70 | 0.70 | 1.54 |

## Files

- JSON: app\reports\data-verification\macro-regime\gate51-cot-lifecycle-rrp-interaction-noncomm_net-20260623T174919.json
- Markdown: app\reports\data-verification\macro-regime\gate51-cot-lifecycle-rrp-interaction-noncomm_net-20260623T174919.md

No live, ACTIVE, production-ready, portfolio-ready, or full-stack source-promotion claim is made by this receipt.
