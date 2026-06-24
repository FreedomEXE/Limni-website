# Gate 47: Real-Value Regime Research Handoff

Date: 2026-06-19

## Starting Point

Gate 44 produced a reusable seven-year ADR Grid research matrix warehouse.
Gate 45 passed the warehouse with caveats.
Gate 46 found that COT lifecycle is useful as a source-quality filter:
selected sides going with crowded COT extremes underperformed, while neutral
or fade-lean lifecycle zones performed materially better.

## Candidate v3 Stack

Do not model the stack as many equal sources. Use layers:

1. Direction source: Friday frozen Strength selects the weekly side.
2. Positioning filter: COT Lifecycle interprets Dealer, Commercial, and
   Non-Commercial positioning as one COT model.
3. Macro regime filter: BPR / monthly bank direction plus real-rate-pressure
   decides whether the higher-timeframe backdrop allows or prioritizes the
   trade.
4. Execution: ADR Grid.

Dealer and Commercial are no longer top-level standalone sources in this
framing. They are ingredients in COT Lifecycle.

Sentiment remains parked until deeper historical data exists.

Pair fill cap is not the v3 risk pillar. The third conceptual slot is the
BPR + real-rate-pressure macro regime layer.

## Gate 47 Objective

Build the higher-timeframe currency regime data layer against the existing
Gate 44 seven-year warehouse before testing any overlay logic. Fill BPR and
rates rows first, then CPI/inflation rows, with enough metadata to decide
later whether the useful regime expression is fade BPR, BPR extremes, nominal
rates, real-rate spreads, CPI valuation gaps, or a combined filter.

## Locked Thesis V0

The first testable thesis is not "BPR plus rates equals true value." That is
too broad and would mix positioning with macro value.

Use separate buckets:

1. BPR is a monthly bank-positioning/crowding source.
2. Nominal rates are yield pressure and carry context.
3. CPI converts nominal rates into real-rate pressure.
4. CPI plus FX price can later produce a valuation-gap or real-FX-value bucket.

Minimum first real-rate-pressure feature:

```txt
real_rate_percent = 3m_interbank_rate_percent - cpi_yoy_percent
```

This is a source feature only. It does not decide support, oppose, fade,
extreme, or combine with BPR in the fill layer.

## Live/Test Parity Rule

The promoted regime algo must use the intersection of what the seven-year
backtest can reproduce and what live trading can observe.

Better live data can be collected, but it stays shadow-only until one of these
is true:

1. The richer source is backfilled across the full test window with defensible
   as-of timestamps.
2. The richer source becomes a new versioned regime candidate and is retested
   before promotion.

Do not let live trade decisions depend on a source that the historical test did
not have in the same form. That would create a live/test mismatch and false
confidence.

Use three lanes:

1. `regime_v1`: frozen feature contract, full seven-year coverage, same
   cadence live and historical, strict stale/missing rules.
2. `shadow_enrichment`: better CPI, official-bank feeds, richer REER/PPP, or
   higher-frequency releases collected forward but not used for decisions.
3. `regime_v2_candidate`: enrichment that has been backfilled or forward-tested
   enough to justify a new dataset hash and full retest.

Every feature row needs source id, observation date, available date, fetched
date, source hash, stale days, missing reason, fallback level, and feature
version. If a currency/week is weak, the regime should store neutral/stale/
missing rather than inventing a value.

## Next Hardening Order

Do not run a promoted seven-year real-rate-pressure regime test until the input data
contract is hardened.

1. CPI source upgrade:
   - Keep the current FRED-derived CPI rows as v0.
   - Find and backfill primary or institutional CPI sources where FRED is stale
     or delayed, starting with Japan.
   - Preserve v0 rows instead of rewriting them silently; upgraded sources
     become new source ids or a new dataset version.
2. Comparable rate contract:
   - Keep `3m_interbank_rate` as the first comparable rate feature.
   - Treat overnight, policy, and reference rates as separate candidate
     features, not substitutes inside the same formula.
