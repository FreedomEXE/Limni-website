# Veto Base Source Research at 36/36

Weeks analyzed: 10 (Mar 22 -> Jan 19).
Universe: 360 pair-weeks.
Data loader: getCanonicalBasketWeek (canonical app/engine path).
All returns ADR-normalized.

Veto rule: 2/4 standardized — skip when 2+ of the other 3 sources actively disagree.

## Veto Filter Summary

| Source | Raw Trades | Veto-Passed | Veto-Failed | Failed Return | Failed WR |
| --- | ---: | ---: | ---: | ---: | ---: |
| dealer | 360 | 168 | 192 | -3.97% | 49.5% |
| commercial | 360 | 192 | 168 | -26.53% | 45.8% |
| sentiment | 360 | 233 | 127 | -4.16% | 56.7% |
| strength | 360 | 216 | 144 | +13.82% | 46.5% |

## Master Comparison

| Strategy | Trades | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Dealer Raw | 360 | +96.51% | 0.00% | 57.8% | 0 | 36.0 |
| Dealer Veto | 168 | +100.47% | 1.48% | 67.3% | 1 | 16.8 |
| Commercial Veto | 192 | +65.31% | 6.53% | 62.0% | 3 | 19.2 |
| Agree 3-of-4 Reference | 244 | +85.36% | 7.61% | 60.7% | 3 | 24.4 |
| Dealer + Strength Veto Union | 244 | +85.36% | 7.61% | 60.7% | 3 | 24.4 |
| Dealer + Sentiment Veto Union | 244 | +85.36% | 7.61% | 60.7% | 3 | 24.4 |
| Dealer + Strength + Sentiment Veto Union | 244 | +85.36% | 7.61% | 60.7% | 3 | 24.4 |
| All 4 Veto Union | 244 | +85.36% | 7.61% | 60.7% | 3 | 24.4 |
| Sentiment Veto | 233 | +77.32% | 12.23% | 60.1% | 3 | 23.3 |
| Commercial Raw | 360 | +38.78% | 13.60% | 54.4% | 3 | 36.0 |
| Strength Raw | 360 | +91.35% | 15.92% | 55.3% | 3 | 36.0 |
| Sentiment Raw | 360 | +73.16% | 28.29% | 58.9% | 3 | 36.0 |
| Strength Veto | 216 | +77.53% | 6.75% | 61.1% | 4 | 21.6 |

## Asset Breakdown

### Dealer Raw

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +61.35% | 57.5% |
| crypto | 20 | +20.01% | 85.0% |
| indices | 30 | -2.25% | 46.7% |
| commodities | 30 | +17.39% | 53.3% |

### Dealer Veto

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 134 | +77.24% | 67.9% |
| crypto | 20 | +20.01% | 85.0% |
| indices | 13 | -5.11% | 30.8% |
| commodities | 1 | +8.34% | 100.0% |

### Commercial Veto

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 142 | +57.13% | 63.4% |
| crypto | 20 | +20.01% | 85.0% |
| indices | 15 | -2.06% | 40.0% |
| commodities | 15 | -9.77% | 40.0% |

### Agree 3-of-4 Reference

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 188 | +70.39% | 61.2% |
| crypto | 20 | +20.01% | 85.0% |
| indices | 20 | -3.60% | 45.0% |
| commodities | 16 | -1.44% | 43.8% |

### Dealer + Strength Veto Union

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 188 | +70.39% | 61.2% |
| crypto | 20 | +20.01% | 85.0% |
| indices | 20 | -3.60% | 45.0% |
| commodities | 16 | -1.44% | 43.8% |

### Dealer + Sentiment Veto Union

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 188 | +70.39% | 61.2% |
| crypto | 20 | +20.01% | 85.0% |
| indices | 20 | -3.60% | 45.0% |
| commodities | 16 | -1.44% | 43.8% |

### Dealer + Strength + Sentiment Veto Union

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 188 | +70.39% | 61.2% |
| crypto | 20 | +20.01% | 85.0% |
| indices | 20 | -3.60% | 45.0% |
| commodities | 16 | -1.44% | 43.8% |

