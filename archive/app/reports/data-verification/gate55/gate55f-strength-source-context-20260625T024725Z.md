# Gate 55F Canonical Strength Source Context Proof

Generated: 2026-06-25T02:47:25.930Z

## Result

- Status: PASS_CANONICAL_STRENGTH_SOURCE_CONTEXT_28_28_FULL_HORIZON
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
| friday_close | 387 | 10836 | 10836 | 0 | 387 | 387 | 0 | 0 | 0 | 5598 | 5238 | 0 | 5-5 |
| market_open_confirmation | 387 | 10836 | 10836 | 0 | 387 | 387 | 0 | 0 | 0 | 5477 | 5359 | 0 | 5-5 |

## Derived Snapshot Coverage

- Snapshot times: 7686
- Snapshot rows: 307440
- Complete snapshot rows: 279520
- Incomplete snapshot rows: 27920
- Coverage range: 0% to 100%

Incomplete snapshot rows are permitted only outside the retained full-horizon decision set. Retained baseline rows above require all requested Strength windows to be available for the pair decision.

## Non-Full Signal Weeks

None.

## Non-Full Horizon Weeks

None.

## Decision Boundary

Gate 55F proves whether canonical M1-derived Friday Strength decision context can produce complete weekly 28-pair matrices. It does not choose selected, fade, buckets, thresholds, horizons by PnL, or a final Strength baseline.

## Files

- JSON: app\reports\data-verification\gate55\gate55f-strength-source-context-20260625T024725Z.json
- Markdown: app\reports\data-verification\gate55\gate55f-strength-source-context-20260625T024725Z.md

Receipt hash: `6A1E553CE7F5F1014F75A545FB0000B6C6238AB22813DF597766BDF14D9F9959`