3. Valuation data:
   - Add BIS REER/NEER or OECD PPP/comparative-price-level rows before calling
     the algo "true value."
   - Store them as valuation inputs, separate from real-rate pressure and BPR.
4. Source availability audit:
   - For every source and currency, prove 2019-2026 row coverage, update
     cadence, available date, stale window, missing reason, and fallback level.
5. Read-only overlay:
   - Join macro buckets to Gate 44 pair decisions after the source audit.
   - Test BPR, nominal rates, CPI, real rates, and valuation independently
     before any combined regime filter.

## Required Separation

Test the macro components separately before combining:

1. BPR / monthly bank positioning direction.
2. Nominal-rate regime.
3. CPI/inflation regime.
4. Real-rate regime.
5. CPI-adjusted valuation-gap regime when paired with FX price.
6. Combined BPR + real-rate-pressure regime only after the separate buckets are read.

The goal is to learn whether each component carries independent signal and
whether the combined filter improves win rate, drawdown, year stability, or
source-quality segmentation.

## Hard Rules

- Do not tune stops, TP, runners, grid entries, or pair filters.
- Do not modify release canon.
- Do not touch Pine verifier.
- Do not delete generated evidence.
- Treat Gate 44 top rows as source-model evidence, not stop-policy proof.
- Keep BPR and real-rate-pressure rows as data contracts before UI work.
- Do not encode BPR/rates support/oppose/fade/extreme logic in the fill layer.

## Data Contract Implemented

Migration and helper:

- `database/migrations/029_macro_regime_source_warehouse.sql`
- `app/src/lib/research/macroRegimeDataset.ts`
- `app/scripts/verification/fill-macro-regime-source-warehouse.ts`

Smallest reusable contract:

- `research_macro_regime_datasets`: one manifest per source fill, with range,
  currencies, source versions, coverage, notes, and status.
- `research_macro_source_observations`: raw observation rows by source family
  (`bpr`, `rate`, `inflation`, `valuation`), source id, currency, instrument,
  observation date,
  effective timestamp, available timestamp, fetched timestamp, source URL,
  row source hash, raw values, normalized numeric values, coverage, and flags.
- `research_macro_weekly_currency_snapshots`: weekly as-of rows by week,
  currency, source family, source id, and instrument. Missing/stale state is
  stored as metadata; no regime direction or filter decision is stored.
  Derived `real_rate_pressure` rows live here and preserve their input rate/CPI
  snapshots in metadata.

## 2026-06-19 Fill Result

Active local v2 dataset:

- Dataset id: `a403b126-9f65-4a35-b353-0b9dcc986bd0`
- Dataset hash:
  `b184c49fbedc202dad061366ca6dbc25478470230549847fe56b420aa8647ca8`
- Dataset version: `macro_regime_source_dataset_v2`
- Range: `2019-01-07T00:00:00.000Z` through
  `2026-06-12T15:00:00.000Z`
- Weeks: `388`
- Raw observations: `12,058` total; `1,656` BPR, `9,847` rates,
  `555` inflation
- Weekly snapshots: `19,788` total; `6,208` BPR, `7,372` rates,
  `3,104` inflation, `3,104` derived real-rate-pressure rows
- BPR reports attempted: `184`; fetched: `184`; failed: `0`; live CFTC
  fetches: `106`; Wayback CFTC archive fallback fetches: `78`; local CFTC
  `403` blocks observed: `78`
- Rate sources: `19`
- Inflation sources: `8`
- Real-value derived source rows: `8` currencies x `388` weeks

Important source-quality facts:

- BPR report coverage is now closed locally for the requested range. Missing
  weekly BPR values now mean the CFTC report did not include that FX currency
  market for that report family, not that the monthly report is missing.
- BPR currency coverage is uneven. The data layer preserves futures/options and
  per-currency missing/stale flags instead of assuming BPR is usable for all
  eight FX currencies.
