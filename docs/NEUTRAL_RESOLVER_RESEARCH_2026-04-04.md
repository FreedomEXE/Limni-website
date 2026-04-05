# Neutral Resolver Stack Research

Weeks analyzed: 10 (Jan 19 -> Mar 22).
Universe: 36 pairs × 10 weeks = 360 possible pair-weeks.

## Gap Analysis

### Sentiment
- S1 baseline: 229/360 trades
- Neutrals with data: 87 pair-weeks
- Neutrals without data: 44 pair-weeks
- Data ceiling: 316/360 (87.8%)

### Strength
- T1 baseline: 335/360 trades
- Neutrals with data: 22 pair-weeks
- Neutrals without data: 3 pair-weeks
- Data ceiling: 357/360 (99.2%)

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

## Sentiment Resolver

### Individual Tier Quality

| Tier | Fills | Total% | Avg% | Win% |
| --- | ---: | ---: | ---: | ---: |
| Tier 1: 60/40 | 24 | -0.27% | -0.011% | 45.8% |
| Tier 2: Persistence (55/45 avg) | 44 | +1.78% | +0.040% | 56.8% |
| Tier 3: Relative extremity | 42 | -15.34% | -0.365% | 47.6% |
| Tier 4: Soft fade (53/47) | 64 | -15.00% | -0.234% | 51.6% |
| Tier 5: Forced lean (51/49) | 77 | -14.48% | -0.188% | 53.2% |

### Sentiment Stack Results

#### SA: Conservative (Tier 1 (60/40) only)

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 207 | +7.64% | 29.57% | 54.6% | 4 | 207/280 |
| indices | 21 | +0.65% | 2.08% | 52.4% | 4 | 21/30 |
| crypto | 16 | +12.25% | 3.78% | 81.3% | 2 | 16/20 |
| commodities | 9 | +7.69% | 2.49% | 44.4% | 5 | 9/30 |
| combined | 253 | +28.22% | 17.19% | 55.7% | 4 | 253/360 |
| *of which resolver* | 24 | -0.27% | — | 45.8% | — | avg -0.011% |

Tier fills: tier1=24

#### SB: Moderate (Tier 1 -> Tier 2 -> Tier 4)

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 242 | -1.83% | 38.21% | 55.0% | 4 | 242/280 |
| indices | 21 | +0.65% | 2.08% | 52.4% | 4 | 21/30 |
| crypto | 18 | +13.82% | 3.78% | 83.3% | 2 | 18/20 |
| commodities | 16 | +2.49% | 7.85% | 43.8% | 6 | 16/30 |
| combined | 297 | +15.13% | 24.94% | 55.9% | 3 | 297/360 |
| *of which resolver* | 68 | -13.36% | — | 52.9% | — | avg -0.196% |

Tier fills: tier1=24, tier2=22, tier4=22

#### SC: Full (Tier 1 -> Tier 2 -> Tier 3 -> Tier 4 -> Tier 5)

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 249 | -5.65% | 39.17% | 54.6% | 4 | 249/280 |
| indices | 21 | +0.65% | 2.08% | 52.4% | 4 | 21/30 |
| crypto | 18 | +13.82% | 3.78% | 83.3% | 2 | 18/20 |
| commodities | 18 | +5.20% | 6.92% | 50.0% | 6 | 18/30 |
| combined | 306 | +14.01% | 24.13% | 55.9% | 3 | 306/360 |
| *of which resolver* | 77 | -14.48% | — | 53.2% | — | avg -0.188% |

Tier fills: tier1=24, tier2=22, tier3=16, tier4=8, tier5=7

#### SD: No Forced Lean (Tier 1 -> Tier 2 -> Tier 3 -> Tier 4)

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 244 | -3.32% | 38.21% | 54.9% | 4 | 244/280 |
| indices | 21 | +0.65% | 2.08% | 52.4% | 4 | 21/30 |
| crypto | 18 | +13.82% | 3.78% | 83.3% | 2 | 18/20 |
| commodities | 16 | +2.49% | 7.85% | 43.8% | 6 | 16/30 |
| combined | 299 | +13.64% | 24.94% | 55.9% | 3 | 299/360 |
| *of which resolver* | 70 | -14.85% | — | 52.9% | — | avg -0.212% |

Tier fills: tier1=24, tier2=22, tier3=16, tier4=8

#### SE: Quality-First (Tier 1 -> Tier 2 -> Tier 3)

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 236 | +0.83% | 37.17% | 55.5% | 4 | 236/280 |
| indices | 21 | +0.65% | 2.08% | 52.4% | 4 | 21/30 |
| crypto | 18 | +13.82% | 3.78% | 83.3% | 2 | 18/20 |
| commodities | 16 | +2.49% | 7.85% | 43.8% | 6 | 16/30 |
| combined | 291 | +17.79% | 23.90% | 56.4% | 3 | 291/360 |
| *of which resolver* | 62 | -10.70% | — | 54.8% | — | avg -0.173% |

