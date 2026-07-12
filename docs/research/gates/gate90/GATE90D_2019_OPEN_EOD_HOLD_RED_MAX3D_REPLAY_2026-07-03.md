# Gate 90D 2019 Open EOD Hold-Red Max-3D Replay

Generated: 2026-07-03

## Verdict

`FAIL_GATE90D_EOD_HOLD_RED_MAX3D_DOES_NOT_BEAT_DAILY_FLATTEN_NO_PROMOTION`

The three-day hold-red cap does not beat normal daily flatten.

It removes the worst multi-month zombie trades from the uncapped hold-red test,
but it still gives back too much at the cap. The current best 2019 strict
no-Candidate-B protection remains:

`pain_1q_stop_adds_before_profit_0_5q` with normal daily flatten.

Plain English: three days is cleaner than forever, but daily flatten is still
better here.

## Scope

- Window: `2019-04-14T23:00:00.000Z..2019-12-30T00:00:00.000Z`.
- Universe: all 28 Gate 74B pairs.
- Activation rule: `triangle_v0_no_candidate_b`.
- Candidate B: omitted.
- Bar path: `open` prices only for fast diagnostics.
- Signal clock: ADR-event `0.075`.
- David: LWMA `50`, RSI `50`, OB/OS `60/40`.
- Session: New York clean daily window, trade start `18:05`, trade cutoff
  `15:45`, flatten `16:00`, Sunday start `20:00`.
- Target: profitable David MA reversion.
- Grid adds: adverse-only.
- Spacing: Triangle adaptive range/3, clamped `0.20..0.30 ADR`.

Tested modes:

- `baseline`
- `pain_1q_stop_adds_before_profit_0_5q`
- `eod_green_hold_red_max_3d`
- `eod_green_hold_red_pain_1q_stop_adds_max_3d`
- `eod_green_hold_red_pain_1q_stop_adds_reset_0_5q_max_3d`

Max-3D semantics: if a cycle is green at flatten, close it. If it is red and
younger than three days, hold it. If it is red and max fill age is at least
three days, close it at the flatten boundary. Some observed max ages are above
three days because the cap executes at the next available flatten/tick boundary,
including weekend gaps.

ADR-normalized return reports price movement with `1 ADR = 1%`. Account return
is still shown because commission, swap, and USD conversion decide whether the
shape is affordable.

## Summary

| Mode | ADR return % | Account return % | Max DD % | Return/DD | Close PF | Win % | Avg trade ADR | Avg MFE ADR | Avg MAE ADR | Entries | Max open | Max depth | Max age days | Swap USD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `baseline` | `25.29` | `1.17` | `-2.19` | `0.536` | `1.230` | `79.30` | `0.0557` | `0.2775` | `0.4071` | `689` | `13` | `10` | `2.66` | `-7.31` |
| `pain_1q_stop_adds_before_profit_0_5q` | `32.98` | `2.29` | `-0.67` | `3.395` | `1.712` | `74.50` | `0.0731` | `0.2390` | `0.2810` | `529` | `13` | `10` | `2.69` | `-5.99` |
| `eod_green_hold_red_max_3d` | `-38.60` | `-7.65` | `-14.28` | `-0.536` | `0.460` | `87.67` | `-0.0865` | `0.2855` | `1.0115` | `825` | `92` | `19` | `4.48` | `-26.72` |
| `eod_green_hold_red_pain_1q_stop_adds_max_3d` | `20.60` | `0.37` | `-1.85` | `0.202` | `1.073` | `83.26` | `0.0472` | `0.2428` | `0.5233` | `559` | `26` | `17` | `5.46` | `-15.93` |
| `eod_green_hold_red_pain_1q_stop_adds_reset_0_5q_max_3d` | `20.88` | `0.39` | `-1.85` | `0.211` | `1.076` | `83.26` | `0.0479` | `0.2432` | `0.5237` | `560` | `26` | `17` | `5.46` | `-15.93` |

## Decision Table

| Question | Answer |
|---|---|
| Does max-3D beat current daily flatten baseline? | No. Baseline is `+1.17%` account; capped hold-red without pain stop is `-7.65%`. |
| Does max-3D beat the current best pain-stop daily flatten rule? | No. Pain-stop daily flatten is `+2.29%`; capped pain-stop hold-red is only `+0.37..+0.39%`. |
| Does the reset after `+0.5Q` matter? | Barely. `+0.37%` became `+0.39%`, with the same DD and age profile. |
| Did the cap solve zombie trades? | Mostly. Max age dropped from `85..254` days in the uncapped report to about `4.48..5.46` days here. |
| Is the cap still too expensive? | Yes. It increases flatten drag and lowers return/DD. |

## Close Reason Split