- BPR archive rows preserve canonical CFTC URL, Wayback archive timestamp, and
  source hash. They are still official CFTC report pages, fetched through
  Wayback only when live CFTC paths fail.
- Rate snapshots are populated weekly for all selected rate sources. Delayed or
  stale series are flagged; examples include stale CHF/NZD overnight-interbank
  monthly series and less-current EUR/GBP 3-month series.
- CPI rows are computed from FRED CPI index levels as YoY inflation. The raw
  index value, prior-year lag index, lag observation date, source URL, source
  hash, cadence, and availability approximation are preserved.
- Real-value rows use the comparable `oecd_3m_interbank_rate` family for all
  eight currencies, then subtract the matching CPI YoY row.
- Direct DB readback: BPR snapshots `6,208` rows / `2,103` available /
  `4,105` missing; rate snapshots `7,372` rows / `7,372` available /
  `207` stale; inflation snapshots `3,104` rows / `3,104` available /
  `486` stale; real-rate-pressure snapshots `3,104` rows / `3,104` available /
  `497` stale.
- Inflation latest observations: AUD `2025-01-01`, CAD `2025-03-01`,
  CHF `2025-04-01`, EUR `2026-05-01`, GBP `2025-03-01`, JPY `2021-06-01`,
  NZD `2025-01-01`, USD `2026-05-01`.
- Japan CPI is the weak v0 source. FRED/OECD Japan CPI ends at
  `2021-06-01` locally; the official Statistics Bureau/e-Stat path was
  identified, but not automated in this slice. JPY real-rate-pressure rows are stale
  for `245/388` weeks and should be excluded or explicitly bucketed until that
  source is upgraded.

## 2026-06-19 Source Hardening Audit

This was source hardening only. No signal tests, BPR/rate/CPI combined logic,
stop/TP/runner tuning, pair filters, release canon, or Pine verifier changes
were run.

### CPI Replacement Map

Keep current FRED-derived CPI rows as v0. Replacement CPI feeds must use new
source ids or a new dataset version, not silent rewrites.

| Currency | Primary/institutional CPI path | Gate 47 status |
| --- | --- | --- |
| AUD | ABS all-groups CPI, Australia, preferably official ABS API/tables. | Quarterly history is reproducible; monthly ABS CPI is richer but must be backfilled or shadow-only. |
| CAD | Statistics Canada table `18-10-0004-01`, monthly all-items CPI. | Primary replacement candidate. |
| CHF | Swiss FSO CPI/LIK official feed; institutional fallback only if FSO API path is not pinned. | Needs endpoint pinning. |
| EUR | Eurostat HICP monthly index, all-items, Euro area aggregate. | Primary replacement candidate for FRED/Eurostat mirror. |
| GBP | ONS CPI all-items index/monthly consumer price inflation dataset. | Primary replacement candidate. |
| JPY | Statistics Bureau/e-Stat Japan CPI 2020-base Table `1-1`, monthly Subgroup Index for Japan all-items, with Table `4-1` all-items as validation/fallback. | Highest priority. Official target is pinned, but not filled: e-Stat API requires an app id; Excel fallback requires a versioned XLSX parser before promotion. |
| NZD | Stats NZ CPI, with RBNZ `Prices M1` as institutional distribution fallback. | Quarterly history is reproducible; monthly/richer paths need parity review. |
| USD | BLS CPI-U all-items, `CUUR0000SA0`, BLS public API. | Primary replacement candidate. |

### BIS And OECD Valuation Availability

Official BIS effective-exchange-rate bulk data was audited separately from the
fill script. For all eight FX currencies (`AUD`, `CAD`, `CHF`, `EUR`, `GBP`,
`JPY`, `NZD`, `USD`):

- Monthly broad REER and NEER exist from `1994-01` through `2026-05`, `389`
  observations each.
- Monthly narrow REER and NEER exist from `1964-01` through `2026-05`, `749`
  observations each.
