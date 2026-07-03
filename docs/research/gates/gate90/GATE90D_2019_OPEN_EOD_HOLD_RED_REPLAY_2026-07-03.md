# Gate 90D 2019 Open EOD Hold-Red Replay

Generated: 2026-07-03

## Verdict

`FAIL_GATE90D_EOD_HOLD_RED_WORSENS_RISK_KEEP_DAILY_FLATTEN_WITH_PAIN_STOP_NO_PROMOTION`

Closing green cycles at the daily flatten and holding red cycles open does not
improve the 2019 strict no-Candidate-B shape.

The cleanest current rule remains:

1. Use strict Triangle v0 no-Candidate-B starts as the quality anchor.
2. If the cycle reaches `-1Q` pain before any `+0.5Q` profit, stop adding.
3. Still respect the daily flatten.

In plain English: if a trade starts badly, stop feeding it. Do not carry red
inventory just because it is red.

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

Protection modes:

- `baseline`
- `pain_1q_stop_adds_before_profit_0_5q`
- `eod_green_hold_red`
- `eod_green_hold_red_pain_1q_stop_adds`
- `eod_green_hold_red_pain_1q_stop_adds_reset_0_5q`

ADR-normalized return reports price movement with `1 ADR = 1%`. Account return
is still shown because commission, swap, and USD conversion decide whether the
shape is affordable.

## Summary

| Mode | ADR return % | Account return % | Max DD % | Return/DD | Close PF | Win % | Avg trade ADR | Avg MFE ADR | Avg MAE ADR | Entries | Max open | Max depth | Max age days | Swap USD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `baseline` | `25.29` | `1.17` | `-2.19` | `0.54` | `1.230` | `79.30` | `0.0557` | `0.2775` | `0.4071` | `689` | `13` | `10` | `2.66` | `-7.31` |
| `pain_1q_stop_adds_before_profit_0_5q` | `32.98` | `2.29` | `-0.67` | `3.40` | `1.712` | `74.50` | `0.0731` | `0.2390` | `0.2810` | `529` | `13` | `10` | `2.69` | `-5.99` |
| `eod_green_hold_red` | `12.27` | `-5.53` | `-78.74` | `-0.07` | `0.580` | `89.07` | `0.0285` | `0.2924` | `4.3721` | `974` | `206` | `78` | `85.07` | `-313.80` |
| `eod_green_hold_red_pain_1q_stop_adds` | `48.13` | `0.23` | `-4.89` | `0.05` | `1.051` | `85.82` | `0.1197` | `0.2394` | `0.8400` | `530` | `29` | `17` | `254.15` | `-159.22` |
| `eod_green_hold_red_pain_1q_stop_adds_reset_0_5q` | `48.42` | `0.25` | `-4.89` | `0.05` | `1.055` | `85.82` | `0.1204` | `0.2398` | `0.8404` | `531` | `29` | `17` | `254.15` | `-159.22` |

## Close Reason Split

| Mode | Close reason | Cycles | Wins | Losses | ADR return % | Account return % | Net USD | PF |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `baseline` | `target` | `318` | `315` | `3` | `100.16` | `5.79` | `579.01` | `1162.110` |
| `baseline` | `session_flatten` | `136` | `45` | `91` | `-74.86` | `-4.62` | `-461.57` | `0.100` |
| `pain_1q_stop_adds_before_profit_0_5q` | `target` | `306` | `296` | `10` | `83.90` | `5.02` | `502.09` | `1092.890` |
| `pain_1q_stop_adds_before_profit_0_5q` | `session_flatten` | `145` | `40` | `105` | `-50.93` | `-2.73` | `-273.36` | `0.150` |
| `eod_green_hold_red` | `target` | `358` | `333` | `25` | `106.46` | `6.42` | `642.42` | `8.970` |
| `eod_green_hold_red` | `session_flatten` | `72` | `50` | `22` | `-94.20` | `-11.95` | `-1194.94` | `0.030` |
| `eod_green_hold_red_pain_1q_stop_adds` | `target` | `337` | `299` | `38` | `78.14` | `3.53` | `352.75` | `5.020` |
| `eod_green_hold_red_pain_1q_stop_adds` | `session_flatten` | `65` | `46` | `19` | `-30.01` | `-3.30` | `-329.57` | `0.100` |
| `eod_green_hold_red_pain_1q_stop_adds_reset_0_5q` | `target` | `337` | `299` | `38` | `78.43` | `3.55` | `354.50` | `5.040` |
| `eod_green_hold_red_pain_1q_stop_adds_reset_0_5q` | `session_flatten` | `65` | `46` | `19` | `-30.01` | `-3.30` | `-329.57` | `0.100` |