| Mode | Close reason | Cycles | Wins | Losses | ADR return % | Account return % | Net USD | PF |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `baseline` | `target` | `318` | `315` | `3` | `100.16` | `5.79` | `579.01` | `1162.111` |
| `baseline` | `session_flatten` | `136` | `45` | `91` | `-74.86` | `-4.62` | `-461.57` | `0.096` |
| `pain_1q_stop_adds_before_profit_0_5q` | `target` | `306` | `296` | `10` | `83.90` | `5.02` | `502.09` | `1092.893` |
| `pain_1q_stop_adds_before_profit_0_5q` | `session_flatten` | `145` | `40` | `105` | `-50.93` | `-2.73` | `-273.36` | `0.148` |
| `eod_green_hold_red_max_3d` | `target` | `356` | `340` | `16` | `106.25` | `6.10` | `609.63` | `137.865` |
| `eod_green_hold_red_max_3d` | `session_flatten` | `90` | `51` | `39` | `-144.85` | `-13.75` | `-1374.95` | `0.027` |
| `eod_green_hold_red_pain_1q_stop_adds_max_3d` | `target` | `345` | `315` | `30` | `85.96` | `5.11` | `510.99` | `182.532` |
| `eod_green_hold_red_pain_1q_stop_adds_max_3d` | `session_flatten` | `91` | `48` | `43` | `-65.37` | `-4.74` | `-473.64` | `0.073` |
| `eod_green_hold_red_pain_1q_stop_adds_reset_0_5q_max_3d` | `target` | `345` | `315` | `30` | `86.24` | `5.13` | `512.74` | `183.155` |
| `eod_green_hold_red_pain_1q_stop_adds_reset_0_5q_max_3d` | `session_flatten` | `91` | `48` | `43` | `-65.37` | `-4.74` | `-473.64` | `0.073` |

The capped hold-red target bucket improves slightly, but its capped flatten
bucket is worse than the daily-flatten pain-stop bucket.

## Week And Month Shape

| Mode | Win weeks | Loss weeks | Worst week | Worst week % | Best week | Best week % | Win months | Loss months | Worst month | Worst month % |
|---|---:|---:|---|---:|---|---:|---:|---:|---|---:|
| `baseline` | `29` | `8` | `2019-10-06` | `-2.19` | `2019-10-13` | `0.83` | `6` | `3` | `2019-10` | `-1.16` |
| `pain_1q_stop_adds_before_profit_0_5q` | `27` | `10` | `2019-07-28` | `-0.61` | `2019-10-13` | `0.92` | `7` | `2` | `2019-07` | `-0.64` |
| `eod_green_hold_red_max_3d` | `29` | `8` | `2019-10-06` | `-14.01` | `2019-10-13` | `5.12` | `6` | `3` | `2019-10` | `-8.88` |
| `eod_green_hold_red_pain_1q_stop_adds_max_3d` | `29` | `8` | `2019-10-06` | `-1.85` | `2019-10-13` | `1.00` | `5` | `4` | `2019-07` | `-1.46` |
| `eod_green_hold_red_pain_1q_stop_adds_reset_0_5q_max_3d` | `29` | `8` | `2019-10-06` | `-1.85` | `2019-10-13` | `1.00` | `5` | `4` | `2019-07` | `-1.46` |

The capped modes can keep the same week win/loss count as baseline, but their
tail is worse than the current pain-stop daily flatten rule.

## Long-Age Evidence

Worst capped hold-red without pain stop:

- `CHFJPY SHORT`: `4.48` days, `7` fills, `-6.17 ADR`, `-$29.94`.
- `EURUSD SHORT`: `4.48` days, `9` fills, `-10.71 ADR`, `-$52.17`.
- `NZDJPY SHORT`: `3.92` days, `10` fills, `-5.44 ADR`, `-$26.90`.
- `GBPJPY SHORT`: `3.41` days, `20` fills, `-25.40 ADR`, `-$353.76`.

Worst capped hold-red with pain stop:

- `GBPCAD LONG`: `5.46` days, `1` fill, `-2.81 ADR`, `-$23.02`.
- `CADJPY LONG`: `5.44` days, `1` fill, `-0.72 ADR`, `-$4.59`.
- `CHFJPY SHORT`: `4.48` days, `7` fills, `-6.17 ADR`, `-$29.94`.
- `EURJPY LONG`: `4.48` days, `1` fill, `-1.29 ADR`, `-$7.79`.
- `EURUSD SHORT`: `4.48` days, `1` fill, `-2.31 ADR`, `-$11.21`.

The pain stop keeps the cap damage from becoming a 78-depth grid, but it still
does not outperform daily flatten.

## Read

The important distinction:

- Uncapped hold-red was rejected because it created multi-month zombie trades.
- Max-3D hold-red fixes the zombie problem.
- But max-3D hold-red still fails the actual comparison because the delayed
  red closes are worse than normal daily flatten plus pain-first stop-add.

So the current strategy rule should be:

1. If a cycle is green at daily flatten, close it.
2. If a cycle is red at daily flatten, also close it for now.
3. If the cycle hit `-1Q` pain before `+0.5Q` profit, stop adding before the
   flatten.
4. Do not add hold-red exceptions until we have a better live-safe reason, such
   as tiny red, low heat, no red-news, and favorable next-session recovery
   evidence.

## Artifacts

- Runner report:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-eod-hold-red-max3d-strict-no-candidate-b/GATE90D_2019_OPEN_EOD_HOLD_RED_MAX3D_STRICT_NO_CANDIDATE_B.md`
- Summary rows:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-eod-hold-red-max3d-strict-no-candidate-b/activation-summary.rows.json`
- Weekly rows:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-eod-hold-red-max3d-strict-no-candidate-b/weekly-activation-truth.rows.json`
- Close-event rows:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-eod-hold-red-max3d-strict-no-candidate-b/close-events.rows.json`
- Close-event breakdown:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-eod-hold-red-max3d-strict-no-candidate-b/close-event-breakdown.rows.json`

## Stop Line

Research-only. No MT5/live/app work, promotion, red-news implementation,
2020/year-by-year expansion, full matrix restart, or full seven-pair handshake
gate is opened by this diagnostic.
