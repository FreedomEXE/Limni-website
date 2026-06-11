# Source Data Inventory - 2026-06-05

Status: inventory, salvage assessment, and 2026-06-05 repair status.

## Scope

This document records what Limni currently stores in the live database and in
local salvage files relevant to the v2.0.3 source-readiness blocker. The goal is
to stop relying on chat memory when deciding whether Jan/Feb can be cleaned, how
future weekly snapshots should be retained, and what is required before
expanding beyond the current 36-instrument universe.

The live DB probe connected to the configured Render Postgres database on
2026-06-05. Counts are a point-in-time read-only snapshot; live cron tables can
increase after this document is written.

## Executive Answer

Sentiment is the fragile blocker. The system did store raw Myfxbook sentiment,
but before the 2026-06-05 retention fix `src/lib/sentiment/store.ts` purged
`sentiment_data` after `SENTIMENT_SNAPSHOT_RETENTION_HOURS`, defaulting to `24`
hours. That means the Jan/Feb raw provider rows were most likely removed by app
retention, not by a mysterious external database cleanup.

Current mitigation: raw sentiment retention has been separated from the live
read window. `SENTIMENT_SNAPSHOT_READ_HOURS` controls normal live reads and
defaults to `24` hours; `SENTIMENT_RAW_RETENTION_DAYS` controls raw provider
snapshot deletion and defaults to `2555` days. This prevents future release
source proof from being deleted after one day.

The live DB still has Jan/Feb `sentiment_aggregates`, but those are derived
aggregate rows. They are useful evidence that sentiment was being processed, but
they are not the same as raw provider snapshots with `raw_payload` and cannot be
called fully source-trusted under the current strict gate.

Strength was a different problem. Strength is internal and was repaired on
2026-06-05 by backfilling canonical warmup price history, rebuilding stored
weekly returns, and relocking the Jan 19 weekly Strength snapshot. Strength now
passes the full 19-week release gate; Sentiment remains the blocker.

## Release Gate Impact

The only release approval command is:

```bash
npm run source:completion:release
```

For v2.0.3 it audits the active 19-week baseline, `2026-01-19` through
`2026-05-24`, and currently fails because 4 Jan/Feb Sentiment source rows are
untrusted:

| Source | Bad weeks | Root issue |
|---|---|---|
| Sentiment | `2026-01-19`, `2026-01-26`, `2026-02-02`, `2026-02-16` | No raw `sentiment_data` provider rows before those week opens in the live DB. |
| Strength | none | Repaired on 2026-06-05 from canonical warmup bars, v3 weekly returns, and Jan 19 weekly Strength relock. |

The March-through-May 12-week subset is diagnostic evidence only. It is not a
replacement baseline.

## Live DB Inventory

### Canonical Source And Source-Like Tables

| Table | Rows | What it stores | Trust role |
|---|---:|---|---|
| `instrument_registry` | 36 | Active Limni symbols, asset class, primary provider, OANDA alias, Bitget base coin. | Universe/source mapping. |
| `cot_snapshots` | 1072 | Weekly CFTC-derived COT snapshots by asset class, variant, currencies JSON, pairs JSON, fetched time. | Source evidence for dealer/commercial. |
| `sentiment_data` | 912 | Raw provider sentiment snapshots: provider, symbol, long/short %, net, ratio, raw payload, latency, timestamp. | Raw sentiment source evidence, but currently only recent rows survive. |
| `sentiment_aggregates` | 89741 | Derived aggregate sentiment by symbol with sources used, confidence, crowding/flip states, timestamp. | Useful derived evidence; not raw source proof. |
| `sentiment_daily_snapshots` | 396 | Daily sentiment locks derived from aggregates. | Derived daily lock evidence. |
| `raw_price_bars` | 59663 | Provider OHLCV bars by provider, provider symbol, asset class, timeframe, quality metadata. | Provider price evidence. |
| `canonical_price_bars` | 87889 | Normalized Limni OHLC bars by symbol, asset class, timeframe, source provider, quality. | Canonical price source for returns/Strength. |
| `pair_period_returns` | 5747 | Derived daily/weekly period returns by symbol, anchor type, anchor version, open/close/high/low. | Derived canonical return inputs. |
| `currency_strength_snapshots` | 59880 | Internal currency strength snapshots by time, window, currency, source, normalized/raw strength. | Internal Strength source-like evidence. |
| `asset_strength_snapshots` | 59877 | Internal asset strength snapshots by asset class, window, asset, source, normalized/raw strength. | Internal Strength source-like evidence. |
| `strength_weekly_snapshots` | 903 | Locked weekly Strength values by week, source type, window, key, source snapshot time. | Weekly Strength lock evidence. |
| `market_snapshots` | 310 | Weekly price/market JSON snapshots by asset class. | Weekly market snapshot evidence, not current release gate source. |
| `news_weekly_snapshots` | 19 | ForexFactory weekly announcements/calendar JSON. | News overlay evidence. |
| `market_funding_snapshots` | about 4223 | Bitget crypto funding rate snapshots and next funding time. | Crypto external market evidence. |
| `market_oi_snapshots` | about 4223 | Bitget crypto open interest and price at snapshot. | Crypto external market evidence. |
| `market_liquidation_snapshots` | about 4216 | CoinAnk liquidation summaries and clusters. | Crypto external market evidence. |
| `market_liquidation_heatmap_snapshots` | 17001 | CoinAnk liquidation heatmap nodes, bands, key levels, aggregate metadata. | Crypto external market evidence. |
| `menthorq_overlay_snapshots` | 23 | Browser-captured gamma/GEX overlay data for 11 symbols. | Options/gamma overlay evidence. |
| `solana_meme_regime_daily` | 6 | SOL and Solana meme regime daily metrics. | Crypto regime research evidence. |

