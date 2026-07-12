# Gate 51B COT Lifecycle x RRP Interaction Diagnostic

Generated: 2026-06-23T17:42:06.140Z

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
| dealer_commercial_agreement_friday_open_fade_agree | with_extreme | weak | 106 | 84.42 | 0.7964 | 3.52 | 1.25 | 3.11 |
| dealer_commercial_agreement_open_strength_fade_agree | with_extreme | weak | 228 | 174.76 | 0.7665 | 4.65 | 1.47 | 2.94 |
| dealer_commercial_agreement_friday_strength_fade_agree | with_extreme | weak | 221 | 168.94 | 0.7644 | 9.19 | 1.58 | 3.10 |
| dealer_commercial_agreement_open_friday_strength_agree | fade_extreme | weak | 122 | 87.74 | 0.7192 | 8.07 | 1.61 | 3.62 |
| dealer_commercial_agreement_open_strength_agree | fade_extreme | confirm | 164 | 100.93 | 0.6154 | 2.90 | 0.95 | 2.33 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree | fade_extreme | confirm | 140 | 85.80 | 0.6129 | 3.24 | 1.12 | 2.41 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_cot | fade_extreme | confirm | 292 | 162.01 | 0.5548 | 2.58 | 0.80 | 2.02 |
| dealer_commercial_agreement_selected | with_extreme | weak | 440 | 243.61 | 0.5537 | 2.66 | 1.03 | 2.12 |
| cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree | fade_extreme | weak | 231 | 122.87 | 0.5319 | 4.82 | 0.97 | 2.14 |
| dealer_commercial_agreement_open_strength_agree | fade_extreme | weak | 215 | 112.63 | 0.5238 | 1.84 | 0.66 | 2.06 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | fade_extreme | confirm | 333 | 164.83 | 0.4950 | 3.80 | 1.00 | 2.06 |
| dealer_commercial_agreement_open_friday_strength_agree | fade_extreme | confirm | 77 | 37.02 | 0.4808 | 2.02 | 0.70 | 2.25 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | with_extreme | weak | 304 | 141.09 | 0.4641 | 2.99 | 0.88 | 1.83 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | with_extreme | weak | 309 | 140.81 | 0.4557 | 3.09 | 0.87 | 1.83 |
| cot_faces_v1_forced_strength_open_canonical_disagree_cot | fade_extreme | confirm | 285 | 127.61 | 0.4477 | 1.29 | 0.64 | 1.71 |
| strength_friday_snapshot_open_canonical_fade_agree | with_extreme | weak | 487 | 206.44 | 0.4239 | 2.18 | 0.89 | 1.78 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_cot | fade_extreme | confirm | 294 | 124.10 | 0.4221 | 1.91 | 0.52 | 1.65 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_cot | with_extreme | weak | 729 | 301.12 | 0.4131 | 3.09 | 0.90 | 1.80 |
| cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree | with_extreme | weak | 386 | 155.43 | 0.4027 | 2.42 | 0.73 | 1.77 |
| cot_faces_v1_commercial_delta_contrarian_selected | fade_extreme | confirm | 622 | 250.12 | 0.4021 | 3.85 | 0.85 | 1.74 |
| cot_faces_v1_forced_selected | fade_extreme | confirm | 622 | 248.40 | 0.3993 | 3.12 | 0.92 | 1.73 |
| cot_faces_v1_forced_strength_open_canonical_disagree_cot | with_extreme | weak | 714 | 283.84 | 0.3975 | 3.36 | 0.98 | 1.75 |
| strength_friday_snapshot_selected | with_extreme | weak | 1034 | 410.92 | 0.3974 | 3.33 | 1.17 | 1.88 |
| strength_open_canonical_fade | with_extreme | weak | 1089 | 427.83 | 0.3929 | 3.56 | 1.12 | 1.80 |
| cot_faces_v1_forced_selected | with_extreme | weak | 1454 | 571.22 | 0.3929 | 3.05 | 1.18 | 1.91 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_agree | fade_extreme | confirm | 328 | 126.02 | 0.3842 | 2.76 | 0.77 | 1.69 |
| dealer_commercial_agreement_friday_strength_agree | fade_extreme | confirm | 166 | 62.99 | 0.3795 | 2.66 | 0.69 | 1.76 |
| strength_friday_snapshot_open_canonical_fade_friday_remainder | with_extreme | weak | 547 | 204.47 | 0.3738 | 3.23 | 0.79 | 1.69 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_disagree_cot | with_extreme | weak | 1120 | 417.82 | 0.3731 | 3.00 | 0.99 | 1.83 |
| cot_faces_v1_forced_strength_friday_snapshot_agree | with_extreme | weak | 725 | 270.11 | 0.3726 | 2.21 | 0.93 | 1.73 |

## Top Lifecycle Score x RRP Buckets

