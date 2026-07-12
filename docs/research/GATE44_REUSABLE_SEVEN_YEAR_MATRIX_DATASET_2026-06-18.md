# Gate 44 Reusable Seven-Year Matrix Dataset

Date: 2026-06-18

Status: first one-week warehouse proof complete. This gate prepares the
reusable data warehouse before running broad 2019-2026 strategy matrices.

## Decision

Do not run the final seven-year matrix as a one-off report. Build a reusable
research dataset with two separate layers:

- immutable base dataset: source context, market-truth M1 execution data, and
  grid trade opportunities;
- variant result ledgers: pair decisions, weekly results, trade exits, stop
  events, and attribution for each logic/parameter set.

This lets later gates add or remove strategy logic without rebuilding market
truth or losing the ability to answer follow-up questions.

## Contract

Added:

- `database/migrations/028_research_matrix_warehouse.sql`
- `app/src/lib/research/matrixDataset.ts`
- `app/scripts/verification/export-research-matrix-dataset-contract.ts`

Gate 44 then wired the existing side-selector audit to write the warehouse
behind `--write-research-matrix-warehouse`. Normal JSON/CSV receipts remain in
place; trade events are captured separately for the warehouse so the receipt
does not become the primary data store.

Warehouse tables:

- `research_matrix_datasets`: one immutable dataset manifest and coverage hash.
- `research_matrix_source_contexts`: one row per week and pair with COT,
  Dealer/Commercial, Friday Strength, market-open Strength, timestamps,
  coverage, and flags.
- `research_matrix_trade_opportunities`: base grid opportunities independent
  of later strategy filters.
- `research_matrix_variant_runs`: one logic/parameter set against a dataset.
- `research_matrix_pair_decisions`: selected side or exclusion reason per
  variant/week/pair.
- `research_matrix_variant_week_results`: weekly summary and attribution per
  variant.
- `research_matrix_trade_events`: fill/exit ledger per variant.
- `research_matrix_stop_events`: stop/take-profit event ledger per variant.

## Question Surfaces

The warehouse is designed to answer, without rerunning the market/source build:

- Strength alone vs COT alone vs combined;
- Dealer, Commercial, Dealer+Commercial, COT Faces, and commercial-delta COT
  variants;
- Friday Strength vs market-open Strength vs agreement/conflict buckets;
- TP, SL, runner, and grid-entry sensitivity;
- profit factor, expectancy, win rate, return/drawdown, drawdown duration,
  week-close drag, and runner giveback;
- pair/currency concentration and bad-regime/year/week attribution;
- missed opportunity from skipped fills, filters, stops, and take-profit exits;
- source coverage and source disagreement diagnostics.

## Storage Shape

The first estimator is intentionally rough; it exists to keep the broad run
honest before writing millions of rows.

```powershell
npm run verification:export-research-matrix-dataset-contract -- `
  --years=7 `
  --pairs=28 `
  --variants=64 `
  --average-fills-per-pair-side=8
```

The expected scale is manageable if the base dataset is built once and variant
logic reads cached arrays:

- source context rows: weeks * pairs;
- base trade opportunities: weeks * pairs * two directions * average fills;
- pair decisions: weeks * pairs * variants;
- weekly results: weeks * variants;
- trade events: base opportunities * variants.

First estimate:

```txt
years=7
weeks=364
pairs=28
variants=64
average fills per pair-side=8
source contexts=10,192
base trade opportunities=163,072
pair decisions=652,288
variant weeks=23,296
trade events=10,436,608
```

Read: this is a database/indexed-ledger problem, not a Markdown/CSV report
problem. The broad run should write ledgers once, then later analysis should
query them.

## First Warehouse Proof

Command:

```powershell
npx tsx app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts `
  --receipts=app/reports/data-verification/fx-hedged-adr-grid/fx-28pair-hedged-adr-grid-2026-06-08-20260616-033849.json `
  --variant-ids=cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree,dealer_commercial_agreement_open_friday_strength_agree `
  --basket-sl-adr-thresholds=15 `
  --pair-inventory-sl-adr-thresholds=0.7 `
  --runner-configs=0.2:be,0.25:be `
  --path-resolution=1m `
  --week-preload-concurrency=1 `
  --write-research-matrix-warehouse `
  --profile
