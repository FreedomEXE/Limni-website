# Gate 55F Canonical Strength Source Context Proof

Generated: 2026-06-25T00:48:34.109Z

## Result

- Status: BLOCKED_CANONICAL_STRENGTH_SOURCE_CONTEXT_NOT_28_28
- Gate: Gate 55F: canonical-strength-source-context-proof
- Price bundle ID: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Derivation version: `fx_m1_currency_strength_v1`
- Source mutation by this script: false
- Local SQLite staging source allowed: false
- No COT+Strength combination: true
- No regime/risk/execution/live work: true
- No selected-vs-fade performance run: true

## Scope

- Weeks: 2019-01-07T00:00:00.000Z through before 2026-06-07T23:00:00.000Z
- Week count: 387
- FX pairs: 28
- Windows: 1h, 4h, 24h, 1w, 1m
- Pair-window coverage threshold: 100%
- Market-open forward search: 180 minutes
- Friday backward search: 60 minutes
- Snapshot cadence: 15 minutes
- Batch weeks: 16

## Point Coverage

| Point | Weeks | Parent rows | Retained rows | Removed rows | Full signal weeks | Full horizon weeks | Partial signal weeks | Partial horizon weeks | Unavailable weeks | Long rows | Short rows | Missing window lookups | Available windows range |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| friday_close | 387 | 10836 | 10836 | 0 | 387 | 360 | 0 | 27 | 0 | 5526 | 5310 | 1176 | 3-5 |
| market_open_confirmation | 387 | 10836 | 10752 | 84 | 384 | 134 | 0 | 250 | 3 | 5598 | 5154 | 14308 | 0-5 |

## Derived Snapshot Coverage

- Snapshot times: 6966
- Snapshot rows: 278640
- Complete snapshot rows: 183272
- Incomplete snapshot rows: 95368
- Coverage range: 0% to 100%

Incomplete snapshot rows are permitted only outside the retained full-horizon decision set. Retained baseline rows above require all requested Strength windows to be available for the pair decision.

## Non-Full Signal Weeks

| Week | Point | Directional rows | Full-window rows | Available window range | Missing window lookups | Resolved min | Resolved max | Missing reasons |
|---|---|---:|---:|---|---:|---|---|---|
| 2022-12-26 | market_open_confirmation | 0/28 | 0/28 | 0-0 | 140 | - | - | missing_strength_windows:28 |
| 2023-12-25 | market_open_confirmation | 0/28 | 0/28 | 0-0 | 140 | - | - | missing_strength_windows:28 |
| 2024-01-01 | market_open_confirmation | 0/28 | 0/28 | 0-0 | 140 | - | - | missing_strength_windows:28 |

## Non-Full Horizon Weeks

