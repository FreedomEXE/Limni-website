# Gate 51A RRP Regime Filter Diagnostic

Generated: 2026-06-23T16:49:35.566Z

## Result

- Status: PASS_RRP_DIAGNOSTIC_ATTRIBUTION
- Gate: Gate 51A: rrp-regime-filter-research-suite diagnostic attribution
- Mode: smoke
- Variants tested: 3
- Thresholds: 0, 0.25, 0.5, 1 RRP percentage points
- Pair attribution rows: 23672
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
| dealer_commercial_agreement_selected | 1.00 | 2718 | 398.92 | -204.22 | -299.60 | 1.33 | 0.74 | 2024 -173.26 |
| dealer_commercial_agreement_selected | 0.50 | 2323 | 328.01 | -275.13 | -294.85 | 1.11 | 0.75 | 2024 -166.24 |
| strength_open_canonical_fade | 1.00 | 6727 | 497.00 | -508.19 | -488.45 | 1.02 | 0.67 | 2023 -331.72 |
| dealer_commercial_agreement_selected | 0.25 | 2054 | 268.37 | -334.77 | -289.31 | 0.93 | 0.75 | 2024 -181.10 |
| cot_faces_v1_forced_selected | 1.00 | 7093 | 511.06 | -557.82 | -559.56 | 0.91 | 0.71 | 2024 -144.47 |
| cot_faces_v1_forced_selected | 0.50 | 6127 | 388.09 | -680.79 | -546.98 | 0.71 | 0.71 | 2024 -171.95 |
| dealer_commercial_agreement_selected | 0.00 | 1792 | 161.23 | -441.91 | -283.96 | 0.57 | 0.75 | 2024 -171.97 |
| cot_faces_v1_forced_selected | 0.25 | 5538 | 220.13 | -848.75 | -646.08 | 0.34 | 0.69 | 2021 -217.08 |
| strength_open_canonical_fade | 0.50 | 5762 | 170.36 | -834.82 | -628.03 | 0.27 | 0.67 | 2023 -349.53 |
| strength_open_canonical_fade | 0.25 | 5198 | -86.12 | -1091.30 | -799.69 | -0.11 | 0.68 | 2023 -395.15 |

## Top Confirm vs Fade Separation

| Variant | Thr | Confirm Rows | Fade Rows | Confirm ADR/Pair | Fade ADR/Pair | Spread | Block-Fade Delta |
| dealer_commercial_agreement_selected | 0.50 | 1291 | 1756 | 0.1314 | 0.1567 | -0.0253 | -275.13 |
| dealer_commercial_agreement_selected | 0.25 | 1548 | 2025 | 0.0848 | 0.1653 | -0.0805 | -334.77 |
| dealer_commercial_agreement_selected | 0.00 | 1792 | 2287 | 0.0900 | 0.1932 | -0.1033 | -441.91 |
| dealer_commercial_agreement_selected | 1.00 | 891 | 1361 | 0.0013 | 0.1501 | -0.1488 | -204.22 |
| cot_faces_v1_forced_selected | 0.50 | 3577 | 4205 | -0.0712 | 0.1619 | -0.2331 | -680.79 |
| cot_faces_v1_forced_selected | 0.00 | 4873 | 5459 | -0.0237 | 0.2169 | -0.2406 | -1184.12 |
| cot_faces_v1_forced_selected | 0.25 | 4244 | 4794 | -0.0714 | 0.1770 | -0.2485 | -848.75 |
| strength_open_canonical_fade | 0.50 | 3452 | 3499 | -0.0992 | 0.2386 | -0.3378 | -834.82 |
| strength_open_canonical_fade | 0.00 | 4626 | 4635 | -0.0623 | 0.2791 | -0.3414 | -1293.54 |
| strength_open_canonical_fade | 0.25 | 4012 | 4063 | -0.0748 | 0.2686 | -0.3434 | -1091.30 |

## Files

- JSON: app\reports\data-verification\macro-regime\gate51-rrp-regime-filter-diagnostic-smoke-20260623T164935.json
- Markdown: app\reports\data-verification\macro-regime\gate51-rrp-regime-filter-diagnostic-smoke-20260623T164935.md

No live, ACTIVE, production-ready, portfolio-ready, BPR, PPP, NEER, REER, valuation, or combined-regime claim is made by this receipt.
