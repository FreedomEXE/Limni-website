# Gate 55E Canonical FX M1 Bundle Audit

- Generated: 2026-06-24T21:36:07.462Z
- Status: PASS_CANONICAL_FX_M1_100_PERCENT
- Write fill: true
- Input hash: EA435C24E0EA4D23F3050446E203FA625108E0A1B88685B9FD2D4DAC8FD344FD

## Before

- Parent pair-weeks: 84
- Complete pair-weeks: 0
- Partial pair-weeks: 84
- Missing pair-weeks: 0
- Source-gap pair-weeks: 0
- Full weeks: 0
- Partial weeks: 3
- Source-gap weeks: 0
- Missing active pair-minute rows: 15287
- Lowest coverage: 85.519733%

## After

- Complete pair-weeks: 84
- Partial pair-weeks: 0
- Missing active pair-minute rows: 0
- Full weeks: 3
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
