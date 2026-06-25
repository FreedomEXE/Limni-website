# Gate 55E Canonical FX M1 Bundle Audit

- Generated: 2026-06-24T21:21:30.905Z
- Status: PASS_CANONICAL_FX_M1_100_PERCENT
- Write fill: true
- Input hash: E91A0CF342EE51D0CE880CD8D1AB20C3A08E3DC1A943A2CB8A0F90FEFD66B05A

## Before

- Parent pair-weeks: 28
- Complete pair-weeks: 5
- Partial pair-weeks: 23
- Missing pair-weeks: 0
- Source-gap pair-weeks: 0
- Full weeks: 0
- Partial weeks: 1
- Source-gap weeks: 0
- Missing active pair-minute rows: 23
- Lowest coverage: 99.986103%

## After

- Complete pair-weeks: 28
- Partial pair-weeks: 0
- Missing active pair-minute rows: 0
- Full weeks: 1
- Partial weeks: 0
- Lowest coverage: 100.000000%

## Weak Week Sample


## Weak Pair Sample


## Governance

- Active FX minutes are provider-observed OANDA `provider_minute` rows inside the canonical New York 5pm week window.
- Pair coverage requires 100% of active provider minutes.
- No-tick repair rows, when written, use prior same-symbol close only and quality_status=derived_no_tick_forward_fill_v1.
- The repair path does not use future bars, outcomes, COT, Strength, regimes, execution optimization, or risk overlays.