```

Receipt:

```txt
app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-1w-20260618-044522.json
```

Dataset:

```txt
dataset_id:   799e6a2c-5aa3-4583-bd59-2f04dd3ff2a6
dataset_hash: 35a20d8831e05a6811f8d42f5453df583cfb3c356c12dc283a97be60b81de993
```

Persisted rows:

```txt
source_contexts:       28
trade_opportunities:  579
variant_runs:         420
pair_decisions:       11,760
variant_week_results: 420
trade_events:         102,084
stop_events:          290
```

Important read: this proof expanded to `420` variant runs because the command
used `--variant-ids`, while the script previously only recognized
`--variants`. The alias is now fixed. The resulting one-week dataset is still a
valid heavier warehouse proof, but it is not a narrow candidate-only proof.

Strength timestamp proof from `research_matrix_source_contexts`:

```txt
fridayStrength:    2026-06-05T21:00:00.000Z, 28/28 directional
marketOpenStrength: 2026-06-07T22:15:00.000Z, 28/28 directional
```

This uses the Gate 43 M1-backed `market_open_confirmation` context, not the
later execution window. It preserves the separation between market truth and
the `2026-06-08T00:00:00Z` execution-zone start in the receipt.

Parity proof:

```txt
JSON week rows: 420
DB week rows:   420
mismatches:     0
```

Compared fields: selected pair sides, fills, final ADR, final raw pct, max
drawdown ADR, week-close ADR, grid TP ADR, runner ADR, stop-exit ADR,
basket-TP exit ADR, and max active fills.

Runtime profile:

```txt
wall time:                       162.4s
research_matrix_warehouse_write: 93.9s
variant_evaluation:             24.2s / 420 rows
week_prepare_all:                8.6s
source_context_strength_history: 4.1s
canonical_bar_load:              4.1s
```

Read at this point: the reusable ledger shape was proven for one week, but the
first DB write path was too slow for a broad matrix. A faster warehouse writer
was the next required engine step.

## Bulk Writer Pass

The first proof showed that ordinary batched INSERTs were the bottleneck, not
variant math. Gate 44 then added:

- JSON recordset bulk upserts for generated variant runs, pair decisions, and
  weekly result rows.
- A PostgreSQL `COPY FROM STDIN` trade-event writer via `pg-copy-streams`.
- Lean trade-event rows: full pair source state is stored in
  `research_matrix_pair_decisions` and `research_matrix_source_contexts`;
  trade events keep a `sourceStateJoin` metadata pointer instead of repeating
  the same source JSON on every fill.
- Table-level profile buckets for warehouse writes.
- `RESEARCH_MATRIX_TRADE_EVENT_WRITE_METHOD=insert` fallback to use the older
  JSON-recordset insert path if COPY needs to be disabled.
- `--matrix-trade-event-mode=full|none|selected` so broad exploratory runs can
  persist source contexts, opportunities, pair decisions, weekly results, and
  stop events without writing every per-fill trade event. `selected` uses
  `--matrix-trade-event-variant-ids` for promotion/debug ledgers on chosen
  variants.

Narrow candidate-family proof after the `--variant-ids` alias fix:

```txt
dataset_id:   e4410f86-0dbf-4ee5-99df-b29bf62a2a0b
dataset_hash: gate44-copy-narrow-20260618-1w
variant_runs: 24
trade_events: 1,852
wall time:    21.2s
warehouse:    3.0s
```

Apples-to-apples 420-variant proof using COPY:

```txt
dataset_id:   33885028-8b32-4c61-a45d-1d1a3cfb0cad
dataset_hash: gate44-copy-420-20260618-1w
source_contexts:       28
trade_opportunities:  579
variant_runs:         420
pair_decisions:       11,760
variant_week_results: 420
trade_events:         102,084
stop_events:          290
```

Runtime comparison for the same one-week / 420-variant shape:

| Path | Wall | Warehouse write | Trade-event write |
| --- | ---: | ---: | ---: |
| First warehouse proof | `162.4s` | `93.9s` | not isolated |
| JSON recordset + bulk variant runs | `71.6s` | `41.4s` | `34.6s` |
| COPY trade events | `66.9s` | `22.8s` | `17.2s` |
| Exploratory no trade events | `22.8s` | `4.5s` | `0.0s` |

The COPY-backed proof preserved source and result parity:

```txt
JSON week rows: 420
DB week rows:   420
mismatches:     0
fridayStrength: 2026-06-05T21:00:00.000Z, 28/28 directional
marketOpenStrength: 2026-06-07T22:15:00.000Z, 28/28 directional
```

Read: this pass is reusable engine work. It improves every future matrix that
writes event ledgers, not only the `2026-06-08` proof. The remaining speed
problem for broad history is no longer source context or marked-path math; it
is the decision of how much per-variant trade-event detail to persist during
exploratory sweeps versus promotion-grade ledgers.

## Persistence Mode Proof

Exploratory no-event proof for the same one-week / `420`-variant shape:

```txt
dataset_id:   2ee9f0bf-8307-45c9-aa61-6f1224653194
dataset_hash: gate44-explore-420-noevents-20260618-1w
source_contexts:       28
trade_opportunities:  579
variant_runs:         420
pair_decisions:       11,760
variant_week_results: 420
trade_events:         0
stop_events:          290
```

DB proof:

```txt
JSON week rows: 420
DB week rows:   420
mismatches:     0
fridayStrength: 2026-06-05T21:00:00.000Z, 28/28 directional
marketOpenStrength: 2026-06-07T22:15:00.000Z, 28/28 directional
tradeEventRowsAvailable metadata: 102,084
```

Selected-event proof:

```txt
dataset_id:   db1ebc20-9391-48a4-9a88-809614291599
dataset_hash: gate44-selected-events-cot-20260618-1w
variant_runs: 12
pair_decisions: 336
variant_week_results: 12
trade_events: 147
warehouse: 2.5s
```

Read: exploratory mode is the right default for broad matrix discovery because
it keeps reusable source, opportunity, decision, weekly-result, and stop-event
ledgers while avoiding millions of repeated fill-event rows. Promotion-grade
or failure-autopsy runs can switch to `full` or `selected` trade-event
persistence without rebuilding market/source truth.

## Current-2026 Source-Complete Proof

First `23`-week exploratory proof before the current-2026 Strength backfill:

```txt
dataset_id:   6a7dc2c3-16b2-4f1c-9b36-e042d68187f6
dataset_hash: gate44-explore-420-current2026-noevents-20260618-23w
variant_week_results: 9,660
pair_decisions: 270,480
trade_events: 0
wall time: 182.3s
warehouse: 84.5s
```

That run preserved JSON-to-DB parity but was not source-complete:
only the last two weeks had M1-backed Gate 43 Strength context. Treat that as a
coverage diagnosis, not a strategy ranking.

After current-2026 M1 and Strength-history materialization, the source-complete
exploratory warehouse proof passed:

```txt
dataset_id:   90ab914f-13a8-415d-ba54-851f1f25ac4a
dataset_hash: gate44-explore-420-current2026-sourcecomplete-noevents-20260618-23w
source_contexts:       644
trade_opportunities:  12,699
variant_runs:         420
pair_decisions:       270,480
variant_week_results: 9,660
trade_events:         0
stop_events:          17,105
tradeEventRowsAvailable metadata: 2,030,667
```

DB proof:

```txt
JSON week rows: 9,660
DB week rows:   9,660
mismatches:     0
Friday Strength directional:     644/644
Market-open Strength directional: 644/644
bad source weeks: 0
first friday/open: 2026-01-02T22:00:00.000Z / 2026-01-04T23:00:00.000Z
last friday/open:  2026-06-05T21:00:00.000Z / 2026-06-07T22:15:00.000Z
```

Runtime:

```txt
wall time: 273.8s
week_prepare_all: 106.9s
canonical_bar_load: 84.9s total across 23 weeks
variant_evaluation: 83.9s across 9,660 variant-week rows
warehouse write: 72.7s
pair_decisions_write: 52.8s
```

Read: current-2026 is now a source-complete reusable warehouse proof. The next
speed target is pair-decision and weekly bar/source preparation for larger
ranges; source completeness is the gate before separated-year validation, not
just runtime.

## Targeted Mark-Price Speed Pass

The next reusable speed pass changed the shared mark-price matrix loader used
by the side-selector. Side-selector scoring only needs prices at the receipt
path timestamps, not every M1 bar in the week, so
`loadPathMarkPriceMatrix` now uses targeted latest-bar lookups for sparse path
timestamp sets. Dense timestamp sets fall back to the older range-scan path via
`PATH_MARK_TARGETED_LOOKUP_MAX_TIMESTAMPS` so future minute-by-minute consumers
do not inherit a hidden index-lookup penalty.

This pass also made pair-decision persistence COPY-backed by default, with
`RESEARCH_MATRIX_PAIR_DECISION_WRITE_METHOD=insert` preserving the previous
JSON-recordset path. Pair decisions now store a compact
`sourceStateJoin: research_matrix_source_contexts` pointer by default instead
of repeating source-state direction JSON for every variant/week/pair; use
`RESEARCH_MATRIX_PAIR_DECISION_SOURCE_STATE=full` if a verbose warehouse run is
needed.

One-week proof after the fallback guard:

```txt
dataset_id:   53b5f668-32cc-4986-a24d-7a8a1e7c8b25
dataset_hash: gate44-targetmarks-fallback-420-noevents-20260618-1w
source_contexts:       28
trade_opportunities:  579
variant_runs:         420
pair_decisions:       11,760
variant_week_results: 420
trade_events:         0
stop_events:          290
canonical_bar_load:   0.34s
warehouse write:      4.44s
pair_decisions_write: 1.54s
```

Current-2026 source-complete scale proof after targeted marks:

```txt
dataset_id:   27da83a7-26e5-4352-8e13-98f71683ff15
dataset_hash: gate44-targetmarks-420-current2026-noevents-20260618-23w
source_contexts:       644
trade_opportunities:  12,699
variant_runs:         420
pair_decisions:       270,480
variant_week_results: 9,660
trade_events:         0
stop_events:          17,105
```

DB proof:

```txt
JSON week rows: 9,660
DB week rows:   9,660
mismatches:     0
Friday Strength directional:     644/644
Market-open Strength directional: 644/644
bad source rows: 0
first friday/open: 2026-01-02T22:00:00.000Z / 2026-01-04T23:00:00.000Z
last friday/open:  2026-06-05T21:00:00.000Z / 2026-06-07T22:15:00.000Z
```

Runtime comparison for the source-complete current-2026 `23`-week /
`420`-variant exploratory shape:

| Bucket | Before targeted marks | After targeted marks |
| --- | ---: | ---: |
| `canonical_bar_load` | `84.9s` | `6.35s` |
| `week_prepare_all` | `106.9s` | `32.0s` |
| `research_matrix_warehouse_write` | `72.7s` | `41.7s` |
| `matrix_pair_decisions_write` | `52.8s` | `22.1s` |
| `variant_evaluation` | `83.9s` | `85.7s` |

Read: this is the first speed pass that materially changes the projected
seven-year loop. The engine still needs faster variant evaluation and a
cleaner analysis/query layer, but broad exploratory runs no longer have to read
millions of M1 rows just to mark roughly hourly receipt path timestamps.

## Clean-2025 Separated-Year Test

Clean pre-shutdown 2025 receipts were selected for `39` displayed weeks,
`2025-01-06` through `2025-09-29`, with one latest receipt per week.

M1 materialization and coverage proof:

```txt
weeks: 2024-12-30 prior freeze week + 39 clean-2025 weeks
M1 gap backfill: fetched=7,917,672 upserted=7,917,672 errors=0
M1 coverage readback: complete=1,090 partial=30 missing=0 inProgress=0
lowest coverage: 77.86%
```

The `30` partial rows are concentrated in the prior 2024 year-end freeze week
plus two clean CADCHF weeks. They did not block the weekly Strength decision
context.

The first full-range Strength derivation hit Node heap limits, so the same
M1-backed Strength history was written in month chunks instead of raising heap
as the default path. Chunked write result:

```txt
chunks: 9
windows: 1h,4h,24h
cadence: 15m
rows read back: 640,224
readback time: 12.44s
Friday Strength directional: 39/39 weeks, 28/28 pairs each
Market-open Strength directional: 39/39 weeks, 28/28 pairs each
first friday/open: 2025-01-03T22:00:00.000Z / 2025-01-05T23:15:00.000Z
last friday/open:  2025-09-26T21:00:00.000Z / 2025-09-28T22:30:00.000Z
```

This preserves the Gate 43 contract: market-open Strength uses FX market-truth
open, not the later 8pm Eastern execution window.

COT candidate dataset:

```txt
dataset_id:   89f068d3-38c6-4756-816e-76803457ac8d
dataset_hash: gate44-clean2025-cot-candidates-noevents-20260618
source_contexts:       1,092
trade_opportunities:  22,246
variant_runs:         6
pair_decisions:       6,552
variant_week_results: 234
trade_events:         0
stop_events:          27
```

DB proof:

```txt
JSON week rows: 234
DB week rows:   234
mismatches:     0
bad Friday Strength rows: 0
bad market-open Strength rows: 0
```

Clean-2025 COT result:

| Variant | Total ADR | Worst Path DD | R/DD | Week-Close ADR |
| --- | ---: | ---: | ---: | ---: |
| No stop | `+87.74` | `-85.19` | `1.03` | `-143.18` |
| `25%` runner BE, no stop | `+96.01` | `-87.10` | `1.10` | `-21.17` |
| `20%` runner BE, no stop | `+94.35` | `-86.72` | `1.09` | `-45.57` |
| `15` ADR basket SL | `+20.38` | `-24.82` | `0.82` | `-86.36` |
| `15` ADR basket SL + `20%` runner BE | `+25.07` | `-24.16` | `1.04` | `-19.09` |
| `15` ADR basket SL + `25%` runner BE | `+28.92` | `-23.99` | `1.21` | `-2.28` |

Dealer/Commercial candidate dataset:

```txt
dataset_id:   10dd52b6-c8f5-4c98-99dd-6bc5e36f4f88
dataset_hash: gate44-clean2025-dealer-commercial-candidates-noevents-20260618
source_contexts:       1,092
trade_opportunities:  22,246
variant_runs:         6
pair_decisions:       6,552
variant_week_results: 234
trade_events:         0
stop_events:          60
```

DB proof:

```txt
JSON week rows: 234
DB week rows:   234
mismatches:     0
bad Friday Strength rows: 0
bad market-open Strength rows: 0
```

Clean-2025 Dealer/Commercial result:

| Variant | Total ADR | Worst Path DD | R/DD | Week-Close ADR |
| --- | ---: | ---: | ---: | ---: |
| No pair stop | `+67.09` | `-27.88` | `2.41` | `-59.19` |
| `20%` runner BE, no pair stop | `+70.54` | `-28.56` | `2.47` | `-26.66` |
| `25%` runner BE, no pair stop | `+71.40` | `-28.73` | `2.48` | `-18.53` |
| `0.70` ADR pair inventory SL | `+3.21` | `-12.89` | `0.25` | `-12.87` |
| `0.70` ADR pair inventory SL + `20%` runner BE | `-2.33` | `-15.99` | `-0.15` | `+9.36` |
| `0.70` ADR pair inventory SL + `25%` runner BE | `-2.80` | `-16.19` | `-0.17` | `+14.92` |

Read: the old all-zero clean-2025 result was a missing-Strength/source-coverage
blocker, not a strategy result. With M1-backed Strength context, the clean-2025
test is real. The current-2026 fixed `0.70` Dealer/Commercial pair stop does
not survive clean-2025; it cuts too much recovery. Dealer/Commercial without
the pair stop, especially with a small BE runner, is the clean-2025 leader.
COT fixed basket stop plus BE runner survives but is materially weaker.

Next decision: do not promote a fixed 2026 stop threshold from this evidence.
The next separated-year work should test robustness of the source model and
stop policy separately, with 2024 as the next adversarial year before a broad
seven-year matrix.

## Seven-Year Coverage Manifest

Gate 44 added a coverage-manifest mode to the existing matrix dataset contract
script. This is coverage/readiness only; it does not simulate variants or tune
strategy parameters.

```txt
npx tsx app/scripts/verification/export-research-matrix-dataset-contract.ts \
  --coverage-manifest \
  --from-year=2019 \
  --to-year=2026 \
  --latest-display-week=2026-06-08 \
  --write
