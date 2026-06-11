# Weekly ADR + 1H Engulfing + 5m EMA50 FX Study

Generated: 2026-03-23T15:12:58.934Z

Methodology:
- Universe: FX only
- Eligible observations: 348
- ADR lookback: 10 days (min 5)
- Multipliers: 0.75, 1.00, 1.25, 1.50 ADR
- 5m EMA length: 50
- Confirmation: 1H engulfing, then require engulf close on correct side of latest closed 5m EMA50

| Multiplier | Zone Touch | 1H Engulf | EMA Confirm | EMA/Engulf | Avg Exec Return | Confirmed Trade Avg | Confirmed Win | Post-Entry <= -1% |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.75 ADR | 56.90% | 56.03% | 45.69% | 81.54% | 0.03% | 0.06% | 56.60% | 16.98% |
| 1.00 ADR | 45.11% | 44.25% | 34.48% | 77.92% | 0.04% | 0.11% | 55.83% | 13.33% |
| 1.25 ADR | 36.21% | 35.34% | 27.59% | 78.05% | 0.05% | 0.17% | 62.50% | 13.54% |
| 1.50 ADR | 25.57% | 24.14% | 18.39% | 76.19% | 0.06% | 0.30% | 65.63% | 14.06% |

Recommended: 1.50 ADR
JSON: reports\weekly-adr-engulfing-ema-fx-study.json
