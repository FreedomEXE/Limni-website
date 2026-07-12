# Gate 55F Canonical Strength Source Context Proof

Date: 2026-06-25

Status: `PASS_CANONICAL_STRENGTH_SOURCE_CONTEXT_28_28_FULL_HORIZON`

## Purpose

Gate 55F proves that Friday Strength source context can be reconstructed from
the frozen Gate 55E canonical FX M1 price bundle without using local SQLite
staging, legacy Gate 44 source-context rows, COT, regimes, execution
optimization, risk overlays, or live/MT5 paths.

This is a source-contract proof only. It does not choose selected direction,
fade direction, buckets, thresholds, a final Strength baseline, or a combined
system.

## Frozen Price Bundle

- `price_bundle_id`:
  `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Price receipt:
  `docs/research/GATE55E_FROZEN_CANONICAL_PRICE_BUNDLE_V1_RECEIPT_2026-06-24.md`
- Strength derivation version: `fx_m1_currency_strength_v1`
- Source table: `canonical_price_bars`
- Source timeframe: `1m`
- Local SQLite staging source allowed: `false`

## Rule Corrections Locked

- Strength source context uses the Gate 55E canonical price bundle as the price
  completeness authority.
- Strength window coverage is calculated on the canonical pair-window rows used
  for the Strength calculation; it does not reclassify provider reopen lag as
  missing price data after Gate 55E has already proven the bundle.
- Warmup coverage permits bounded provider reopen lag, so Sunday reopen minutes
  such as `22:03` do not falsely fail a window that has no missing tradable
  price rows.
- Year-end closures use the provider-observed Christmas/New Year closure bands:
  `Dec 24 22:00 UTC -> Dec 26 22:00 UTC` and
  `Dec 31 22:00 UTC -> Jan 02 22:00 UTC`.
- Market-open confirmation uses a normal `180` minute forward search and a
  holiday reopen `2880` minute forward search.
- Friday close uses a bounded `60` minute backward search for the latest
  complete source state at or before Friday 17:00 New York.

## Final Command

```powershell
npm run verification:gate55f-strength-source-context -- --from-week=2019-01-07 --to-week=2026-06-08 --batch-weeks=16
```

## Final Receipt

- JSON:
  `app/reports/data-verification/gate55/gate55f-strength-source-context-20260625T024725Z.json`
- Markdown:
  `app/reports/data-verification/gate55/gate55f-strength-source-context-20260625T024725Z.md`
- Receipt hash:
  `6A1E553CE7F5F1014F75A545FB0000B6C6238AB22813DF597766BDF14D9F9959`
- JSON SHA-256:
  `1CBB0F7A65575ABE89A5322B7A548BD4A7604DBD6FC606959F6384374E6E228F`
- Markdown SHA-256:
  `52A88F35A249530C961B0B11C0FF08D3361B432197263EDB4FF929D834D11753`

## Final Coverage

- Weeks: `387`
- FX pairs: `28`
- Expected parent rows per point: `10,836`
- Snapshot times derived: `7,686`
- Snapshot rows derived: `307,440`
- Incomplete candidate snapshot rows: `27,920`
- Non-full signal weeks: `0`
- Non-full horizon weeks: `0`

| Point | Parent rows | Retained rows | Removed rows | Full signal weeks | Full horizon weeks | Missing window lookups |
|---|---:|---:|---:|---:|---:|---:|
| friday_close | 10,836 | 10,836 | 0 | 387/387 | 387/387 | 0 |
| market_open_confirmation | 10,836 | 10,836 | 0 | 387/387 | 387/387 | 0 |

## Interpretation

Friday Strength can now produce a full canonical 28-pair weekly matrix from
the frozen Gate 55E M1 bundle for every trade week in the tested 2019-01-07
through 2026-06-01 window.

This closes the source-context blocker that stopped the legacy Gate 55A
selected-vs-fade diagnostic from being promotion-grade evidence.

The next allowed Gate 55 step is a canonical selected-vs-fade performance
diagnostic using this source context, under ADR Grid and simple weekly hold,
with the same `price_bundle_id` declared. No COT+Strength combination, regime
filter, execution optimization, risk overlay, or final combined-system
selection is authorized.