### All 4 Veto Union

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 188 | +70.39% | 61.2% |
| crypto | 20 | +20.01% | 85.0% |
| indices | 20 | -3.60% | 45.0% |
| commodities | 16 | -1.44% | 43.8% |

### Sentiment Veto

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 179 | +62.63% | 60.3% |
| crypto | 20 | +20.01% | 85.0% |
| indices | 18 | -3.89% | 44.4% |
| commodities | 16 | -1.44% | 43.8% |

### Commercial Raw

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +41.06% | 55.4% |
| crypto | 20 | +20.01% | 85.0% |
| indices | 30 | -4.91% | 33.3% |
| commodities | 30 | -17.39% | 46.7% |

### Strength Raw

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +83.89% | 56.4% |
| crypto | 20 | +6.57% | 55.0% |
| indices | 30 | -1.96% | 53.3% |
| commodities | 30 | +2.85% | 46.7% |

### Sentiment Raw

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +59.53% | 58.9% |
| crypto | 20 | +20.01% | 85.0% |
| indices | 30 | -0.66% | 53.3% |
| commodities | 30 | -5.73% | 46.7% |

### Strength Veto

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 172 | +66.69% | 61.6% |
| crypto | 12 | +13.29% | 83.3% |
| indices | 16 | -1.02% | 56.3% |
| commodities | 16 | -1.44% | 43.8% |

## Overlap Matrix

| | dealer_veto | commercial_veto | sentiment_veto | strength_veto |
| --- | ---: | ---: | ---: | ---: |
| dealer_veto | 168 | 116 | 157 | 140 |
| commercial_veto | 116 | 192 | 181 | 164 |
| sentiment_veto | 157 | 181 | 233 | 205 |
| strength_veto | 140 | 164 | 205 | 216 |

## Unique Trades Per Source

| Source | Veto-Passed | Unique | Shared | Unique Return | Unique WR |
| --- | ---: | ---: | ---: | ---: | ---: |
| dealer_veto | 168 | 0 | 168 | +0.00% | 0.0% |
| commercial_veto | 192 | 0 | 192 | +0.00% | 0.0% |
| sentiment_veto | 233 | 0 | 233 | +0.00% | 0.0% |
| strength_veto | 216 | 0 | 216 | +0.00% | 0.0% |

## Structural Verification

- 4-source veto union = agree_3of4: YES
- Pair-weeks in union: 244
- Pair-weeks in agree_3of4: 244
- Mismatches: 0

## Per-Week Profile

| Week | dealer_raw | dealer_veto | strength_raw | strength_veto | sentiment_veto | agree_3of4 | D+St sleeve | D+St+Se sleeve |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mar 22 | +1.92% | -1.48% | +0.02% | -1.44% | -8.27% | -3.45% | -3.45% | -3.45% |
| Mar 15 | +3.35% | +1.50% | -10.26% | -0.52% | +3.90% | +3.90% | +3.90% | +3.90% |
| Mar 08 | +2.68% | +1.06% | -1.26% | -0.22% | -2.25% | -2.25% | -2.25% | -2.25% |
| Mar 02 | +11.62% | +1.96% | -4.40% | -4.57% | -5.62% | -5.36% | -5.36% | -5.36% |
| Feb 23 | +2.55% | +4.39% | +6.91% | +5.21% | +7.69% | +6.07% | +6.07% | +6.07% |
| Feb 16 | +18.39% | +9.39% | +3.98% | +0.42% | +0.48% | +0.48% | +0.48% | +0.48% |
| Feb 09 | +1.93% | +5.92% | +12.82% | +2.91% | +1.29% | +4.28% | +4.28% | +4.28% |
| Feb 02 | +9.82% | +16.67% | +23.24% | +18.86% | +19.69% | +20.35% | +20.35% | +20.35% |
| Jan 26 | +7.74% | +12.50% | +17.31% | +15.63% | +14.60% | +15.53% | +15.53% | +15.53% |
| Jan 19 | +36.51% | +48.57% | +42.98% | +41.24% | +45.82% | +45.82% | +45.82% | +45.82% |