```

Current manifest receipts:

```txt
app/reports/data-verification/research-matrix-coverage/research-matrix-coverage-manifest-2019-2026-20260619-002530.json
app/reports/data-verification/research-matrix-coverage/research-matrix-coverage-manifest-2019-2026-20260619-002530.md
```

The manifest checks receipt availability, M1 path coverage, Friday Strength,
market-open Strength, COT report availability, and Dealer/Commercial source
context separately. Market-open Strength remains FX market-truth open, not the
later execution window.

Year-level readback:

| Year | Included Weeks | Valid Receipts | M1 Complete | Friday Strength | Market-Open Strength | COT | Strict Ready |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2019 | `52` | `0/52` | `0/1484` | `0/52` | `0/52` | `51/52` | `0/52` |
| 2020 | `52` | `0/52` | `0/1484` | `0/52` | `0/52` | `51/52` | `0/52` |
| 2021 | `52` | `0/52` | `0/1484` | `0/52` | `0/52` | `52/52` | `0/52` |
| 2022 | `52` | `0/52` | `0/1484` | `0/52` | `0/52` | `52/52` | `0/52` |
| 2023 | `52` | `0/52` | `0/1484` | `0/52` | `0/52` | `51/52` | `0/52` |
| 2024 | `53` | `50/53` | `0/1512` | `0/53` | `1/53` | `53/53` | `0/53` |
| 2025 | `39` | `39/39` | `1090/1120` | `39/39` | `39/39` | `39/39` | `36/39` |
| 2026 | `23` | `23/23` | `643/672` | `23/23` | `23/23` | `23/23` | `21/23` |

Read this as a strict coverage-clean manifest, not a strategy pass/fail table.
The 2025 and 2026 source context is complete, but strict readiness still flags
known M1 partial rows:

- `2025-09-01` CADCHF `88.93%`.
- `2025-09-15` CADCHF `89.74%`.
- `2026-02-16` CADCHF `88.53%`.
- The first included 2025/2026 weeks also inherit prior year-end freeze-week
  partials.

COT report gaps are now explicit:

- `2019-01-07`
- `2020-12-28`
- `2023-07-10`

### 2024 Next-Year Blocker Map

The next adversarial separated year is 2024. Existing 1h receipt generation now
has valid hedged-grid receipts for the 50 normal displayed weeks
`2024-01-08` through `2024-12-16`.

The missing/invalid receipt weeks are not hidden:

- `2024-01-01`
- `2024-12-23`
- `2024-12-30`

These are holiday/year-end partial weeks on the 1h path. They require explicit
regime handling before they are scored or excluded. A smoke export for
`2024-01-01` produced `engines=0`, `fills=0`, and all 28 price symbols missing,
while `2024-01-08` produced a valid 28-pair receipt. Do not treat the three
holiday weeks as ordinary source failures.

2024 still has no M1-backed historical path/Strength proof:

```txt
valid receipts:        50/53
M1 complete rows:       0/1512
M1 partial rows:       28
M1 missing rows:    1,484
Friday Strength:        0/53
market-open Strength:   1/53
COT reports:           53/53
strict ready weeks:     0/53
```

The 28 M1 partial rows are the displayed week `2024-12-30`; lowest readback was
CADCHF at `77.86%`. The rest of 2024 is still M1-missing, so the next step is
not source/model scoring. It is canonical Oanda 1m backfill for the 2024
required weeks, then month-chunk M1-backed Strength derivation, then a rerun of
the coverage manifest.

Coverage readback performance was tightened again while building this manifest:
`getCanonicalHourlyCoverage` now aggregates DB rows by distinct week windows and
then joins back to pair-week requests. Proof checks:

```txt
2026-06-08 one-week M1 coverage: 28 complete, 0 partial, 0 missing, 3.32s
2025-12-29..2026-06-08 explicit 24-week readback:
  complete=643 partial=29 missing=0 lowest=71.83%, 76.60s