| Variant | Lifecycle | RRP | Rows | Total ADR | Avg ADR/Pair | R/DD | Sharpe | PF |
| dealer_commercial_agreement_friday_strength_fade_agree | high_exhaustion | weak | 399 | 201.87 | 0.5059 | 2.63 | 0.80 | 1.86 |
| cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree | high_exhaustion | weak | 617 | 278.30 | 0.4511 | 4.43 | 1.05 | 2.04 |
| dealer_commercial_agreement_open_strength_agree | high_exhaustion | weak | 420 | 169.25 | 0.4030 | 1.54 | 0.65 | 1.75 |
| dealer_commercial_agreement_selected | high_exhaustion | weak | 829 | 309.89 | 0.3738 | 2.38 | 0.78 | 1.67 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_disagree_cot | high_exhaustion | weak | 1660 | 612.96 | 0.3693 | 4.28 | 1.22 | 1.96 |
| cot_faces_v1_forced_strength_open_canonical_agree | high_exhaustion | weak | 1101 | 403.17 | 0.3662 | 3.59 | 0.93 | 1.78 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | high_exhaustion | weak | 1112 | 407.10 | 0.3661 | 3.73 | 0.94 | 1.80 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_cot | high_exhaustion | weak | 1039 | 374.96 | 0.3609 | 3.47 | 0.97 | 1.74 |
| strength_friday_snapshot_open_canonical_fade_open_fade_remainder | high_exhaustion | weak | 1139 | 399.59 | 0.3508 | 4.12 | 0.91 | 1.70 |
| cot_faces_v1_forced_selected | high_exhaustion | weak | 2179 | 744.78 | 0.3418 | 4.00 | 1.21 | 1.88 |
| strength_friday_snapshot_open_canonical_fade_friday_remainder | high_exhaustion | weak | 1165 | 397.30 | 0.3410 | 3.93 | 0.95 | 1.73 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_agree | high_exhaustion | weak | 1146 | 381.92 | 0.3333 | 3.68 | 0.91 | 1.70 |
| dealer_commercial_agreement_open_friday_strength_agree | high_exhaustion | weak | 235 | 77.99 | 0.3319 | 1.01 | 0.41 | 1.52 |
| cot_faces_v1_forced_strength_friday_snapshot_agree | high_exhaustion | weak | 1140 | 369.82 | 0.3244 | 3.55 | 0.89 | 1.68 |
| cot_faces_v1_commercial_delta_contrarian_selected | high_exhaustion | weak | 2179 | 704.97 | 0.3235 | 3.82 | 1.14 | 1.81 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_cot | high_exhaustion | weak | 1033 | 323.05 | 0.3127 | 2.99 | 0.82 | 1.61 |
| dealer_commercial_agreement_open_strength_fade_agree | high_exhaustion | weak | 397 | 123.52 | 0.3111 | 1.66 | 0.46 | 1.43 |
| strength_open_canonical_fade | high_exhaustion | weak | 2153 | 649.08 | 0.3015 | 5.12 | 1.00 | 1.68 |
| strength_friday_snapshot_selected | high_exhaustion | weak | 2179 | 646.78 | 0.2968 | 6.41 | 0.97 | 1.70 |
| cot_faces_v1_forced_strength_open_canonical_disagree_cot | high_exhaustion | weak | 1052 | 307.08 | 0.2919 | 3.24 | 0.73 | 1.53 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | high_exhaustion | fade | 718 | 206.25 | 0.2873 | 3.94 | 0.70 | 1.51 |
| strength_friday_snapshot_open_canonical_fade_agree | high_exhaustion | fade | 923 | 252.44 | 0.2735 | 2.59 | 0.69 | 1.49 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | high_exhaustion | weak | 1039 | 276.96 | 0.2666 | 2.50 | 0.66 | 1.50 |
| strength_friday_snapshot_fade | high_exhaustion | weak | 2179 | 570.14 | 0.2617 | 2.26 | 0.81 | 1.57 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | high_exhaustion | weak | 1033 | 264.86 | 0.2564 | 2.24 | 0.63 | 1.47 |
| cot_faces_v1_commercial_delta_contrarian_open_strength_fade_agree | high_exhaustion | weak | 1041 | 265.55 | 0.2551 | 2.65 | 0.62 | 1.43 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_disagree_cot | high_exhaustion | weak | 1041 | 265.55 | 0.2551 | 2.65 | 0.62 | 1.43 |
| dealer_commercial_agreement_friday_strength_agree | high_exhaustion | weak | 430 | 108.02 | 0.2512 | 1.03 | 0.35 | 1.36 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | high_exhaustion | all | 2898 | 727.84 | 0.2512 | 4.97 | 0.95 | 1.61 |
| strength_friday_snapshot_open_canonical_fade_agree | high_exhaustion | weak | 1014 | 249.49 | 0.2460 | 3.94 | 0.58 | 1.41 |

## Files

- JSON: app\reports\data-verification\macro-regime\gate51-cot-lifecycle-rrp-interaction-noncomm_net-20260623T174206.json
- Markdown: app\reports\data-verification\macro-regime\gate51-cot-lifecycle-rrp-interaction-noncomm_net-20260623T174206.md

No live, ACTIVE, production-ready, portfolio-ready, or full-stack source-promotion claim is made by this receipt.
