# Gate 55E Canonical FX M1 Bundle Audit

- Generated: 2026-06-24T22:52:38.742Z
- Status: PASS_CANONICAL_FX_M1_100_PERCENT
- Write fill: true
- Input hash: 33DDD01DB427B338F2330245ED3BE20E1F48B478F5FFDF6798CC560B4388BD6E

## Before

- Parent pair-weeks: 336
- Complete pair-weeks: 3
- Partial pair-weeks: 333
- Missing pair-weeks: 0
- Source-gap pair-weeks: 0
- Full weeks: 0
- Partial weeks: 12
- Source-gap weeks: 0
- Missing active pair-minute rows: 18373
- Lowest coverage: 92.325905%

## After

- Complete pair-weeks: 336
- Partial pair-weeks: 0
- Missing active pair-minute rows: 0
- Full weeks: 12
- Partial weeks: 0
- Lowest coverage: 100.000000%

## Weak Week Sample


## Weak Pair Sample


## Governance

- Active FX minutes are provider-observed OANDA `provider_minute` rows inside the canonical New York 5pm week window.
- Pair coverage requires 100% of active provider minutes.
- No-tick repair rows, when written, require existing pair rows to span the active session edges within 60 minutes.
- No-tick repair rows use prior same-symbol close only and quality_status=derived_no_tick_forward_fill_v1.
- The repair path does not use future bars, outcomes, COT, Strength, regimes, execution optimization, or risk overlays.