full 2019-2026 manifest write: 441.7s
```

## M1-First Warehouse Correction And SQLite Pivot

Freedom challenged the year-by-year recovery path, correctly. The right base
layer is not a manual 2024-first loop. It is:

```txt
canonical M1 bars -> M1 coverage proof -> Strength snapshots -> source/receipt checks -> matrix
```

Gate 44 first added the DB M1-only planner/executor:

```txt
app/scripts/verification/plan-bulk-m1-backfill.ts
upsertCanonicalHourlyBarsForInstrumentWindow(...)
```

The initial all-years DB dry run proved the backlog shape:

```txt
receipt: app/reports/data-verification/canonical-m1-warehouse/canonical-m1-backfill-plan-2019-2026-20260619-014610.md
chunks: 30
complete rows: 1,733
partial rows: 59
missing rows: 9,072
weak rows: 9,131
estimated weak M1 bars: 65,743,200
```

Bounded DB proofs then worked:

```txt
2024-01-08: fetched/upserted 199,568 M1 bars, 28/28 complete
2024-01-15: fetched/upserted 198,950 M1 bars, 28 complete / 0 partial / 0 missing
2024-01-01..2024-01-22: fetched/upserted 757,177 M1 bars,
  84 complete / 28 partial / 0 missing
```

The remaining `28` partial rows in that four-week batch are the New Year
holiday week `2024-01-01`, not ordinary missing rows.

That DB path is now superseded for raw seven-year M1 storage. A later older-year
DB backfill hit PostgreSQL storage exhaustion (`No space left on device`), and
the DB read showed `canonical_price_bars` was already roughly `10 GB` of the
roughly `13 GB` database footprint. The table also has a duplicate-index
candidate:

```txt
canonical_price_bars_symbol_timeframe_bar_open_utc_key
idx_canonical_price_bars_lookup
```

Both are on `(symbol, timeframe, bar_open_utc)` shape, one ascending unique and
one descending lookup. The lookup index was identified as a cleanup candidate,
but it was not dropped in this gate. The important architectural decision is
separate: do not force seven-year raw M1 into the Render production database.

Gate 44 added a local SQLite raw-M1 warehouse instead:

```txt
app/src/lib/research/localM1Warehouse.ts
app/scripts/verification/plan-local-m1-backfill.ts
data/canonical-m1/canonical-m1.sqlite
```

`data/` is gitignored. The warehouse is enabled only by
`LIMNI_M1_WAREHOUSE=sqlite` or `LIMNI_M1_SQLITE_PATH`, so production DB behavior
does not change by default. `pathBarLoader` and `historicalStrength` now read
`1m` bars from SQLite when that switch is set; otherwise they keep using the
canonical DB path.

Local M1 receipts:

```txt
smoke chunk:
  app/reports/data-verification/local-m1-warehouse/local-m1-backfill-plan-2019-2019-20260619-070837.md

