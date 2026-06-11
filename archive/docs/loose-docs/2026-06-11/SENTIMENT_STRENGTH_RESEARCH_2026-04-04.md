# Sentiment + Strength Research

Weeks analyzed: 10 (Jan 19 -> Mar 22).

## Sentiment Data Availability

| Asset Class | Present | Possible | Coverage |
| --- | ---: | ---: | ---: |
| fx | 252 | 280 | 90.0% |
| indices | 21 | 30 | 70.0% |
| crypto | 18 | 20 | 90.0% |
| commodities | 25 | 30 | 83.3% |
| combined | 316 | 360 | 87.8% |

## Strength Data Availability

| Asset Class | Present | Possible | Coverage |
| --- | ---: | ---: | ---: |
| fx | 280 | 280 | 100.0% |
| indices | 27 | 30 | 90.0% |
| crypto | 20 | 20 | 100.0% |
| commodities | 30 | 30 | 100.0% |
| combined | 357 | 360 | 99.2% |

## Sentiment Methods

### S1 Baseline

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 190 | +10.60% | 26.75% | 55.3% | 4 | 190/280 |
| indices | 21 | +0.65% | 2.08% | 52.4% | 4 | 21/30 |
| crypto | 16 | +12.25% | 3.78% | 81.3% | 2 | 16/20 |
| commodities | 2 | +4.99% | 0.08% | 50.0% | 1 | 2/30 |
| combined | 229 | +28.49% | 19.56% | 56.8% | 5 | 229/360 |

### S2 60/40

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 207 | +7.64% | 29.57% | 54.6% | 4 | 207/280 |
| indices | 21 | +0.65% | 2.08% | 52.4% | 4 | 21/30 |
| crypto | 16 | +12.25% | 3.78% | 81.3% | 2 | 16/20 |
| commodities | 9 | +7.69% | 2.49% | 44.4% | 5 | 9/30 |
| combined | 253 | +28.22% | 17.19% | 55.7% | 4 | 253/360 |

### S3 Neutral Tiebreak

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 249 | -5.65% | 39.17% | 54.6% | 4 | 249/280 |
| indices | 21 | +0.65% | 2.08% | 52.4% | 4 | 21/30 |
| crypto | 18 | +13.82% | 3.78% | 83.3% | 2 | 18/20 |
| commodities | 18 | +5.20% | 6.92% | 50.0% | 6 | 18/30 |
| combined | 306 | +14.01% | 24.13% | 55.9% | 3 | 306/360 |

### S4 2+ Week Persistence

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 142 | +4.29% | 30.52% | 53.5% | 5 | 142/280 |
| indices | 18 | +0.80% | 2.08% | 50.0% | 3 | 18/30 |
| crypto | 13 | +4.63% | 3.73% | 84.6% | 1 | 13/20 |
| commodities | 1 | -0.08% | 0.08% | 0.0% | 1 | 1/30 |
| combined | 174 | +9.63% | 28.34% | 55.2% | 5 | 174/360 |

### S5 Flip-only

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 0 | +0.00% | 0.00% | 0.0% | 0 | 0/280 |
| indices | 0 | +0.00% | 0.00% | 0.0% | 0 | 0/30 |
| crypto | 0 | +0.00% | 0.00% | 0.0% | 0 | 0/20 |
| commodities | 0 | +0.00% | 0.00% | 0.0% | 0 | 0/30 |
| combined | 0 | +0.00% | 0.00% | 0.0% | 0 | 0/360 |

### S6 Crowding-only

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 190 | +10.60% | 26.75% | 55.3% | 4 | 190/280 |
| indices | 21 | +0.65% | 2.08% | 52.4% | 4 | 21/30 |
| crypto | 16 | +12.25% | 3.78% | 81.3% | 2 | 16/20 |
| commodities | 2 | +4.99% | 0.08% | 50.0% | 1 | 2/30 |
| combined | 229 | +28.49% | 19.56% | 56.8% | 5 | 229/360 |

## Sentiment Extremity Diagnostic

| Bucket | Trades | Total% | Win% | Avg |
| --- | ---: | ---: | ---: | ---: |
| Very weak (0-5) | 0 | +0.00% | 0.0% | +0.000% |
| Weak (5-10) | 0 | +0.00% | 0.0% | +0.000% |
| Moderate (10-15) | 0 | +0.00% | 0.0% | +0.000% |
| Strong (15+) | 229 | +28.49% | 56.8% | +0.124% |

## Sentiment Summary

| Method | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| S5 Flip-only | 0 | +0.00% | 0.00% | 0.0% | 0 | 0/360 |
| S3 Neutral Tiebreak | 306 | +14.01% | 24.13% | 55.9% | 3 | 306/360 |
| S2 60/40 | 253 | +28.22% | 17.19% | 55.7% | 4 | 253/360 |
| S1 Baseline | 229 | +28.49% | 19.56% | 56.8% | 5 | 229/360 |
| S6 Crowding-only | 229 | +28.49% | 19.56% | 56.8% | 5 | 229/360 |
| S4 2+ Week Persistence | 174 | +9.63% | 28.34% | 55.2% | 5 | 174/360 |