| Week | Point | Directional rows | Full-window rows | Available window range | Missing window lookups | Resolved min | Resolved max | Missing reasons |
|---|---|---:|---:|---|---:|---|---|---|
| 2019-06-10 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2019-06-09T21:15:00.000Z | 2019-06-09T21:15:00.000Z | - |
| 2019-06-17 | market_open_confirmation | 28/28 | 0/28 | 4-4 | 28 | 2019-06-16T21:15:00.000Z | 2019-06-16T21:15:00.000Z | - |
| 2019-06-24 | market_open_confirmation | 28/28 | 0/28 | 4-4 | 28 | 2019-06-23T21:15:00.000Z | 2019-06-23T21:15:00.000Z | - |
| 2019-08-12 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2019-08-11T21:15:00.000Z | 2019-08-11T21:15:00.000Z | - |
| 2019-08-19 | friday_close | 28/28 | 0/28 | 4-4 | 28 | 2019-08-16T21:00:00.000Z | 2019-08-16T21:00:00.000Z | - |
| 2019-08-19 | market_open_confirmation | 28/28 | 0/28 | 4-4 | 28 | 2019-08-18T21:15:00.000Z | 2019-08-18T21:15:00.000Z | - |
| 2019-08-26 | friday_close | 28/28 | 0/28 | 4-4 | 28 | 2019-08-23T21:00:00.000Z | 2019-08-23T21:00:00.000Z | - |
| 2019-08-26 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2019-08-25T21:15:00.000Z | 2019-08-25T21:15:00.000Z | - |
| 2019-09-02 | friday_close | 28/28 | 0/28 | 4-4 | 28 | 2019-08-30T21:00:00.000Z | 2019-08-30T21:00:00.000Z | - |
| 2019-09-02 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2019-09-01T21:15:00.000Z | 2019-09-01T21:15:00.000Z | - |
| 2019-09-09 | friday_close | 28/28 | 0/28 | 4-4 | 28 | 2019-09-06T21:00:00.000Z | 2019-09-06T21:00:00.000Z | - |
| 2019-09-09 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2019-09-08T21:15:00.000Z | 2019-09-08T21:15:00.000Z | - |
| 2019-09-16 | friday_close | 28/28 | 0/28 | 4-4 | 28 | 2019-09-13T21:00:00.000Z | 2019-09-13T21:00:00.000Z | - |
| 2019-09-16 | market_open_confirmation | 28/28 | 0/28 | 4-4 | 28 | 2019-09-15T21:15:00.000Z | 2019-09-15T21:15:00.000Z | - |
| 2019-09-23 | friday_close | 28/28 | 0/28 | 4-4 | 28 | 2019-09-20T21:00:00.000Z | 2019-09-20T21:00:00.000Z | - |
| 2019-09-23 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2019-09-22T21:15:00.000Z | 2019-09-22T21:15:00.000Z | - |
| 2019-09-30 | friday_close | 28/28 | 0/28 | 4-4 | 28 | 2019-09-27T21:00:00.000Z | 2019-09-27T21:00:00.000Z | - |
| 2019-09-30 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2019-09-29T21:15:00.000Z | 2019-09-29T21:15:00.000Z | - |
| 2019-10-07 | friday_close | 28/28 | 0/28 | 4-4 | 28 | 2019-10-04T21:00:00.000Z | 2019-10-04T21:00:00.000Z | - |
| 2019-10-07 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2019-10-06T21:15:00.000Z | 2019-10-06T21:15:00.000Z | - |
| 2019-10-14 | friday_close | 28/28 | 0/28 | 4-4 | 28 | 2019-10-11T21:00:00.000Z | 2019-10-11T21:00:00.000Z | - |
| 2019-10-14 | market_open_confirmation | 28/28 | 0/28 | 4-4 | 28 | 2019-10-13T21:15:00.000Z | 2019-10-13T21:15:00.000Z | - |
| 2019-10-21 | friday_close | 28/28 | 0/28 | 4-4 | 28 | 2019-10-18T21:00:00.000Z | 2019-10-18T21:00:00.000Z | - |
| 2019-10-21 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2019-10-20T21:15:00.000Z | 2019-10-20T21:15:00.000Z | - |
| 2019-10-28 | friday_close | 28/28 | 0/28 | 4-4 | 28 | 2019-10-25T21:00:00.000Z | 2019-10-25T21:00:00.000Z | - |
| 2019-10-28 | market_open_confirmation | 28/28 | 0/28 | 4-4 | 28 | 2019-10-27T21:15:00.000Z | 2019-10-27T21:15:00.000Z | - |
| 2019-11-04 | friday_close | 28/28 | 0/28 | 4-4 | 28 | 2019-11-01T21:00:00.000Z | 2019-11-01T21:00:00.000Z | - |
| 2019-11-04 | market_open_confirmation | 28/28 | 0/28 | 4-4 | 28 | 2019-11-03T22:15:00.000Z | 2019-11-03T22:15:00.000Z | - |
| 2020-06-01 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2020-05-31T23:00:00.000Z | 2020-05-31T23:00:00.000Z | - |
| 2021-11-22 | market_open_confirmation | 28/28 | 0/28 | 2-2 | 84 | 2021-11-22T00:15:00.000Z | 2021-11-22T00:15:00.000Z | - |
| 2021-12-06 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2021-12-05T23:15:00.000Z | 2021-12-05T23:15:00.000Z | - |
| 2021-12-13 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2021-12-12T23:15:00.000Z | 2021-12-12T23:15:00.000Z | - |
| 2021-12-20 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2021-12-19T23:15:00.000Z | 2021-12-19T23:15:00.000Z | - |
| 2021-12-27 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2021-12-26T23:15:00.000Z | 2021-12-26T23:15:00.000Z | - |
| 2022-01-03 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-01-02T23:15:00.000Z | 2022-01-02T23:15:00.000Z | - |
| 2022-01-10 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-01-09T23:15:00.000Z | 2022-01-09T23:15:00.000Z | - |
| 2022-01-17 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-01-16T23:15:00.000Z | 2022-01-16T23:15:00.000Z | - |
| 2022-01-24 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-01-23T23:15:00.000Z | 2022-01-23T23:15:00.000Z | - |
| 2022-01-31 | friday_close | 28/28 | 0/28 | 3-3 | 56 | 2022-01-28T22:00:00.000Z | 2022-01-28T22:00:00.000Z | - |
| 2022-01-31 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-01-30T23:15:00.000Z | 2022-01-30T23:15:00.000Z | - |
| 2022-02-07 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-02-06T23:15:00.000Z | 2022-02-06T23:15:00.000Z | - |
| 2022-02-14 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-02-13T23:15:00.000Z | 2022-02-13T23:15:00.000Z | - |
| 2022-02-21 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-02-20T23:15:00.000Z | 2022-02-20T23:15:00.000Z | - |
| 2022-02-28 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-02-27T23:15:00.000Z | 2022-02-27T23:15:00.000Z | - |
| 2022-03-07 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-03-06T23:15:00.000Z | 2022-03-06T23:15:00.000Z | - |
| 2022-03-14 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-03-13T22:15:00.000Z | 2022-03-13T22:15:00.000Z | - |
| 2022-03-21 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-03-20T22:15:00.000Z | 2022-03-20T22:15:00.000Z | - |
| 2022-03-28 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-03-27T22:15:00.000Z | 2022-03-27T22:15:00.000Z | - |
| 2022-04-04 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-04-03T22:15:00.000Z | 2022-04-03T22:15:00.000Z | - |
| 2022-04-11 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-04-10T22:15:00.000Z | 2022-04-10T22:15:00.000Z | - |
| 2022-04-18 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-04-17T22:15:00.000Z | 2022-04-17T22:15:00.000Z | - |
| 2022-04-25 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-04-24T22:15:00.000Z | 2022-04-24T22:15:00.000Z | - |
| 2022-05-02 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-05-01T22:15:00.000Z | 2022-05-01T22:15:00.000Z | - |
| 2022-05-09 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-05-08T22:15:00.000Z | 2022-05-08T22:15:00.000Z | - |
| 2022-05-16 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-05-15T22:15:00.000Z | 2022-05-15T22:15:00.000Z | - |
| 2022-05-23 | friday_close | 28/28 | 0/28 | 3-3 | 56 | 2022-05-20T21:00:00.000Z | 2022-05-20T21:00:00.000Z | - |
| 2022-05-23 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-05-22T22:15:00.000Z | 2022-05-22T22:15:00.000Z | - |
| 2022-05-30 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-05-29T22:15:00.000Z | 2022-05-29T22:15:00.000Z | - |
| 2022-06-06 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-06-05T22:15:00.000Z | 2022-06-05T22:15:00.000Z | - |
| 2022-06-13 | market_open_confirmation | 28/28 | 0/28 | 3-3 | 56 | 2022-06-12T22:15:00.000Z | 2022-06-12T22:15:00.000Z | - |

## Decision Boundary

Gate 55F proves whether canonical M1-derived Friday Strength decision context can produce complete weekly 28-pair matrices. It does not choose selected, fade, buckets, thresholds, horizons by PnL, or a final Strength baseline.

## Files

- JSON: app\reports\data-verification\gate55\gate55f-strength-source-context-20260625T004834Z.json
- Markdown: app\reports\data-verification\gate55\gate55f-strength-source-context-20260625T004834Z.md

Receipt hash: `67C2436623C90BDCAB7CD96B4705C16AE0E522794BD72ED83A94FA02AC162739`