- Daily broad and narrow NEER exist; broad daily starts `1996-04-11`, narrow
  daily starts `1983-10-03`, both through `2026-06-16` in the audited bulk
  file.
- Daily REER was not present. Do not infer daily real valuation from the daily
  nominal file.
- BIS ingestion is now pinned to the official v2 SDMX API:
  `https://stats.bis.org/api/v2/data/dataflow/BIS/WS_EER/1.0/{seriesKey}`.
  The Node request must send `Accept-Language: en`; without that header, BIS
  can return a server error for otherwise valid CSV requests.

OECD availability:

- Monthly comparative price levels were current-period only in the audited API
  pull (`2026-04`) and are shadow-only for seven-year parity.
- Annual OECD Table 4 has all eight FX currencies using reference areas:
  `AUS`, `CAN`, `CHE`, `EA20`, `GBR`, `JPN`, `NZL`, `USA`.
- Annual PPP household final consumption rows are available through `2024`.
- Annual average exchange-rate rows are available through `2025`.

### Smallest Valuation Contract

Gate 47 valuation rows now use:

- Source family: `valuation`.
- Source ids:
  - `oecd_table4_ppp_household_final_consumption`
  - `oecd_table4_exchange_rate_average`
- Observation date: calendar-year start, e.g. `2024-01-01`.
- Effective timestamp: calendar-year end, e.g. `2024-12-31T23:59:59Z`.
- Available timestamp: year end plus `180` days, stored as an explicit
  approximation mode.
- Stale window: `455` days for annual rows.
- Missing reason: weekly snapshots store
  `no_observation_available_as_of_week_open` when no source row exists as of
  week open.
- Source hash: SHA-256 of the fetched official OECD CSV payload.
- Feature version: `regime_v1_valuation_input_contract`.
- Interpretation rule: raw PPP and exchange-rate inputs only. No PPP gap,
  support/oppose/fade/extreme bucket, or combined macro-regime logic is stored
  in this fill layer.

### Valuation Fill Slice V1

Persisted source-only valuation dataset:

- Dataset id: `5cd8e166-772a-4d1c-868a-582e70567558`
- Dataset hash:
  `60ba3840779b5ea62443fe8b94fc19c272bbe903595cdf0ba0ff7430ce58284d`
- Dataset version: `macro_regime_source_dataset_v2`
- Range: `2019-01-07T00:00:00.000Z` through
  `2026-06-12T15:00:00.000Z`
- Weeks: `388`
- Raw observations: `136` valuation rows
- Weekly snapshots: `6,208` valuation rows
- Sources: `16` (`8` currencies x `2` valuation inputs)
- Available/stale/missing: `6,208` available, `0` stale, `0` missing
- Latest PPP household final consumption observation: `2024` for all eight
  currencies.
- Latest average exchange-rate observation: `2025` for all eight currencies.
- Verification: valuation-only dry run passed before the DB write; targeted
  ESLint passed on the changed TypeScript files.
- Dry-run receipt:
  `app/reports/data-verification/macro-regime/gate47-valuation-oecd-ppp-dry-run-20260619.json`

### Valuation Fill Slice V2

Persisted source-only valuation dataset with OECD annual PPP/exchange-rate rows
plus official BIS monthly broad NEER/REER rows:

- Dataset id: `97266ab2-6feb-4962-936b-a47d73c06684`
- Dataset hash:
  `3131935ee881bfde850440a272fec06f1de5d3c3710a50e64d23552a0fed4cc0`
- Dataset version: `macro_regime_source_dataset_v2`
- Range: `2019-01-07T00:00:00.000Z` through
  `2026-06-12T15:00:00.000Z`
- Weeks: `388`
- Raw observations: `1,608` valuation rows
- Weekly snapshots: `12,416` valuation rows
- Sources: `32`
  - `8` currencies x `2` OECD annual valuation inputs
  - `8` currencies x `2` BIS monthly broad EER inputs
