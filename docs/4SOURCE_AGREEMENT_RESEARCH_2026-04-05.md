# 4-Source Agreement Research

Weeks analyzed: 10 (Jan 19 -> Mar 22).
Universe: 36 pairs × 10 weeks = 360 possible pair-weeks.
Data loader: getCanonicalBasketWeek (canonical app/engine path).
All returns ADR-normalized.

## Vote Distribution

| Pattern | Count | % of Total |
| --- | ---: | ---: |
| 4-0 (unanimous) | 77 | 21.4% |
| 3-1 (strong majority) | 167 | 46.4% |
| 2-2 (tie) | 116 | 32.2% |

### Per-Week Vote Distribution

| Week | 4-0 | 3-1 | 2-2 | Total |
| --- | ---: | ---: | ---: | ---: |
| Jan 19 | 8 | 18 | 10 | 36 |
| Jan 26 | 9 | 16 | 11 | 36 |
| Feb 02 | 9 | 17 | 10 | 36 |
| Feb 09 | 10 | 14 | 12 | 36 |
| Feb 16 | 8 | 15 | 13 | 36 |
| Feb 23 | 9 | 15 | 12 | 36 |
| Mar 02 | 10 | 11 | 15 | 36 |
| Mar 08 | 7 | 22 | 7 | 36 |
| Mar 15 | 2 | 19 | 15 | 36 |
| Mar 22 | 5 | 20 | 11 | 36 |

## Tie Analysis (2v2 Splits)

| Split Pattern | Count | % of Ties |
| --- | ---: | ---: |
| D+C vs Se+St | 24 | 20.7% |
| D+Se vs C+St | 51 | 44% |
| D+St vs C+Se | 41 | 35.3% |
| other | 0 | 0% |

### Tiebreak-Only Performance

| Tiebreaker | Tie Trades | Total% | Avg% | Win% |
| --- | ---: | ---: | ---: | ---: |
| Dealer direction | 116 | -19.08% | -0.164% | 46.6% |
| Sentiment direction | 116 | +3.88% | +0.033% | 59.5% |

## Standalone Source Baselines

| Source | Trades | Total% | MaxDD% | Win% | Losing Wks |
| --- | ---: | ---: | ---: | ---: | ---: |
| Dealer | 360 | +96.51% | 0.00% | 57.8% | 0 |
| Commercial | 360 | +38.78% | 13.60% | 54.4% | 3 |
| Sentiment | 360 | +73.16% | 28.29% | 58.9% | 3 |
| Strength | 360 | +91.35% | 15.92% | 55.3% | 3 |

## 3-Source Agreement Baselines

| Variant | Sources | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| agree_2of3_DCS | D+C+Se | 360 | +63.70% | 11.37% | 58.1% | 4 | 100% (360/360) |
| agree_2of3_DSt | D+Se+St | 360 | +91.83% | 21.36% | 58.3% | 3 | 100% (360/360) |
| agree_2of3_DCSt | D+C+St | 360 | +81.48% | 8.14% | 54.2% | 2 | 100% (360/360) |
| agree_2of3_CSSt | C+Se+St | 360 | +104.44% | 13.48% | 58.3% | 4 | 100% (360/360) |

## 4-Source Agreement Results

### agree_3of4

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 188 | +70.39% | 12.17% | 61.2% | 2 | 67.1% |
| indices | 20 | -3.60% | 4.24% | 45.0% | 8 | 66.7% |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 100.0% |
| commodities | 16 | -1.44% | 11.36% | 43.8% | 5 | 53.3% |
| combined | 244 | +85.36% | 7.61% | 60.7% | 3 | 67.8% |

### agree_4of4

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 63 | +52.53% | 0.03% | 79.4% | 1 | 22.5% |
| indices | 2 | -1.28% | 1.28% | 0.0% | 2 | 6.7% |
| crypto | 12 | +13.29% | 1.98% | 83.3% | 2 | 60.0% |
| commodities | 0 | +0.00% | 0.00% | 0.0% | 0 | 0.0% |
| combined | 77 | +64.53% | 0.00% | 77.9% | 0 | 21.4% |

### agree_majority_dealer

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +47.66% | 9.16% | 55.4% | 4 | 100.0% |
| indices | 30 | +0.78% | 3.34% | 56.7% | 4 | 100.0% |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 100.0% |
| commodities | 30 | -2.16% | 12.17% | 43.3% | 5 | 100.0% |
| combined | 360 | +66.29% | 6.97% | 56.1% | 4 | 100.0% |

### agree_majority_sentiment

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | 280 | +75.03% | 27.74% | 60.7% | 4 | 100.0% |
| indices | 30 | -0.07% | 3.52% | 53.3% | 5 | 100.0% |
| crypto | 20 | +20.01% | 3.78% | 85.0% | 2 | 100.0% |
| commodities | 30 | -5.73% | 15.57% | 46.7% | 6 | 100.0% |
| combined | 360 | +89.25% | 18.13% | 60.3% | 3 | 100.0% |

## Master Comparison

| Strategy | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Trades/Wk |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Dealer | 360 | +96.51% | 0.00% | 57.8% | 0 | 100% (360/360) | 36.0 |
| agree_4of4 | 77 | +64.53% | 0.00% | 77.9% | 0 | 21.4% (77/360) | 7.7 |
| agree_2of3_DCSt | 360 | +81.48% | 8.14% | 54.2% | 2 | 100% (360/360) | 36.0 |
| agree_2of3_DSt | 360 | +91.83% | 21.36% | 58.3% | 3 | 100% (360/360) | 36.0 |
| Strength | 360 | +91.35% | 15.92% | 55.3% | 3 | 100% (360/360) | 36.0 |
| agree_majority_sentiment | 360 | +89.25% | 18.13% | 60.3% | 3 | 100% (360/360) | 36.0 |
| agree_3of4 | 244 | +85.36% | 7.61% | 60.7% | 3 | 67.8% (244/360) | 24.4 |
| Sentiment | 360 | +73.16% | 28.29% | 58.9% | 3 | 100% (360/360) | 36.0 |
| Commercial | 360 | +38.78% | 13.60% | 54.4% | 3 | 100% (360/360) | 36.0 |
| agree_2of3_CSSt | 360 | +104.44% | 13.48% | 58.3% | 4 | 100% (360/360) | 36.0 |
| agree_majority_dealer | 360 | +66.29% | 6.97% | 56.1% | 4 | 100% (360/360) | 36.0 |
| agree_2of3_DCS | 360 | +63.70% | 11.37% | 58.1% | 4 | 100% (360/360) | 36.0 |

## Per-Week Coverage

| Week | agree_3of4 | agree_4of4 | agree_majority_dealer | agree_majority_sentiment |
| --- | ---: | ---: | ---: | ---: |
| Jan 19 | 26 | 8 | 36 | 36 |
| Jan 26 | 25 | 9 | 36 | 36 |
| Feb 02 | 26 | 9 | 36 | 36 |
| Feb 09 | 24 | 10 | 36 | 36 |
| Feb 16 | 23 | 8 | 36 | 36 |
| Feb 23 | 24 | 9 | 36 | 36 |
| Mar 02 | 21 | 10 | 36 | 36 |
| Mar 08 | 29 | 7 | 36 | 36 |
| Mar 15 | 21 | 2 | 36 | 36 |
| Mar 22 | 25 | 5 | 36 | 36 |
