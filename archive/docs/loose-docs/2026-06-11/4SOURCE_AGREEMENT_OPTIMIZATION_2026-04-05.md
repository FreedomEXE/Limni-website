# 4-Source Agreement Optimization

Weeks analyzed: 10 (Jan 19 -> Mar 22).
Base system: agree_3of4 on canonical basket directions.
All returns ADR-normalized.

## Variant Comparison

| Variant | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Trades/Wk | Added Tie Trades | Added Tie Return |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| agree_3of4 + Se+St ties | 268 | +98.14% | 17.42% | 61.2% | 3 | 74.4% | 26.8 | 24 | +12.77% |
| agree_3of4 + only D+C vs Se+St ties | 268 | +98.14% | 17.42% | 61.2% | 3 | 74.4% | 26.8 | 24 | +12.77% |
| agree_3of4 FX+crypto only | 208 | +90.40% | 11.18% | 63.5% | 3 | 69.3% | 20.8 | 0 | +0.00% |
| agree_3of4 + FX-only sentiment ties | 336 | +90.01% | 24.78% | 60.4% | 3 | 93.3% | 33.6 | 92 | +4.65% |
| agree_3of4 | 244 | +85.36% | 7.61% | 60.7% | 3 | 67.8% | 24.4 | 0 | +0.00% |
| agree_3of4 + only D+St vs C+Se ties | 285 | +84.07% | 6.22% | 60.4% | 3 | 79.2% | 28.5 | 41 | -1.29% |
| agree_3of4 + only D+Se vs C+St ties | 295 | +77.77% | 9.77% | 60.0% | 4 | 81.9% | 29.5 | 51 | -7.60% |

## Tie Pattern Breakdown

| Pattern | Count | Sentiment-Side Total% | Sentiment-Side Win% | Opposite-Side Total% | Opposite-Side Win% |
| --- | ---: | ---: | ---: | ---: | ---: |
| D+C vs Se+St | 24 | +12.77% | 66.7% | -12.77% | 33.3% |
| D+Se vs C+St | 51 | -7.60% | 56.9% | +7.60% | 43.1% |
| D+St vs C+Se | 41 | -1.29% | 58.5% | +1.29% | 41.5% |

## Per-Week Coverage

| Week | agree_3of4 | + Se+St ties | + FX-only ties | FX+crypto only |
| --- | ---: | ---: | ---: | ---: |
| Jan 19 | 26 | 31 | 35 | 21 |
| Jan 26 | 25 | 25 | 32 | 23 |
| Feb 02 | 26 | 27 | 33 | 23 |
| Feb 09 | 24 | 26 | 34 | 20 |
| Feb 16 | 23 | 28 | 33 | 20 |
| Feb 23 | 24 | 29 | 34 | 20 |
| Mar 02 | 21 | 22 | 33 | 18 |
| Mar 08 | 29 | 30 | 34 | 25 |
| Mar 15 | 21 | 24 | 34 | 17 |
| Mar 22 | 25 | 26 | 34 | 21 |