### Derived Strategy, Canon, And Research Tables

| Table | Rows | What it stores | Trust role |
|---|---:|---|---|
| `performance_snapshots` | 649 | Weekly performance JSON by asset class, including returns, pair details, stats. | Derived app performance snapshot. |
| `strategy_artifacts` | 74 | Cached strategy payloads keyed by selection and fingerprint. | Derived strategy cache. |
| `strategy_week_shards` | 2469 | Versioned per-week strategy result shards, path summaries, sim payloads. | Derived canon/cache material. |
| `strategy_backtest_runs` | 29 | Stored backtest run configs and metadata. | Derived research history. |
| `strategy_backtest_weekly` | 252 | Weekly return/trade/drawdown rows per backtest run. | Derived research history. |
| `strategy_backtest_trades` | 6561 | Per-trade rows per stored backtest run. | Derived research history. |
| `trades` | 117566 | Universal trade ledger rows. Current rows are backtest origin for `adr_grid` and `weekly_hold`. | Derived strategy ledger, not raw source. |
| `research_runs` | 13 | Research run metadata. | Derived research history. |

### Execution And Operational Tables

| Table | Rows | What it stores |
|---|---:|---|
| `bitget_bot_ranges` | 380 | Daily range locks by bot/symbol/source. |
| `bitget_bot_signals` | 2690 | Bot session signals, direction, sweep/displacement, status, metadata. |
| `bitget_bot_trades` | 6 | Bot trade lifecycle rows. |
| `bitget_bot_dry_run_log` | 435 | Dry-run bot action log. |
| `bot_states` | 3 | Bot state JSON. |
| `mt5_weekly_plans` | 13 | MT5 account weekly lot maps and baseline equity. |
| `mt5_change_log` | 1 | MT5 strategy/account change note. |
| `mt5_account_snapshots` | 0 | Empty at probe time. |
| `mt5_positions` | 0 | Empty at probe time. |
| `mt5_closed_trades` | 0 | Empty at probe time. |
| `mt5_risk_events` | 0 | Empty at probe time. |
| `mt5_heartbeats` | 0 | Empty at probe time. |
| `connected_accounts` | 0 | Empty at probe time. |
| `broker_profiles` | 0 | Empty at probe time. |
| `correlation_matrix` | 0 | Empty at probe time. |
| `poseidon_group_members` | 2 | Poseidon group membership. |
| `poseidon_group_messages` | 35 | Poseidon group messages. |
| `poseidon_kv` | 5 | Poseidon key/value state. |
| `katarakti_*` | 0 | Empty Katarakti experimental tables at probe time. |

## Sentiment Storage

### What We Store

Raw sentiment is stored in `sentiment_data`:

| Column group | Meaning |
|---|---|
| Identity | `symbol`, `provider` |
| Provider values | `long_pct`, `short_pct`, `net`, `ratio` |
| Audit payload | `raw_payload`, `fetch_latency_ms`, `timestamp_utc` |