2019-2022:
  app/reports/data-verification/local-m1-warehouse/local-m1-backfill-plan-2019-2022-20260619-080858.md
  app/reports/data-verification/local-m1-warehouse/logs/local-m1-2019-2022-chunks-2-all-20260619-031332.log

2023-2026:
  app/reports/data-verification/local-m1-warehouse/local-m1-backfill-plan-2023-2026-20260619-090641.md
  app/reports/data-verification/local-m1-warehouse/logs/local-m1-2023-2026-chunks-all-20260619-041155.log

year coverage summary:
  app/reports/data-verification/local-m1-warehouse/local-m1-year-coverage-summary-20260619-093609.md
```

Unified local M1 coverage through latest display week `2026-06-08`:

| Year | Weeks | Rows | Complete | Partial | Missing | Lowest Coverage |
|---:|---:|---:|---:|---:|---:|---:|
| 2019 | 52 | 1456 | 1126 | 330 | 0 | 46.58% |
| 2020 | 52 | 1456 | 1303 | 153 | 0 | 67.97% |
| 2021 | 52 | 1456 | 1340 | 116 | 0 | 69.47% |
| 2022 | 52 | 1456 | 1420 | 36 | 0 | 77.69% |
| 2023 | 52 | 1456 | 1428 | 28 | 0 | 73.71% |
| 2024 | 53 | 1484 | 1400 | 84 | 0 | 73.96% |
| 2025 | 52 | 1456 | 1398 | 58 | 0 | 71.83% |
| 2026 | 23 | 644 | 643 | 1 | 0 | 88.53% |

Read: the raw M1 infrastructure backlog is no longer the blocker. There are
`0` missing local M1 symbol-weeks across 2019-2026. The remaining partial rows
are real market/holiday/provider coverage facts that must be carried into
source-path attribution; they are not a failed backfill state.

SQLite loader smokes passed:

```txt
pathBarLoader, EURUSD 2024-04-01:
  1413 bars, first 2024-04-01T00:00:00.000Z,
  last 2024-04-01T23:59:00.000Z

