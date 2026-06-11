# V1 Universal +1% Intraweek Hit Rate

Generated: 2026-02-23T11:17:01.439Z
Threshold: 1.00%
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z

## Totals
- Trades total: 538
- Trades evaluable: 538
- Hits (+1.00%): 302
- Hit rate (on total): 56.13%
- Hit rate (on evaluable): 56.13%

## By Model
| Model | Total | Evaluable | Hits | Hit Rate (Total) | Hit Rate (Evaluable) |
| --- | ---: | ---: | ---: | ---: | ---: |
| antikythera | 43 | 43 | 33 | 76.74% | 76.74% |
| blended | 119 | 119 | 66 | 55.46% | 55.46% |
| commercial | 106 | 106 | 43 | 40.57% | 40.57% |
| dealer | 111 | 111 | 66 | 59.46% | 59.46% |
| sentiment | 159 | 159 | 94 | 59.12% | 59.12% |

## Assumptions
- Universe: V1 universal models only (antikythera, blended, dealer, commercial, sentiment) for the same 5-week window used in floor-clamped compare.
- One trade record per model/pair/week directional signal (same counting basis as V1 universal trade count in compare report).
- Hit definition: trade reaches +1.0% favorable excursion at any time during its report-window (MFE >= 1.0%).
- Directional MFE uses weekly intraperiod OHLC highs/lows from OANDA/Bitget.
- No sizing/scaling; pure 1:1 market percent move evaluation.

JSON: `reports/v1-universal-hitrate-1pct-2026-02-23.json`