## Week And Month Shape

| Mode | Win weeks | Loss weeks | Worst week | Worst week % | Best week | Best week % | Win months | Loss months | Worst month | Worst month % |
|---|---:|---:|---|---:|---|---:|---:|---:|---|---:|
| `baseline` | `29` | `8` | `2019-10-06` | `-2.19` | `2019-10-13` | `0.83` | `6` | `3` | `2019-10` | `-1.16` |
| `pain_1q_stop_adds_before_profit_0_5q` | `27` | `10` | `2019-07-28` | `-0.61` | `2019-10-13` | `0.92` | `7` | `2` | `2019-07` | `-0.64` |
| `eod_green_hold_red` | `27` | `11` | `2019-12-09` | `-28.74` | `2019-12-16` | `51.26` | `6` | `3` | `2019-10` | `-24.39` |
| `eod_green_hold_red_pain_1q_stop_adds` | `20` | `18` | `2019-07-28` | `-2.42` | `2019-09-01` | `3.17` | `3` | `6` | `2019-07` | `-2.13` |
| `eod_green_hold_red_pain_1q_stop_adds_reset_0_5q` | `20` | `18` | `2019-07-28` | `-2.42` | `2019-09-01` | `3.17` | `3` | `6` | `2019-07` | `-2.13` |

The uncapped hold-red mode creates an artificial monster week: it suffers a
large open-equity drawdown, then books a huge recovery week. That is not a
healthy strategy shape; it is delayed pain.

## Pair Read

Worst account pairs:

| Mode | Worst pairs |
|---|---|
| `baseline` | `GBPJPY -0.54%`, `AUDJPY -0.47%`, `EURUSD -0.14%`, `GBPNZD -0.11%`, `EURGBP -0.09%` |
| `pain_1q_stop_adds_before_profit_0_5q` | `AUDJPY -0.52%`, `AUDUSD -0.10%`, `EURUSD -0.06%`, then near-flat `CHFJPY` / `AUDCHF` |
| `eod_green_hold_red` | `EURGBP -8.88%`, `GBPJPY -2.86%`, `AUDJPY -0.47%` |
| `eod_green_hold_red_pain_1q_stop_adds_reset_0_5q` | `EURJPY -0.58%`, `USDCHF -0.56%`, `GBPJPY -0.51%`, `GBPUSD -0.49%`, `AUDJPY -0.49%` |

Best account pairs:

| Mode | Best pairs |
|---|---|
| `baseline` | `GBPAUD +0.42%`, `USDCAD +0.28%`, `GBPCHF +0.25%`, `GBPCAD +0.21%`, `USDJPY +0.20%` |
| `pain_1q_stop_adds_before_profit_0_5q` | `GBPAUD +0.40%`, `GBPCHF +0.25%`, `GBPUSD +0.24%`, `USDCAD +0.23%`, `EURGBP +0.22%` |
| `eod_green_hold_red` | `GBPUSD +1.58%`, `GBPNZD +0.67%`, `GBPCAD +0.51%`, `GBPAUD +0.42%`, `GBPCHF +0.41%` |
| `eod_green_hold_red_pain_1q_stop_adds_reset_0_5q` | `GBPAUD +0.40%`, `GBPNZD +0.39%`, `USDCAD +0.26%`, `USDJPY +0.20%`, `EURCAD +0.19%` |

