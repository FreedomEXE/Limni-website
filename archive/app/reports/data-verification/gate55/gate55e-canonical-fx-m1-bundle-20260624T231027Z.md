# Gate 55E Canonical FX M1 Bundle Audit

- Generated: 2026-06-24T23:10:12.043Z
- Status: PASS_CANONICAL_FX_M1_100_PERCENT
- Write fill: true
- Input hash: E97D9E9C1EABE5298A3533AE44C285437C019EBDDED0E6130F0904FF3AD644C1

## Before

- Parent pair-weeks: 28
- Complete pair-weeks: 1
- Partial pair-weeks: 27
- Missing pair-weeks: 0
- Source-gap pair-weeks: 0
- Full weeks: 0
- Partial weeks: 1
- Source-gap weeks: 0
- Missing active pair-minute rows: 4869
- Lowest coverage: 95.152237%

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
- No-tick repair rows, when written, require at least 90% observed pair coverage, the close edge within 60 minutes, and bounded holiday/reopen lag within 360 minutes.
- No-tick repair rows use prior same-symbol close only and quality_status=derived_no_tick_forward_fill_v1.
- The repair path does not use future bars, outcomes, COT, Strength, regimes, execution optimization, or risk overlays.
