# Sentiment Full Resolver Research (Canonical Path)

Weeks analyzed: 10 (Jan 19 -> Mar 22).
Universe: 36 pairs × 10 weeks = 360 possible pair-weeks.
Data loader: getAggregatesForWeekStartWithBackfill (canonical app/engine path).

## Gap Analysis

- S1 baseline: 265/360 trades
- Neutrals with data: 95 pair-weeks
- Neutrals without data: 0 pair-weeks
- Data ceiling: 360/360 (100.0%)

### Per-Week Gap Breakdown

| Week | S1 Trades | Neutrals (data) | No Data | Total Gaps |
| --- | ---: | ---: | ---: | ---: |
| Jan 19 | 30 | 6 | 0 | 6 |
| Jan 26 | 30 | 6 | 0 | 6 |
| Feb 02 | 28 | 8 | 0 | 8 |
| Feb 09 | 28 | 8 | 0 | 8 |
| Feb 16 | 28 | 8 | 0 | 8 |
| Feb 23 | 20 | 16 | 0 | 16 |
| Mar 02 | 24 | 12 | 0 | 12 |
| Mar 08 | 27 | 9 | 0 | 9 |
| Mar 15 | 26 | 10 | 0 | 10 |
| Mar 22 | 24 | 12 | 0 | 12 |

## Individual Tier Quality

| Tier | Fills | Total% | Avg% | Win% |
| --- | ---: | ---: | ---: | ---: |
| A: Prior-week S1 carry | 30 | +7.54% | +0.251% | 70.0% |
| R: Relative extremity fade | 82 | -9.90% | -0.121% | 53.7% |
| F: Forced lean | 13 | -16.37% | -1.259% | 30.8% |

## Tier R: Extremity Bucket Breakdown

| Bucket | Fills | Total% | Avg% | Win% |
| --- | ---: | ---: | ---: | ---: |
| 0-1% from 50 | 0 | +0.00% | +0.000% | 0.0% |
| 1-2% from 50 | 6 | +1.28% | +0.214% | 50.0% |
| 2-5% from 50 | 20 | -6.40% | -0.320% | 55.0% |
| 5-10% from 50 | 32 | -4.52% | -0.141% | 59.4% |
| 10-15% from 50 | 24 | -0.27% | -0.011% | 45.8% |

## Flat / Near-50 Diagnostic

- Rows with `agg_long_pct === 50.000` (exactly flat): 13
- Rows with `|agg_long_pct - 50| < 0.5` (near-flat): 13
- Rows with `|agg_long_pct - 50| < 1.0`: 13

These are the rows most likely to produce noise rather than signal from Tier R.

## Tier F Sub-Step Breakdown

| Sub-Step | Fills |
| --- | ---: |
| Prior-week S1 | 0 |
| Prior-week lean | 3 |
| 2-week average lean | 0 |
| Hardcoded SHORT (synthetic) | 10 |

Total Tier F fills: 13

## Stack Results

### SA: Prior-S1 carry only

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 243 | +75.60% | 27.51% | 60.9% | 4 | 243/280 |
| indices | 30 | -0.66% | 3.52% | 53.3% | 6 | 30/30 |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 20/20 |
| commodities | 2 | +4.99% | 0.08% | 50.0% | 1 | 2/30 |
| combined | 295 | +99.94% | 19.60% | 61.7% | 5 | 295/360 |
| *of which resolver* | 30 | +7.54% | — | 70.0% | — | — |

Tier fills: tierA=30, tierR=0, tierF=0

### SB: Prior-S1 carry + relative extremity

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 277 | +61.48% | 36.31% | 59.6% | 4 | 277/280 |
| indices | 30 | -0.66% | 3.52% | 53.3% | 6 | 30/30 |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 20/20 |
| commodities | 20 | +8.69% | 6.92% | 50.0% | 6 | 20/30 |
| combined | 347 | +89.53% | 21.27% | 59.9% | 3 | 347/360 |
| *of which resolver* | 82 | -2.87% | — | 57.3% | — | — |

Tier fills: tierA=30, tierR=52, tierF=0

