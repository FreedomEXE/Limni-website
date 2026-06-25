# Gate 55F Canonical Strength Source Context Proof

Generated: 2026-06-25T01:57:57.230Z

## Result

- Status: PASS_CANONICAL_STRENGTH_SOURCE_CONTEXT_28_28_WITH_PARTIAL_HORIZON_CAVEATS
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
- Holiday market-open forward search: 2880 minutes
- Friday backward search: 60 minutes
- Snapshot cadence: 15 minutes
- Batch weeks: 16

## Point Coverage

| Point | Weeks | Parent rows | Retained rows | Removed rows | Full signal weeks | Full horizon weeks | Partial signal weeks | Partial horizon weeks | Unavailable weeks | Long rows | Short rows | Missing window lookups | Available windows range |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| friday_close | 387 | 10836 | 10836 | 0 | 387 | 386 | 0 | 1 | 0 | 5600 | 5236 | 28 | 4-5 |
| market_open_confirmation | 387 | 10836 | 10836 | 0 | 387 | 387 | 0 | 0 | 0 | 5477 | 5359 | 0 | 5-5 |

## Derived Snapshot Coverage

- Snapshot times: 7686
- Snapshot rows: 307440
- Complete snapshot rows: 278928
- Incomplete snapshot rows: 28512
- Coverage range: 0% to 100%

Incomplete snapshot rows are permitted only outside the retained full-horizon decision set. Retained baseline rows above require all requested Strength windows to be available for the pair decision.

## Non-Full Signal Weeks

None.

## Non-Full Horizon Weeks

| Week | Point | Directional rows | Full-window rows | Available window range | Missing window lookups | Resolved min | Resolved max | Missing reasons |
|---|---|---:|---:|---|---:|---|---|---|
| 2023-01-02 | friday_close | 28/28 | 0/28 | 4-4 | 28 | 2022-12-30T22:00:00.000Z | 2022-12-30T22:00:00.000Z | - |

## Decision Boundary

Gate 55F proves whether canonical M1-derived Friday Strength decision context can produce complete weekly 28-pair matrices. It does not choose selected, fade, buckets, thresholds, horizons by PnL, or a final Strength baseline.

## Files

- JSON: app\reports\data-verification\gate55\gate55f-strength-source-context-20260625T015757Z.json
- Markdown: app\reports\data-verification\gate55\gate55f-strength-source-context-20260625T015757Z.md

Receipt hash: `069901ABB87FD476534343BC44F81D9B08D1EC3218DBAB5F586C8EA834CA8D0C`
