# Snapshot Regime Comparison Evidence

Generated: 2026-06-06T04:41:16.863Z

## Guardrails

- Read-only evidence report.
- No canon regeneration.
- No 19-week baseline retirement.
- No UI refactor or app patching.
- `v2.0.2` remains a usable app-shell reference only; its data is not treated as truth here.
- Current `v2.0.3` app state remains evidence/quarantine, not release base.

## Scope

- Window: clean14, 2026-02-23T00:00:00.000Z through 2026-05-24T23:00:00.000Z.
- Sources: Dealer, Commercial, Sentiment, Strength.
- Performance return source: `pair_period_returns`, weekly, `anchor_type=execution`, `anchor_version=execution_ny_fri9_entry_fri11_close_v1`.
- Current app execution anchor: `execution_ny_crypto_sun20_v2`.
- Performance calculation: source-model standalone basket sum using the same execution return rows for both regimes. Missing return rows produce `null`, not filled values.

## Regimes

- Sunday/Monday regime: legacy/current weekly basket source path, using COT report-date snapshots, sentiment week-start resolver, and locked/week-open strength snapshots where available.
- Friday 5 PM ET regime: in-memory `buildFrozenSourceLedgerWeek()` at Friday 17:00 America/New_York, not persisted by this report.

## Execution Return Anchor Coverage

Selected comparison anchor: `execution_ny_fri9_entry_fri11_close_v1` (complete for clean14).
Current app anchor: `execution_ny_crypto_sun20_v2` (incomplete for clean14).
Selection rationale: the selected anchor is complete for clean14; incomplete/absent anchors are reported but not used for aggregate deltas.

| Anchor | Weeks Covered | Complete Weeks | Rows | Sources | Complete Clean14 |
| --- | ---: | ---: | ---: | --- | --- |
| execution_monday_utc_v1 | 14/14 | 13/14 | 498 | canonical_price_bars | no |
| execution_ny_fri9_entry_fri11_close_v1 | 14/14 | 14/14 | 504 | canonical_price_bars | yes |
| execution_ny_session_v2 | 14/14 | 14/14 | 504 | canonical_price_bars | yes |
| execution_ny_crypto_sun20_v2 | 0/14 | 0/14 | 0 | - | no |

## Source Completeness

| Regime | Rows | Complete | Trusted | Incident Rows | Incidents |
| --- | ---: | ---: | ---: | ---: | ---: |
| sunday_monday | 2,016 | 2,016 | 2,016 | 0 | 0 |
| friday_1700_et | 2,016 | 2,016 | 2,016 | 504 | 504 |

## Signal Changes

Total changed pair/source signals: 181.

| Source | Changed Signals |
| --- | ---: |
| sentiment | 1 |
| strength | 180 |

Top changed signal rows:

| Week | Source | Symbol | Asset | Sunday/Monday | Friday 5 PM ET |
| --- | --- | --- | --- | --- | --- |
| 2026-02-23 | sentiment | EURCAD | fx | SHORT | LONG |
| 2026-02-23 | strength | CADCHF | fx | SHORT | LONG |
| 2026-02-23 | strength | CADJPY | fx | SHORT | LONG |
| 2026-02-23 | strength | ETHUSD | crypto | LONG | SHORT |
| 2026-02-23 | strength | EURCHF | fx | SHORT | LONG |
| 2026-02-23 | strength | EURJPY | fx | SHORT | LONG |
| 2026-02-23 | strength | EURNZD | fx | SHORT | LONG |
| 2026-02-23 | strength | EURUSD | fx | LONG | SHORT |
| 2026-02-23 | strength | GBPCAD | fx | LONG | SHORT |
| 2026-02-23 | strength | GBPJPY | fx | SHORT | LONG |
| 2026-02-23 | strength | GBPUSD | fx | LONG | SHORT |
| 2026-02-23 | strength | NZDUSD | fx | LONG | SHORT |
| 2026-02-23 | strength | USDCAD | fx | SHORT | LONG |
| 2026-02-23 | strength | USDCHF | fx | SHORT | LONG |
| 2026-02-23 | strength | USDJPY | fx | SHORT | LONG |
| 2026-03-02 | strength | AUDCAD | fx | LONG | SHORT |
| 2026-03-02 | strength | AUDCHF | fx | LONG | SHORT |
| 2026-03-02 | strength | AUDJPY | fx | LONG | SHORT |
| 2026-03-02 | strength | AUDNZD | fx | LONG | SHORT |
| 2026-03-02 | strength | CADCHF | fx | LONG | SHORT |
| 2026-03-02 | strength | EURAUD | fx | SHORT | LONG |
| 2026-03-02 | strength | EURCAD | fx | LONG | SHORT |
| 2026-03-02 | strength | EURCHF | fx | LONG | SHORT |
| 2026-03-02 | strength | EURGBP | fx | SHORT | LONG |
| 2026-03-02 | strength | EURNZD | fx | SHORT | LONG |
| 2026-03-02 | strength | EURUSD | fx | SHORT | LONG |
| 2026-03-02 | strength | GBPCAD | fx | LONG | SHORT |
| 2026-03-02 | strength | GBPCHF | fx | LONG | SHORT |
| 2026-03-02 | strength | NZDCAD | fx | LONG | SHORT |
| 2026-03-02 | strength | NZDCHF | fx | LONG | SHORT |
| 2026-03-02 | strength | NZDUSD | fx | LONG | SHORT |
| 2026-03-02 | strength | USDCAD | fx | LONG | SHORT |
| 2026-03-02 | strength | USDCHF | fx | LONG | SHORT |
| 2026-03-02 | strength | USDJPY | fx | LONG | SHORT |
| 2026-03-02 | strength | WTIUSD | commodities | SHORT | LONG |
| 2026-03-08 | strength | NIKKEIUSD | indices | SHORT | LONG |
| 2026-03-15 | strength | NDXUSD | indices | SHORT | LONG |
| 2026-03-22 | strength | AUDCHF | fx | SHORT | LONG |
| 2026-03-22 | strength | EURCHF | fx | SHORT | LONG |
| 2026-03-22 | strength | GBPAUD | fx | SHORT | LONG |
| 2026-03-22 | strength | GBPCHF | fx | SHORT | LONG |
| 2026-03-22 | strength | GBPNZD | fx | SHORT | LONG |
| 2026-03-22 | strength | NDXUSD | indices | SHORT | LONG |
| 2026-03-22 | strength | NIKKEIUSD | indices | LONG | SHORT |
| 2026-03-22 | strength | NZDCAD | fx | LONG | SHORT |
| 2026-03-22 | strength | NZDCHF | fx | SHORT | LONG |
| 2026-03-22 | strength | NZDUSD | fx | LONG | SHORT |
| 2026-03-22 | strength | SPXUSD | indices | SHORT | LONG |
| 2026-03-22 | strength | USDCAD | fx | LONG | SHORT |
| 2026-03-22 | strength | WTIUSD | commodities | SHORT | LONG |
| 2026-03-22 | strength | XAGUSD | commodities | LONG | SHORT |
| 2026-03-22 | strength | XAUUSD | commodities | LONG | SHORT |
| 2026-03-29 | strength | AUDCHF | fx | SHORT | LONG |
| 2026-03-29 | strength | AUDJPY | fx | SHORT | LONG |
| 2026-03-29 | strength | AUDNZD | fx | LONG | SHORT |
| 2026-03-29 | strength | CADJPY | fx | SHORT | LONG |
| 2026-03-29 | strength | GBPCAD | fx | SHORT | LONG |
| 2026-03-29 | strength | GBPCHF | fx | SHORT | LONG |
| 2026-03-29 | strength | GBPJPY | fx | SHORT | LONG |
| 2026-03-29 | strength | NDXUSD | indices | LONG | SHORT |
| 2026-03-29 | strength | NIKKEIUSD | indices | SHORT | LONG |
| 2026-03-29 | strength | NZDCAD | fx | SHORT | LONG |
| 2026-03-29 | strength | NZDCHF | fx | SHORT | LONG |
| 2026-03-29 | strength | SPXUSD | indices | LONG | SHORT |
| 2026-04-05 | strength | EURCAD | fx | SHORT | LONG |
| 2026-04-05 | strength | EURCHF | fx | LONG | SHORT |
| 2026-04-05 | strength | EURGBP | fx | SHORT | LONG |
| 2026-04-05 | strength | EURJPY | fx | SHORT | LONG |
| 2026-04-05 | strength | EURUSD | fx | SHORT | LONG |
| 2026-04-05 | strength | GBPCHF | fx | LONG | SHORT |
| 2026-04-05 | strength | NIKKEIUSD | indices | SHORT | LONG |
| 2026-04-05 | strength | SPXUSD | indices | LONG | SHORT |
| 2026-04-05 | strength | USDJPY | fx | LONG | SHORT |
| 2026-04-05 | strength | WTIUSD | commodities | SHORT | LONG |
| 2026-04-05 | strength | XAUUSD | commodities | LONG | SHORT |
| 2026-04-12 | strength | AUDCAD | fx | LONG | SHORT |
| 2026-04-12 | strength | AUDCHF | fx | LONG | SHORT |
| 2026-04-12 | strength | AUDJPY | fx | LONG | SHORT |
| 2026-04-12 | strength | AUDNZD | fx | LONG | SHORT |
| 2026-04-12 | strength | AUDUSD | fx | LONG | SHORT |
| ... | ... | ... | ... | ... | 101 more rows in JSON |