Aggregated sentiment is stored in `sentiment_aggregates`:

| Column group | Meaning |
|---|---|
| Identity | `symbol`, `timestamp_utc` |
| Aggregate values | `agg_long_pct`, `agg_short_pct`, `agg_net` |
| Provenance-like data | `sources_used`, `confidence_score`, `crowding_state`, `flip_state` |

Daily locks are stored in `sentiment_daily_snapshots`:

| Column group | Meaning |
|---|---|
| Identity | `symbol`, snapshot date/time |
| Values | daily long/short/net values derived from aggregate state |
| Mode | `DAILY_LOCK_FROM_AGG` in the current live rows |

### Current Provider Reality

The current live `sentiment_data` table contains only `MYFXBOOK` rows:

| Provider | Rows | Symbols | Earliest row | Latest row |
|---|---:|---:|---|---|
| `MYFXBOOK` | 912 | 36 | `2026-06-04T20:10:44.401Z` | `2026-06-05T19:10:44.899Z` |

The configured provider code includes:

| Provider | Current state |
|---|---|
| Myfxbook | Active source. Fetches `get-community-outlook.json`, maps provider symbols into Limni symbols, stores provider item in `raw_payload`. |
| IG | Provider code exists, including indices, metals, oil, BTC/ETH, FX. No live DB rows were found in the current probe. |
| ForexClientSentiment | Provider code exists but is unavailable unless configured. |
| OANDA sentiment | Provider code exists but is unavailable because the old source is not usable. |
| TradingView sentiment | Experimental code exists but is not part of `getAllProviders`; it also uses the Myfxbook provider slot. |

### Jan/Feb Live DB Coverage

Raw provider rows:

| Window | `sentiment_data` result |
|---|---|
| Before `2026-01-19` | `0` rows |
| Jan/Feb release gap weeks | `0/36` raw symbols before each bad week open |
| Current live raw rows | Recent June Myfxbook only |

Aggregate rows survived:

| Week bucket | Rows | Symbols | Earliest aggregate | Latest aggregate |
|---|---:|---:|---|---|
| `2026-01-19` | 96 | 32 | `2026-01-24` | `2026-01-26` |
| `2026-01-26` | 5517 | 32 | `2026-01-26` | `2026-02-02` |
| `2026-02-02` | 1364 | 36 | `2026-02-02` | `2026-02-07` |
| `2026-02-16` | 4140 | 36 | `2026-02-18` | `2026-02-23` |
| `2026-02-23` | 5940 | 36 | `2026-02-23` | `2026-03-02` |
| `2026-03-02` | 6084 | 36 | `2026-03-02` | `2026-03-09` |

The aggregate evidence matters because it proves the app was processing
sentiment in Jan/Feb. It does not satisfy the current strict release gate
because the raw provider snapshots and raw payloads are gone.

### Retention Root Cause

`src/lib/sentiment/store.ts` now uses separate read and retention policies:

| Store | Default retention | Effect |
|---|---:|---|
| `sentiment_data` live read window | 24 hours | `SENTIMENT_SNAPSHOT_READ_HOURS` controls normal operational reads. Legacy `SENTIMENT_SNAPSHOT_RETENTION_HOURS` is accepted only as a read-window fallback. |
| `sentiment_data` raw retention | 2555 days | `SENTIMENT_RAW_RETENTION_DAYS` controls raw provider snapshot deletion for source-proof retention. |
| `sentiment_aggregates` | 365 days | Derived aggregates are retained for long-term history. |

This explains the current DB shape: Jan/Feb aggregates exist, but Jan/Feb raw
provider payloads do not.

## Sentiment Salvage

### Local Files Found

| File | Rows | Symbols | Date range | Usefulness |
|---|---:|---:|---|---|
| `data/sentiment_snapshots.json` | 127 | 28 | `2026-01-14T01:07:54.433Z` to `2026-01-14T16:44:20.355Z` | Real raw Myfxbook payload, partial FX-only salvage. |
| `data/sentiment_aggregates.json` | 127 | 28 | `2026-01-14` | Derived aggregate counterpart to the Jan 14 raw file. |
| `data/research_sentiment_aggregates.json` | 56 | 56 | `2026-02-08T01:35:39.830Z` | Aggregate-only research evidence, not raw provider proof. |
| `data/sentiment_sources.json` | 1 source status set | n/a | `2026-01-14` | Shows Myfxbook healthy; IG/OANDA/ForexClient unavailable at that time. |

