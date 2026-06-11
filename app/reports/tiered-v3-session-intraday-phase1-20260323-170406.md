# Tiered V3 Session Intraday Phase 1

Generated: 2026-03-23T17:04:06.849Z

## Methodology

- System: tiered_v3
- Scope: fx_only
- Weeks: 9
- Trading days: 45
- Basket TP: +0.50%
- Basket SL: -1.00%
- Denominator: equal_weight_average_pair_return_per_day
- Hourly rule: enter at first hourly bar open at or after session timestamp; TP/SL evaluated on hourly close marks

## Summary

| Variant | Session | Exit | Return | Max DD | Avg Day | Win % | Worst Day | Trades | Avg/Day | TP % | SL % | Avg TP Hrs | Sharpe | t-stat |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| asia_hold_to_16 | ASIA_ONLY | HOLD_TO_16 | 1.94% | 0.97% | 0.045% | 55.81% | -0.62% | 819 | 19.05 | 0.00% | 0.00% | — | 3.09 | 1.27 |
| asia_basket_tp_050 | ASIA_ONLY | BASKET_TP_050 | 1.94% | 0.97% | 0.045% | 55.81% | -0.62% | 819 | 19.05 | 2.33% | 0.00% | 20.00 | 3.09 | 1.27 |
| random_hold_to_16 | RANDOM_HOUR | HOLD_TO_16 | 1.14% | 0.48% | 0.027% | 53.49% | -0.26% | 819 | 19.05 | 0.00% | 0.00% | — | 3.04 | 1.25 |
| newyork_hold_to_16 | NEWYORK_ONLY | HOLD_TO_16 | 1.08% | 0.69% | 0.025% | 60.47% | -0.31% | 819 | 19.05 | 0.00% | 0.00% | — | 2.88 | 1.19 |
| newyork_basket_tp_050 | NEWYORK_ONLY | BASKET_TP_050 | 1.08% | 0.69% | 0.025% | 60.47% | -0.31% | 819 | 19.05 | 0.00% | 0.00% | — | 2.88 | 1.19 |
| europe_hold_to_16 | EUROPE_ONLY | HOLD_TO_16 | 0.79% | 0.89% | 0.018% | 53.49% | -0.52% | 819 | 19.05 | 0.00% | 0.00% | — | 1.77 | 0.73 |
| europe_basket_tp_050 | EUROPE_ONLY | BASKET_TP_050 | 0.79% | 0.89% | 0.018% | 53.49% | -0.52% | 819 | 19.05 | 0.00% | 0.00% | — | 1.77 | 0.73 |