Tier fills: tier1=24, tier2=22, tier3=16

### Sentiment Stack Comparison

| Stack | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Resolver Avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| S1 Baseline (no resolver) | 229 | +28.49% | 19.56% | 56.8% | 5 | 229/360 | — |
| SA: Conservative | 253 | +28.22% | 17.19% | 55.7% | 4 | 253/360 | -0.011% |
| SB: Moderate | 297 | +15.13% | 24.94% | 55.9% | 3 | 297/360 | -0.196% |
| SC: Full | 306 | +14.01% | 24.13% | 55.9% | 3 | 306/360 | -0.188% |
| SD: No Forced Lean | 299 | +13.64% | 24.94% | 55.9% | 3 | 299/360 | -0.212% |
| SE: Quality-First | 291 | +17.79% | 23.90% | 56.4% | 3 | 291/360 | -0.173% |

## Strength Resolver

### Individual Tier Quality

| Tier | Fills | Total% | Avg% | Win% |
| --- | ---: | ---: | ---: | ---: |
| Tier 1: Raw spread sum | 16 | -2.17% | -0.136% | 50.0% |
| Tier 2: Weighted (24h×2) | 22 | -4.15% | -0.189% | 40.9% |
| Tier 3: 24h only | 22 | -5.25% | -0.239% | 40.9% |
| Tier 4: Softer threshold (4) | 2 | -3.22% | -1.610% | 0.0% |
| Tier 5: Any window lean | 22 | -0.19% | -0.009% | 59.1% |

### Strength Stack Results

#### TA: Simple (Tier 1 (raw spread sum) only)

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +77.68% | 20.22% | 55.7% | 2 | 280/280 |
| indices | 21 | +1.04% | 4.60% | 57.1% | 4 | 21/30 |
| crypto | 20 | -2.86% | 3.05% | 45.0% | 6 | 20/20 |
| commodities | 30 | +2.85% | 11.57% | 46.7% | 4 | 30/30 |
| combined | 351 | +78.72% | 15.09% | 54.4% | 3 | 351/360 |
| *of which resolver* | 16 | -2.17% | — | 50.0% | — | avg -0.136% |

Tier fills: tier1=16

#### TB: Moderate (Tier 1 -> Tier 2 -> Tier 3)

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +77.68% | 20.22% | 55.7% | 2 | 280/280 |
| indices | 27 | -0.94% | 6.15% | 48.1% | 4 | 27/30 |
| crypto | 20 | -2.86% | 3.05% | 45.0% | 6 | 20/20 |
| commodities | 30 | +2.85% | 11.57% | 46.7% | 4 | 30/30 |
| combined | 357 | +76.74% | 15.41% | 53.8% | 3 | 357/360 |
| *of which resolver* | 22 | -4.15% | — | 40.9% | — | avg -0.189% |

Tier fills: tier1=16, tier2=6

#### TC: Full (Tier 1 -> Tier 2 -> Tier 3 -> Tier 4 -> Tier 5)

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +77.68% | 20.22% | 55.7% | 2 | 280/280 |
| indices | 27 | -0.94% | 6.15% | 48.1% | 4 | 27/30 |
| crypto | 20 | -2.86% | 3.05% | 45.0% | 6 | 20/20 |
| commodities | 30 | +2.85% | 11.57% | 46.7% | 4 | 30/30 |
| combined | 357 | +76.74% | 15.41% | 53.8% | 3 | 357/360 |
| *of which resolver* | 22 | -4.15% | — | 40.9% | — | avg -0.189% |

Tier fills: tier1=16, tier2=6

#### TD: Conservative (Tier 1 -> Tier 3)

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +77.68% | 20.22% | 55.7% | 2 | 280/280 |
| indices | 27 | -0.94% | 6.15% | 48.1% | 4 | 27/30 |
| crypto | 20 | -2.86% | 3.05% | 45.0% | 6 | 20/20 |
| commodities | 30 | +2.85% | 11.57% | 46.7% | 4 | 30/30 |
| combined | 357 | +76.74% | 15.41% | 53.8% | 3 | 357/360 |
| *of which resolver* | 22 | -4.15% | — | 40.9% | — | avg -0.189% |

Tier fills: tier1=16, tier3=6

### Strength Stack Comparison

| Stack | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Resolver Avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| T1 Baseline (no resolver) | 335 | +80.89% | 14.98% | 54.6% | 4 | 335/360 | — |
| TA: Simple | 351 | +78.72% | 15.09% | 54.4% | 3 | 351/360 | -0.136% |
| TB: Moderate | 357 | +76.74% | 15.41% | 53.8% | 3 | 357/360 | -0.189% |
| TC: Full | 357 | +76.74% | 15.41% | 53.8% | 3 | 357/360 | -0.189% |
| TD: Conservative | 357 | +76.74% | 15.41% | 53.8% | 3 | 357/360 | -0.189% |

