# Gate 51A RRP Regime Filter Diagnostic

Generated: 2026-06-23T17:09:54.399Z

## Result

- Status: PASS_RRP_DIAGNOSTIC_ATTRIBUTION
- Gate: Gate 51A: rrp-regime-filter-research-suite diagnostic attribution
- Mode: full
- Variants tested: 1
- Thresholds: 1 RRP percentage points
- Pair attribution rows: 903
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
| dealer_commercial_agreement_open_friday_strength_agree | 1.00 | 619 | 214.24 | 88.49 | -152.64 | 1.40 | 0.60 | 1.65 | 0.80 | 2024 -122.81 |

## Top Confirm vs Fade Separation

| Variant | Thr | Confirm Rows | Fade Rows | Confirm ADR/Pair | Fade ADR/Pair | Spread | Block-Fade Delta |
| dealer_commercial_agreement_open_friday_strength_agree | 1.00 | 212 | 284 | 0.0646 | -0.3116 | 0.3761 | 88.49 |

## Fixed Candidate Validation Addendum

- Candidate: dealer_commercial_agreement_open_friday_strength_agree
- Threshold: 1 RRP percentage points
- Threshold locked for validation: true
- ADR-normalized: true
- Path Sharpe: annualized weekly ADR path Sharpe, using all matrix weeks with blocked/no-trade weeks carried as 0 ADR
- Profit factor: positive weekly ADR divided by absolute negative weekly ADR, using all matrix weeks
- Zero-fill worst-case assumption: -1 ADR per zero-filled row

### Mode Comparison

| Mode | Rows | Total ADR | Delta vs Base | Max DD | R/DD | Path Sharpe | Profit Factor | Win Active | Worst Year |
| No RRP filter | 903 | 125.75 | 0.00 | -195.65 | 0.64 | 0.24 | 1.20 | 0.78 | 2024 -191.97 |
| Block RRP fades | 619 | 214.24 | 88.49 | -152.64 | 1.40 | 0.60 | 1.65 | 0.80 | 2024 -122.81 |
| RRP confirm only | 212 | 13.69 | -112.06 | -89.79 | 0.15 | 0.07 | 1.08 | 0.79 | 2024 -67.94 |
| RRP fade only | 284 | -88.49 | -214.24 | -149.23 | -0.59 | -0.26 | 0.74 | 0.81 | 2022 -91.93 |
| RRP weak only | 407 | 200.55 | 74.80 | -77.12 | 2.60 | 0.99 | 2.09 | 0.81 | 2024 -54.87 |
| Block fades and weak | 212 | 13.69 | -112.06 | -89.79 | 0.15 | 0.07 | 1.08 | 0.79 | 2024 -67.94 |
| Block RRP confirms | 691 | 112.06 | -13.69 | -157.95 | 0.71 | 0.27 | 1.22 | 0.79 | 2024 -124.03 |

### RRP Buckets

| Bucket | Rows | Total ADR | Avg ADR/Pair | Zero-filled Rows |
| confirm | 212 | 13.69 | 0.0646 | 0 |
| fade | 284 | -88.49 | -0.3116 | 1 |
| weak | 407 | 200.55 | 0.4927 | 3 |

### Year By Year

| Year | No RRP | Block Fade | Delta | Confirm | Fade | Weak | Block Confirm |
| 2019 | 1.52 | 12.26 | 10.73 | -4.06 | -10.73 | 16.32 | 5.58 |
| 2020 | 89.94 | 90.10 | 0.16 | 17.90 | -0.16 | 72.20 | 72.04 |
| 2021 | 38.94 | 19.24 | -19.70 | -14.80 | 19.70 | 34.05 | 53.75 |
| 2022 | -45.28 | 46.65 | 91.93 | 12.28 | -91.93 | 34.37 | -57.56 |
| 2023 | 86.12 | 60.36 | -25.76 | 39.37 | 25.76 | 20.99 | 46.75 |
| 2024 | -191.97 | -122.81 | 69.16 | -67.94 | -69.16 | -54.87 | -124.03 |
| 2025 | 67.09 | 39.06 | -28.04 | 15.79 | 28.04 | 23.27 | 51.30 |
| 2026 | 79.38 | 69.37 | -10.01 | 15.14 | 10.01 | 54.23 | 64.23 |

