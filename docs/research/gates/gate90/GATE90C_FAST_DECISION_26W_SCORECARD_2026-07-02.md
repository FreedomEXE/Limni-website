# Gate 90C Fast Decision 26W Scorecard

Generated: 2026-07-02

## Verdict

`PASS_GATE90C_FAST_DECISION_26W_SCORECARD_RESEARCH_ONLY_NO_PROMOTION`

## Scope

This is a narrowed Gate 90C decision surface after the full 150-command foreground matrix proved too slow. It keeps the current Gate 90C execution surface: all 28 pairs, OHLC high/low path, ADR-event signal clock, NY daily window, David MA reversion target, adverse-only adds, min MA expansion 0.10 ADR, summary-only close-event metrics.

Window: `2025-12-08..2026-05-31` (26 weeks).
Rows: `49` summary rows from 7 cells x 7 activation rules.

Cells:

- `0.025 / MA25 / S0.10`
- `0.025 / MA25 / S0.15`
- `0.025 / MA25 / S0.20`
- `0.05 / MA25 / S0.10`
- `0.05 / MA25 / S0.20`
- `0.10 / MA50 / S0.10`
- `0.10 / MA50 / S0.20`

## Top Non-Raw By Net

| cell_id | activation_rule_id | net_profit_usd | close_event_profit_factor | close_event_win_pct | weekly_equity_profit_factor | max_equity_drawdown_usd | worst_13_week_equity_delta_usd | entries_opened | max_open_positions | max_add_depth | session_flatten_close_net_usd | total_swap_usd |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| adr025_ma25_s1 | david_contra | 9556.15 | 2.545217 | 88.81 | 83.949028 | -61.69 | 4493.77 | 46995 | 95 | 25 | -5448.4 | -146.94 |
| adr05_ma25_s1 | david_contra | 9253.44 | 2.109636 | 90.52 | 38.69331 | -145.52 | 4287.94 | 37688 | 115 | 27 | -7349.94 | -216.86 |
| adr025_ma25_s15 | david_contra | 7997.71 | 2.652541 | 85.53 | 288.177297 | -27.85 | 3822.82 | 37919 | 72 | 18 | -4180.86 | -120.52 |
| adr025_ma25_s1 | candidate_b | 7615.03 | 2.292434 | 88.54 | 70.959922 | -87.59 | 3527.82 | 41897 | 99 | 25 | -5334.65 | -89.46 |
| adr05_ma25_s1 | candidate_b | 7281.6 | 1.782177 | 90.05 | 51.807639 | -82.14 | 3321.11 | 37030 | 118 | 71 | -8468.58 | -140.61 |
| adr05_ma25_s1 | stoch_contra | 7126.4 | 2.246341 | 90.4 | 24.56059 | -232.59 | 3558.15 | 28069 | 130 | 27 | -5114.35 | -147.25 |
| adr025_ma25_s1 | stoch_contra | 6905.64 | 2.548294 | 88.66 | 67.094383 | -85.58 | 3134.02 | 34431 | 92 | 25 | -3943.34 | -104.29 |
| adr025_ma25_s2 | david_contra | 6641.59 | 2.405994 | 83.14 | 54.542979 | -101.67 | 3061.97 | 33371 | 66 | 13 | -4170.16 | -109.65 |
| adr1_ma50_s1 | david_contra | 6568.68 | 1.478484 | 87.46 | 7.927038 | -207.59 | 2778.47 | 24853 | 179 | 58 | -11490.29 | -314.42 |
| adr025_ma25_s15 | candidate_b | 6565.93 | 2.411577 | 84.91 | 111.143914 | -59.61 | 3224.31 | 34075 | 76 | 16 | -4110.35 | -70.03 |
| adr05_ma25_s2 | david_contra | 5963.4 | 2.085484 | 87.51 | 53.272807 | -71.06 | 2866.02 | 25421 | 74 | 25 | -4897.71 | -138.46 |
| adr025_ma25_s1 | david_stoch_confirm | 5894.99 | 2.462451 | 88.59 | 66.055594 | -59.77 | 2663.83 | 30083 | 90 | 25 | -3593 | -87.71 |

## Top Non-Raw By Close Event PF