## Long Hold Evidence

The hold-red variants prove the danger directly.

Uncapped hold-red:

- `EURGBP LONG`: `85.02` days, `56` fills, `-63.46 ADR`, `-$915.18`.
- `GBPJPY SHORT`: `85.07` days, `61` fills, `-37.53 ADR`, `-$316.95`.
- `GBPUSD SHORT`: `73.87` days, `79` fills, reached target, but only after
  carrying too much exposure.

Hold-red plus pain stop-add:

- `EURJPY LONG`: `254.15` days, `1` fill, `-7.91 ADR`, `-$66.85`.
- `USDCHF LONG`: `238.14` days, `1` fill, `-8.88 ADR`, `-$64.94`.
- `GBPCAD LONG`: `208.50` days, `1` fill, tiny positive ADR but `-$18.68`
  after carry.
- `GBPJPY SHORT`: `85.07` days, `1` fill, `-7.51 ADR`, `-$82.23`.

The pain stop-add did its job by preventing the grid from becoming huge, but it
did not solve the core problem: an old loser can sit for months. That is not an
execution rule we should freeze.

## Reset Read

The reset idea barely changed anything.

`eod_green_hold_red_pain_1q_stop_adds_reset_0_5q` versus locked
`eod_green_hold_red_pain_1q_stop_adds`:

- ADR return: `48.13%` to `48.42%`.
- Account return: `0.23%` to `0.25%`.
- Max DD: unchanged at `-4.89%`.
- Max age: unchanged at `254.15` days.
- Entries: `530` to `531`.

So yes, the reset can technically requalify a cycle after it reaches `+0.5Q`,
but in this test it is not a meaningful edge.

## Read

Holding red cycles makes the average ADR per closed trade look better in the
pain-stop variants, but it makes the account worse.

That is the trap:

- It delays losses.
- It adds swap and time risk.
- It raises max age from about `2.7` days to as high as `254.15` days.
- It lowers the week/month stability.
- It leaves us exposed to exactly the red-news and weekend risk we are trying
  to avoid.

The best current 2019 strict no-Candidate-B protection is still
`pain_1q_stop_adds_before_profit_0_5q` with normal flatten:

- higher ADR return than baseline: `32.98%` versus `25.29%`;
- higher account return: `2.29%` versus `1.17%`;
- much lower max DD: `-0.67%` versus `-2.19%`;
- fewer entries: `529` versus `689`;
- lower session-flatten drag: `-$273.36` versus `-$461.57`;
- no multi-month held losers.

## Next Design Call

Do not freeze hold-red.

The next protection shape should be:

1. Keep the normal daily flatten.
2. Keep pain-first stop-add after `-1Q` before `+0.5Q`.
3. Add log-only receipts for possible future exceptions:
   - if cycle is red at flatten, what was its MFE/MAE profile;
   - whether it recovered by the next session;
   - whether it was inside a red-news / Friday / weekend boundary;
   - whether pair/account heat was already elevated.

If a hold exception is ever tested again, it should be capped, not indefinite:
for example one extra session only, or only if red is small and heat is low.
That is a separate protection design, not the current freeze.

## Artifacts

- Runner report:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-eod-hold-red-strict-no-candidate-b/GATE90D_2019_OPEN_EOD_HOLD_RED_STRICT_NO_CANDIDATE_B.md`
- Summary rows:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-eod-hold-red-strict-no-candidate-b/activation-summary.rows.json`
- Weekly rows:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-eod-hold-red-strict-no-candidate-b/weekly-activation-truth.rows.json`
- Close-event rows:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-eod-hold-red-strict-no-candidate-b/close-events.rows.json`
- Close-event breakdown:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-eod-hold-red-strict-no-candidate-b/close-event-breakdown.rows.json`

## Stop Line

Research-only. No MT5/live/app work, promotion, red-news implementation,
2020/year-by-year expansion, full matrix restart, or full seven-pair handshake
gate is opened by this diagnostic.
