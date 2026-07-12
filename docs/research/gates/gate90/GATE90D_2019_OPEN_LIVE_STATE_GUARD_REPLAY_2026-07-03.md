# Gate 90D 2019 Open Live-State Guard Replay

Generated: 2026-07-03

## Verdict

`PASS_GATE90D_LIVE_STATE_STOP_ADD_GUARD_IMPROVES_2019_STRICT_NO_PROMOTION`

The live-state replay answered Freedom's objection correctly: we cannot know
the final bad-cycle bucket in advance, so protection must use only timestamps
observed while a cycle is open.

This pass added first MFE/MAE quantum timestamps to close events and replayed
three live-safe protection modes against strict `triangle_v0_no_candidate_b`.
The first useful result is not a trailing stop. It is a **pain-first stop-add
guard**:

> If a cycle reaches `-1Q` adverse excursion before it ever reaches `+0.5Q`
> favorable excursion, stop adding new grid risk to that cycle.

That rule improved account return, drawdown, and PF on the 2019 strict
no-Candidate-B open-price surface.

## Scope

- Window: `2019-04-14T23:00:00.000Z..2019-12-30T00:00:00.000Z`.
- Pairs: all 28.
- Activation: `triangle_v0_no_candidate_b`.
- Candidate B: excluded.
- Bar path mode: `open`.
- Signal clock: ADR event, brick `0.075`.
- David: LWMA `50`, RSI `50`, levels `60/40`.
- Target: David MA reversion.
- Adds: adverse only.
- Session: New York daily window.
- Reporting: ADR-normalized percent, where `1 ADR = 1%`; account percent is
  secondary costed USD/equity truth.

## Replay Table

| Protection | ADR % | Account % | DD % | R/DD | PF | Weekly PF | Win % | Entries | Max open | Target net | Flatten net | Protection net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `baseline` | `+25.29` | `+1.17` | `-2.19` | `0.54` | `1.230` | `1.402` | `79.30` | `689` | `13` | `+579.01` | `-461.57` | `0.00` |
| `pain_1q_stop_adds_before_profit_0_5q` | `+32.98` | `+2.29` | `-0.67` | `3.39` | `1.712` | `2.661` | `74.50` | `529` | `13` | `+502.09` | `-273.36` | `0.00` |
| `pain_2q_circuit_before_profit_0_5q` | `+31.44` | `+0.02` | `-1.87` | `0.01` | `1.003` | `1.004` | `74.09` | `696` | `12` | `+577.06` | `-206.04` | `-369.37` |
| `live_state_guard_v0` | `+28.48` | `+1.94` | `-0.78` | `2.47` | `1.530` | `2.206` | `72.37` | `554` | `12` | `+514.83` | `-190.53` | `-130.72` |

## Read

`pain_1q_stop_adds_before_profit_0_5q` is the best row in this pass.

It reduced fills from `689` to `529`, improved account return from `+1.17%` to
`+2.29%`, improved max drawdown from `-2.19%` to `-0.67%`, and improved close
event PF from `1.230` to `1.712`.

The hard `-2Q` circuit is not good by itself. It reduced session-flatten damage
but booked `-$369.37` in `pain_circuit` losses and left account return near
flat. That means the first live response to pain-first behavior should be
**stop feeding the grid**, not immediate kill.

The combined guard helped, but less than the simple stop-add guard. It closed
`41` cycles through `pain_circuit` for `-$130.72`; that reduced drawdown, but
still gave back return versus stop-add-only.

## Live-State Table From Timestamp Receipts

The timestamped strict baseline showed:

| Live state | Cycles | ADR % | Account % | Read |
|---|---:|---:|---:|---|
| `profit_1q_before_pain_1q` | `154` | `+51.07` | `+3.34` | Good bucket. Do not over-trail. |
| `profit_0_5q_only` | `140` | `+23.46` | `+1.29` | Small-profit bucket. Normal target/close is fine. |
| `pain_2q_before_profit_0_5q` | `45` | `-41.67` | `-3.18` | Ugly live bucket. Needs protection, but hard kill was too blunt. |
| `pain_1q_before_profit_0_5q` | `41` | `+9.63` | `+0.49` | Too early to kill; stop-add is the right first response. |
| `pain_1q_before_profit_1q` | `38` | `-16.76` | `-0.70` | Mixed pain-first bucket. Needs more context/heat guard. |
| `inside_1q` | `36` | `-0.44` | `-0.05` | Small, not the main problem. |

## Strategy Shape Update

The next no-Candidate-B v1 shape should be:

1. Strict Katarakti / Triangle start remains the quality anchor.
2. If a cycle gets to `+1Q` profit first, do not add more risk; avoid tight
   trailing for now because target closes are already strong.
3. If a cycle hits `-1Q` pain before `+0.5Q` profit, stop adding to that cycle.
4. Do not hard-close at `-2Q` yet. It needs a second condition, likely heat,
   cluster, time-to-recovery failure, or red-news/macro context.
5. Keep larger targets only for premium Katarakti classes after MFE evidence
   proves they can support them.

Monkey version:

- If it makes money first, protect it gently.
- If it hurts first, stop feeding it.
- Do not instantly kill every ugly trade yet; that was too expensive.
- The first real green protection rule is stop-add after pain-first behavior.

## Artifacts

- Live-state timestamp strict replay:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-live-state-strict-no-candidate-b/`
- Live-state excursion diagnostic:
  `docs/research/gates/gate90/GATE90D_2019_OPEN_LIVE_STATE_EXCURSION_RECEIPTS_2026-07-03.md`
- Guard replay:
  `docs/research/gates/gate90/artifacts/gate90d-2019-open-live-state-guard-strict-no-candidate-b/`
- One-pair guard smoke:
  `docs/research/gates/gate90/artifacts/gate90d-live-state-guard-smoke-audchf-2019-1w/`

## Stop Line

Research-only. No Triangle v1 freeze, no MT5/live/app work, no promotion, no
red-news implementation, no 2020/year-by-year expansion, no full matrix
restart, and no full seven-pair handshake gate.
