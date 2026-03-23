# Weekly ADR + 1H Engulfing Matrix Study

Generated: 2026-03-23T15:05:25.880Z

Methodology:
- Observation basis: unique_pair_week_direction_occurrences_across_all_26_canonical_systems
- Unique observations: 512
- Eligible observations with ADR history and hourly bars: 455
- ADR lookback: 10 days (min 5)
- Reference multiplier: 1.00 ADR
- Confirmation: 1H engulfing after ADR zone touch
- Path assumption: canonical_hourly_bars_for_entry_confirmation; zone touch can happen intra-hour via high/low and confirmation requires a later hourly engulfing candle close

Asset-Class Recommendations:

| Asset Class | Sample | Recommended | Best Exec Return | Best Confirmed Trade | Cleanest Post-Entry | Confidence |
|---|---:|---:|---:|---:|---:|---|
| Fx | 348 | 1.50 ADR | 1.50 ADR | 1.50 ADR | 1.50 ADR | high |
| Indices | 43 | 0.75 ADR | 0.75 ADR | 1.00 ADR | 1.50 ADR | high |
| Crypto | 16 | 0.75 ADR | 0.75 ADR | 1.50 ADR | 1.50 ADR | medium |
| Commodities | 48 | 1.00 ADR | 1.00 ADR | 1.50 ADR | 1.00 ADR | high |

Reference Comparison by Asset Class:

| Asset Class | Multiplier | Zone Touch | Confirm Rate | Confirm/Touch | Avg Exec Return | Confirmed Trade Avg | Post-Entry <= -1% |
|---|---:|---:|---:|---:|---:|---:|---:|
| Fx | 0.50 ADR | 70.40% | 70.11% | 99.59% | 0.06% | 0.09% | 20.49% |
| Fx | 0.75 ADR | 56.90% | 56.03% | 98.48% | 0.07% | 0.12% | 15.38% |
| Fx | 1.00 ADR | 45.11% | 44.25% | 98.09% | 0.07% | 0.16% | 12.99% |
| Fx | 1.25 ADR | 36.21% | 35.34% | 97.62% | 0.07% | 0.19% | 13.01% |
| Fx | 1.50 ADR | 25.57% | 24.14% | 94.38% | 0.08% | 0.34% | 11.90% |
| Indices | 0.50 ADR | 88.37% | 83.72% | 94.74% | 0.52% | 0.62% | 50.00% |
| Indices | 0.75 ADR | 67.44% | 60.47% | 89.66% | 0.56% | 0.93% | 50.00% |
| Indices | 1.00 ADR | 48.84% | 46.51% | 95.24% | 0.53% | 1.13% | 40.00% |
| Indices | 1.25 ADR | 34.88% | 34.88% | 100.00% | 0.30% | 0.86% | 53.33% |
| Indices | 1.50 ADR | 20.93% | 18.60% | 88.89% | 0.16% | 0.84% | 37.50% |
| Crypto | 0.50 ADR | 75.00% | 75.00% | 100.00% | 5.20% | 6.93% | 75.00% |
| Crypto | 0.75 ADR | 75.00% | 75.00% | 100.00% | 5.48% | 7.31% | 66.67% |
| Crypto | 1.00 ADR | 62.50% | 62.50% | 100.00% | 4.48% | 7.17% | 80.00% |
| Crypto | 1.25 ADR | 50.00% | 50.00% | 100.00% | 4.29% | 8.57% | 87.50% |
| Crypto | 1.50 ADR | 50.00% | 50.00% | 100.00% | 5.00% | 10.00% | 62.50% |
| Commodities | 0.50 ADR | 68.75% | 66.67% | 96.97% | 0.34% | 0.52% | 78.13% |
| Commodities | 0.75 ADR | 60.42% | 58.33% | 96.55% | 0.82% | 1.40% | 78.57% |
| Commodities | 1.00 ADR | 56.25% | 52.08% | 92.59% | 1.39% | 2.68% | 72.00% |
| Commodities | 1.25 ADR | 39.58% | 37.50% | 94.74% | 1.12% | 2.99% | 72.22% |
| Commodities | 1.50 ADR | 33.33% | 33.33% | 100.00% | 1.18% | 3.54% | 81.25% |

JSON: reports\weekly-adr-engulfing-matrix-study.json
