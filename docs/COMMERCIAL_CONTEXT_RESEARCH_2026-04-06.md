# Commercial Context Tagging Research

Weeks analyzed: 10 (Mar 22 -> Jan 19).
Baseline: canonical selector strength_tiebreak.
All returns ADR-normalized.
Total baseline trades: 360

This is a diagnostic pass. No selector directions were changed.
Commercial is evaluated as a state/context descriptor, not a directional signal.

## Baseline Summary

| Metric | Value |
| --- | ---: |
| Trades | 360 |
| Total Return | +91.96% |
| Max Drawdown | 4.01% |
| Win Rate | 54.2% |
| Losing Weeks | 1 |

## Tag 1: Commercial Divergence

Does commercial opposing the selector direction predict worse outcomes?

| Bucket | Trades | Total% | Avg% | Win% | MaxDD% | Losing Wks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Commercial agrees | 121 | +41.46% | +0.34% | 58.7% | 4.71% | 3 |
| Commercial neutral | 21 | +8.03% | +0.38% | 52.4% | 2.31% | 2 |
| Commercial opposes | 218 | +42.47% | +0.19% | 51.8% | 9.12% | 3 |

## Tag 2: Alignment Confidence

Three-tier alignment bucketing.

| Bucket | Trades | Total% | Avg% | Win% | MaxDD% | Losing Wks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| aligned | 121 | +41.46% | +0.34% | 58.7% | 4.71% | 3 |
| neutral | 21 | +8.03% | +0.38% | 52.4% | 2.31% | 2 |
| opposed | 218 | +42.47% | +0.19% | 51.8% | 9.12% | 3 |

## Tag 3: Commercial Extremity State

Does commercial extremity level change outcome quality?

### All Trades by Extremity

| Extremity | Trades | Total% | Avg% | Win% | MaxDD% | Losing Wks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| low (<0.4) | 68 | +23.25% | +0.34% | 61.8% | 8.15% | 3 |
| medium (0.4-0.7) | 113 | +47.18% | +0.42% | 54.9% | 6.44% | 3 |
| high (≥0.7) | 179 | +21.54% | +0.12% | 50.8% | 26.45% | 3 |

### Extremity × Alignment Cross-Tab

This is the key diagnostic. Does high extremity + opposition predict fragile trades?

| Extremity | Alignment | Trades | Total% | Avg% | Win% |
| --- | --- | ---: | ---: | ---: | ---: |
| high | aligned | 51 | +11.46% | +0.22% | 52.9% |
| high | neutral (*) | 10 | +1.09% | +0.11% | 50.0% |
| high | opposed | 118 | +8.99% | +0.08% | 50.0% |
| medium | aligned | 40 | +18.70% | +0.47% | 62.5% |
| medium | neutral (*) | 4 | +2.49% | +0.62% | 50.0% |
| medium | opposed | 69 | +25.98% | +0.38% | 50.7% |
| low | aligned | 30 | +11.29% | +0.38% | 63.3% |
| low | neutral (*) | 7 | +4.46% | +0.64% | 57.1% |
| low | opposed | 31 | +7.50% | +0.24% | 61.3% |

## Tag 4: Commercial Delta-Persistence

Is commercial flow building with or against the selector direction?

| Flow Direction | Trades | Total% | Avg% | Win% | MaxDD% | Losing Wks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| building_with | 80 | +34.31% | +0.43% | 57.5% | 10.69% | 2 |
| stable | 165 | +49.34% | +0.30% | 54.5% | 0.71% | 1 |
| building_against | 79 | +3.04% | +0.04% | 48.1% | 9.29% | 5 |
| no_prior | 36 | +5.27% | +0.15% | 58.3% | 0.00% | 0 |

### Delta-Persistence × Alignment Cross-Tab

| Flow | Alignment | Trades | Total% | Avg% | Win% |
| --- | --- | ---: | ---: | ---: | ---: |
| building_with | aligned | 30 | +6.42% | +0.21% | 50.0% |
| building_with | opposed | 43 | +19.75% | +0.46% | 58.1% |
| stable | aligned | 57 | +26.33% | +0.46% | 57.9% |
| stable | opposed | 101 | +23.83% | +0.24% | 54.5% |
| building_against | aligned | 23 | -0.55% | -0.02% | 60.9% |
| building_against | opposed | 49 | +2.87% | +0.06% | 42.9% |
| no_prior | aligned (*) | 11 | +9.26% | +0.84% | 81.8% |
| no_prior | opposed | 25 | -3.98% | -0.16% | 48.0% |

## Combined Fragility Score

Score = sum of:
- commercial opposed: +1
- commercial extremity high: +1
- commercial flow building against: +1

| Fragility Score | Trades | Total% | Avg% | Win% | MaxDD% |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 (no flags) | 58 | +33.34% | +0.57% | 63.8% | 1.43% |
| 1 (one flag) | 143 | +41.78% | +0.29% | 55.9% | 13.82% |
| 2 (two flags) | 144 | +25.27% | +0.18% | 50.0% | 11.93% |
| 3 (all flags) (*) | 15 | -8.42% | -0.56% | 40.0% | 11.85% |

## Divergence by Asset Class

### fx

| Bucket | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| agrees | 93 | +17.96% | 54.8% |
| neutral (*) | 16 | +6.89% | 56.3% |
| opposes | 171 | +17.24% | 50.9% |

### crypto

| Bucket | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| agrees (*) | 14 | +16.46% | 78.6% |
| neutral (*) | 1 | +2.13% | 100.0% |
| opposes (*) | 5 | -1.42% | 0.0% |

### indices

| Bucket | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| agrees (*) | 6 | -0.04% | 66.7% |
| neutral (*) | 4 | -0.99% | 25.0% |
| opposes | 20 | +2.19% | 65.0% |

### commodities

| Bucket | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| agrees (*) | 8 | +7.08% | 62.5% |
| neutral (*) | 0 | +0.00% | 0.0% |
| opposes | 22 | +24.46% | 59.1% |