| cell_id | activation_rule_id | close_event_profit_factor | net_profit_usd | close_event_win_pct | weekly_equity_profit_factor | max_equity_drawdown_usd | worst_13_week_equity_delta_usd | entries_opened | max_open_positions | session_flatten_close_net_usd |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| adr025_ma25_s15 | david_contra | 2.652541 | 7997.71 | 85.53 | 288.177297 | -27.85 | 3822.82 | 37919 | 72 | -4180.86 |
| adr025_ma25_s15 | stoch_contra | 2.648356 | 5888.94 | 85.19 | 113.944585 | -49.18 | 2829.79 | 27813 | 68 | -3040.95 |
| adr025_ma25_s15 | david_stoch_confirm | 2.609897 | 5061.12 | 85.29 | 97.070169 | -43.87 | 2407.51 | 24242 | 62 | -2669.39 |
| adr025_ma25_s1 | stoch_contra | 2.548294 | 6905.64 | 88.66 | 67.094383 | -85.58 | 3134.02 | 34431 | 92 | -3943.34 |
| adr025_ma25_s1 | david_contra | 2.545217 | 9556.15 | 88.81 | 83.949028 | -61.69 | 4493.77 | 46995 | 95 | -5448.4 |
| adr025_ma25_s15 | candidate_b_david_contra_confirm | 2.468185 | 3782.91 | 84.93 | 95.11142 | -31.23 | 1851.21 | 19445 | 60 | -2247.85 |
| adr025_ma25_s1 | david_stoch_confirm | 2.462451 | 5894.99 | 88.59 | 66.055594 | -59.77 | 2663.83 | 30083 | 90 | -3593 |
| adr025_ma25_s15 | candidate_b | 2.411577 | 6565.93 | 84.91 | 111.143914 | -59.61 | 3224.31 | 34075 | 76 | -4110.35 |
| adr025_ma25_s2 | david_contra | 2.405994 | 6641.59 | 83.14 | 54.542979 | -101.67 | 3061.97 | 33371 | 66 | -4170.16 |
| adr025_ma25_s2 | stoch_contra | 2.405744 | 4876.3 | 83.04 | 47.112065 | -67.78 | 2193.19 | 24505 | 55 | -3032.52 |
| adr025_ma25_s2 | david_stoch_confirm | 2.33387 | 4138.84 | 83.07 | 33.999434 | -83.66 | 1884.61 | 21316 | 48 | -2719.18 |
| adr025_ma25_s15 | candidate_b_david_contra_conflict_candidate | 2.306954 | 3377.25 | 84.81 | 59.490724 | -57.74 | 1605.53 | 18085 | 47 | -2326.99 |

## Best Row Per Cell

| cell_id | activation_rule_id | net_profit_usd | close_event_profit_factor | weekly_equity_profit_factor | max_equity_drawdown_usd | worst_13_week_equity_delta_usd | entries_opened | max_open_positions | max_add_depth | session_flatten_close_net_usd |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| adr025_ma25_s1 | david_contra | 9556.15 | 2.545217 | 83.949028 | -61.69 | 4493.77 | 46995 | 95 | 25 | -5448.4 |
| adr05_ma25_s1 | david_contra | 9253.44 | 2.109636 | 38.69331 | -145.52 | 4287.94 | 37688 | 115 | 27 | -7349.94 |
| adr025_ma25_s15 | david_contra | 7997.71 | 2.652541 | 288.177297 | -27.85 | 3822.82 | 37919 | 72 | 18 | -4180.86 |
| adr025_ma25_s2 | david_contra | 6641.59 | 2.405994 | 54.542979 | -101.67 | 3061.97 | 33371 | 66 | 13 | -4170.16 |
| adr1_ma50_s1 | david_contra | 6568.68 | 1.478484 | 7.927038 | -207.59 | 2778.47 | 24853 | 179 | 58 | -11490.29 |
| adr05_ma25_s2 | david_contra | 5963.4 | 2.085484 | 53.272807 | -71.06 | 2866.02 | 25421 | 74 | 25 | -4897.71 |
| adr1_ma50_s2 | david_contra | 4186.53 | 1.529563 | 10.708256 | -104.75 | 1792.68 | 15843 | 96 | 29 | -6758.53 |

## Best Row Per Rule

