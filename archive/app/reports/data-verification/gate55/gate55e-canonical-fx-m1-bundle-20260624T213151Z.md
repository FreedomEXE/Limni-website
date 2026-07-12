# Gate 55E Canonical FX M1 Bundle Audit

- Generated: 2026-06-24T21:31:51.477Z
- Status: BLOCKED_CANONICAL_FX_M1_GAPS_REMAIN
- Write fill: false
- Input hash: 0425B1122A29BA1E2D3D7B203B16A2C01A3D410735D280BAB740CD08940102E6

## Before

- Parent pair-weeks: 28
- Complete pair-weeks: 0
- Partial pair-weeks: 10
- Missing pair-weeks: 18
- Source-gap pair-weeks: 0
- Full weeks: 0
- Partial weeks: 1
- Source-gap weeks: 0
- Missing active pair-minute rows: 140614
- Lowest coverage: 0.000000%

## Weak Week Sample

- 2019-01-14T00:00:00.000Z: status=partial, expected=7196, completePairs=0, partialPairs=10, missingBars=140614, lowest=0.000000%

## Weak Pair Sample

- 2019-01-14T00:00:00.000Z AUDCAD: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z AUDCHF: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z AUDJPY: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z AUDNZD: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z AUDUSD: status=partial, actual=6354/7196, missing=842, coverage=88.299055%
- 2019-01-14T00:00:00.000Z CADCHF: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z CADJPY: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z CHFJPY: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z EURAUD: status=partial, actual=3472/7196, missing=3724, coverage=48.249027%
- 2019-01-14T00:00:00.000Z EURCAD: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z EURCHF: status=partial, actual=3597/7196, missing=3599, coverage=49.986103%
- 2019-01-14T00:00:00.000Z EURGBP: status=partial, actual=6070/7196, missing=1126, coverage=84.352418%
- 2019-01-14T00:00:00.000Z EURJPY: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z EURNZD: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z EURUSD: status=partial, actual=7141/7196, missing=55, coverage=99.235686%
- 2019-01-14T00:00:00.000Z GBPAUD: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z GBPCAD: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z GBPCHF: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z GBPJPY: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z GBPNZD: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z GBPUSD: status=partial, actual=7051/7196, missing=145, coverage=97.984992%
- 2019-01-14T00:00:00.000Z NZDCAD: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z NZDCHF: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z NZDJPY: status=missing, actual=0/7196, missing=7196, coverage=0.000000%
- 2019-01-14T00:00:00.000Z NZDUSD: status=partial, actual=6932/7196, missing=264, coverage=96.331295%
- 2019-01-14T00:00:00.000Z USDCAD: status=partial, actual=6971/7196, missing=225, coverage=96.873263%
- 2019-01-14T00:00:00.000Z USDCHF: status=partial, actual=6211/7196, missing=985, coverage=86.311840%
- 2019-01-14T00:00:00.000Z USDJPY: status=partial, actual=7075/7196, missing=121, coverage=98.318510%

## Governance

- Active FX minutes are provider-observed OANDA `provider_minute` rows inside the canonical New York 5pm week window.
- Pair coverage requires 100% of active provider minutes.
- No-tick repair rows, when written, require existing pair rows to span the active session edges within 60 minutes.
- No-tick repair rows use prior same-symbol close only and quality_status=derived_no_tick_forward_fill_v1.
- The repair path does not use future bars, outcomes, COT, Strength, regimes, execution optimization, or risk overlays.
