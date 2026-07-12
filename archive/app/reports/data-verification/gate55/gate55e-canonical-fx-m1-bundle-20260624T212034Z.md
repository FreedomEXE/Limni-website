# Gate 55E Canonical FX M1 Bundle Audit

- Generated: 2026-06-24T21:20:34.008Z
- Status: BLOCKED_CANONICAL_FX_M1_GAPS_REMAIN
- Write fill: false
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

## Weak Week Sample

- 2019-01-07T00:00:00.000Z: status=partial, expected=7196, completePairs=5, partialPairs=23, missingBars=23, lowest=99.986103%

## Weak Pair Sample

- 2019-01-07T00:00:00.000Z AUDCAD: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z AUDCHF: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z AUDJPY: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z AUDNZD: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z AUDUSD: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z CADCHF: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z CADJPY: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z CHFJPY: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z EURAUD: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z EURCAD: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z GBPAUD: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z GBPCAD: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z GBPCHF: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z GBPJPY: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z GBPNZD: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z GBPUSD: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z NZDCAD: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z NZDCHF: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z NZDJPY: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z NZDUSD: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z USDCAD: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z USDCHF: status=partial, actual=7195/7196, missing=1, coverage=99.986103%
- 2019-01-07T00:00:00.000Z USDJPY: status=partial, actual=7195/7196, missing=1, coverage=99.986103%

## Governance

- Active FX minutes are provider-observed OANDA `provider_minute` rows inside the canonical New York 5pm week window.
- Pair coverage requires 100% of active provider minutes.
- No-tick repair rows, when written, use prior same-symbol close only and quality_status=derived_no_tick_forward_fill_v1.
- The repair path does not use future bars, outcomes, COT, Strength, regimes, execution optimization, or risk overlays.