| activation_rule_id | cell_id | net_profit_usd | close_event_profit_factor | weekly_equity_profit_factor | max_equity_drawdown_usd | worst_13_week_equity_delta_usd | entries_opened | max_open_positions | session_flatten_close_net_usd |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| raw_both | adr025_ma25_s1 | 17585.88 | 2.644401 |  | 0 | 8125.85 | 83772 | 137 | -9309.67 |
| david_contra | adr025_ma25_s1 | 9556.15 | 2.545217 | 83.949028 | -61.69 | 4493.77 | 46995 | 95 | -5448.4 |
| candidate_b | adr025_ma25_s1 | 7615.03 | 2.292434 | 70.959922 | -87.59 | 3527.82 | 41897 | 99 | -5334.65 |
| stoch_contra | adr05_ma25_s1 | 7126.4 | 2.246341 | 24.56059 | -232.59 | 3558.15 | 28069 | 130 | -5114.35 |
| david_stoch_confirm | adr025_ma25_s1 | 5894.99 | 2.462451 | 66.055594 | -59.77 | 2663.83 | 30083 | 90 | -3593 |
| candidate_b_david_contra_confirm | adr05_ma25_s1 | 4527.94 | 2.034656 | 28.093034 | -90.22 | 2079.83 | 19783 | 112 | -3936.31 |
| candidate_b_david_contra_conflict_candidate | adr025_ma25_s1 | 3984.19 | 2.241865 | 52.067869 | -78.02 | 1727.83 | 22036 | 61 | -2918.95 |

## Read

- `raw_both` remains the highest-net benchmark, not a build candidate.
- Among controlled selectors, `david_contra` is the clear first build-shape candidate in this recent 26-week surface. Its best rows lead net across every tested cell family.
- `0.025 / MA25 / S0.10` is the highest-harvest controlled row, but it reaches max open `95` and max add depth `25`; treat it as the aggressive benchmark, not the default live shape.
- `0.025 / MA25 / S0.15` keeps the same leading selector family with lower max open/add pressure than S0.10 while preserving more net than S0.20. It is the current balanced MT5-build candidate from this surface.
- `candidate_b` is competitive but not primary: its best row is second-tier net and should remain a controlled overlay/comparison, not a broad COT redesign.
- `candidate_b_david_contra_confirm` materially reduces exposure but gives up too much net in the tested cells. It is a risk-shape candidate, not the first MT5 build default.
- `0.10 / MA50` is sturdier and lower cadence, but it trails the lower-brick MA25 rows on harvested net in this 26-week surface.

## Decision Implication

For the next MT5 build discussion, use `david_contra` with ADR-event `0.025 / MA25` as the primary research shape, and compare `S0.15` versus `S0.10` explicitly as the aggression dial. Keep `0.10 / MA50 / S0.20` as the conservative reference, not the leading default.

## Artifacts

- JSON: `docs/research/gates/gate90/artifacts/gate90c-fast-decision-26w-scorecard.json`
- CSV: `docs/research/gates/gate90/artifacts/gate90c-fast-decision-26w-scorecard.csv`
- Source run directories: `docs/research/gates/gate90/artifacts/gate90c-fast-decision-26w-adr025_ma25_s1-exp010-rsi506040-stoch100-3-100-6040`, `docs/research/gates/gate90/artifacts/gate90c-fast-decision-26w-adr025_ma25_s15-exp010-rsi506040-stoch100-3-100-6040`, `docs/research/gates/gate90/artifacts/gate90c-fast-decision-26w-adr025_ma25_s2-exp010-rsi506040-stoch100-3-100-6040`, `docs/research/gates/gate90/artifacts/gate90c-fast-decision-26w-adr005_ma25_s1-exp010-rsi506040-stoch100-3-100-6040`, `docs/research/gates/gate90/artifacts/gate90c-fast-decision-26w-adr005_ma25_s2-exp010-rsi506040-stoch100-3-100-6040`, `docs/research/gates/gate90/artifacts/gate90c-fast-decision-26w-adr010_ma50_s1-exp010-rsi506040-stoch100-3-100-6040`, `docs/research/gates/gate90/artifacts/gate90c-fast-decision-26w-adr010_ma50_s2-exp010-rsi506040-stoch100-3-100-6040`

## Stop Line

Research-only. No MT5 EA refactor, red-news blackout, broad COT/Candidate B redesign, promotion/live-readiness, or app/live integration is opened by this scorecard.
