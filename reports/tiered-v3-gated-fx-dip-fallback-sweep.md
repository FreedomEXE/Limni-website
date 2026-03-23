# Tiered V3 Gated FX Dip Fallback Sweep

Generated: 2026-03-23T14:14:16.596Z

Methodology:
- System: Tiered V3 Net Hold Gated
- Asset class: FX only
- Mode: fallback only
- Path assumption: canonical daily high/low proxy for FX
- Rule: if dip/rally threshold is touched, enter at threshold; otherwise keep original week-open entry

Baseline:
- Simple return: 263.18%
- Max DD simple: 1.55%
- Weekly win rate: 88.89%
- Trade win rate: 61.54%
- FX trades: 73

Results:

| Threshold | Fill Rate | Simple Return | Delta vs Baseline | Max DD | Trade Win | Post-Fill <= -1% | Avg Worst MAE |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0.50% | 50.68% | 286.32% | +23.14% | 0.00% | 74.04% | 24.32% | -0.59% |
| 0.75% | 32.88% | 284.66% | +21.48% | 0.00% | 71.15% | 8.33% | -0.59% |
| 1.00% | 26.03% | 285.76% | +22.58% | 0.00% | 70.19% | 10.53% | -0.48% |
| 1.25% | 16.44% | 280.08% | +16.90% | 0.30% | 67.31% | 8.33% | -0.44% |
| 1.50% | 12.33% | 278.92% | +15.73% | 0.05% | 66.35% | 11.11% | -0.30% |

Leaders:
- Best by simple return: 0.50% (286.32%)
- Best by return/drawdown: 1.50%

JSON: reports\tiered-v3-gated-fx-dip-fallback-sweep.json