### Pair Contribution Top

| Pair | No RRP | Block Fade | Delta | Confirm | Fade | Weak | Zero Rows |
| EURAUD | -62.28 | 18.40 | 80.68 | 5.01 | -80.68 | 13.39 | 0 |
| NZDJPY | -7.48 | 24.11 | 31.59 | 17.12 | -31.59 | 6.99 | 0 |
| EURGBP | -9.10 | 13.84 | 22.95 | 1.40 | -22.95 | 12.44 | 0 |
| AUDUSD | 2.99 | 21.28 | 18.29 | 8.35 | -18.29 | 12.93 | 1 |
| GBPAUD | 10.48 | 28.66 | 18.18 | 11.20 | -18.18 | 17.47 | 0 |
| CADJPY | -4.09 | -19.44 | -15.35 | -12.00 | 15.35 | -7.45 | 0 |
| EURJPY | 36.43 | 21.76 | -14.67 | 10.43 | 14.67 | 11.32 | 0 |
| GBPNZD | 39.26 | 24.64 | -14.61 | -2.63 | 14.61 | 27.28 | 1 |
| GBPCAD | 7.83 | 21.11 | 13.28 | 4.04 | -13.28 | 17.06 | 0 |
| USDJPY | 22.25 | 9.65 | -12.60 | 7.65 | 12.60 | 2.00 | 0 |
| GBPCHF | -9.88 | 2.48 | 12.36 | -0.91 | -12.36 | 3.40 | 0 |
| EURCHF | 3.69 | -7.94 | -11.62 | -25.58 | 11.62 | 17.65 | 0 |

### Currency Contribution Top

| Currency | No RRP | Block Fade | Delta | Confirm | Fade | Weak |
| AUD | -76.31 | -19.79 | 56.52 | -18.32 | -56.52 | -1.47 |
| EUR | 20.49 | 62.29 | 41.80 | 3.17 | -41.80 | 59.12 |
| GBP | 29.34 | 53.55 | 24.21 | 7.02 | -24.21 | 46.53 |
| CHF | 4.31 | -7.18 | -11.49 | -1.93 | 11.49 | -5.26 |
| USD | 64.65 | 56.22 | -8.43 | 26.72 | 8.43 | 29.50 |
| CAD | 38.69 | 30.64 | -8.05 | 3.67 | 8.05 | 26.97 |
| JPY | 5.24 | -0.44 | -5.69 | -17.73 | 5.69 | 17.29 |
| NZD | 39.34 | 38.95 | -0.39 | 11.09 | 0.39 | 27.86 |

### Zero-Fill Sensitivity

| Mode | Zero Rows | Base ADR | Ex-Zero ADR | Worst ADR | Worst R/DD | Worst Sharpe | Worst PF |
| No RRP filter | 4 | 125.75 | 125.75 | 121.75 | 0.62 | 0.24 | 1.19 |
| Block RRP fades | 3 | 214.24 | 214.24 | 211.24 | 1.38 | 0.59 | 1.64 |
| RRP confirm only | 0 | 13.69 | 13.69 | 13.69 | 0.15 | 0.07 | 1.08 |
| RRP fade only | 1 | -88.49 | -88.49 | -89.49 | -0.60 | -0.26 | 0.74 |
| RRP weak only | 3 | 200.55 | 200.55 | 197.55 | 2.56 | 0.97 | 2.06 |
| Block fades and weak | 0 | 13.69 | 13.69 | 13.69 | 0.15 | 0.07 | 1.08 |
| Block RRP confirms | 4 | 112.06 | 112.06 | 108.06 | 0.68 | 0.26 | 1.21 |

## Files

- JSON: app\reports\data-verification\macro-regime\gate51-rrp-candidate-validation-addendum-full-20260623T170954.json
- Markdown: app\reports\data-verification\macro-regime\gate51-rrp-candidate-validation-addendum-full-20260623T170954.md

No live, ACTIVE, production-ready, portfolio-ready, BPR, PPP, NEER, REER, valuation, or combined-regime claim is made by this receipt.
