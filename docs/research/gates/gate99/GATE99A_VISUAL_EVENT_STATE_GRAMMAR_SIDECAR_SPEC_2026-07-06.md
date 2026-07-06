# Gate 99A - Visual Event-State Grammar Sidecar Spec

Date: 2026-07-06

Status: visual-only implementation gate. No trading claim.

## Objective

Build the smallest non-trading chart sidecar that lets Freedom visually review
the proposed post-Gate-98 Katarakti architecture before any EA execution logic
is written.

The sidecar must draw state grammar, not trades.

## Boundary

Allowed:

- MT5 indicator only.
- Read historical chart/source bars.
- Compute LRMG event state.
- Compute event-clocked exhaustion state.
- Compute event-clocked David-like transition state.
- Draw setup, armed, confirmed, invalidated, stale, and conflict states.
- Export event/state receipts.

Forbidden:

- No orders.
- No account, balance, equity, TP, SL, trail, or PnL logic.
- No `LimniKataraktiEA.mq5` mutation.
- No `LimniHedge_V1.mq5` mutation.
- No Candidate B or regime overlay.
- No parameter sweep.
- No promotion claim.

## Frozen Visual Grammar

Version:

`G99_VISUAL_EVENT_STATE_V0`

Event clock:

`LRMG_BRICK_CLOSE`

The chart timeframe is only a display canvas. The sidecar should project the
event state to the chart, but the state sequence advances only when an LRMG
brick/event closes.

Default source-window behavior:

- `SourceTimeframe=PERIOD_M1`.
- `StartDate=2026.01.01 00:00`.
- `EndDate` blank means current server time.
- `LookbackBars=12000` keeps the latest source bars for responsive visual
  review.

For strict cross-timeframe review, keep the same `StartDate`, `EndDate`,
`LookbackBars`, and all grammar inputs on every display chart.

## State Labels

Composite states:

- `NONE`
- `SETUP`
- `ARMED`
- `CONFIRMED`
- `INVALIDATED`
- `STALE`
- `CONFLICT`

Long-side sequence:

1. `SETUP`: event Stoch D-line exhaustion is oversold.
2. `ARMED`: LRMG side/structure supports long-side reversal/reclaim.
3. `CONFIRMED`: David-like event state flips up after exhaustion.
4. `INVALIDATED`: LRMG side breaks against the setup before confirmation.
5. `STALE`: confirmation does not arrive within the configured event age.
6. `CONFLICT`: simultaneous long and short setup pressure or unreadable state.

Short-side sequence mirrors this:

1. `SETUP`: event Stoch D-line exhaustion is overbought.
2. `ARMED`: LRMG side/structure supports short-side reversal/reclaim.
3. `CONFIRMED`: David-like event state flips down after exhaustion.

## Components

### LRMG

Draw by default:

- LRMG center/median anchor.
- Confirmed long/short arrows only.

Optional debug draw:

- LRMG center/median anchor.
- `+1Q` and `-1Q` bands.
- LRMG side state: `LRMG_SIDE_BELOW`, `LRMG_SIDE_ABOVE`, or
  `LRMG_SIDE_CENTER`.
- State labels and panel text.

### Exhaustion

The V0 exhaustion layer is event-clocked, not time-bar Stochastic.

Formula:

`event_stoch = 100 * (event_close - lowest_close_last_N_events) / (highest_close_last_N_events - lowest_close_last_N_events)`

`event_stoch_d = average(event_stoch over M event closes)`

The V0 visual default uses D-line exhaustion because the post-closeout manual
observation was that smoother confirmed exhaustion survived better than the
main-line Stoch read.

### David-Like State

V0 uses an event-clocked David-like transition proxy rather than claiming exact
parity with `David_MA_Color_V1f_Updated`.

The default state is based on event-close LWMA slope:

- `DAVID_EVENT_UP`
- `DAVID_EVENT_DOWN`
- `DAVID_EVENT_FLAT`

Flip markers:

- `DAVID_FLIP_UP`
- `DAVID_FLIP_DOWN`

Exact David indicator parity can be added later only if the visual grammar is
accepted.

### Katarakti

Katarakti is optional comparison context only in Gate 99A.

It is not the V0 core trigger. Any later Katarakti return should be treated as
a premium/confluence trigger after the state grammar is visually approved.

## Receipt Contract

Every drawn state marker must have a matching CSV receipt row.

Default chart visual is intentionally minimal after first visual review:
confirmed long and short arrows only, plus the LRMG price line. Verbose state
labels and the panel remain available as debug inputs but should stay off for
normal human review.

Receipt fields:

- `event_id`
- `timestamp`
- `symbol`
- `display_timeframe`
- `event_clock_type`
- `event_price`
- `lrmg_center`
- `lrmg_quantum`
- `lrmg_side`
- `lrmg_structure`
- `stoch_main`
- `stoch_d`
- `stoch_state`
- `stoch_exhaustion_age_events`
- `david_state`
- `david_previous_state`
- `david_flip`
- `composite_state`
- `side`
- `reason_code`
- `grammar_version`
- `config_hash`

Reason codes must be explicit and non-overlapping.

Initial V0 reason codes:

- `STOCH_OVERSOLD_ENTER`
- `STOCH_OVERBOUGHT_ENTER`
- `LRMG_LONG_ARMED`
- `LRMG_SHORT_ARMED`
- `DAVID_FLIP_UP_CONFIRMED`
- `DAVID_FLIP_DOWN_CONFIRMED`
- `FAIL_LRMG_SIDE_CONFLICT`
- `FAIL_DAVID_WRONG_DIRECTION`
- `FAIL_SIGNAL_STALE`
- `FAIL_SEQUENCE_ORDER_INVALID`
- `FAIL_DATA_GAP`

## Pass Criteria

- Same input data and config produce the same event ids and state sequence.
- Every drawn marker has a matching receipt row.
- Event ids do not depend on chart display timeframe.
- No state label is treated as a trade or promotion.
- Freedom can visually decide whether the grammar represents the intended
  structure.

## Fail Criteria

- The sidecar requires trade outcomes or PnL to explain the state.
- Markers change because the display timeframe changes.
- Confirmations appear without component-level explanation.
- State labels repaint after future events.
- The visual only looks coherent after more parameter tuning.
