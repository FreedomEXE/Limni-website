# Sentiment Persistence-First Resolver Research

Weeks analyzed: 10 (Jan 19 -> Mar 22).
Universe: 36 pairs × 10 weeks = 360 possible pair-weeks.

## Gap Analysis

- S1 baseline: 265/360 trades
- Neutrals with data: 95 pair-weeks (have sentiment data but S1 returns null)
- Neutrals without data: 0 pair-weeks (no sentiment aggregate exists)
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

## Sentiment Data Availability

| Asset Class | Present | Possible | Coverage |
| --- | ---: | ---: | ---: |
| fx | 280 | 280 | 100.0% |
| indices | 30 | 30 | 100.0% |
| crypto | 20 | 20 | 100.0% |
| commodities | 30 | 30 | 100.0% |
| combined | 360 | 360 | 100.0% |

## Individual Tier Quality

| Tier | Fires On | Fills | Total% | Avg% | Win% |
| --- | --- | ---: | ---: | ---: | ---: |
| A: Prior-week S1 carry | neutral w/data | 30 | +7.54% | +0.251% | 70.0% |
| B: Persistence (55/45 avg) | neutral w/data | 48 | -6.31% | -0.132% | 54.2% |
| C: Persistence (any lean) | neutral w/data | 61 | -11.79% | -0.193% | 52.5% |
| D: Mild crowding (60/40) | neutral w/data | 24 | -0.27% | -0.011% | 45.8% |
| E: No-data carry (1 week) | no data | 0 | +0.00% | +0.000% | 0.0% |
| F: No-data carry (2 weeks) | no data | 0 | +0.00% | +0.000% | 0.0% |
| G: Deep 2-week carry | neutral w/data | 14 | -4.15% | -0.296% | 50.0% |
| H: Persistence (52/48 avg) | neutral w/data | 60 | -11.09% | -0.185% | 53.3% |

## Stack Results

### PA: Persistence-only (55/45)

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 248 | +69.88% | 29.27% | 60.1% | 4 | 248/280 |
| indices | 30 | -0.66% | 3.52% | 53.3% | 6 | 30/30 |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 20/20 |
| commodities | 15 | -3.15% | 12.97% | 33.3% | 7 | 15/30 |
| combined | 313 | +86.09% | 16.53% | 59.7% | 3 | 313/360 |
| *of which resolver* | 48 | -6.31% | — | 54.2% | — | avg -0.131% |

Tier fills: tierB=48

### PB: Prior-S1 carry only

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 243 | +75.60% | 27.51% | 60.9% | 4 | 243/280 |
| indices | 30 | -0.66% | 3.52% | 53.3% | 6 | 30/30 |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 20/20 |
| commodities | 2 | +4.99% | 0.08% | 50.0% | 1 | 2/30 |
| combined | 295 | +99.94% | 19.60% | 61.7% | 5 | 295/360 |
| *of which resolver* | 30 | +7.54% | — | 70.0% | — | avg +0.251% |

Tier fills: tierA=30

### PC: Persistence-first -> 60/40

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 250 | +68.60% | 30.55% | 59.6% | 4 | 250/280 |
| indices | 30 | -0.66% | 3.52% | 53.3% | 6 | 30/30 |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 20/20 |
| commodities | 15 | -3.15% | 12.97% | 33.3% | 7 | 15/30 |
| combined | 315 | +84.81% | 17.81% | 59.4% | 3 | 315/360 |
| *of which resolver* | 50 | -7.59% | — | 52.0% | — | avg -0.152% |

Tier fills: tierB=48, tierD=2

### PD: Prior-S1 -> persistence -> 60/40

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 256 | +72.59% | 28.64% | 60.2% | 4 | 256/280 |
| indices | 30 | -0.66% | 3.52% | 53.3% | 6 | 30/30 |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 20/20 |
| commodities | 15 | -3.15% | 12.97% | 33.3% | 7 | 15/30 |
| combined | 321 | +88.79% | 15.90% | 59.8% | 3 | 321/360 |
| *of which resolver* | 56 | -3.61% | — | 55.4% | — | avg -0.064% |

Tier fills: tierA=30, tierB=25, tierD=1

### PE: All persistence

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 265 | +64.69% | 30.47% | 59.2% | 4 | 265/280 |
| indices | 30 | -0.66% | 3.52% | 53.3% | 6 | 30/30 |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 20/20 |
| commodities | 18 | +0.08% | 12.04% | 44.4% | 7 | 18/30 |
| combined | 333 | +84.13% | 17.57% | 59.5% | 3 | 333/360 |
| *of which resolver* | 68 | -8.27% | — | 54.4% | — | avg -0.122% |

Tier fills: tierA=30, tierB=25, tierC=13

### PF: Full + no-data carry

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 256 | +72.59% | 28.64% | 60.2% | 4 | 256/280 |
| indices | 30 | -0.66% | 3.52% | 53.3% | 6 | 30/30 |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 20/20 |
| commodities | 15 | -3.15% | 12.97% | 33.3% | 7 | 15/30 |
| combined | 321 | +88.79% | 15.90% | 59.8% | 3 | 321/360 |
| *of which resolver* | 56 | -3.61% | — | 55.4% | — | avg -0.064% |

Tier fills: tierA=30, tierB=25, tierD=1

### PG: Max coverage

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 266 | +63.88% | 31.28% | 59.0% | 4 | 266/280 |
| indices | 30 | -0.66% | 3.52% | 53.3% | 6 | 30/30 |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 20/20 |
| commodities | 18 | +0.08% | 12.04% | 44.4% | 7 | 18/30 |
| combined | 334 | +83.32% | 17.57% | 59.3% | 3 | 334/360 |
| *of which resolver* | 69 | -9.08% | — | 53.6% | — | avg -0.132% |

Tier fills: tierA=30, tierB=25, tierC=13, tierD=1

## Stack Comparison

| Stack | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Resolver Avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| S1 Baseline (no resolver) | 265 | +92.40% | 19.56% | 60.8% | 5 | 265/360 | — |
| PA: Persistence-only (55/45) | 313 | +86.09% | 16.53% | 59.7% | 3 | 313/360 | -0.131% |
| PB: Prior-S1 carry only | 295 | +99.94% | 19.60% | 61.7% | 5 | 295/360 | +0.251% |
| PC: Persistence-first -> 60/40 | 315 | +84.81% | 17.81% | 59.4% | 3 | 315/360 | -0.152% |
| PD: Prior-S1 -> persistence -> 60/40 | 321 | +88.79% | 15.90% | 59.8% | 3 | 321/360 | -0.064% |
| PE: All persistence | 333 | +84.13% | 17.57% | 59.5% | 3 | 333/360 | -0.122% |
| PF: Full + no-data carry | 321 | +88.79% | 15.90% | 59.8% | 3 | 321/360 | -0.064% |
| PG: Max coverage | 334 | +83.32% | 17.57% | 59.3% | 3 | 334/360 | -0.132% |

## No-Data Diagnostic

| Asset Class | No-Data Pair-Weeks | Total Possible | Gap% |
| --- | ---: | ---: | ---: |
| fx | 0 | 280 | 0.0% |
| indices | 0 | 30 | 0.0% |
| crypto | 0 | 20 | 0.0% |
| commodities | 0 | 30 | 0.0% |

### Most Frequent No-Data Pairs

| Pair | Weeks Missing | Total Weeks |
| --- | ---: | ---: |

