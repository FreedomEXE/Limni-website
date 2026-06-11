# Selector Commercial Research

Weeks analyzed: 10 (Mar 22 -> Jan 19).
Baseline: canonical selector strength_tiebreak.
All returns ADR-normalized.

## Master Comparison

| Variant | Trades | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk | Changed Decisions | Changed Return |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline strength_tiebreak | 360 | +91.96% | 4.01% | 54.2% | 1 | 36.0 | 0 | +0.00% |
| Commercial + strength disagree skip | 348 | +80.90% | 4.69% | 53.7% | 1 | 34.8 | 12 | -11.06% |
| Commercial tiebreak | 360 | +88.49% | 1.91% | 58.9% | 2 | 36.0 | 75 | -3.47% |
| Commercial weighted COT | 360 | +79.88% | 9.90% | 59.7% | 2 | 36.0 | 4 | -12.09% |
| Commercial full voter | 360 | +77.08% | 9.90% | 59.7% | 2 | 36.0 | 17 | -14.89% |
| Commercial caution skip | 286 | +60.76% | 16.56% | 52.1% | 3 | 28.6 | 74 | -31.20% |
| Commercial override | 360 | +29.30% | 43.44% | 53.1% | 4 | 36.0 | 49 | -62.66% |

## Asset Breakdown

### Baseline strength_tiebreak

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +42.09% | 52.5% |
| crypto | 20 | +17.17% | 60.0% |
| indices | 30 | +1.17% | 60.0% |
| commodities | 30 | +31.54% | 60.0% |

### Commercial + strength disagree skip

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 272 | +40.28% | 52.2% |
| crypto | 20 | +17.17% | 60.0% |
| indices | 30 | +1.17% | 60.0% |
| commodities | 26 | +22.28% | 57.7% |

### Commercial tiebreak

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +36.16% | 57.9% |
| crypto | 20 | +18.80% | 80.0% |
| indices | 30 | +0.74% | 56.7% |
| commodities | 30 | +32.79% | 56.7% |

### Commercial weighted COT

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +27.54% | 58.9% |
| crypto | 20 | +18.80% | 80.0% |
| indices | 30 | +0.74% | 56.7% |
| commodities | 30 | +32.79% | 56.7% |

### Commercial full voter

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +24.43% | 58.2% |
| crypto | 20 | +18.80% | 80.0% |
| indices | 30 | +0.74% | 56.7% |
| commodities | 30 | +33.11% | 63.3% |

### Commercial caution skip

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 212 | +20.00% | 49.5% |
| crypto | 20 | +17.17% | 60.0% |
| indices | 29 | +1.07% | 58.6% |
| commodities | 25 | +22.53% | 60.0% |

### Commercial override

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | -23.20% | 50.0% |
| crypto | 20 | +18.80% | 80.0% |
| indices | 30 | +0.74% | 56.7% |
| commodities | 30 | +32.96% | 60.0% |