### SC: Prior-S1 carry + relative extremity + forced lean

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +59.53% | 37.31% | 58.9% | 4 | 280/280 |
| indices | 30 | -0.66% | 3.52% | 53.3% | 6 | 30/30 |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 20/20 |
| commodities | 30 | -5.73% | 15.57% | 46.7% | 6 | 30/30 |
| combined | 360 | +73.16% | 28.29% | 58.9% | 3 | 360/360 |
| *of which resolver* | 95 | -19.25% | — | 53.7% | — | — |

Tier fills: tierA=30, tierR=52, tierF=13

### SD: Relative extremity only

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 277 | +54.45% | 39.17% | 58.5% | 4 | 277/280 |
| indices | 30 | -0.66% | 3.52% | 53.3% | 6 | 30/30 |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 20/20 |
| commodities | 20 | +8.69% | 6.92% | 50.0% | 6 | 20/30 |
| combined | 347 | +82.50% | 24.13% | 59.1% | 3 | 347/360 |
| *of which resolver* | 82 | -9.90% | — | 53.7% | — | — |

Tier fills: tierA=0, tierR=82, tierF=0

### SE: Relative extremity + forced lean

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +52.50% | 40.18% | 57.9% | 4 | 280/280 |
| indices | 30 | -0.66% | 3.52% | 53.3% | 6 | 30/30 |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 20/20 |
| commodities | 30 | -5.73% | 15.57% | 46.7% | 6 | 30/30 |
| combined | 360 | +66.13% | 31.15% | 58.1% | 3 | 360/360 |
| *of which resolver* | 95 | -26.27% | — | 50.5% | — | — |

Tier fills: tierA=0, tierR=82, tierF=13

## Stack Comparison

| Stack | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Full 36/36? |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| SB: Prior-S1 carry + relative extremity | 347 | +89.53% | 21.27% | 59.9% | 3 | 347/360 | No |
| SD: Relative extremity only | 347 | +82.50% | 24.13% | 59.1% | 3 | 347/360 | No |
| SC: Prior-S1 carry + relative extremity + forced lean | 360 | +73.16% | 28.29% | 58.9% | 3 | 360/360 | Yes |
| SE: Relative extremity + forced lean | 360 | +66.13% | 31.15% | 58.1% | 3 | 360/360 | Yes |
| SA: Prior-S1 carry only | 295 | +99.94% | 19.60% | 61.7% | 5 | 295/360 | No |
| S1 Baseline (no resolver) | 265 | +92.40% | 19.56% | 60.8% | 5 | 265/360 | No |

## Resolver-Only Performance

| Stack | Resolver Trades | Resolver Total% | Resolver Avg% | Resolver Win% |
| --- | ---: | ---: | ---: | ---: |
| SA: Prior-S1 carry only | 30 | +7.54% | +0.251% | 70.0% |
| SB: Prior-S1 carry + relative extremity | 82 | -2.87% | -0.035% | 57.3% |
| SC: Prior-S1 carry + relative extremity + forced lean | 95 | -19.25% | -0.203% | 53.7% |
| SD: Relative extremity only | 82 | -9.90% | -0.121% | 53.7% |
| SE: Relative extremity + forced lean | 95 | -26.27% | -0.277% | 50.5% |

## Per-Week Coverage Verification

| Week | S1 | SA | SB | SC | SD | SE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Jan 19 | 30 | 32 | 35 | 36 | 35 | 36 |
| Jan 26 | 30 | 30 | 35 | 36 | 35 | 36 |
| Feb 02 | 28 | 31 | 34 | 36 | 34 | 36 |
| Feb 09 | 28 | 32 | 35 | 36 | 35 | 36 |
| Feb 16 | 28 | 28 | 35 | 36 | 35 | 36 |
| Feb 23 | 20 | 28 | 34 | 36 | 34 | 36 |
| Mar 02 | 24 | 25 | 34 | 36 | 34 | 36 |
| Mar 08 | 27 | 28 | 35 | 36 | 35 | 36 |
| Mar 15 | 26 | 31 | 35 | 36 | 35 | 36 |
| Mar 22 | 24 | 30 | 35 | 36 | 35 | 36 |

