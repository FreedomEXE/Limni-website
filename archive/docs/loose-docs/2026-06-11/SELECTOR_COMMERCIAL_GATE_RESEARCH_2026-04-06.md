# Selector Commercial Gate Research

Weeks analyzed: 10 (Mar 22 -> Jan 19).
Baseline: canonical selector strength_tiebreak.
Commercial is tested only as a gate on dealer-led selector decisions.
All returns ADR-normalized.

## Master Comparison

| Variant | Trades | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk | Changed Decisions | Changed Return |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline strength_tiebreak | 360 | +91.96% | 4.01% | 54.2% | 1 | 36.0 | 0 | +0.00% |
| Comm Gate Override-Only | 360 | +60.76% | 12.37% | 49.4% | 1 | 36.0 | 21 | -31.20% |
| Comm Gate Strict | 360 | +64.91% | 15.31% | 51.1% | 2 | 36.0 | 37 | -27.05% |
| Comm Gate Soft | 360 | +64.91% | 15.31% | 51.1% | 2 | 36.0 | 37 | -27.05% |
| Comm Require Confirmation | 360 | +19.46% | 21.19% | 46.1% | 4 | 36.0 | 39 | -72.50% |

## Conflict Slices

| Slice | Count | Total% | Win% |
| --- | ---: | ---: | ---: |
| dealer_conflict_comm_agrees | 10 | +0.28% | 60.0% |
| dealer_conflict_comm_strong_oppose | 37 | +13.53% | 64.9% |
| dealer_conflict_comm_weak_or_neutral | 39 | +10.87% | 53.8% |

## Asset Breakdown

### Baseline strength_tiebreak

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +42.09% | 52.5% |
| crypto | 20 | +17.17% | 60.0% |
| indices | 30 | +1.17% | 60.0% |
| commodities | 30 | +31.54% | 60.0% |

### Comm Gate Override-Only

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +10.88% | 46.4% |
| crypto | 20 | +17.17% | 60.0% |
| indices | 30 | +1.17% | 60.0% |
| commodities | 30 | +31.54% | 60.0% |

### Comm Gate Strict

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +15.23% | 48.9% |
| crypto | 20 | +17.17% | 60.0% |
| indices | 30 | +0.97% | 56.7% |
| commodities | 30 | +31.54% | 60.0% |

### Comm Gate Soft

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | +15.23% | 48.9% |
| crypto | 20 | +17.17% | 60.0% |
| indices | 30 | +0.97% | 56.7% |
| commodities | 30 | +31.54% | 60.0% |

### Comm Require Confirmation

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | 280 | -27.20% | 42.5% |
| crypto | 20 | +17.17% | 60.0% |
| indices | 30 | +1.17% | 60.0% |
| commodities | 30 | +28.33% | 56.7% |

