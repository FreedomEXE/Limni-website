# COT Commercial Direction Research

Weeks analyzed: 10 (Jan 19 -> Mar 22).

## Baseline

| Baseline | Pairs | Total% | MaxDD% | Win% |
| --- | ---: | ---: | ---: | ---: |
| Forced-raw baseline | 280 | +23.41% | 18.52% | 52.9% |

## Test 1: Alternative Direction Methods

| Method (replaces forced-raw) | Pairs | Total% | MaxDD% | Win% | vs Baseline |
| --- | ---: | ---: | ---: | ---: | ---: |
| Forced-raw baseline | 280 | +23.41% | 18.52% | 52.9% | — |
| Delta-based direction | 280 | +0.38% | 19.19% | 50.0% | -23.03% |
| OI-normalized direction | 280 | -3.40% | 26.97% | 49.3% | -26.81% |
| 4-week net change direction | 280 | +26.41% | 18.92% | 53.2% | +3.00% |
| Non-commercial direction | 280 | -19.95% | 39.95% | 48.9% | -43.36% |

## Test 2: Blended Direction Methods

| Blended method | Pairs | Total% | MaxDD% | Win% | vs Baseline |
| --- | ---: | ---: | ---: | ---: | ---: |
| Forced-raw baseline | 280 | +23.41% | 18.52% | 52.9% | — |
| Net + delta agree | 162 | +11.89% | 16.25% | 52.5% | -11.52% |
| Net + noncomm agree | 9 | +1.73% | 3.32% | 77.8% | -21.68% |
| Forced-raw flipped by delta | 280 | +41.06% | 2.36% | 55.4% | +17.65% |

## Test 3: Magnitude Threshold

| Magnitude bucket | Pairs | Total% | MaxDD% | Win% | Avg% |
| --- | ---: | ---: | ---: | ---: | ---: |
| Forced-raw baseline | 280 | +23.41% | 18.52% | 52.9% | +0.084% |
| Top third (largest difference) | 93 | +11.94% | 10.16% | 54.8% | +0.128% |
| Middle third | 93 | -2.13% | 20.25% | 48.4% | -0.023% |
| Bottom third (smallest diff) | 94 | +13.60% | 4.05% | 55.3% | +0.145% |
| Only |net_diff| > median | 140 | -6.03% | 13.58% | 49.3% | -0.043% |

## Test 4: Best Method Standalone

| Commercial System | Trades | Total% | MaxDD% | Win% |
| --- | ---: | ---: | ---: | ---: |
| Forced-raw (current) | 280 | +23.41% | 18.52% | 52.9% |
| Best alternative: Forced-raw flipped by delta | 280 | +41.06% | 2.36% | 55.4% |

## Summary

1. Best candidate from this pass: `Forced-raw flipped by delta` with 280 trades, +41.06%, 2.36% DD, 55.4% WR.
2. Forced-raw baseline was reproduced exactly enough at 280 trades, +23.41%, 18.52% DD, 52.9% WR.
3. Median net-diff threshold used in Test 3: 50773 contracts. Lower/upper tercile cuts: 35134 / 87072.

