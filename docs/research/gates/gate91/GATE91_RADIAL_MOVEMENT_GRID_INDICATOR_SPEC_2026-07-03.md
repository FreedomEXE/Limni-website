# Gate 91 Radial Movement Grid Indicator Spec

Date: 2026-07-03

## Verdict

The next visual research object is a pure movement-geometry MT5 indicator:

```text
Limni Radial Movement Grid
```

This is not an EA, not a cost guard, not execution policy, and not risk logic.
It is a charting tool for manual historical review.

## Final Formula

For each completed radial basin `S`, define the official map:

```text
C(S) = movement-weighted median price under d|p|
Q(S) = sqrt(E under d|p|[(p - C(S))^2])
z(t) = (price(t) - C(S)) / Q(S)
```

In the MT5 implementation, `d|p|` is approximated from the source price path
instead of from clock-counted samples. This prevents quiet time from receiving
extra votes.

## Basin Rule

The official `C/Q` map is frozen from the last completed radial orbit.

```text
orbit begins when price first reaches z >= +1 or z <= -1
orbit completes only after both +1 and -1 have been touched
and price then returns through z = 0
```

Only after that completion is a new official map computed.

The developing basin may be drawn provisionally, but it must remain visually
separate from the official frozen map to avoid repainting the research geometry.

## Visual Contract

2026-07-03 final visual correction: the bottom-pane indicator was a wrong turn.
It made LRMG feel like an oscillator below normal price, not a replacement
chart. The correct MT5 visual test is:

```text
LimniLRMGCreateChart.mq5
```

This script creates a generated LRMG custom symbol chart:

```text
<source>_LRMG_<timeframe>
```

Example:

```text
AUDCAD_i_LRMG_H4
```

The generated chart is the study surface. It is not a subwindow under a normal
price chart.

```text
x-axis = generated M1 custom-symbol time anchored to source M1 events
y-axis = absolute LRMG closed-brick level units from the generated chart base
cyan   = moving closed-brick LRMG median
grid distance = brick close level - moving median level
```

The generated chart must draw:

- one equal-size custom OHLC bar per closed LRMG brick
- each brick body from the previous integer LRMG level to the next integer LRMG level
- high/low locked to the brick body so the visual grammar stays equal-block
- a moving cyan median line
- no static `0` trade boundary

This solves the axis problem:

- raw price stays on the source chart, not on the generated LRMG chart
- raw brick size/pips stay as measurement metadata only
- manual review happens on the generated normalized movement chart
- direction is not inferred from static above/below-zero position
- the LRMG formula source is canonical M1 regardless of the chart timeframe
- chart timeframe changes are display aggregation only, not a formula input

MT5 custom-symbol rates are M1 history. That means multiple independent custom
bars cannot occupy the same M1 open time. If one source M1 candle closes
multiple LRMG bricks, the first brick stays anchored to the source M1 event
minute and subsequent bricks are placed in the next available generated M1
slots. This preserves event order and source-time locality while prioritizing
the equal-block visual grammar Freedom asked for.

## Projection Contract

Future Triangle layers must be projected into the same z-space rather than
forcing LRMG back onto a price axis.

```text
Katarakti_z(t) = (Katarakti_event_price(t) - LRMG_median_price(t)) / Q(t)
David_z(t)     = (DavidMA_price(t) - LRMG_median_price(t)) / Q(t)
```

This lets Katarakti, David, and LRMG share one normalized movement coordinate
while preserving their original formulas.

## Prototype Status

`LimniRadialMovementGrid.mq5`, `LimniLRMGStudyOverlay.mq5`, and
`LimniLRMGZSpace.mq5` are retained as debug/prototype tools only.

The custom symbol path is now the primary LRMG study surface, but it must use
real source timestamps and z-space mapped candles. The old compressed brick
stream with synthetic one-minute timestamps is deprecated.

## Debug Visuals

Debug mode may draw:

- official frozen center line `C`
- official shell lines `C +/- kQ`
- live `z` value
- positive and negative shell crossing markers
- center crossing markers
- completed radial basin boxes
- current basin trace
- optional dashed provisional `C/Q` field for review only

Repeated shell-crossing arrows are diagnostic events, not grid entries.

## Exclusions

The radial grid formula must not include:

- broker spread
- commission
- slippage
- swap
- sessions
- news
- weekend or rollover rules
- lot sizing
- forced close logic
- max exposure policy

Those belong in separate CostGuard, ExecutionPolicy, and RiskPolicy layers.

## Bootstrap

The first map is necessarily bootstrapped from local history. It is labeled as
bootstrap in the indicator. Bootstrap regions are not research proof; the
endogenous process begins after the first completed radial orbit.