## Strength Number Deltas

Strength rows with any numeric/direction delta: 435 of 504.

| Week | Symbol | Asset | Direction Before | Direction After | Composite Delta | Raw 1W Delta | Raw 1M Delta | Latest Before | Latest After |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |
| 2026-02-23 | EURUSD | fx | LONG | SHORT | -4 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | GBPUSD | fx | LONG | SHORT | -4 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | AUDUSD | fx | LONG | LONG | -4 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | NZDUSD | fx | LONG | SHORT | -4 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | USDJPY | fx | SHORT | LONG | 6 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | USDCHF | fx | SHORT | LONG | 4 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | USDCAD | fx | SHORT | LONG | 4 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | EURGBP | fx | LONG | LONG | 0 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | EURJPY | fx | SHORT | LONG | 6 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | EURCHF | fx | SHORT | LONG | 5 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | EURAUD | fx | SHORT | SHORT | 4 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | EURNZD | fx | SHORT | LONG | 4 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | EURCAD | fx | LONG | LONG | 0 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | GBPJPY | fx | SHORT | LONG | 5 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | GBPCHF | fx | SHORT | SHORT | 4 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | GBPAUD | fx | SHORT | SHORT | 2 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | GBPNZD | fx | SHORT | SHORT | 4 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | GBPCAD | fx | LONG | SHORT | -3 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | AUDJPY | fx | LONG | LONG | -2 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | AUDCHF | fx | LONG | LONG | -2 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | AUDCAD | fx | LONG | LONG | -3 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | AUDNZD | fx | LONG | LONG | -3 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | NZDJPY | fx | LONG | LONG | -2 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | NZDCHF | fx | LONG | LONG | -2 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | NZDCAD | fx | LONG | LONG | -2 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | CADJPY | fx | SHORT | LONG | 5 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | CADCHF | fx | SHORT | LONG | 4 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | CHFJPY | fx | LONG | LONG | 3 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | SPXUSD | indices | LONG | LONG | 3 | 0 | 0 | 2026-02-21T06:00:00.000Z | 2026-02-21T03:00:00.000Z |
| 2026-02-23 | NDXUSD | indices | LONG | LONG | 0 | 0 | 0 | 2026-02-21T06:00:00.000Z | 2026-02-21T03:00:00.000Z |
| 2026-02-23 | NIKKEIUSD | indices | SHORT | SHORT | -1 | 0 | 0 | 2026-02-21T06:00:00.000Z | 2026-02-21T03:00:00.000Z |
| 2026-02-23 | BTCUSD | crypto | SHORT | SHORT | 4 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | ETHUSD | crypto | LONG | SHORT | -4 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | XAUUSD | commodities | SHORT | SHORT | 0 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-02-23 | WTIUSD | commodities | SHORT | SHORT | 0 | 0 | 0 | 2026-02-23T05:00:00.000Z | 2026-02-21T01:00:00.000Z |
| 2026-03-02 | EURUSD | fx | SHORT | LONG | 6 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | GBPUSD | fx | SHORT | SHORT | 4 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | AUDUSD | fx | LONG | LONG | -4 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | NZDUSD | fx | LONG | SHORT | -4 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | USDJPY | fx | LONG | SHORT | -5 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | USDCHF | fx | LONG | SHORT | -4 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | USDCAD | fx | LONG | SHORT | -4 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | EURGBP | fx | SHORT | LONG | 2 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | EURJPY | fx | LONG | LONG | 0 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | EURCHF | fx | LONG | SHORT | -3 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | EURAUD | fx | SHORT | LONG | 6 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | EURNZD | fx | SHORT | LONG | 5 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | EURCAD | fx | LONG | SHORT | -1 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | GBPJPY | fx | LONG | LONG | -2 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | GBPCHF | fx | LONG | SHORT | -2 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | GBPAUD | fx | SHORT | SHORT | 4 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | GBPNZD | fx | SHORT | SHORT | 4 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | GBPCAD | fx | LONG | SHORT | -2 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | AUDJPY | fx | LONG | SHORT | -5 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | AUDCHF | fx | LONG | SHORT | -6 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | AUDCAD | fx | LONG | SHORT | -6 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | AUDNZD | fx | LONG | SHORT | -4 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | NZDJPY | fx | LONG | LONG | -4 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | NZDCHF | fx | LONG | SHORT | -6 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | NZDCAD | fx | LONG | SHORT | -6 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | CADJPY | fx | LONG | LONG | -3 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | CADCHF | fx | LONG | SHORT | -5 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | CHFJPY | fx | LONG | LONG | -2 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | SPXUSD | indices | SHORT | SHORT | 1 | 0 | 0 | 2026-02-28T06:00:00.000Z | 2026-02-28T03:00:00.000Z |
| 2026-03-02 | NDXUSD | indices | SHORT | SHORT | 1 | 0 | 0 | 2026-02-28T06:00:00.000Z | 2026-02-28T03:00:00.000Z |
| 2026-03-02 | NIKKEIUSD | indices | LONG | LONG | -1 | 0 | 0 | 2026-02-28T06:00:00.000Z | 2026-02-28T03:00:00.000Z |
| 2026-03-02 | BTCUSD | crypto | SHORT | SHORT | 2 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | ETHUSD | crypto | SHORT | SHORT | -2 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | XAUUSD | commodities | LONG | LONG | -2 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | XAGUSD | commodities | LONG | LONG | -4 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-02 | WTIUSD | commodities | SHORT | LONG | 2 | 0 | 0 | 2026-03-02T05:00:00.000Z | 2026-02-28T01:00:00.000Z |
| 2026-03-08 | SPXUSD | indices | SHORT | SHORT | -1 | 0 | 0 | 2026-03-07T06:00:00.000Z | 2026-03-07T03:00:00.000Z |
| 2026-03-08 | NDXUSD | indices | SHORT | SHORT | -2 | 0 | 0 | 2026-03-07T06:00:00.000Z | 2026-03-07T03:00:00.000Z |
| 2026-03-08 | NIKKEIUSD | indices | SHORT | LONG | 3 | 0 | 0 | 2026-03-07T06:00:00.000Z | 2026-03-07T03:00:00.000Z |
| 2026-03-15 | SPXUSD | indices | SHORT | SHORT | 1 | 0 | 0 | 2026-03-14T04:00:00.000Z | 2026-03-14T01:00:00.000Z |
| 2026-03-15 | NDXUSD | indices | SHORT | LONG | 3 | 0 | 0 | 2026-03-14T04:00:00.000Z | 2026-03-14T01:00:00.000Z |
| 2026-03-15 | NIKKEIUSD | indices | LONG | LONG | -1 | 0 | 0 | 2026-03-14T04:00:00.000Z | 2026-03-14T01:00:00.000Z |
| 2026-03-22 | EURUSD | fx | LONG | LONG | -2 | 0 | 0 | 2026-03-23T03:00:00.000Z | 2026-03-21T01:00:00.000Z |
| 2026-03-22 | GBPUSD | fx | LONG | LONG | -2 | 0 | 0 | 2026-03-23T03:00:00.000Z | 2026-03-21T01:00:00.000Z |
| 2026-03-22 | AUDUSD | fx | LONG | LONG | -4 | 0 | 0 | 2026-03-23T03:00:00.000Z | 2026-03-21T01:00:00.000Z |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | 355 more rows in JSON |

## Performance Deltas

| Source | Weeks | Comparable Weeks | Sunday/Monday Return | Friday 5 PM ET Return | Delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| dealer | 14 | 14 | +18.3899% | +18.3899% | +0.0000% |
| commercial | 14 | 14 | -43.3241% | -43.3241% | +0.0000% |
| sentiment | 14 | 14 | -85.3426% | -86.0259% | -0.6833% |
| strength | 14 | 14 | -76.6487% | -46.9868% | +29.6619% |

Per-week performance delta rows with non-zero or missing delta:

| Week | Source | Sunday/Monday | Friday 5 PM ET | Delta | Missing Before | Missing After |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 2026-02-23 | sentiment | +1.7206% | +1.0374% | -0.6833% | - | - |
| 2026-02-23 | strength | +8.3755% | +15.5324% | +7.1569% | - | - |
| 2026-03-02 | strength | -50.5298% | -4.7596% | +45.7702% | - | - |
| 2026-03-08 | strength | -27.5627% | -22.5098% | +5.0529% | - | - |
| 2026-03-15 | strength | +5.0599% | +2.2938% | -2.7661% | - | - |
| 2026-03-22 | strength | +3.3146% | -7.4531% | -10.7676% | - | - |
| 2026-03-29 | strength | +1.6566% | -10.7981% | -12.4547% | - | - |
| 2026-04-05 | strength | +18.4318% | -2.4566% | -20.8884% | - | - |
| 2026-04-12 | strength | -14.2315% | +57.2101% | +71.4416% | - | - |
| 2026-04-19 | strength | -8.9866% | +0.8755% | +9.8621% | - | - |
| 2026-04-26 | strength | -3.9746% | +0.0275% | +4.0021% | - | - |
| 2026-05-03 | strength | -7.0692% | -17.0669% | -9.9977% | - | - |
| 2026-05-10 | strength | -19.4622% | -42.6027% | -23.1404% | - | - |
| 2026-05-17 | strength | -2.6668% | -8.8566% | -6.1898% | - | - |
| 2026-05-24 | strength | +20.9964% | -6.4227% | -27.4191% | - | - |

## Missing Or Stale Data Notes

| Issue | Count |
| --- | ---: |
| current_app_execution_anchor_not_used | 1 |
| raw_provider_evidence_missing | 504 |

Full notes:

- 2026-02-23 sentiment AUDCAD: raw_provider_evidence_missing:AUDCAD.
- 2026-02-23 sentiment AUDCHF: raw_provider_evidence_missing:AUDCHF.
- 2026-02-23 sentiment AUDJPY: raw_provider_evidence_missing:AUDJPY.
- 2026-02-23 sentiment AUDNZD: raw_provider_evidence_missing:AUDNZD.
- 2026-02-23 sentiment AUDUSD: raw_provider_evidence_missing:AUDUSD.
- 2026-02-23 sentiment BTCUSD: raw_provider_evidence_missing:BTCUSD.
- 2026-02-23 sentiment CADCHF: raw_provider_evidence_missing:CADCHF.
- 2026-02-23 sentiment CADJPY: raw_provider_evidence_missing:CADJPY.
- 2026-02-23 sentiment CHFJPY: raw_provider_evidence_missing:CHFJPY.
- 2026-02-23 sentiment ETHUSD: raw_provider_evidence_missing:ETHUSD.
- 2026-02-23 sentiment EURAUD: raw_provider_evidence_missing:EURAUD.
- 2026-02-23 sentiment EURCAD: raw_provider_evidence_missing:EURCAD.
- 2026-02-23 sentiment EURCHF: raw_provider_evidence_missing:EURCHF.
- 2026-02-23 sentiment EURGBP: raw_provider_evidence_missing:EURGBP.
- 2026-02-23 sentiment EURJPY: raw_provider_evidence_missing:EURJPY.
- 2026-02-23 sentiment EURNZD: raw_provider_evidence_missing:EURNZD.
- 2026-02-23 sentiment EURUSD: raw_provider_evidence_missing:EURUSD.
- 2026-02-23 sentiment GBPAUD: raw_provider_evidence_missing:GBPAUD.
- 2026-02-23 sentiment GBPCAD: raw_provider_evidence_missing:GBPCAD.
- 2026-02-23 sentiment GBPCHF: raw_provider_evidence_missing:GBPCHF.
- 2026-02-23 sentiment GBPJPY: raw_provider_evidence_missing:GBPJPY.
- 2026-02-23 sentiment GBPNZD: raw_provider_evidence_missing:GBPNZD.
- 2026-02-23 sentiment GBPUSD: raw_provider_evidence_missing:GBPUSD.
- 2026-02-23 sentiment NDXUSD: raw_provider_evidence_missing:NDXUSD.
- 2026-02-23 sentiment NIKKEIUSD: raw_provider_evidence_missing:NIKKEIUSD.
- 2026-02-23 sentiment NZDCAD: raw_provider_evidence_missing:NZDCAD.
- 2026-02-23 sentiment NZDCHF: raw_provider_evidence_missing:NZDCHF.
- 2026-02-23 sentiment NZDJPY: raw_provider_evidence_missing:NZDJPY.
- 2026-02-23 sentiment NZDUSD: raw_provider_evidence_missing:NZDUSD.
- 2026-02-23 sentiment SPXUSD: raw_provider_evidence_missing:SPXUSD.
- 2026-02-23 sentiment USDCAD: raw_provider_evidence_missing:USDCAD.
- 2026-02-23 sentiment USDCHF: raw_provider_evidence_missing:USDCHF.
- 2026-02-23 sentiment USDJPY: raw_provider_evidence_missing:USDJPY.
- 2026-02-23 sentiment WTIUSD: raw_provider_evidence_missing:WTIUSD.
- 2026-02-23 sentiment XAGUSD: raw_provider_evidence_missing:XAGUSD.
- 2026-02-23 sentiment XAUUSD: raw_provider_evidence_missing:XAUUSD.
- 2026-03-02 sentiment AUDCAD: raw_provider_evidence_missing:AUDCAD.
- 2026-03-02 sentiment AUDCHF: raw_provider_evidence_missing:AUDCHF.
- 2026-03-02 sentiment AUDJPY: raw_provider_evidence_missing:AUDJPY.
- 2026-03-02 sentiment AUDNZD: raw_provider_evidence_missing:AUDNZD.
- 2026-03-02 sentiment AUDUSD: raw_provider_evidence_missing:AUDUSD.
- 2026-03-02 sentiment BTCUSD: raw_provider_evidence_missing:BTCUSD.
- 2026-03-02 sentiment CADCHF: raw_provider_evidence_missing:CADCHF.
- 2026-03-02 sentiment CADJPY: raw_provider_evidence_missing:CADJPY.
- 2026-03-02 sentiment CHFJPY: raw_provider_evidence_missing:CHFJPY.
- 2026-03-02 sentiment ETHUSD: raw_provider_evidence_missing:ETHUSD.
- 2026-03-02 sentiment EURAUD: raw_provider_evidence_missing:EURAUD.
- 2026-03-02 sentiment EURCAD: raw_provider_evidence_missing:EURCAD.
- 2026-03-02 sentiment EURCHF: raw_provider_evidence_missing:EURCHF.
- 2026-03-02 sentiment EURGBP: raw_provider_evidence_missing:EURGBP.
- 2026-03-02 sentiment EURJPY: raw_provider_evidence_missing:EURJPY.
- 2026-03-02 sentiment EURNZD: raw_provider_evidence_missing:EURNZD.
- 2026-03-02 sentiment EURUSD: raw_provider_evidence_missing:EURUSD.
- 2026-03-02 sentiment GBPAUD: raw_provider_evidence_missing:GBPAUD.
- 2026-03-02 sentiment GBPCAD: raw_provider_evidence_missing:GBPCAD.
- 2026-03-02 sentiment GBPCHF: raw_provider_evidence_missing:GBPCHF.
- 2026-03-02 sentiment GBPJPY: raw_provider_evidence_missing:GBPJPY.
- 2026-03-02 sentiment GBPNZD: raw_provider_evidence_missing:GBPNZD.
- 2026-03-02 sentiment GBPUSD: raw_provider_evidence_missing:GBPUSD.
- 2026-03-02 sentiment NDXUSD: raw_provider_evidence_missing:NDXUSD.
- 2026-03-02 sentiment NIKKEIUSD: raw_provider_evidence_missing:NIKKEIUSD.
- 2026-03-02 sentiment NZDCAD: raw_provider_evidence_missing:NZDCAD.
- 2026-03-02 sentiment NZDCHF: raw_provider_evidence_missing:NZDCHF.
- 2026-03-02 sentiment NZDJPY: raw_provider_evidence_missing:NZDJPY.
- 2026-03-02 sentiment NZDUSD: raw_provider_evidence_missing:NZDUSD.
- 2026-03-02 sentiment SPXUSD: raw_provider_evidence_missing:SPXUSD.
- 2026-03-02 sentiment USDCAD: raw_provider_evidence_missing:USDCAD.
- 2026-03-02 sentiment USDCHF: raw_provider_evidence_missing:USDCHF.
- 2026-03-02 sentiment USDJPY: raw_provider_evidence_missing:USDJPY.
- 2026-03-02 sentiment WTIUSD: raw_provider_evidence_missing:WTIUSD.
- 2026-03-02 sentiment XAGUSD: raw_provider_evidence_missing:XAGUSD.
- 2026-03-02 sentiment XAUUSD: raw_provider_evidence_missing:XAUUSD.
- 2026-03-08 sentiment AUDCAD: raw_provider_evidence_missing:AUDCAD.
- 2026-03-08 sentiment AUDCHF: raw_provider_evidence_missing:AUDCHF.
- 2026-03-08 sentiment AUDJPY: raw_provider_evidence_missing:AUDJPY.
- 2026-03-08 sentiment AUDNZD: raw_provider_evidence_missing:AUDNZD.
- 2026-03-08 sentiment AUDUSD: raw_provider_evidence_missing:AUDUSD.
- 2026-03-08 sentiment BTCUSD: raw_provider_evidence_missing:BTCUSD.
- 2026-03-08 sentiment CADCHF: raw_provider_evidence_missing:CADCHF.
- 2026-03-08 sentiment CADJPY: raw_provider_evidence_missing:CADJPY.
- 2026-03-08 sentiment CHFJPY: raw_provider_evidence_missing:CHFJPY.
- 2026-03-08 sentiment ETHUSD: raw_provider_evidence_missing:ETHUSD.
- 2026-03-08 sentiment EURAUD: raw_provider_evidence_missing:EURAUD.
- 2026-03-08 sentiment EURCAD: raw_provider_evidence_missing:EURCAD.
- 2026-03-08 sentiment EURCHF: raw_provider_evidence_missing:EURCHF.
- 2026-03-08 sentiment EURGBP: raw_provider_evidence_missing:EURGBP.
- 2026-03-08 sentiment EURJPY: raw_provider_evidence_missing:EURJPY.
- 2026-03-08 sentiment EURNZD: raw_provider_evidence_missing:EURNZD.
- 2026-03-08 sentiment EURUSD: raw_provider_evidence_missing:EURUSD.
- 2026-03-08 sentiment GBPAUD: raw_provider_evidence_missing:GBPAUD.
- 2026-03-08 sentiment GBPCAD: raw_provider_evidence_missing:GBPCAD.
- 2026-03-08 sentiment GBPCHF: raw_provider_evidence_missing:GBPCHF.
- 2026-03-08 sentiment GBPJPY: raw_provider_evidence_missing:GBPJPY.
- 2026-03-08 sentiment GBPNZD: raw_provider_evidence_missing:GBPNZD.
- 2026-03-08 sentiment GBPUSD: raw_provider_evidence_missing:GBPUSD.
- 2026-03-08 sentiment NDXUSD: raw_provider_evidence_missing:NDXUSD.
- 2026-03-08 sentiment NIKKEIUSD: raw_provider_evidence_missing:NIKKEIUSD.
- 2026-03-08 sentiment NZDCAD: raw_provider_evidence_missing:NZDCAD.
- 2026-03-08 sentiment NZDCHF: raw_provider_evidence_missing:NZDCHF.
- 2026-03-08 sentiment NZDJPY: raw_provider_evidence_missing:NZDJPY.
- 2026-03-08 sentiment NZDUSD: raw_provider_evidence_missing:NZDUSD.
- 2026-03-08 sentiment SPXUSD: raw_provider_evidence_missing:SPXUSD.
- 2026-03-08 sentiment USDCAD: raw_provider_evidence_missing:USDCAD.
- 2026-03-08 sentiment USDCHF: raw_provider_evidence_missing:USDCHF.
- 2026-03-08 sentiment USDJPY: raw_provider_evidence_missing:USDJPY.
- 2026-03-08 sentiment WTIUSD: raw_provider_evidence_missing:WTIUSD.
- 2026-03-08 sentiment XAGUSD: raw_provider_evidence_missing:XAGUSD.
- 2026-03-08 sentiment XAUUSD: raw_provider_evidence_missing:XAUUSD.
- 2026-03-15 sentiment AUDCAD: raw_provider_evidence_missing:AUDCAD.
- 2026-03-15 sentiment AUDCHF: raw_provider_evidence_missing:AUDCHF.
- 2026-03-15 sentiment AUDJPY: raw_provider_evidence_missing:AUDJPY.
- 2026-03-15 sentiment AUDNZD: raw_provider_evidence_missing:AUDNZD.
- 2026-03-15 sentiment AUDUSD: raw_provider_evidence_missing:AUDUSD.
- 2026-03-15 sentiment BTCUSD: raw_provider_evidence_missing:BTCUSD.
- 2026-03-15 sentiment CADCHF: raw_provider_evidence_missing:CADCHF.
- 2026-03-15 sentiment CADJPY: raw_provider_evidence_missing:CADJPY.
- 2026-03-15 sentiment CHFJPY: raw_provider_evidence_missing:CHFJPY.
- 2026-03-15 sentiment ETHUSD: raw_provider_evidence_missing:ETHUSD.
- 2026-03-15 sentiment EURAUD: raw_provider_evidence_missing:EURAUD.
- 2026-03-15 sentiment EURCAD: raw_provider_evidence_missing:EURCAD.
- 2026-03-15 sentiment EURCHF: raw_provider_evidence_missing:EURCHF.
- 2026-03-15 sentiment EURGBP: raw_provider_evidence_missing:EURGBP.
- 2026-03-15 sentiment EURJPY: raw_provider_evidence_missing:EURJPY.
- 2026-03-15 sentiment EURNZD: raw_provider_evidence_missing:EURNZD.
- 2026-03-15 sentiment EURUSD: raw_provider_evidence_missing:EURUSD.
- 2026-03-15 sentiment GBPAUD: raw_provider_evidence_missing:GBPAUD.
- 2026-03-15 sentiment GBPCAD: raw_provider_evidence_missing:GBPCAD.
- 2026-03-15 sentiment GBPCHF: raw_provider_evidence_missing:GBPCHF.
- 2026-03-15 sentiment GBPJPY: raw_provider_evidence_missing:GBPJPY.
- 2026-03-15 sentiment GBPNZD: raw_provider_evidence_missing:GBPNZD.
- 2026-03-15 sentiment GBPUSD: raw_provider_evidence_missing:GBPUSD.
- 2026-03-15 sentiment NDXUSD: raw_provider_evidence_missing:NDXUSD.
- 2026-03-15 sentiment NIKKEIUSD: raw_provider_evidence_missing:NIKKEIUSD.
- 2026-03-15 sentiment NZDCAD: raw_provider_evidence_missing:NZDCAD.
- 2026-03-15 sentiment NZDCHF: raw_provider_evidence_missing:NZDCHF.
- 2026-03-15 sentiment NZDJPY: raw_provider_evidence_missing:NZDJPY.
- 2026-03-15 sentiment NZDUSD: raw_provider_evidence_missing:NZDUSD.
- 2026-03-15 sentiment SPXUSD: raw_provider_evidence_missing:SPXUSD.
- 2026-03-15 sentiment USDCAD: raw_provider_evidence_missing:USDCAD.
- 2026-03-15 sentiment USDCHF: raw_provider_evidence_missing:USDCHF.
- 2026-03-15 sentiment USDJPY: raw_provider_evidence_missing:USDJPY.
- 2026-03-15 sentiment WTIUSD: raw_provider_evidence_missing:WTIUSD.
- 2026-03-15 sentiment XAGUSD: raw_provider_evidence_missing:XAGUSD.
- 2026-03-15 sentiment XAUUSD: raw_provider_evidence_missing:XAUUSD.
- 2026-03-22 sentiment AUDCAD: raw_provider_evidence_missing:AUDCAD.
- 2026-03-22 sentiment AUDCHF: raw_provider_evidence_missing:AUDCHF.
- 2026-03-22 sentiment AUDJPY: raw_provider_evidence_missing:AUDJPY.
- 2026-03-22 sentiment AUDNZD: raw_provider_evidence_missing:AUDNZD.
- 2026-03-22 sentiment AUDUSD: raw_provider_evidence_missing:AUDUSD.
- 2026-03-22 sentiment BTCUSD: raw_provider_evidence_missing:BTCUSD.
- 2026-03-22 sentiment CADCHF: raw_provider_evidence_missing:CADCHF.
- 2026-03-22 sentiment CADJPY: raw_provider_evidence_missing:CADJPY.
- 2026-03-22 sentiment CHFJPY: raw_provider_evidence_missing:CHFJPY.
- 2026-03-22 sentiment ETHUSD: raw_provider_evidence_missing:ETHUSD.
- 2026-03-22 sentiment EURAUD: raw_provider_evidence_missing:EURAUD.
- 2026-03-22 sentiment EURCAD: raw_provider_evidence_missing:EURCAD.
- 2026-03-22 sentiment EURCHF: raw_provider_evidence_missing:EURCHF.
- 2026-03-22 sentiment EURGBP: raw_provider_evidence_missing:EURGBP.
- 2026-03-22 sentiment EURJPY: raw_provider_evidence_missing:EURJPY.
- 2026-03-22 sentiment EURNZD: raw_provider_evidence_missing:EURNZD.
- 2026-03-22 sentiment EURUSD: raw_provider_evidence_missing:EURUSD.
- 2026-03-22 sentiment GBPAUD: raw_provider_evidence_missing:GBPAUD.
- 2026-03-22 sentiment GBPCAD: raw_provider_evidence_missing:GBPCAD.
- 2026-03-22 sentiment GBPCHF: raw_provider_evidence_missing:GBPCHF.
- 2026-03-22 sentiment GBPJPY: raw_provider_evidence_missing:GBPJPY.
- 2026-03-22 sentiment GBPNZD: raw_provider_evidence_missing:GBPNZD.
- 2026-03-22 sentiment GBPUSD: raw_provider_evidence_missing:GBPUSD.
- 2026-03-22 sentiment NDXUSD: raw_provider_evidence_missing:NDXUSD.
- 2026-03-22 sentiment NIKKEIUSD: raw_provider_evidence_missing:NIKKEIUSD.
- 2026-03-22 sentiment NZDCAD: raw_provider_evidence_missing:NZDCAD.
- 2026-03-22 sentiment NZDCHF: raw_provider_evidence_missing:NZDCHF.
- 2026-03-22 sentiment NZDJPY: raw_provider_evidence_missing:NZDJPY.
- 2026-03-22 sentiment NZDUSD: raw_provider_evidence_missing:NZDUSD.
- 2026-03-22 sentiment SPXUSD: raw_provider_evidence_missing:SPXUSD.
- 2026-03-22 sentiment USDCAD: raw_provider_evidence_missing:USDCAD.
- 2026-03-22 sentiment USDCHF: raw_provider_evidence_missing:USDCHF.
- 2026-03-22 sentiment USDJPY: raw_provider_evidence_missing:USDJPY.
- 2026-03-22 sentiment WTIUSD: raw_provider_evidence_missing:WTIUSD.
- 2026-03-22 sentiment XAGUSD: raw_provider_evidence_missing:XAGUSD.
- 2026-03-22 sentiment XAUUSD: raw_provider_evidence_missing:XAUUSD.
- 2026-03-29 sentiment AUDCAD: raw_provider_evidence_missing:AUDCAD.
- 2026-03-29 sentiment AUDCHF: raw_provider_evidence_missing:AUDCHF.
- 2026-03-29 sentiment AUDJPY: raw_provider_evidence_missing:AUDJPY.
- 2026-03-29 sentiment AUDNZD: raw_provider_evidence_missing:AUDNZD.
- 2026-03-29 sentiment AUDUSD: raw_provider_evidence_missing:AUDUSD.
- 2026-03-29 sentiment BTCUSD: raw_provider_evidence_missing:BTCUSD.
- 2026-03-29 sentiment CADCHF: raw_provider_evidence_missing:CADCHF.
- 2026-03-29 sentiment CADJPY: raw_provider_evidence_missing:CADJPY.
- 2026-03-29 sentiment CHFJPY: raw_provider_evidence_missing:CHFJPY.
- 2026-03-29 sentiment ETHUSD: raw_provider_evidence_missing:ETHUSD.
- 2026-03-29 sentiment EURAUD: raw_provider_evidence_missing:EURAUD.
- 2026-03-29 sentiment EURCAD: raw_provider_evidence_missing:EURCAD.
- 2026-03-29 sentiment EURCHF: raw_provider_evidence_missing:EURCHF.
- 2026-03-29 sentiment EURGBP: raw_provider_evidence_missing:EURGBP.
- 2026-03-29 sentiment EURJPY: raw_provider_evidence_missing:EURJPY.
- 2026-03-29 sentiment EURNZD: raw_provider_evidence_missing:EURNZD.
- 2026-03-29 sentiment EURUSD: raw_provider_evidence_missing:EURUSD.
- 2026-03-29 sentiment GBPAUD: raw_provider_evidence_missing:GBPAUD.
- 2026-03-29 sentiment GBPCAD: raw_provider_evidence_missing:GBPCAD.
- 2026-03-29 sentiment GBPCHF: raw_provider_evidence_missing:GBPCHF.
- 2026-03-29 sentiment GBPJPY: raw_provider_evidence_missing:GBPJPY.
- 2026-03-29 sentiment GBPNZD: raw_provider_evidence_missing:GBPNZD.
- 2026-03-29 sentiment GBPUSD: raw_provider_evidence_missing:GBPUSD.
- 2026-03-29 sentiment NDXUSD: raw_provider_evidence_missing:NDXUSD.
- 2026-03-29 sentiment NIKKEIUSD: raw_provider_evidence_missing:NIKKEIUSD.
- 2026-03-29 sentiment NZDCAD: raw_provider_evidence_missing:NZDCAD.
- 2026-03-29 sentiment NZDCHF: raw_provider_evidence_missing:NZDCHF.
- 2026-03-29 sentiment NZDJPY: raw_provider_evidence_missing:NZDJPY.
- 2026-03-29 sentiment NZDUSD: raw_provider_evidence_missing:NZDUSD.
- 2026-03-29 sentiment SPXUSD: raw_provider_evidence_missing:SPXUSD.
- 2026-03-29 sentiment USDCAD: raw_provider_evidence_missing:USDCAD.
- 2026-03-29 sentiment USDCHF: raw_provider_evidence_missing:USDCHF.
- 2026-03-29 sentiment USDJPY: raw_provider_evidence_missing:USDJPY.
- 2026-03-29 sentiment WTIUSD: raw_provider_evidence_missing:WTIUSD.
- 2026-03-29 sentiment XAGUSD: raw_provider_evidence_missing:XAGUSD.
- 2026-03-29 sentiment XAUUSD: raw_provider_evidence_missing:XAUUSD.
- 2026-04-05 sentiment AUDCAD: raw_provider_evidence_missing:AUDCAD.
- 2026-04-05 sentiment AUDCHF: raw_provider_evidence_missing:AUDCHF.
- 2026-04-05 sentiment AUDJPY: raw_provider_evidence_missing:AUDJPY.
- 2026-04-05 sentiment AUDNZD: raw_provider_evidence_missing:AUDNZD.
- 2026-04-05 sentiment AUDUSD: raw_provider_evidence_missing:AUDUSD.
- 2026-04-05 sentiment BTCUSD: raw_provider_evidence_missing:BTCUSD.
- 2026-04-05 sentiment CADCHF: raw_provider_evidence_missing:CADCHF.
- 2026-04-05 sentiment CADJPY: raw_provider_evidence_missing:CADJPY.
- 2026-04-05 sentiment CHFJPY: raw_provider_evidence_missing:CHFJPY.
- 2026-04-05 sentiment ETHUSD: raw_provider_evidence_missing:ETHUSD.
- 2026-04-05 sentiment EURAUD: raw_provider_evidence_missing:EURAUD.
- 2026-04-05 sentiment EURCAD: raw_provider_evidence_missing:EURCAD.
- 2026-04-05 sentiment EURCHF: raw_provider_evidence_missing:EURCHF.
- 2026-04-05 sentiment EURGBP: raw_provider_evidence_missing:EURGBP.
- 2026-04-05 sentiment EURJPY: raw_provider_evidence_missing:EURJPY.
- 2026-04-05 sentiment EURNZD: raw_provider_evidence_missing:EURNZD.
- 2026-04-05 sentiment EURUSD: raw_provider_evidence_missing:EURUSD.
- 2026-04-05 sentiment GBPAUD: raw_provider_evidence_missing:GBPAUD.
- 2026-04-05 sentiment GBPCAD: raw_provider_evidence_missing:GBPCAD.
- 2026-04-05 sentiment GBPCHF: raw_provider_evidence_missing:GBPCHF.
- 2026-04-05 sentiment GBPJPY: raw_provider_evidence_missing:GBPJPY.
- 2026-04-05 sentiment GBPNZD: raw_provider_evidence_missing:GBPNZD.
- 2026-04-05 sentiment GBPUSD: raw_provider_evidence_missing:GBPUSD.
- 2026-04-05 sentiment NDXUSD: raw_provider_evidence_missing:NDXUSD.
- 2026-04-05 sentiment NIKKEIUSD: raw_provider_evidence_missing:NIKKEIUSD.
- 2026-04-05 sentiment NZDCAD: raw_provider_evidence_missing:NZDCAD.
- 2026-04-05 sentiment NZDCHF: raw_provider_evidence_missing:NZDCHF.
- 2026-04-05 sentiment NZDJPY: raw_provider_evidence_missing:NZDJPY.
- 2026-04-05 sentiment NZDUSD: raw_provider_evidence_missing:NZDUSD.
- 2026-04-05 sentiment SPXUSD: raw_provider_evidence_missing:SPXUSD.
- 2026-04-05 sentiment USDCAD: raw_provider_evidence_missing:USDCAD.
- 2026-04-05 sentiment USDCHF: raw_provider_evidence_missing:USDCHF.
- 2026-04-05 sentiment USDJPY: raw_provider_evidence_missing:USDJPY.
- 2026-04-05 sentiment WTIUSD: raw_provider_evidence_missing:WTIUSD.
- 2026-04-05 sentiment XAGUSD: raw_provider_evidence_missing:XAGUSD.
- 2026-04-05 sentiment XAUUSD: raw_provider_evidence_missing:XAUUSD.
- 2026-04-12 sentiment AUDCAD: raw_provider_evidence_missing:AUDCAD.
- 2026-04-12 sentiment AUDCHF: raw_provider_evidence_missing:AUDCHF.
- 2026-04-12 sentiment AUDJPY: raw_provider_evidence_missing:AUDJPY.
- 2026-04-12 sentiment AUDNZD: raw_provider_evidence_missing:AUDNZD.
- 2026-04-12 sentiment AUDUSD: raw_provider_evidence_missing:AUDUSD.
- 2026-04-12 sentiment BTCUSD: raw_provider_evidence_missing:BTCUSD.
- 2026-04-12 sentiment CADCHF: raw_provider_evidence_missing:CADCHF.
- 2026-04-12 sentiment CADJPY: raw_provider_evidence_missing:CADJPY.
- 2026-04-12 sentiment CHFJPY: raw_provider_evidence_missing:CHFJPY.
- 2026-04-12 sentiment ETHUSD: raw_provider_evidence_missing:ETHUSD.
- 2026-04-12 sentiment EURAUD: raw_provider_evidence_missing:EURAUD.
- 2026-04-12 sentiment EURCAD: raw_provider_evidence_missing:EURCAD.
- 2026-04-12 sentiment EURCHF: raw_provider_evidence_missing:EURCHF.
- 2026-04-12 sentiment EURGBP: raw_provider_evidence_missing:EURGBP.
- 2026-04-12 sentiment EURJPY: raw_provider_evidence_missing:EURJPY.
- 2026-04-12 sentiment EURNZD: raw_provider_evidence_missing:EURNZD.
- 2026-04-12 sentiment EURUSD: raw_provider_evidence_missing:EURUSD.
- 2026-04-12 sentiment GBPAUD: raw_provider_evidence_missing:GBPAUD.
- 2026-04-12 sentiment GBPCAD: raw_provider_evidence_missing:GBPCAD.
- 2026-04-12 sentiment GBPCHF: raw_provider_evidence_missing:GBPCHF.
- 2026-04-12 sentiment GBPJPY: raw_provider_evidence_missing:GBPJPY.
- 2026-04-12 sentiment GBPNZD: raw_provider_evidence_missing:GBPNZD.
- 2026-04-12 sentiment GBPUSD: raw_provider_evidence_missing:GBPUSD.
- 2026-04-12 sentiment NDXUSD: raw_provider_evidence_missing:NDXUSD.
- 2026-04-12 sentiment NIKKEIUSD: raw_provider_evidence_missing:NIKKEIUSD.
- 2026-04-12 sentiment NZDCAD: raw_provider_evidence_missing:NZDCAD.
- 2026-04-12 sentiment NZDCHF: raw_provider_evidence_missing:NZDCHF.
- 2026-04-12 sentiment NZDJPY: raw_provider_evidence_missing:NZDJPY.
- 2026-04-12 sentiment NZDUSD: raw_provider_evidence_missing:NZDUSD.
- 2026-04-12 sentiment SPXUSD: raw_provider_evidence_missing:SPXUSD.
- 2026-04-12 sentiment USDCAD: raw_provider_evidence_missing:USDCAD.
- 2026-04-12 sentiment USDCHF: raw_provider_evidence_missing:USDCHF.
- 2026-04-12 sentiment USDJPY: raw_provider_evidence_missing:USDJPY.
- 2026-04-12 sentiment WTIUSD: raw_provider_evidence_missing:WTIUSD.
- 2026-04-12 sentiment XAGUSD: raw_provider_evidence_missing:XAGUSD.
- 2026-04-12 sentiment XAUUSD: raw_provider_evidence_missing:XAUUSD.
- 2026-04-19 sentiment AUDCAD: raw_provider_evidence_missing:AUDCAD.
- 2026-04-19 sentiment AUDCHF: raw_provider_evidence_missing:AUDCHF.
- 2026-04-19 sentiment AUDJPY: raw_provider_evidence_missing:AUDJPY.
- 2026-04-19 sentiment AUDNZD: raw_provider_evidence_missing:AUDNZD.
- 2026-04-19 sentiment AUDUSD: raw_provider_evidence_missing:AUDUSD.
- 2026-04-19 sentiment BTCUSD: raw_provider_evidence_missing:BTCUSD.
- 2026-04-19 sentiment CADCHF: raw_provider_evidence_missing:CADCHF.
- 2026-04-19 sentiment CADJPY: raw_provider_evidence_missing:CADJPY.
- 2026-04-19 sentiment CHFJPY: raw_provider_evidence_missing:CHFJPY.
- 2026-04-19 sentiment ETHUSD: raw_provider_evidence_missing:ETHUSD.
- 2026-04-19 sentiment EURAUD: raw_provider_evidence_missing:EURAUD.
- 2026-04-19 sentiment EURCAD: raw_provider_evidence_missing:EURCAD.
- 2026-04-19 sentiment EURCHF: raw_provider_evidence_missing:EURCHF.
- 2026-04-19 sentiment EURGBP: raw_provider_evidence_missing:EURGBP.
- 2026-04-19 sentiment EURJPY: raw_provider_evidence_missing:EURJPY.
- 2026-04-19 sentiment EURNZD: raw_provider_evidence_missing:EURNZD.
- 2026-04-19 sentiment EURUSD: raw_provider_evidence_missing:EURUSD.
- 2026-04-19 sentiment GBPAUD: raw_provider_evidence_missing:GBPAUD.
- 2026-04-19 sentiment GBPCAD: raw_provider_evidence_missing:GBPCAD.
- 2026-04-19 sentiment GBPCHF: raw_provider_evidence_missing:GBPCHF.
- 2026-04-19 sentiment GBPJPY: raw_provider_evidence_missing:GBPJPY.
- 2026-04-19 sentiment GBPNZD: raw_provider_evidence_missing:GBPNZD.
- 2026-04-19 sentiment GBPUSD: raw_provider_evidence_missing:GBPUSD.
- 2026-04-19 sentiment NDXUSD: raw_provider_evidence_missing:NDXUSD.
- 2026-04-19 sentiment NIKKEIUSD: raw_provider_evidence_missing:NIKKEIUSD.
- 2026-04-19 sentiment NZDCAD: raw_provider_evidence_missing:NZDCAD.
- 2026-04-19 sentiment NZDCHF: raw_provider_evidence_missing:NZDCHF.
- 2026-04-19 sentiment NZDJPY: raw_provider_evidence_missing:NZDJPY.
- 2026-04-19 sentiment NZDUSD: raw_provider_evidence_missing:NZDUSD.
- 2026-04-19 sentiment SPXUSD: raw_provider_evidence_missing:SPXUSD.
- 2026-04-19 sentiment USDCAD: raw_provider_evidence_missing:USDCAD.
- 2026-04-19 sentiment USDCHF: raw_provider_evidence_missing:USDCHF.
- 2026-04-19 sentiment USDJPY: raw_provider_evidence_missing:USDJPY.
- 2026-04-19 sentiment WTIUSD: raw_provider_evidence_missing:WTIUSD.
- 2026-04-19 sentiment XAGUSD: raw_provider_evidence_missing:XAGUSD.
- 2026-04-19 sentiment XAUUSD: raw_provider_evidence_missing:XAUUSD.
- 2026-04-26 sentiment AUDCAD: raw_provider_evidence_missing:AUDCAD.
- 2026-04-26 sentiment AUDCHF: raw_provider_evidence_missing:AUDCHF.
- 2026-04-26 sentiment AUDJPY: raw_provider_evidence_missing:AUDJPY.
- 2026-04-26 sentiment AUDNZD: raw_provider_evidence_missing:AUDNZD.
- 2026-04-26 sentiment AUDUSD: raw_provider_evidence_missing:AUDUSD.
- 2026-04-26 sentiment BTCUSD: raw_provider_evidence_missing:BTCUSD.
- 2026-04-26 sentiment CADCHF: raw_provider_evidence_missing:CADCHF.
- 2026-04-26 sentiment CADJPY: raw_provider_evidence_missing:CADJPY.
- 2026-04-26 sentiment CHFJPY: raw_provider_evidence_missing:CHFJPY.
- 2026-04-26 sentiment ETHUSD: raw_provider_evidence_missing:ETHUSD.
- 2026-04-26 sentiment EURAUD: raw_provider_evidence_missing:EURAUD.
- 2026-04-26 sentiment EURCAD: raw_provider_evidence_missing:EURCAD.
- 2026-04-26 sentiment EURCHF: raw_provider_evidence_missing:EURCHF.
- 2026-04-26 sentiment EURGBP: raw_provider_evidence_missing:EURGBP.
- 2026-04-26 sentiment EURJPY: raw_provider_evidence_missing:EURJPY.
- 2026-04-26 sentiment EURNZD: raw_provider_evidence_missing:EURNZD.
- 2026-04-26 sentiment EURUSD: raw_provider_evidence_missing:EURUSD.
- 2026-04-26 sentiment GBPAUD: raw_provider_evidence_missing:GBPAUD.
- 2026-04-26 sentiment GBPCAD: raw_provider_evidence_missing:GBPCAD.
- 2026-04-26 sentiment GBPCHF: raw_provider_evidence_missing:GBPCHF.
- 2026-04-26 sentiment GBPJPY: raw_provider_evidence_missing:GBPJPY.
- 2026-04-26 sentiment GBPNZD: raw_provider_evidence_missing:GBPNZD.
- 2026-04-26 sentiment GBPUSD: raw_provider_evidence_missing:GBPUSD.
- 2026-04-26 sentiment NDXUSD: raw_provider_evidence_missing:NDXUSD.
- 2026-04-26 sentiment NIKKEIUSD: raw_provider_evidence_missing:NIKKEIUSD.
- 2026-04-26 sentiment NZDCAD: raw_provider_evidence_missing:NZDCAD.
- 2026-04-26 sentiment NZDCHF: raw_provider_evidence_missing:NZDCHF.
- 2026-04-26 sentiment NZDJPY: raw_provider_evidence_missing:NZDJPY.
- 2026-04-26 sentiment NZDUSD: raw_provider_evidence_missing:NZDUSD.
- 2026-04-26 sentiment SPXUSD: raw_provider_evidence_missing:SPXUSD.
- 2026-04-26 sentiment USDCAD: raw_provider_evidence_missing:USDCAD.
- 2026-04-26 sentiment USDCHF: raw_provider_evidence_missing:USDCHF.
- 2026-04-26 sentiment USDJPY: raw_provider_evidence_missing:USDJPY.
- 2026-04-26 sentiment WTIUSD: raw_provider_evidence_missing:WTIUSD.
- 2026-04-26 sentiment XAGUSD: raw_provider_evidence_missing:XAGUSD.
- 2026-04-26 sentiment XAUUSD: raw_provider_evidence_missing:XAUUSD.
- 2026-05-03 sentiment AUDCAD: raw_provider_evidence_missing:AUDCAD.
- 2026-05-03 sentiment AUDCHF: raw_provider_evidence_missing:AUDCHF.
- 2026-05-03 sentiment AUDJPY: raw_provider_evidence_missing:AUDJPY.
- 2026-05-03 sentiment AUDNZD: raw_provider_evidence_missing:AUDNZD.
- 2026-05-03 sentiment AUDUSD: raw_provider_evidence_missing:AUDUSD.
- 2026-05-03 sentiment BTCUSD: raw_provider_evidence_missing:BTCUSD.
- 2026-05-03 sentiment CADCHF: raw_provider_evidence_missing:CADCHF.
- 2026-05-03 sentiment CADJPY: raw_provider_evidence_missing:CADJPY.
- 2026-05-03 sentiment CHFJPY: raw_provider_evidence_missing:CHFJPY.
- 2026-05-03 sentiment ETHUSD: raw_provider_evidence_missing:ETHUSD.
- 2026-05-03 sentiment EURAUD: raw_provider_evidence_missing:EURAUD.
- 2026-05-03 sentiment EURCAD: raw_provider_evidence_missing:EURCAD.
- 2026-05-03 sentiment EURCHF: raw_provider_evidence_missing:EURCHF.
- 2026-05-03 sentiment EURGBP: raw_provider_evidence_missing:EURGBP.
- 2026-05-03 sentiment EURJPY: raw_provider_evidence_missing:EURJPY.
- 2026-05-03 sentiment EURNZD: raw_provider_evidence_missing:EURNZD.
- 2026-05-03 sentiment EURUSD: raw_provider_evidence_missing:EURUSD.
- 2026-05-03 sentiment GBPAUD: raw_provider_evidence_missing:GBPAUD.
- 2026-05-03 sentiment GBPCAD: raw_provider_evidence_missing:GBPCAD.
- 2026-05-03 sentiment GBPCHF: raw_provider_evidence_missing:GBPCHF.
- 2026-05-03 sentiment GBPJPY: raw_provider_evidence_missing:GBPJPY.
- 2026-05-03 sentiment GBPNZD: raw_provider_evidence_missing:GBPNZD.
- 2026-05-03 sentiment GBPUSD: raw_provider_evidence_missing:GBPUSD.
- 2026-05-03 sentiment NDXUSD: raw_provider_evidence_missing:NDXUSD.
- 2026-05-03 sentiment NIKKEIUSD: raw_provider_evidence_missing:NIKKEIUSD.
- 2026-05-03 sentiment NZDCAD: raw_provider_evidence_missing:NZDCAD.
- 2026-05-03 sentiment NZDCHF: raw_provider_evidence_missing:NZDCHF.
- 2026-05-03 sentiment NZDJPY: raw_provider_evidence_missing:NZDJPY.
- 2026-05-03 sentiment NZDUSD: raw_provider_evidence_missing:NZDUSD.
- 2026-05-03 sentiment SPXUSD: raw_provider_evidence_missing:SPXUSD.
- 2026-05-03 sentiment USDCAD: raw_provider_evidence_missing:USDCAD.
- 2026-05-03 sentiment USDCHF: raw_provider_evidence_missing:USDCHF.
- 2026-05-03 sentiment USDJPY: raw_provider_evidence_missing:USDJPY.
- 2026-05-03 sentiment WTIUSD: raw_provider_evidence_missing:WTIUSD.
- 2026-05-03 sentiment XAGUSD: raw_provider_evidence_missing:XAGUSD.
- 2026-05-03 sentiment XAUUSD: raw_provider_evidence_missing:XAUUSD.
- 2026-05-10 sentiment AUDCAD: raw_provider_evidence_missing:AUDCAD.
- 2026-05-10 sentiment AUDCHF: raw_provider_evidence_missing:AUDCHF.
- 2026-05-10 sentiment AUDJPY: raw_provider_evidence_missing:AUDJPY.
- 2026-05-10 sentiment AUDNZD: raw_provider_evidence_missing:AUDNZD.
- 2026-05-10 sentiment AUDUSD: raw_provider_evidence_missing:AUDUSD.
- 2026-05-10 sentiment BTCUSD: raw_provider_evidence_missing:BTCUSD.
- 2026-05-10 sentiment CADCHF: raw_provider_evidence_missing:CADCHF.
- 2026-05-10 sentiment CADJPY: raw_provider_evidence_missing:CADJPY.
- 2026-05-10 sentiment CHFJPY: raw_provider_evidence_missing:CHFJPY.
- 2026-05-10 sentiment ETHUSD: raw_provider_evidence_missing:ETHUSD.
- 2026-05-10 sentiment EURAUD: raw_provider_evidence_missing:EURAUD.
- 2026-05-10 sentiment EURCAD: raw_provider_evidence_missing:EURCAD.
- 2026-05-10 sentiment EURCHF: raw_provider_evidence_missing:EURCHF.
- 2026-05-10 sentiment EURGBP: raw_provider_evidence_missing:EURGBP.
- 2026-05-10 sentiment EURJPY: raw_provider_evidence_missing:EURJPY.
- 2026-05-10 sentiment EURNZD: raw_provider_evidence_missing:EURNZD.
- 2026-05-10 sentiment EURUSD: raw_provider_evidence_missing:EURUSD.
- 2026-05-10 sentiment GBPAUD: raw_provider_evidence_missing:GBPAUD.
- 2026-05-10 sentiment GBPCAD: raw_provider_evidence_missing:GBPCAD.
- 2026-05-10 sentiment GBPCHF: raw_provider_evidence_missing:GBPCHF.
- 2026-05-10 sentiment GBPJPY: raw_provider_evidence_missing:GBPJPY.
- 2026-05-10 sentiment GBPNZD: raw_provider_evidence_missing:GBPNZD.
- 2026-05-10 sentiment GBPUSD: raw_provider_evidence_missing:GBPUSD.
- 2026-05-10 sentiment NDXUSD: raw_provider_evidence_missing:NDXUSD.
- 2026-05-10 sentiment NIKKEIUSD: raw_provider_evidence_missing:NIKKEIUSD.
- 2026-05-10 sentiment NZDCAD: raw_provider_evidence_missing:NZDCAD.
- 2026-05-10 sentiment NZDCHF: raw_provider_evidence_missing:NZDCHF.
- 2026-05-10 sentiment NZDJPY: raw_provider_evidence_missing:NZDJPY.
- 2026-05-10 sentiment NZDUSD: raw_provider_evidence_missing:NZDUSD.
- 2026-05-10 sentiment SPXUSD: raw_provider_evidence_missing:SPXUSD.
- 2026-05-10 sentiment USDCAD: raw_provider_evidence_missing:USDCAD.
- 2026-05-10 sentiment USDCHF: raw_provider_evidence_missing:USDCHF.
- 2026-05-10 sentiment USDJPY: raw_provider_evidence_missing:USDJPY.
- 2026-05-10 sentiment WTIUSD: raw_provider_evidence_missing:WTIUSD.
- 2026-05-10 sentiment XAGUSD: raw_provider_evidence_missing:XAGUSD.
- 2026-05-10 sentiment XAUUSD: raw_provider_evidence_missing:XAUUSD.
- 2026-05-17 sentiment AUDCAD: raw_provider_evidence_missing:AUDCAD.
- 2026-05-17 sentiment AUDCHF: raw_provider_evidence_missing:AUDCHF.
- 2026-05-17 sentiment AUDJPY: raw_provider_evidence_missing:AUDJPY.
- 2026-05-17 sentiment AUDNZD: raw_provider_evidence_missing:AUDNZD.
- 2026-05-17 sentiment AUDUSD: raw_provider_evidence_missing:AUDUSD.
- 2026-05-17 sentiment BTCUSD: raw_provider_evidence_missing:BTCUSD.
- 2026-05-17 sentiment CADCHF: raw_provider_evidence_missing:CADCHF.
- 2026-05-17 sentiment CADJPY: raw_provider_evidence_missing:CADJPY.
- 2026-05-17 sentiment CHFJPY: raw_provider_evidence_missing:CHFJPY.
- 2026-05-17 sentiment ETHUSD: raw_provider_evidence_missing:ETHUSD.
- 2026-05-17 sentiment EURAUD: raw_provider_evidence_missing:EURAUD.
- 2026-05-17 sentiment EURCAD: raw_provider_evidence_missing:EURCAD.
- 2026-05-17 sentiment EURCHF: raw_provider_evidence_missing:EURCHF.
- 2026-05-17 sentiment EURGBP: raw_provider_evidence_missing:EURGBP.
- 2026-05-17 sentiment EURJPY: raw_provider_evidence_missing:EURJPY.
- 2026-05-17 sentiment EURNZD: raw_provider_evidence_missing:EURNZD.
- 2026-05-17 sentiment EURUSD: raw_provider_evidence_missing:EURUSD.
- 2026-05-17 sentiment GBPAUD: raw_provider_evidence_missing:GBPAUD.
- 2026-05-17 sentiment GBPCAD: raw_provider_evidence_missing:GBPCAD.
- 2026-05-17 sentiment GBPCHF: raw_provider_evidence_missing:GBPCHF.
- 2026-05-17 sentiment GBPJPY: raw_provider_evidence_missing:GBPJPY.
- 2026-05-17 sentiment GBPNZD: raw_provider_evidence_missing:GBPNZD.
- 2026-05-17 sentiment GBPUSD: raw_provider_evidence_missing:GBPUSD.
- 2026-05-17 sentiment NDXUSD: raw_provider_evidence_missing:NDXUSD.
- 2026-05-17 sentiment NIKKEIUSD: raw_provider_evidence_missing:NIKKEIUSD.
- 2026-05-17 sentiment NZDCAD: raw_provider_evidence_missing:NZDCAD.
- 2026-05-17 sentiment NZDCHF: raw_provider_evidence_missing:NZDCHF.
- 2026-05-17 sentiment NZDJPY: raw_provider_evidence_missing:NZDJPY.
- 2026-05-17 sentiment NZDUSD: raw_provider_evidence_missing:NZDUSD.
- 2026-05-17 sentiment SPXUSD: raw_provider_evidence_missing:SPXUSD.
- 2026-05-17 sentiment USDCAD: raw_provider_evidence_missing:USDCAD.
- 2026-05-17 sentiment USDCHF: raw_provider_evidence_missing:USDCHF.
- 2026-05-17 sentiment USDJPY: raw_provider_evidence_missing:USDJPY.
- 2026-05-17 sentiment WTIUSD: raw_provider_evidence_missing:WTIUSD.
- 2026-05-17 sentiment XAGUSD: raw_provider_evidence_missing:XAGUSD.
- 2026-05-17 sentiment XAUUSD: raw_provider_evidence_missing:XAUUSD.
- 2026-05-24 sentiment AUDCAD: raw_provider_evidence_missing:AUDCAD.
- 2026-05-24 sentiment AUDCHF: raw_provider_evidence_missing:AUDCHF.
- 2026-05-24 sentiment AUDJPY: raw_provider_evidence_missing:AUDJPY.
- 2026-05-24 sentiment AUDNZD: raw_provider_evidence_missing:AUDNZD.
- 2026-05-24 sentiment AUDUSD: raw_provider_evidence_missing:AUDUSD.
- 2026-05-24 sentiment BTCUSD: raw_provider_evidence_missing:BTCUSD.
- 2026-05-24 sentiment CADCHF: raw_provider_evidence_missing:CADCHF.
- 2026-05-24 sentiment CADJPY: raw_provider_evidence_missing:CADJPY.
- 2026-05-24 sentiment CHFJPY: raw_provider_evidence_missing:CHFJPY.
- 2026-05-24 sentiment ETHUSD: raw_provider_evidence_missing:ETHUSD.
- 2026-05-24 sentiment EURAUD: raw_provider_evidence_missing:EURAUD.
- 2026-05-24 sentiment EURCAD: raw_provider_evidence_missing:EURCAD.
- 2026-05-24 sentiment EURCHF: raw_provider_evidence_missing:EURCHF.
- 2026-05-24 sentiment EURGBP: raw_provider_evidence_missing:EURGBP.
- 2026-05-24 sentiment EURJPY: raw_provider_evidence_missing:EURJPY.
- 2026-05-24 sentiment EURNZD: raw_provider_evidence_missing:EURNZD.
- 2026-05-24 sentiment EURUSD: raw_provider_evidence_missing:EURUSD.
- 2026-05-24 sentiment GBPAUD: raw_provider_evidence_missing:GBPAUD.
- 2026-05-24 sentiment GBPCAD: raw_provider_evidence_missing:GBPCAD.
- 2026-05-24 sentiment GBPCHF: raw_provider_evidence_missing:GBPCHF.
- 2026-05-24 sentiment GBPJPY: raw_provider_evidence_missing:GBPJPY.
- 2026-05-24 sentiment GBPNZD: raw_provider_evidence_missing:GBPNZD.
- 2026-05-24 sentiment GBPUSD: raw_provider_evidence_missing:GBPUSD.
- 2026-05-24 sentiment NDXUSD: raw_provider_evidence_missing:NDXUSD.
- 2026-05-24 sentiment NIKKEIUSD: raw_provider_evidence_missing:NIKKEIUSD.
- 2026-05-24 sentiment NZDCAD: raw_provider_evidence_missing:NZDCAD.
- 2026-05-24 sentiment NZDCHF: raw_provider_evidence_missing:NZDCHF.
- 2026-05-24 sentiment NZDJPY: raw_provider_evidence_missing:NZDJPY.
- 2026-05-24 sentiment NZDUSD: raw_provider_evidence_missing:NZDUSD.
- 2026-05-24 sentiment SPXUSD: raw_provider_evidence_missing:SPXUSD.
- 2026-05-24 sentiment USDCAD: raw_provider_evidence_missing:USDCAD.
- 2026-05-24 sentiment USDCHF: raw_provider_evidence_missing:USDCHF.
- 2026-05-24 sentiment USDJPY: raw_provider_evidence_missing:USDJPY.
- 2026-05-24 sentiment WTIUSD: raw_provider_evidence_missing:WTIUSD.
- 2026-05-24 sentiment XAGUSD: raw_provider_evidence_missing:XAGUSD.
- 2026-05-24 sentiment XAUUSD: raw_provider_evidence_missing:XAUUSD.
- Current app execution anchor execution_ny_crypto_sun20_v2 is not used for this report; clean14 coverage is 0/14 weeks and 0/14 complete weeks. Comparison anchor is execution_ny_fri9_entry_fri11_close_v1.

## Report Files

- JSON: `reports\snapshot-regime-comparison\clean14-sunday-vs-friday-regime-report.json`
- Markdown: `reports\snapshot-regime-comparison\clean14-sunday-vs-friday-regime-report.md`