- Available/stale/missing: `12,416` available, `0` stale, `0` missing
- Latest OECD PPP household final consumption observation: `2024` for all
  eight currencies.
- Latest OECD average exchange-rate observation: `2025` for all eight
  currencies.
- Latest BIS monthly broad NEER and REER observation: `2026-05` for all eight
  currencies.
- Dry-run receipt:
  `app/reports/data-verification/macro-regime/gate47-valuation-oecd-bis-dry-run-20260619.json`
- Verification: valuation-only dry run passed before the DB write; targeted
  ESLint passed on the changed TypeScript files.

### JPY CPI Pin Check

JPY CPI remains a blocker for real-rate promotion.

Pinned official path:

- Statistics Bureau/e-Stat CPI 2020-base.
- Primary target: Table `1-1`, monthly Subgroup Index for Japan, exact
  all-items code.
- Validation/fallback target: Table `4-1`, `Indices of Items for Japan
  Monthly`, exact all-items row.
- Example latest-page stat/file id from the April 2025 Table `4-1` probe:
  `000040276983`.
- API probe:
  `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?statsDataId=000040276983&limit=1&lang=E`
- File-download probe:
  `https://www.e-stat.go.jp/en/stat-search/file-download?statInfId=000040276983&fileKind=4`

Findings:

- The API target is real, but returns authentication failure without an
  e-Stat app id. The fill layer should require `ESTAT_APP_ID` before using the
  API path.
- The official Excel file download is accessible without an app id. Manual XML
  inspection of the Table `4-1` XLSX confirms the table contains `Monthly,
  Index`, all-items (`総合`) in column `I`, and monthly rows back through at
  least `2019-01` with latest `2025-04` in the probed file. This is now a
  validation/fallback path, not the primary semantic target.
- The repo currently has no XLSX parser dependency (`xlsx`, `exceljs`,
  `jszip`, `adm-zip` absent). Do not add a parser casually inside this gate.
- No JPY CPI replacement rows were filled in this slice. The next safe step is
  either:
  1. env-gated e-Stat API fill using `ESTAT_APP_ID`, or
  2. a tiny, reviewed XLSX extraction helper for the pinned official table,
     versioned as a source parser before any data promotion.

## Existing Evidence To Review

- `docs/research/GATE44_REUSABLE_SEVEN_YEAR_MATRIX_DATASET_2026-06-18.md`
- `docs/research/GATE45_SEVEN_YEAR_MATRIX_REVIEW_AND_ACCURACY_AUDIT_HANDOFF_2026-06-19.md`
- `docs/research/GATE46_COT_LIFECYCLE_SOURCE_SCORE_AUDIT_2026-06-19.md`
- `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-source-model-matrix-read-372w-20260619-134630.md`
- `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/gate46-cot-lifecycle-source-score-audit-372w-20260619T170102.md`

## Suggested First Slice

Start with a read-only warehouse overlay, not a new backtest:

1. Define currency/month BPR direction rows.
2. Define currency/week nominal-rate rows.
3. Define currency/week CPI/inflation rows.
4. Define currency/week real-rate rows.
5. Later, derive CPI-adjusted FX valuation gaps from CPI snapshots plus FX
   price rows.
6. Join each row to Gate 44 week/pair decisions by currency exposure.
7. Bucket existing pair ADR contributions by:
   - BPR supports selected side
   - BPR opposes selected side
   - BPR neutral/missing
   - nominal rate favours base/quote
   - CPI inflation favours/disfavours base/quote
   - real-rate spread favours base/quote
   - real-rate-pressure neutral/stale/missing
8. Only after separate evidence exists, test combined BPR + real-rate-pressure logic.

## Decision Needed After First Slice

If BPR and real-rate-pressure regime do not add stability or improve bad lifecycle
pockets, do not promote them into v3.

If they improve source quality, then the v3 model becomes:

Friday frozen Strength direction -> COT Lifecycle filter -> BPR/rates regime
filter -> ADR Grid execution.