deriveFxStrengthHistoryFromM1, 2024-04-01 00:00..03:00:
  snapshotsGenerated=3
  rowsGenerated=24
  completeRows=24
  incompleteRows=0
  minCoveragePct=99.2857
```

Do not spend more time on DB raw-M1 backfill. The next execution should derive
M1-backed Strength from the local warehouse in bounded chunks, then rerun
source/receipt coverage and the source/model matrix with
`LIMNI_M1_WAREHOUSE=sqlite`.

## Next Implementation Order

### 2026-06-19 Update: Source/Path Warehouse Ready Enough For Seven-Year Source Tests

After Freedom challenged the year-by-year path, Gate 44 completed the M1-first
warehouse build and ran the first real seven-year source-model matrices.

Completed base coverage:

```txt
raw M1: local SQLite filled for 2019-2026 through 2026-06-08
missing local M1 symbol-weeks: 0
latest valid hedged-grid receipts: 372 weeks
source coverage audit: 10,416 pair rows
missing all sources: 0
known COT gaps: 84 pair rows, from 2019-01-07, 2020-12-28, 2023-07-10
```

Local weekly decision-point Strength was derived from the local M1 warehouse and
stored in the local Strength table. Friday Strength is essentially clean across
the receipt set; market-open Strength remains patchy in older years because it
uses FX market-truth open and does not fall forward to the later execution
window.

The side-selector runner was then repaired for broad history:

- week preparation now processes bounded batches instead of retaining every
  mark-price matrix;
- exploratory mode does not materialize trade-event rows when
  `--matrix-trade-event-mode=none`;
- per-week path caches are cleared after each prepared week;
- the warehouse writer receives compact week/source/opportunity rows instead of
  retained full receipt objects;
- `--progress` prints heap/RSS progress for long runs.

First 10-week smoke after the memory fix:

```txt
dataset_id: 1fff4936-3e4b-4df5-8d6e-02291f7596da
variant weeks: 60
source_contexts: 280
trade_opportunities: 5,680
pair_decisions: 1,680
variant_week_results: 60
trade_events: 0
runtime: 30.6s
```

First narrow seven-year source/model pass:

```txt
weeks: 372
variants: 6
variant_week_rows: 2,232
pair_decisions: 62,496
trade_events: 0
JSON-to-DB parity: 2,232/2,232, mismatches 0
```

Broad seven-year source-model matrix:

```txt
dataset_id:   479624d1-f6a2-4928-82f1-981137762bdc
dataset_hash: cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36
weeks: 372
variants: 35
source_contexts: 10,416
trade_opportunities: 222,769
pair_decisions: 364,560
variant_week_results: 13,020
trade_events: 0
stop_events: 0
JSON-to-DB parity: 13,020/13,020, mismatches 0
```

Broad matrix receipts:

```txt
app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-372w-20260619-134630.json
app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-372w-20260619-134630.md
app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-source-model-matrix-read-372w-20260619-134630.md
```

Top broad source-model rows by return / worst-path DD, no stops/runners/TP
tuning:

| Rank | Variant | Total ADR | Worst Path DD | R/DD | Week-Close ADR |
|---:|---|---:|---:|---:|---:|
| 1 | Open canonical strength fade | `+1005.18` | `-228.13` | `4.41` | `-8310.13` |
| 2 | Friday frozen strength when it disagrees with COT Faces | `+744.11` | `-185.53` | `4.01` | `-4318.14` |
| 3 | COT Faces when Open canonical strength disagrees | `+620.06` | `-155.18` | `4.00` | `-4024.63` |
| 4 | Friday frozen strength when it disagrees with COT Faces commercial-delta contrarian | `+731.62` | `-188.37` | `3.88` | `-4376.99` |
| 5 | Friday frozen strength + open canonical strength fade agree | `+698.41` | `-189.90` | `3.68` | `-3995.66` |
| 6 | COT commercial-delta + open strength fade agree | `+536.94` | `-163.03` | `3.29` | `-4009.11` |

Read: this is the first real broad source-model answer, not a stop-policy
answer. The winners have large positive realized ADR but severe week-close drag,
so stop/runner/TP work is now justified as the next separate gate instead of
being used to hide source/path uncertainty. The striking early read is that
open Strength fade and source-disagreement rows deserve serious analysis before
any parameter optimization.

Runtime profile for the broad source-model pass:

```txt
week_prepare_batch: 691.4s
canonical_bar_load: 518.1s
variant_evaluation: 225.6s for 13,020 rows
source_context_build: 160.5s
research_matrix_warehouse_write: 100.1s
matrix_pair_decisions_write: 21.9s
peak logged heap: about 3.24 GB
```

Next implementation order:

1. Use the broad source-model matrix and read report to answer source questions:
   source agreement/fade, year/regime breakouts, bad-week attribution, and
   pair/currency concentration.
2. Add targeted query/report helpers over the warehouse so analysis does not
   rerun M1/source truth.
3. Only after source-model reads are reviewed, reopen a separate optimization
   gate for stops, runners, TP, grid entries, and pair filters.
4. Use exploratory persistence by default for broad discovery:
   source contexts, opportunities, pair decisions, weekly results, stop events,
   and selected detailed trade-event ledgers only when requested.

Gate 44 save point: do not extend this gate into optimization. Gate 45 is the
review/audit gate for this work:
`docs/research/GATE45_SEVEN_YEAR_MATRIX_REVIEW_AND_ACCURACY_AUDIT_HANDOFF_2026-06-19.md`.
The Gate 45 reviewer should decide whether the matrix is `PASS`, `PASS WITH
CAVEATS`, or `FAIL` before any new stop, TP, runner, grid, or pair-filter work.

## Frozen

- No broad seven-year run yet.
- No release canon changes.
- No Pine verifier cleanup.
- No live promotion.
- No new strategy optimization before the warehouse can preserve source and
  execution ledgers.