The Jan 14 raw file is missing these current 36-universe symbols:

```text
BTCUSD, ETHUSD, NDXUSD, NIKKEIUSD, SPXUSD, WTIUSD, XAGUSD, XAUUSD
```

### Salvage Classification

| Item | Classification | Reason |
|---|---|---|
| `data/sentiment_snapshots.json` | Partial raw salvage | It has raw Myfxbook payload, but only 28 symbols and only Jan 14. |
| `sentiment_aggregates` Jan/Feb live rows | Derived evidence | Useful for forensics and maybe policy discussion, but not raw provider trust. |
| `data/research_sentiment_aggregates.json` | Weak aggregate-only evidence | It may show Feb 8 processed sentiment, but has no raw provider payload. |
| Late aggregates copied backward | Not allowed | Would create trusted-looking rows without source-time proof. |
| Current Myfxbook API | Not a Jan/Feb repair path | Myfxbook does not expose historical community outlook snapshots. |
| Render DB backups or old exported DB snapshots | Best possible repair path if available | Could contain raw `sentiment_data` before the 24-hour retention purge. |

## COT Storage

COT is in stronger shape than sentiment.

| Store | Coverage |
|---|---|
| `cot_snapshots` | 1072 live DB rows: 268 each for commodities, crypto, FX, and indices. |
| Report dates | `2021-04-13` through `2026-05-26`. |
| Variant | `FutOnly`. |
| Local files | `data/cot_snapshots/*.json` and `data/cot_snapshot.json` exist for older/local evidence, with local generated history through `2025-12-30`. |

The code fetches CFTC public reporting endpoints and stores computed snapshot
JSON in `cot_snapshots`. The DB table does not keep a separate raw CFTC row
archive. The stored truth is the normalized currencies/pairs JSON snapshot plus
report date and fetched timestamp.

## Price, Returns, And Strength Storage

### Price Bars

Canonical bars cover the active 36 instruments from the baseline forward. On
2026-06-05, the pre-baseline warmup needed by Strength was also backfilled for
the four lookback weeks.

| Store | Current shape |
|---|---|
| `raw_price_bars` | Provider OHLCV by provider symbol and timeframe. OANDA for non-crypto, Bitget/Bitget spot for crypto. |
| `canonical_price_bars` | Normalized Limni symbol bars by timeframe. Current rows include 1h and 1d bars. |
| `pair_period_returns` | Derived daily/weekly period returns by symbol, anchor type, and anchor version. |

Observed canonical coverage before the warmup repair:

| Asset class | 1h source | Current 1h coverage |
|---|---|---|
| FX | OANDA | 28 symbols, from Jan 18/19 into Jun 5. |
| Commodities | OANDA | 3 symbols, from Jan 18/19 into Jun 1. |
| Indices | OANDA | 3 symbols, from Jan 18/19 into Jun 1. |
| Crypto | Bitget spot | 2 symbols, from Jan 17 into Jun 1. |

2026-06-05 repair update: `scripts/backfill-canonical-hourly-bars.ts` and
`src/lib/canonicalHourlyBars.ts` now support explicit `--weeks=` inputs outside
`CANONICAL_WEEKS_START`, allowing surgical warmup repair without changing the
active release baseline.

### Local OHLC Files

| Local folder | Files | Range | Usefulness |
|---|---:|---|---|
| `data/ohlc/M5/*.csv` | 36 | `2020-01-01T22:00:00Z` to `2025-12-31T00:00:00Z` | Possible comparison/partial price salvage, source likely differs from canonical OANDA. |
| `data/ohlc/M15/*.csv` | 36 | `2024-01-01T00:00:00Z` to `2025-12-31T00:00:00Z` | Possible comparison/partial price salvage, does not cover all Jan warmup. |

Do not silently treat these local OHLC files as canonical OANDA evidence unless
the release policy explicitly accepts that source. They are useful for comparing
or reconstructing parts of the warmup, but canonical release trust should prefer
OANDA/Bitget backfill if available.

### Strength

Strength stores three layers:

