# Gate 55E Canonical FX M1 Bundle Audit

- Generated: 2026-06-24T23:11:12.310Z
- Status: PASS_CANONICAL_FX_M1_100_PERCENT
- Write fill: true
- Input hash: 4CDFAE6ACADAC642A25EF67836DA0B1F82F577C4E00826A7D49A3CCC02953845

## Before

- Parent pair-weeks: 56
- Complete pair-weeks: 14
- Partial pair-weeks: 42
- Missing pair-weeks: 0
- Source-gap pair-weeks: 0
- Full weeks: 0
- Partial weeks: 2
- Source-gap weeks: 0
- Missing active pair-minute rows: 3517
- Lowest coverage: 92.119424%

## After

- Complete pair-weeks: 56
- Partial pair-weeks: 0
- Missing active pair-minute rows: 0
- Full weeks: 2
- Partial weeks: 0
- Lowest coverage: 100.000000%

## Weak Week Sample


## Weak Pair Sample


## Governance

- Active FX minutes are provider-observed OANDA `provider_minute` rows inside the canonical New York 5pm week window.
- Pair coverage requires 100% of active provider minutes.
- No-tick repair rows, when written, require at least 90% observed pair coverage, the close edge within 60 minutes, and bounded holiday/reopen lag within 360 minutes.
- No-tick repair rows use prior same-symbol close only and quality_status=derived_no_tick_forward_fill_v1.
- The repair path does not use future bars, outcomes, COT, Strength, regimes, execution optimization, or risk overlays.
