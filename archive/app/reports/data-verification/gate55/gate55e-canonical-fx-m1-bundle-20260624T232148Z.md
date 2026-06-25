# Gate 55E Canonical FX M1 Bundle Audit

- Generated: 2026-06-24T23:12:18.972Z
- Status: PASS_CANONICAL_FX_M1_100_PERCENT
- Write fill: false
- Input hash: B93264594586659F16BF7A35B12F09B95048EBBFB2449D78A5F2522FA1571B98

## Before

- Parent pair-weeks: 10948
- Complete pair-weeks: 10948
- Partial pair-weeks: 0
- Missing pair-weeks: 0
- Source-gap pair-weeks: 0
- Full weeks: 391
- Partial weeks: 0
- Source-gap weeks: 0
- Missing active pair-minute rows: 0
- Lowest coverage: 100.000000%

## Weak Week Sample


## Weak Pair Sample


## Governance

- Active FX minutes are provider-observed OANDA `provider_minute` rows inside the canonical New York 5pm week window.
- Pair coverage requires 100% of active provider minutes.
- No-tick repair rows, when written, require at least 90% observed pair coverage, the close edge within 60 minutes, and bounded holiday/reopen lag within 360 minutes.
- No-tick repair rows use prior same-symbol close only and quality_status=derived_no_tick_forward_fill_v1.
- The repair path does not use future bars, outcomes, COT, Strength, regimes, execution optimization, or risk overlays.