| Store | Current shape |
|---|---|
| `currency_strength_snapshots` | 8 currencies, 1h/4h/24h windows, OANDA source, Jan 19 through Jun 5. |
| `asset_strength_snapshots` | Commodities, crypto, indices assets, 1h/4h/24h windows, OANDA source label, Jan 19 through Jun 5. |
| `strength_weekly_snapshots` | 903 weekly locks across currency and asset keys/windows. |

The original release blocker was not that Strength never stored Jan/Feb values.
It was that the first four baseline weeks could not prove stored prior weekly
returns for the four-week Strength lookback:

| Week | Prior return rows | Prior weeks present |
|---|---:|---:|
| `2026-01-19` | `0/144` | `0/4` |
| `2026-01-26` | `36/144` | `1/4` |
| `2026-02-02` | `72/144` | `2/4` |
| `2026-02-09` | `108/144` | `3/4` |
| `2026-02-16` | `144/144` | `4/4` |

Completed repair:

1. Added explicit warmup-week support to the canonical hourly backfill path.
2. Backfilled `2025-12-22`, `2025-12-29`, `2026-01-05`, and `2026-01-12`.
   Full warmup coverage now reports `missing=0`; Dec 22 and Dec 29 remain
   holiday-shortened/early-close partials by raw hour count.
3. Rebuilt warmup weekly returns with `npm run performance:refresh-canonical`
   for those four weeks: `144` canonical and `144` execution rows, `missing=[]`.
4. Computed the Jan 19 index asset-strength lock gap and relocked Jan 19:
   `9` index Strength lock rows for SPX, NDX, and NIKKEI across 1h/4h/24h.
5. Reran `npm run source:completion:release` serially. Strength is now trusted
   for all 19 baseline weeks.

## Crypto And External Market Data

Current crypto/external stores are broader than just BTC/ETH strategy inputs.

| Source | Tables | What is stored |
|---|---|---|
| Bitget spot | `canonical_price_bars`, `raw_price_bars` | BTC/ETH spot hourly/daily bars for canonical crypto price history. |
| Bitget futures | `market_funding_snapshots`, `market_oi_snapshots`, `market_snapshots` | Funding rates, next funding time, open interest, price snapshots. |
| CoinAnk | `market_liquidation_snapshots`, `market_liquidation_heatmap_snapshots` | Liquidation summaries, heatmap nodes/bands/key levels, exchange-group metadata. |
| CFTC/COT | `cot_snapshots` | Crypto COT rows normalized into dealer/commercial pair signals. |
| Myfxbook sentiment | `sentiment_data`, `sentiment_aggregates` | BTCUSD and ETHUSD sentiment only when provider returns those symbols and raw retention has not purged rows. |
| Solana/meme regime | `solana_meme_regime_daily` | Daily SOL price/change and Solana meme volume/change/mcap/holders/sample metrics. |
| CoinMarketCap fallback | no dedicated historical table found | Used as a spot-price fallback in code paths, not a durable historical source store in the current DB inventory. |

Crypto strategy expansion should treat funding/OI/liquidation history as useful
extra market context, but the v2.0.3 release gate still depends on the four
weekly directional source families: dealer COT, commercial COT, sentiment, and
Strength.

## Weekly Snapshot Concept

For release trust, a weekly Limni snapshot is not one table. It is a chain:

1. Universe row in `instrument_registry`.
2. COT rows in `cot_snapshots` for dealer/commercial direction.
3. Raw sentiment rows in `sentiment_data` before the week open.
4. Aggregated sentiment rows in `sentiment_aggregates` built from raw rows.
5. Canonical price bars in `canonical_price_bars`.
6. Canonical returns in `pair_period_returns`.
7. Strength snapshot/weekly lock rows in `currency_strength_snapshots`,
   `asset_strength_snapshots`, and `strength_weekly_snapshots`.
8. Derived strategy/performance artifacts in `performance_snapshots`,
   `strategy_week_shards`, `strategy_artifacts`, and `trades`.

Only steps 1 through 7 are source/readiness inputs. Step 8 is output.

## 64-Instrument Expansion Requirements

The current live universe is 36 active instruments. Expanding to the 5ers
64-instrument universe is possible only if each added instrument has an explicit
source contract.

For every new symbol, require:

| Requirement | Why it matters |
|---|---|
| `instrument_registry` row | The app needs a canonical Limni symbol and provider aliases. |
| COT mapping | Dealer/commercial logic needs a CFTC market mapping or a documented no-COT exclusion. |
| Sentiment mapping | Myfxbook/IG/other provider symbol must be known and raw snapshots must be retained. |
| Raw sentiment archive | Myfxbook cannot look back historically, so live raw snapshots must be stored long-term before the symbol can become source-trusted. |
| Canonical price provider | OANDA, Bitget, or another canonical provider must support the instrument and timeframe. |
| Warmup bars | Strength and returns need pre-baseline warmup, not just first release week data. |
| `pair_period_returns` rows | Derived weekly returns must exist for the active anchor/version. |
| Strength locks | Weekly Strength must lock with stored prior returns, not provider fallback. |
| Audit tests | `source:completion:release` must count the expanded expected universe and fail missing symbols. |

Rule: "as long as we have COT and sentiment we can simulate returns" is only
part of the truth. We also need canonical price bars, period returns, Strength
inputs, and source-retention proof if the numbers are to be release-trusted.

## Salvage Matrix

| Data | Salvage status | Action |
|---|---|---|
| COT live DB | Strong | Keep as release source evidence. |
| Current canonical price bars Jan 19 onward | Strong for active baseline prices | Keep. |
| Strength Jan/Feb stored locks | Repaired | Full release gate now reports Strength trusted for all 19 weeks. |
| Strength warmup Dec/early Jan | Repaired | OANDA/Bitget canonical bars and v3 weekly returns were rebuilt. |
| Local `data/ohlc` CSVs | Partial comparison evidence | Use only if canonical provider repair fails or policy accepts alternate source. |
| Jan 14 raw Myfxbook local file | Partial raw sentiment salvage | Can prove 28 symbols on Jan 14 only; cannot clean 36/36. |
| Jan/Feb live sentiment aggregates | Derived forensic evidence | Do not mark raw-source trusted without policy change or raw backups. |
| Feb 8 research sentiment aggregate file | Weak forensic evidence | Aggregate-only; not raw source proof. |
| Current Myfxbook API | Not historical salvage | It cannot retrieve old weekly outlook. |
| Render DB backups/old dumps/logged raw payloads | Best possible sentiment repair | Search before accepting Jan/Feb as permanently unclean. |

## Immediate Next Work For Codex High

1. Stop future raw sentiment loss.
   - Completed locally on 2026-06-05: raw sentiment retention/archive policy now
     keeps provider snapshots for `SENTIMENT_RAW_RETENTION_DAYS`, default
     `2555` days.
   - Normal operational reads still use `SENTIMENT_SNAPSHOT_READ_HOURS`,
     default `24` hours, so long retention does not force live surfaces to scan
     the full raw archive.

2. Search for raw Jan/Feb sentiment backups.
   - Render database point-in-time backups or snapshots.
   - Old database dumps.
   - Logs/artifacts that captured `sentiment_data` raw payloads.
   - Local JSON files beyond the current `data/` folder if they exist elsewhere.

3. Repair Strength from canonical provider history.
   - Completed locally on 2026-06-05.
   - Added warmup support before `CANONICAL_WEEKS_START`.
   - Backfilled `2025-12-22`, `2025-12-29`, `2026-01-05`, and `2026-01-12`.
   - Rebuilt warmup weekly returns and relocked Jan 19 index Strength.

4. Decide sentiment policy only after the backup search.
   - If raw Jan/Feb rows are found, import/rebuild honestly.
   - If raw rows are not found, the 19-week gate remains blocked unless Freedom
     explicitly approves a policy that treats aggregate-only evidence as enough.
   - Do not make that policy change implicitly.

5. Add a durable source manifest for any future 64-instrument expansion.
   - The manifest should list every symbol, COT mapping, sentiment mapping,
     canonical price provider, supported asset class, and readiness status.

## Human Breakdown

What changed: this document records the live DB stores, local salvage files,
sentiment retention root cause, completed Strength repair, crypto external
stores, and 64-instrument expansion requirements.

Why it matters: the team can now tell the difference between real source proof,
derived aggregate evidence, partial salvage, and simulation outputs without
repeating the same investigation.

What passed/failed: the serial `npm run source:completion:release` gate now
reports Strength trusted for all 19 weeks, but still fails with 4 untrusted
Sentiment rows.

Next gate: search for raw Jan/Feb sentiment backups, import/rebuild honestly if
found, then rerun `npm run source:completion:release` serially until all 76 rows
are trusted.