## Strength Methods

### T1 Baseline

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 270 | +82.84% | 19.82% | 56.3% | 3 | 270/280 |
| indices | 16 | +0.90% | 4.54% | 56.3% | 5 | 16/30 |
| crypto | 20 | -2.86% | 3.05% | 45.0% | 6 | 20/20 |
| commodities | 29 | +0.01% | 11.57% | 44.8% | 4 | 29/30 |
| combined | 335 | +80.89% | 14.98% | 54.6% | 4 | 335/360 |

### T2 Threshold=4

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 272 | +79.61% | 20.78% | 55.9% | 3 | 272/280 |
| indices | 16 | +0.90% | 4.54% | 56.3% | 5 | 16/30 |
| crypto | 20 | -2.86% | 3.05% | 45.0% | 6 | 20/20 |
| commodities | 29 | +0.01% | 11.57% | 44.8% | 4 | 29/30 |
| combined | 337 | +77.67% | 15.94% | 54.3% | 4 | 337/360 |

### T3 Threshold=3

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 274 | +78.85% | 21.35% | 55.8% | 3 | 274/280 |
| indices | 16 | +0.90% | 4.54% | 56.3% | 5 | 16/30 |
| crypto | 20 | -2.86% | 3.05% | 45.0% | 6 | 20/20 |
| commodities | 30 | +2.85% | 11.57% | 46.7% | 4 | 30/30 |
| combined | 340 | +79.75% | 16.51% | 54.4% | 4 | 340/360 |

### T4 Weighted Windows

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 273 | +83.40% | 19.26% | 56.4% | 3 | 273/280 |
| indices | 26 | +1.12% | 5.19% | 53.8% | 4 | 26/30 |
| crypto | 16 | -2.16% | 3.05% | 43.8% | 4 | 16/20 |
| commodities | 28 | -5.06% | 11.57% | 42.9% | 4 | 28/30 |
| combined | 343 | +77.31% | 18.34% | 54.5% | 4 | 343/360 |

### T5 Neutral Resolver

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +77.68% | 20.22% | 55.7% | 2 | 280/280 |
| indices | 21 | +1.04% | 4.60% | 57.1% | 4 | 21/30 |
| crypto | 20 | -2.86% | 3.05% | 45.0% | 6 | 20/20 |
| commodities | 30 | +2.85% | 11.57% | 46.7% | 4 | 30/30 |
| combined | 351 | +78.72% | 15.09% | 54.4% | 3 | 351/360 |

### T6 2+ Week Persistence

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 119 | +1.66% | 20.69% | 54.6% | 4 | 119/280 |
| indices | 5 | +0.03% | 0.67% | 40.0% | 2 | 5/30 |
| crypto | 10 | -0.26% | 0.92% | 40.0% | 3 | 10/20 |
| commodities | 10 | -2.24% | 10.77% | 40.0% | 3 | 10/30 |
| combined | 144 | -0.81% | 20.61% | 52.1% | 3 | 144/360 |

### T7 Weighted Raw Spread

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +74.39% | 20.22% | 55.4% | 2 | 280/280 |
| indices | 27 | -0.94% | 6.15% | 48.1% | 4 | 27/30 |
| crypto | 16 | -2.16% | 3.05% | 43.8% | 4 | 16/20 |
| commodities | 30 | +2.85% | 11.57% | 46.7% | 4 | 30/30 |
| combined | 353 | +74.15% | 14.71% | 53.5% | 3 | 353/360 |

## Strength Summary

| Method | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| T7 Weighted Raw Spread | 353 | +74.15% | 14.71% | 53.5% | 3 | 353/360 |
| T5 Neutral Resolver | 351 | +78.72% | 15.09% | 54.4% | 3 | 351/360 |
| T6 2+ Week Persistence | 144 | -0.81% | 20.61% | 52.1% | 3 | 144/360 |
| T1 Baseline | 335 | +80.89% | 14.98% | 54.6% | 4 | 335/360 |
| T2 Threshold=4 | 337 | +77.67% | 15.94% | 54.3% | 4 | 337/360 |
| T3 Threshold=3 | 340 | +79.75% | 16.51% | 54.4% | 4 | 340/360 |
| T4 Weighted Windows | 343 | +77.31% | 18.34% | 54.5% | 4 | 343/360 |

## Recommendations

1. Sentiment winner by risk-first ranking: `S5 Flip-only`.
2. Strength winner by risk-first ranking: `T7 Weighted Raw Spread`.
3. Treat these as research results only. No canonical change should happen until the standalone winners are clearly preferable and repeatable.

