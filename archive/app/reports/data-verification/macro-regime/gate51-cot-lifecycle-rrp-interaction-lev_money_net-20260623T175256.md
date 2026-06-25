# Gate 51B COT Lifecycle x RRP Interaction Diagnostic

Generated: 2026-06-23T17:52:56.112Z

## Result

- Status: PASS_COT_LIFECYCLE_RRP_INTERACTION_DIAGNOSTIC
- Gate: Gate 51B: cot-lifecycle-rrp-interaction-diagnostic
- Variants tested: 35
- Pair rows with lifecycle and RRP: 111204
- Crowd leg: lev_money_net
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
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree | fade_lean | confirm | 55 | 61.41 | 1.1166 | 57.83 | 1.97 | 30.42 |
| cot_faces_v1_forced_opposite | fade_extreme | confirm | 53 | 47.81 | 0.9020 | 3.47 | 1.11 | 4.20 |
| cot_faces_v1_commercial_delta_contrarian_opposite | fade_extreme | confirm | 51 | 45.68 | 0.8956 | 3.31 | 1.06 | 4.06 |
| cot_faces_v1_forced_strength_open_canonical_disagree_cot | fade_lean | confirm | 106 | 93.21 | 0.8794 | 3.71 | 1.31 | 3.65 |
| dealer_commercial_agreement_open_strength_fade_agree | with_lean | weak | 98 | 84.15 | 0.8587 | 4.95 | 1.22 | 3.33 |
| cot_faces_v1_commercial_delta_contrarian_open_strength_fade_agree | fade_lean | confirm | 111 | 94.83 | 0.8543 | 3.96 | 1.33 | 3.46 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_disagree_cot | fade_lean | confirm | 111 | 94.83 | 0.8543 | 3.96 | 1.33 | 3.46 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_agree | fade_lean | confirm | 135 | 108.06 | 0.8004 | 6.41 | 1.44 | 3.89 |
| dealer_commercial_agreement_friday_strength_fade_agree | neutral_mixed | weak | 193 | 153.02 | 0.7928 | 9.58 | 1.69 | 3.23 |
| dealer_commercial_agreement_friday_strength_fade_agree | with_lean | weak | 90 | 70.80 | 0.7867 | 4.16 | 1.01 | 2.94 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | with_lean | fade | 123 | 93.32 | 0.7587 | 11.36 | 1.73 | 4.06 |
| dealer_commercial_agreement_open_friday_strength_agree | fade_lean | weak | 55 | 40.79 | 0.7416 | 3.51 | 0.76 | 2.43 |
| cot_faces_v1_commercial_delta_contrarian_selected | fade_lean | confirm | 258 | 182.86 | 0.7088 | 8.89 | 1.55 | 2.78 |
| dealer_commercial_agreement_open_strength_agree | neutral_mixed | confirm | 141 | 95.70 | 0.6788 | 3.66 | 1.10 | 2.82 |
| dealer_commercial_agreement_open_strength_agree | neutral_mixed | weak | 199 | 130.14 | 0.6540 | 7.33 | 1.49 | 2.98 |
| cot_faces_v1_forced_strength_open_canonical_disagree_strength | with_lean | fade | 106 | 69.32 | 0.6540 | 5.27 | 1.02 | 2.46 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_cot | fade_lean | confirm | 124 | 80.61 | 0.6501 | 3.78 | 0.90 | 2.20 |
| cot_faces_v1_forced_selected | fade_lean | confirm | 254 | 164.05 | 0.6459 | 4.69 | 1.27 | 2.40 |
| cot_faces_v1_forced_strength_friday_snapshot_agree | fade_lean | confirm | 130 | 83.44 | 0.6419 | 4.33 | 0.92 | 2.47 |
| dealer_commercial_agreement_selected | neutral_mixed | weak | 398 | 255.17 | 0.6411 | 10.77 | 1.84 | 2.82 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | with_lean | fade | 124 | 78.72 | 0.6348 | 7.57 | 1.26 | 2.80 |
| cot_faces_v1_forced_opposite | with_lean | fade | 254 | 160.12 | 0.6304 | 4.34 | 1.14 | 2.40 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_cot | fade_lean | confirm | 123 | 74.80 | 0.6082 | 3.41 | 0.83 | 2.02 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_disagree_cot | fade_lean | confirm | 203 | 121.45 | 0.5983 | 5.90 | 1.07 | 2.17 |
| dealer_commercial_agreement_open_strength_fade_agree | neutral_mixed | weak | 192 | 114.56 | 0.5967 | 4.51 | 1.17 | 2.22 |
| dealer_commercial_agreement_open_strength_agree | neutral_mixed | all | 533 | 315.19 | 0.5913 | 7.97 | 1.82 | 2.98 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | fade_lean | confirm | 142 | 83.46 | 0.5878 | 4.44 | 0.93 | 2.28 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_disagree_strength | with_lean | fade | 111 | 65.11 | 0.5866 | 4.95 | 0.95 | 2.24 |
| dealer_commercial_agreement_friday_strength_fade_agree | neutral_mixed | fade | 228 | 132.79 | 0.5824 | 6.81 | 1.34 | 2.65 |
| cot_faces_v1_commercial_delta_contrarian_opposite | with_lean | fade | 258 | 147.12 | 0.5702 | 4.41 | 1.06 | 2.16 |

## Top Lifecycle Score x RRP Buckets

| Variant | Lifecycle | RRP | Rows | Total ADR | Avg ADR/Pair | R/DD | Sharpe | PF |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_agree | neutral | weak | 75 | 69.88 | 0.9317 | 23.09 | 1.60 | 6.74 |
| cot_faces_v1_forced_strength_open_canonical_disagree_strength | neutral | confirm | 85 | 76.40 | 0.8988 | 5.49 | 1.41 | 5.04 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_disagree_strength | neutral | confirm | 85 | 71.64 | 0.8429 | 5.15 | 1.32 | 4.79 |
| strength_friday_snapshot_open_canonical_fade_friday_remainder | neutral | weak | 79 | 65.40 | 0.8278 | 9.39 | 1.21 | 3.97 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | neutral | fade | 77 | 62.52 | 0.8120 | 18.49 | 1.60 | 7.79 |
| cot_faces_v1_forced_strength_friday_snapshot_agree | neutral | weak | 73 | 58.80 | 0.8055 | 15.89 | 1.43 | 4.70 |
| dealer_commercial_agreement_selected | neutral | weak | 60 | 47.64 | 0.7940 | 5.58 | 1.10 | 3.73 |
| cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree | neutral | weak | 79 | 62.55 | 0.7918 | 6.39 | 1.15 | 3.46 |
| cot_faces_v1_forced_strength_open_canonical_agree | neutral | weak | 77 | 60.78 | 0.7893 | 6.21 | 1.17 | 3.39 |
| cot_faces_v1_forced_strength_open_canonical_agree | neutral | fade | 76 | 58.32 | 0.7674 | 13.31 | 1.54 | 6.71 |
| strength_friday_snapshot_selected | neutral | weak | 141 | 103.90 | 0.7369 | 8.38 | 1.36 | 3.45 |
| cot_faces_v1_forced_selected | neutral | weak | 141 | 102.77 | 0.7289 | 7.41 | 1.23 | 3.17 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | neutral | weak | 68 | 45.10 | 0.6632 | 3.64 | 0.82 | 2.58 |
| cot_faces_v1_forced_strength_open_canonical_disagree_cot | neutral | weak | 63 | 40.79 | 0.6475 | 2.31 | 0.66 | 2.32 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_cot | neutral | weak | 68 | 43.97 | 0.6466 | 3.17 | 0.69 | 2.18 |
| dealer_commercial_agreement_open_friday_strength_agree | neutral | all | 58 | 37.24 | 0.6420 | 5.60 | 1.13 | 4.45 |
| strength_friday_snapshot_open_canonical_fade_agree | neutral | weak | 62 | 38.51 | 0.6211 | 3.11 | 0.78 | 2.51 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | neutral | confirm | 92 | 52.94 | 0.5754 | 2.75 | 0.70 | 2.28 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | neutral | confirm | 86 | 48.56 | 0.5647 | 2.35 | 0.65 | 2.18 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | neutral | weak | 66 | 34.02 | 0.5155 | 2.75 | 0.62 | 2.00 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_cot | neutral | fade | 86 | 44.13 | 0.5131 | 4.73 | 0.92 | 2.77 |
| cot_faces_v1_commercial_delta_contrarian_strength_friday_snapshot_disagree_strength | neutral | all | 221 | 112.70 | 0.5100 | 3.14 | 1.01 | 2.32 |
| cot_faces_v1_commercial_delta_contrarian_friday_open_fade_disagree_cot | neutral | fade | 127 | 63.75 | 0.5019 | 5.44 | 0.96 | 2.47 |
| dealer_commercial_agreement_friday_strength_fade_agree | low_continuation | weak | 371 | 174.76 | 0.4711 | 2.13 | 0.71 | 1.75 |
| strength_open_canonical_selected | neutral | weak | 140 | 65.71 | 0.4694 | 2.08 | 0.63 | 1.84 |
| cot_faces_v1_commercial_delta_contrarian_selected | neutral | weak | 141 | 66.12 | 0.4689 | 1.39 | 0.48 | 1.78 |
| cot_faces_v1_forced_strength_friday_snapshot_disagree_strength | neutral | all | 212 | 98.58 | 0.4650 | 2.29 | 0.86 | 2.07 |
| cot_faces_v1_forced_selected | neutral | fade | 162 | 72.62 | 0.4482 | 4.56 | 1.00 | 2.21 |
| strength_open_canonical_selected | neutral | fade | 154 | 68.54 | 0.4451 | 3.40 | 0.78 | 2.36 |
| strength_friday_snapshot_open_canonical_fade_friday_remainder | neutral | fade | 68 | 29.74 | 0.4373 | 1.62 | 0.53 | 2.07 |

## Files

- JSON: app\reports\data-verification\macro-regime\gate51-cot-lifecycle-rrp-interaction-lev_money_net-20260623T175256.json
- Markdown: app\reports\data-verification\macro-regime\gate51-cot-lifecycle-rrp-interaction-lev_money_net-20260623T175256.md

No live, ACTIVE, production-ready, portfolio-ready, or full-stack source-promotion claim is made by this receipt.
