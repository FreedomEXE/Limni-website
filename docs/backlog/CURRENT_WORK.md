# Current Work

Status: active checklist. Keep this short and update it when gates change.

This is the running repo-visible checklist. Persistent memory stays in
`C:/Users/User/Documents/GitHub/freedom-ops/.codex/`; this file tracks the
current Limni work plan so Freedom does not have to reconstruct it from chat.

## Workflow

- Use at most three active running surfaces:
  - `CODEX_SESSION.md` for hot recovery and frozen areas.
  - `docs/backlog/CURRENT_WORK.md` for the active checklist.
  - One focused gate/release doc only when the active gate needs durable detail.
- Archive completed or stale notes under `archive/` using mirrored repo paths.
- Do not start coding until the active gate is named.
- For broad issue sets, classify first, then patch one gate at a time.
- Gate labels use a sequence number plus a scope slug. The slug is the real
  boundary; the number is only a recovery handle.

## Active Gate

Gate 44: reusable-seven-year-matrix-dataset.

Status: active. Gate 43 created the M1-backed Strength history/context layer
and corrected market-open confirmation to use FX market-truth open, separate
from the later execution window. Gate 44 builds the reusable seven-year matrix
warehouse so source context, grid opportunities, variant decisions, trade
events, stops, and attribution can be queried after the run without rerunning
market/source truth. First one-week warehouse proof passed on `2026-06-08`
with M1 marks, Gate 43 market-open Strength context, `28/28` Friday and
market-open directional Strength rows, and exact JSON-to-DB weekly-result
parity. The proof wrote dataset
`799e6a2c-5aa3-4583-bd59-2f04dd3ff2a6` with `28` source-context rows, `579`
base trade opportunities, `420` variant runs, `11,760` pair decisions, `420`
variant-week rows, `102,084` trade events, and `290` stop events. Read: do not
run the broad seven-year matrix yet. The first warehouse write took about
`93.9s` of `162.4s` wall time for one week; the COPY-backed writer now brings
the same `420`-variant / `102,084`-event proof to `66.9s` wall time, `22.8s`
warehouse write, and `17.2s` trade-event write with exact parity. Gate 44 now
has explicit trade-event persistence modes. Exploratory mode
`--matrix-trade-event-mode=none` wrote the same `420` variant weeks with source
contexts, opportunities, pair decisions, weekly results, and stop events in
`22.8s` wall / `4.5s` warehouse time, with `0` trade-event rows by design and
exact JSON-to-DB weekly-result parity. Selected-event mode also passed on a
narrow COT slice, writing `12` variant weeks and `147` detailed trade events
for one chosen runner variant. Read: broad discovery should default to
exploratory persistence; promotion-grade or failure-autopsy runs can use full
or selected trade-event ledgers without rebuilding source/market truth.
Current-2026 closed-week proof then exposed and fixed the next real blocker:
M1-backed Gate 43 Strength initially existed only for the latest current weeks,
so the first `23`-week warehouse was fast and parity-clean but not
source-complete. Current-2026 FX M1 bars were materialized for `2026-01-05`
through `2026-06-08` plus the prior `2025-12-29` week, and Strength history
was derived/written for `15m` cadence with `1h/4h/24h` windows
(`382,176` rows). The source-complete warehouse proof wrote dataset
`90ab914f-13a8-415d-ba54-851f1f25ac4a` /
`gate44-explore-420-current2026-sourcecomplete-noevents-20260618-23w` with
`644` source contexts, `12,699` opportunities, `420` variants, `270,480` pair
decisions, `9,660` variant-week rows, `0` trade events, and `17,105` stop
events. DB parity was exact (`9,660/9,660`, zero mismatches), Friday Strength
was `644/644` directional, market-open Strength was `644/644` directional, and
bad source weeks were `0`. Runtime was `273.8s`; the remaining bottlenecks are
multi-week bar/source preparation and pair-decision persistence. A follow-up
targeted mark-price pass changed the shared `pathBarLoader` mark matrix so
side-selector scoring reads latest marks at receipt path timestamps instead of
scanning every M1 bar in each week, with a dense-timestamp fallback for future
minute-level consumers. Pair decisions now use COPY by default and store a
source-context join pointer unless a verbose run is requested. The
source-complete current-2026 proof after this pass wrote dataset
`27da83a7-26e5-4352-8e13-98f71683ff15` /
`gate44-targetmarks-420-current2026-noevents-20260618-23w`: exact DB parity
(`9,660/9,660`, zero mismatches), Friday Strength `644/644`, market-open
Strength `644/644`, bad source rows `0`. Profile shifted materially:
`canonical_bar_load` `84.9s -> 6.35s`, `week_prepare_all` `106.9s -> 32.0s`,
warehouse write `72.7s -> 41.7s`, pair-decision write `52.8s -> 22.1s`.
Remaining broad-run bottlenecks are variant evaluation, source-context reads,
and analysis/query reporting.

Clean-2025 separated-year test is now real, not all-zero. The local path
materialized M1 for `2024-12-30` plus the `39` clean displayed weeks
`2025-01-06` through `2025-09-29` (`7,917,672` rows fetched/upserted,
`0` errors). Coverage readback was `1,090` complete, `30` partial, `0`
missing. M1-backed Strength was written in nine month chunks after the full
range hit Node heap limits; readback loaded `640,224` Strength rows in
`12.44s`, and all `39/39` weeks had `28/28` Friday plus `28/28` market-open
directional Strength. First/last Friday Strength:
`2025-01-03T22:00:00Z` / `2025-09-26T21:00:00Z`; first/last market-open
Strength: `2025-01-05T23:15:00Z` / `2025-09-28T22:30:00Z`. This preserves FX
market-truth open, separate from the later 8pm Eastern execution zone.

Clean-2025 candidate datasets:
`gate44-clean2025-cot-candidates-noevents-20260618` /
`89f068d3-38c6-4756-816e-76803457ac8d` and
`gate44-clean2025-dealer-commercial-candidates-noevents-20260618` /
`10dd52b6-c8f5-4c98-99dd-6bc5e36f4f88`. Both passed exact JSON-to-DB weekly
parity (`234/234`, zero mismatches), each with `1,092` source contexts and `0`
bad Friday/open Strength rows. COT fixed `15` ADR basket SL + `25%` BE runner
returned `+28.92` ADR / `-23.99` worst-path DD / `1.21` R/DD / `-2.28`
week-close ADR; the `20%` BE runner row returned `+25.07` / `-24.16` /
`1.04` / `-19.09`. Dealer/Commercial with the current-2026 fixed `0.70` pair
inventory SL failed clean-2025 (`25%` BE row `-2.80` ADR / `-16.19` DD), while
Dealer/Commercial without the pair stop was the clean-2025 leader (`25%` BE
row `+71.40` ADR / `-28.73` DD / `2.48` R/DD / `-18.53` week-close ADR).
Read: do not promote the fixed `0.70` pair stop from current-2026; stop policy
and source model must be separated before a seven-year sweep.

Seven-year coverage manifest now exists:
`app/reports/data-verification/research-matrix-coverage/research-matrix-coverage-manifest-2019-2026-20260619-002530.md`
and matching JSON. This is coverage/readiness only, not a strategy run. Current
state: 2019 `0/52` ready, 2020 `0/52`, 2021 `0/52`, 2022 `0/52`, 2023 `0/52`,
2024 `0/53`, 2025 `36/39` strict-ready, 2026 `21/23` strict-ready. The 2025
and 2026 source/Strength contexts are complete; strict blockers are the known
partial M1 rows, not a source failure. Named COT gaps are `2019-01-07`,
`2020-12-28`, and `2023-07-10`.

Freedom correctly challenged the manual year-by-year recovery path. Gate 44
pivoted to M1-first warehouse build:
`canonical M1 bars -> M1 coverage proof -> Strength snapshots -> source/receipt
checks -> matrix`. The first DB planner/executor
`app/scripts/verification/plan-bulk-m1-backfill.ts` proved the all-years raw-M1
backlog (`9,072` missing rows, about `65,743,200` weak M1 bars) and bounded DB
proofs worked for early 2024, but a later older-year DB fill hit PostgreSQL
storage exhaustion (`No space left on device`). Render/Postgres is therefore
the wrong place to force seven-year raw M1.

Gate 44 now uses a local SQLite raw-M1 warehouse for research:
`app/src/lib/research/localM1Warehouse.ts`,
`app/scripts/verification/plan-local-m1-backfill.ts`, and
`data/canonical-m1/canonical-m1.sqlite` (`data/` is gitignored). It is opt-in
only through `LIMNI_M1_WAREHOUSE=sqlite` or `LIMNI_M1_SQLITE_PATH`; production
DB behavior is unchanged by default. `pathBarLoader` and
`historicalStrength` now read `1m` bars from SQLite when enabled.

Local M1 fill is complete through latest display week `2026-06-08`:
`2019-2022` receipt
`app/reports/data-verification/local-m1-warehouse/local-m1-backfill-plan-2019-2022-20260619-080858.md`,
`2023-2026` receipt
`app/reports/data-verification/local-m1-warehouse/local-m1-backfill-plan-2023-2026-20260619-090641.md`,
and year summary
`app/reports/data-verification/local-m1-warehouse/local-m1-year-coverage-summary-20260619-093609.md`.
Readback: 2019 `1126` complete / `330` partial / `0` missing, 2020 `1303` /
`153` / `0`, 2021 `1340` / `116` / `0`, 2022 `1420` / `36` / `0`, 2023
`1428` / `28` / `0`, 2024 `1400` / `84` / `0`, 2025 `1398` / `58` / `0`,
2026 `643` / `1` / `0`. Read: raw M1 infrastructure is no longer the blocker;
partials are market/holiday/provider facts to carry into attribution, not a
failed backfill state.

SQLite loader smokes passed: `pathBarLoader` loaded EURUSD `2024-04-01` from
local M1 with `1413` bars, and `deriveFxStrengthHistoryFromM1` generated
`3` hourly snapshots / `24` rows for `2024-04-01T00:00..03:00Z` with `0`
incomplete rows. Next action: derive M1-backed Strength from the local SQLite
warehouse in bounded chunks, then rerun weekly context/source/receipt coverage
with `LIMNI_M1_WAREHOUSE=sqlite` before the broad seven-year source/model
matrix.

2026-06-19 Gate 44 update: the setup path is now past coverage and into real
seven-year source tests. Local M1 is filled through `2026-06-08`; local weekly
decision-point Strength was derived from that M1 warehouse; latest-valid
receipts cover `372` clean displayed weeks; source coverage passed over
`10,416` pair rows with zero missing-all-source rows. The side-selector runner
was repaired so broad exploratory runs process bounded week batches, avoid
retaining full mark-price matrices, skip trade-event materialization when
`--matrix-trade-event-mode=none`, clear per-week path caches, and write compact
warehouse rows. A 10-week smoke wrote dataset
`1fff4936-3e4b-4df5-8d6e-02291f7596da` with exact persisted counts in `30.6s`.
The first six-variant 372-week numeric pass wrote `2,232` variant-week rows and
passed JSON-to-DB parity with zero mismatches.

The broad source-model-only seven-year matrix is now complete:
dataset `479624d1-f6a2-4928-82f1-981137762bdc`, hash
`cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36`,
`35` variants, `372` weeks, `10,416` source contexts, `222,769` trade
opportunities, `364,560` pair decisions, `13,020` variant-week results,
`0` trade events by design, and exact JSON-to-DB parity (`13,020/13,020`,
zero mismatches). Receipt:
`app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-372w-20260619-134630.md`.
Read report:
`app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-source-model-matrix-read-372w-20260619-134630.md`.
Top R/DD rows are open canonical Strength fade, Friday Strength when it
disagrees with COT Faces, COT Faces when open Strength disagrees, and
Friday/open-fade agreement. Do not treat this as stop-policy proof: the leaders
have severe week-close drag, so stops/runners/TP are the next separate gate
after source-model analysis, not part of this coverage gate.

Gate 44 save point: complete enough for review. Do not continue by tuning
stops, runners, TP, grid entries, or pair filters. The next gate is:

```txt
Gate 45: seven-year-matrix-review-and-accuracy-audit
```

Gate 45 handoff:
`docs/research/GATE45_SEVEN_YEAR_MATRIX_REVIEW_AND_ACCURACY_AUDIT_HANDOFF_2026-06-19.md`.

Gate 45 job: audit the Gate 44 warehouse and broad source-model matrix for
accuracy, robustness, modularity, future-proofing, and metadata sufficiency.
The expected output is `PASS`, `PASS WITH CAVEATS`, or `FAIL` before any new
optimization work.

Durable notes:

- Gate 39 result:
  `docs/research/GATE39_ADR_BASKET_STOP_LOSS_HARDENING_2026-06-16.md`.
- Gate 40 review handoff and first-pass result:
  `docs/research/GATE40_TAKE_PROFIT_RUNNER_REVIEW_HANDOFF_2026-06-16.md`.
- Gate 41 review/design handoff:
  `docs/research/GATE41_BACKWARD_REGIME_VALIDATION_HANDOFF_2026-06-16.md`.
- Gate 42 cleanup/speed handoff:
  `docs/research/GATE42_RESEARCH_STATE_CLEANUP_AND_BACKTEST_ENGINE_REARCHITECTURE_2026-06-16.md`.
- Gate 43 Strength history state:
  `docs/research/GATE43_STRENGTH_HISTORY_AND_CONTINUOUS_CONTEXT_2026-06-18.md`.
- Gate 44 reusable matrix dataset state:
  `docs/research/GATE44_REUSABLE_SEVEN_YEAR_MATRIX_DATASET_2026-06-18.md`.
- Gate 44 first warehouse proof receipt:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-1w-20260618-044522.md`.
- Gate 41 clean-2025 kickstart receipts:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-39w-20260616-190246.md`
  for COT and
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-39w-20260616-191152.md`
  for Dealer/Commercial, each with matching `-stop-events.csv` ledgers.
- Gate 39 review receipt repair: the side-selector audit now emits stop-event
  ledgers proving active fills closed at stops and skipped-fill opportunity
  cost.

Receipts:

- Coarse ADR basket SL sweep:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-124910.md`.
- Refined ADR basket SL sweep:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-125153.md`.
- Pair inventory stop sweeps:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-132732.md`,
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-133045.md`,
  and
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-133329.md`.
- Gate 39 review receipts with stop-event ledgers:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-160225.md`,
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-160515.md`,
  and
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-161014.md`.
- Gate 40 current-2026 TP/runner sweeps:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-163225.md`
  for COT and
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-163524.md`
  for Dealer/Commercial.
- Gate 40 reset-point trailing follow-up sweeps:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-174946.md`
  for COT and
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-175407.md`
  for Dealer/Commercial.

Current read:

- Window: 23 closed displayed weeks, `2026-01-05` through `2026-06-08`.
  Excluded partial/current `2026-06-15`.
- Graduated rows tested: COT commercial-delta + open + Friday Strength
  go-with, and Dealer/Commercial + open + Friday Strength go-with.
- Basket SL definition: close active selected fills and block later selected
  fills when selected-basket marked ADR reaches `-N` from week-open baseline.
- COT row: no stop returned `+113.61` ADR / `-18.91` DD / `6.01` R/DD /
  `-65.57` week-close ADR. The only defensible active stop is around `15` ADR:
  `+98.48` ADR / `-16.57` DD / `5.94` R/DD / `-53.82` week-close ADR, one hit
  week, 33 skipped fills. Stops below `14` ADR cut too much recovery; `20+`
  ADR does nothing.
- Dealer/Commercial row: no stop returned `+58.88` ADR / `-12.46` DD / `4.73`
  R/DD / `-9.99` week-close ADR. Active stops at `11` or `12` ADR hurt return
  without improving the measured worst path DD; `13+` ADR does not trigger.
- 39b pair inventory stop definition: close active fills for a pair-side and
  block later fills for that pair-side when adverse distance from active
  average entry reaches the threshold in that pair's ADR units. Pair stop runs
  before any basket stop.
- Dealer/Commercial benefits from a `0.70` ADR pair inventory stop in current
  2026: `+52.28` ADR / `-6.31` DD / `8.29` R/DD / `-2.68` week-close ADR.
  This sacrifices `6.60` ADR versus no stop but roughly halves measured worst
  DD.
- COT does not improve on pure R/DD with pair stops. Primary hardening remains
  the `15` ADR basket band. A `1.10` ADR pair inventory stop is only a
  secondary candidate if broader proof shows week-close drag is a bigger regime
  risk than current-2026 R/DD suggests.
- Working threshold before backward expansion: COT can carry a `15` ADR basket
  SL candidate; Dealer/Commercial can carry `0.70` ADR pair inventory SL.
- Gate 39 review result: stop definitions and threshold reads pass as a
  research base. The new event ledgers show the stops are robustness pistons,
  not free edge; they reduce measured path/week-close risk by sacrificing some
  recovery and skipped winners.
- Gate 40 first-pass result: basket TP is not validated. `10` ADR is too tight
  and hurts; `15` ADR is weak/non-helpful; `20` and `25` ADR are non-binding in
  the current-2026 window. Break-even runners are the constructive mechanism.
  Trailing runners improved some headline return rows but worsened drawdown,
  stop churn, or week-close quality enough to stay frozen.
- COT Gate 40 leader with the fixed `15` ADR basket SL is `20%` runner BE:
  `+114.31` ADR / `-17.08` DD / `6.69` R/DD / `+3.17` week-close ADR.
  This beats the fixed Gate 39 COT stop row on return and week-close quality,
  with only about `0.52` ADR worse worst-path DD.
- Dealer/Commercial Gate 40 leader with the fixed `0.70` ADR pair SL is `20%`
  runner BE: `+67.48` ADR / `-6.83` DD / `9.88` R/DD / `+27.66` week-close
  ADR. This adds `+15.20` ADR versus the fixed Gate 39 row, with about `0.52`
  ADR worse worst-path DD.
- Gate 40 reset-point trailing follow-up added three runner families: pure BE,
  pure reset trail armed at `+1.0` ADR, and BE-then-reset-trail. Pure reset
  trail is not viable for COT in this current window; it expands drawdown and
  loses too much edge. BE-then-reset-trail is mechanically viable but gives
  away much of the week-close rescue. Pure BE remains the leader.
- Updated current-window leaders after BE sizing: COT fixed `15` ADR basket SL
  + `25%` runner BE is `+118.27` ADR / `-17.21` DD / `6.87` R/DD / `+17.41`
  week-close ADR. Dealer/Commercial fixed `0.70` ADR pair SL + `25%` runner BE
  is `+71.28` ADR / `-6.96` DD / `10.24` R/DD / `+35.24` week-close ADR.
- Gate 40 completion decision: candidate rows for Gate 41 are pure BE runners
  at `20%` and `25%` on the fixed hardening rows. Basket TP, pure reset-point
  trailing, BE-then-reset trailing, and broad trailing-stop matrices are frozen
  unless Freedom explicitly reopens them.
- Gate 41 first recommended slice: clean pre-shutdown 2025, displayed weeks
  `2025-01-06` through `2025-09-29`. Exclude shutdown-affected source report
  dates `2025-09-30` through `2025-12-23`; do not score displayed weeks
  `2025-10-06` through `2025-12-30` as clean live source truth.
- Gate 41 clean-2025 kickstart result: `39` unique latest receipts were
  selected from the generated clean-2025 hedged ADR Grid set. The mechanical
  grid receipts have `28` pair summaries per week, `22,246` total grid trades,
  `112` path points per week, no missing symbols, and no default ADR symbols.
  Four duplicate generated weeks exist (`2025-07-14`, `2025-07-21`,
  `2025-07-28`, `2025-08-04`); duplicates were not deleted, and the latest
  receipt per week was selected.
- Gate 41 source blocker: both candidate runs returned zero selected pair
  sides and `+0.00` ADR, not because paths were missing but because the
  candidate rows require Friday frozen Strength. Local DB coverage starts at
  `2026-01-19` for `currency_strength_snapshots` and
  `asset_strength_snapshots`, while `strength_weekly_snapshots` starts at
  `2026-01-19` and `source_freeze_ledger_weeks` starts at `2026-02-23`.
  `cot_snapshots` for FX FutOnly cover back to `2019-01-08`, so COT coverage is
  not the immediate blocker.
- Gate 41 diagnostic receipt:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-191355.md`.
  On `2025-01-06`, the COT base row excluded all `28` pairs for
  `missing_friday_strength`; Dealer/Commercial excluded `17` pairs for
  `missing_friday_strength` and `11` for `dealer_commercial_disagree`.
- Current Gate 41 decision: clean 2025 cannot validate or falsify the Gate 40
  candidate rows until historical Friday Strength/frozen-source coverage is
  reconstructed or Freedom explicitly changes the test definition. Do not call
  the all-zero 2025 result a strategy pass or fail.
- Gate 42 next read: the research scripts share source/data primitives with
  the app, but the newer hedged 28-pair ADR Grid runner remains research-only.
  Do not pretend the research engine and app runtime engine are fully unified
  yet. The promotion path is: make the local research kernel fast and
  reproducible, then later move a winning candidate into a shared runtime
  boundary with parity tests.
- Gate 42 speed target: profile first, then split the local research pipeline
  into data-prep/cache, source-context cache, numeric simulation kernel, and
  output/report layer. Use vectorized/matrix-style preprocessing for bars,
  source masks, ADR values, and candidate filters; reserve event-driven logic
  for stateful order execution. Avoid heavy object allocation in tight loops,
  avoid repeated JSON parsing/path rebuilding per variant, and calculate global
  metrics lazily at the end.
- Gate 42 execution-data target: current hedged ADR Grid research uses
  confirmed `1h` bars and guardrails to avoid overstating intrabar precision.
  The repo can load/save `1m` Oanda bars, and canonical price bars were intended
  to support alternate resolutions/providers. Verify that coverage and adapter
  boundary, then move ADR Grid research execution toward `1m` bars with cached,
  prealigned arrays. Retire the `1h` overstatement guardrails only after the
  `1m` path has parity/smoke receipts.
- Gate 42 smoke target after `1m` migration: current-2026 closed weeks only,
  one COT candidate row and one Dealer/Commercial candidate row, no source
  definition changes, and a receipt reporting runtime, selected pair sides,
  trade count, total ADR, worst path DD, week-close ADR, and missing `1m`
  coverage.
- Gate 42 repo classification/staging pass is complete for the selected durable
  set: Gate 36-42 research scripts/docs, selected Gate 40/41 side-selector
  receipts, `package.json`, and shared source-context speed helpers. Pine
  verifier changes, release screenshots, `$1`, bulk reports, local profile
  outputs, and release canon remain unstaged.
- Gate 42 profiling found source context, not numeric simulation, as the slow
  path. The first 39-week COT profile spent about `287.8s` in
  `source_context_build`; after source-context need selection it was still
  about `273.9s`. A shared Strength lookback batch read then cut the one-week
  mixed COT plus Dealer/Commercial smoke from about `4.6s` source-context time
  to about `1.6s` with unchanged summary results.
- Gate 42 `1h` exporter smoke for `2026-06-08` passed: 28 pairs, 56 engines,
  579 fills, `+81.4034` final ADR, `-17.4714` max drawdown. The same `1m`
  smoke ran cleanly but produced zero engines/fills, confirming the adapter path
  is wired but stored M1 coverage/materialization is still missing.
- Gate 42 M1 materialization path now reuses the existing canonical hourly
  backfill/coverage owner with `--timeframe=1m`; default behavior remains `1h`
  for existing callers. Read-only EURUSD coverage for `2026-06-08` showed
  stored M1 missing at `0/7200`; dry-run Oanda fetch returned `7159` complete M1
  bars and wrote `0` DB rows. The write path now batches canonical bar upserts
  through the existing owner instead of writing one row per DB call.
- Gate 42 M1 smoke materialization is complete for displayed week
  `2026-06-08`: EURUSD wrote `7159` M1 bars and read back complete at `99.43%`;
  gap-only all-FX materialization wrote the other `27` FX pairs with `192619`
  M1 bars, 28/28 complete coverage, and lowest coverage `95.24%`.
- Gate 42 `1m` exporter smoke now passes after materialization: 28 pairs,
  56 engines, 611 fills, `+87.8034` final ADR, `-21.3196` max drawdown.
  One-week `1m` COT and Dealer/Commercial side-selector smokes also passed on
  the candidate families.
- Gate 42 path-cache consolidation has started in the existing app performance
  owner: `app/src/lib/performance/pathBarLoader.ts` now builds prealigned
  timelines/mark lookups, and both the FX hedged exporter and side-selector
  audit consume it. A follow-up direct timeline loader trims the M1 DB payload
  to close/high/low/price rows and avoids a script-local mark-lookup build.
  Direct timeline smokes preserved the same `1m` outputs; single COT and
  Dealer/Commercial reruns put `canonical_bar_load` around `2.6s` to `3.0s`.
  A variant path cache then cut repeated marked-path rebuilding across four
  current-week rows: COT `pair_stop_path_build` dropped from about `4.4s` to
  about `1.5s`, and Dealer/Commercial dropped from about `0.8s` to about
  `0.6s`. Parallel DB runs are still noisy, so broad M1 sweeps need the next
  layer: reusable week-level numeric arrays/source masks, not another local
  receipt parser.
- Gate 42 indexed-trade matrix pass now binds each trade once to entry/exit
  milliseconds, size, and the shared M1 mark-price series. Results stayed
  unchanged on the one-week current smoke. COT path rebuilding dropped from
  seconds to about `0.2s` and runner simulation to about `0.5s`; Dealer/
  Commercial path rebuilding dropped to about `0.07s` and runner simulation to
  about `0.02s`. The remaining smoke bottlenecks are now `canonical_bar_load`
  and source-context reads, not marked-path reconstruction.
- Gate 42 close-only mark matrix now separates side-selector mark-price reads
  from high/low path-bar timelines. Side-selector M1 smokes still preserve the
  exact rows, while `canonical_bar_load` fell to about `1.9s` for COT and
  about `2.2s` for Dealer/Commercial in sequential one-week profiles. The
  shared canonical basket source now also has a short runtime cache so mixed
  COT/app-source contexts can reuse the same week result inside one process.
- Gate 42 prepared-week pass added bounded week-list preparation to the
  side-selector. Each receipt week is parsed once, source context and M1 mark
  matrix are attached once, then all variants consume that prepared object.
  Preload is bounded by `--week-preload-concurrency` /
  `SIDE_SELECTOR_WEEK_PRELOAD_CONCURRENCY`; source and bars load sequentially
  inside each week to avoid DB connection contention. One-week COT and
  Dealer/Commercial candidate smokes preserved the exact rows.
- Gate 42 source-only pass added `--source-coverage-only` to the existing
  side-selector audit. It reuses the prepared source-context and pair
  qualification path while skipping path-bar loading and numeric simulation.
  The clean-2025 39-week source-only receipt selected `0/1092` rows for both
  exact Gate 40 candidates: COT had `1092` missing Friday Strength rows;
  Dealer/Commercial had `407` missing Friday Strength rows plus source-filter
  exclusions. After model-filtered basket reads, source-only `buildBaseWeek`,
  and pair-filtered canonical Strength, the same audit dropped to about `34s`
  wall time with unchanged blocker counts.
- Gate 43 direction agreed: reconstruct Strength history as a reusable
  historical/continuous Strength context layer, not a Friday-only patch. Friday
  and Sunday confirmation are the first consumers, but future systems may need
  daily recalculation or continuous Strength agreement to keep trades open.
  Current canonical weekly Strength is mostly `1h`/`4h`/`24h` snapshots plus
  prior `1w`/`1m` lookback returns; older scripts sometimes used only
  `4h`/`24h`. The next gate should design storage once around canonical M1
  raw truth, derived Strength snapshots, fast pair-spread lookup, source freeze
  ledgers, and compact arrays/source masks for seven-year sweeps.
- Gate 43 first implementation slice now exists: `strength_history_snapshots`,
  `app/src/lib/strength/historicalStrength.ts`, and
  `app/scripts/verification/export-strength-history-context.ts`. A two-week
  current-2026 M1 slice wrote `27,648` derived FX Strength rows at `15m`
  cadence for `1h`/`4h`/`24h` windows. Prior-Friday and Friday/week-close
  M1-derived directions matched the legacy cutoff resolver `84/84`; Sunday/open
  exposed a source-model conflict because the legacy table contains weekend
  neutral `50/50` rows while the M1 layer falls back to the latest real
  prior-Friday source state.
- Gate 43 runtime follow-up added an explicit weekly Strength decision context:
  `friday_close` uses the latest complete pre-week Friday 17:00 New York source
  state, while `market_open_confirmation` uses the first complete source state
  at or after the FX market-truth open from `getCanonicalWeekWindow(...,
  "fx").openUtc`, separate from the later execution window. The verifier now
  supports `--read-existing-only --weekly-context` so cached source-context
  reads can be profiled separately from M1 derivation. Corrected current
  two-week proof read `27,648` existing snapshot rows in `3.03s`; all-28
  current-week context produced `28/28` Friday directional rows and `28/28`
  market-open directional rows, with market-open rows resolving to
  `2026-06-07T22:15:00Z`. Coverage and directional resolution are separate:
  only zero covered Strength windows should become source-blocked.
- Gate 44 first contract slice added the reusable matrix warehouse contract:
  `database/migrations/028_research_matrix_warehouse.sql`,
  `app/src/lib/research/matrixDataset.ts`, and
  `app/scripts/verification/export-research-matrix-dataset-contract.ts`.
  A 7-year / 28-pair / 64-variant estimate is roughly `10,192` source-context
  rows, `163,072` base trade opportunities, `652,288` pair-decision rows,
  `23,296` variant-week rows, and `10,436,608` trade events. Treat this as an
  indexed-ledger warehouse, not a Markdown/CSV report.
- Gate 42 execution-data decision: `1m` is the shared canonical execution path
  for research and future app engine promotion. Keep `1h` as fallback/debug
  until parity receipts prove the M1 path is stable enough to retire hourly
  guardrails.
- Gate 41 second recommended slice remains 2024 as a separate adversarial
  validation year, but do not run it until the Friday Strength/source-coverage
  decision is made and the local test cycle is materially faster.
- Frozen: no ADR Grid term tuning, costs/margin, pair clustering, sentiment,
  live-strategy promotion, release canon changes, or broad history sweep before
  separated-year receipts are reviewed.

## Next Gates

Recommended next data gates:

1. Continue `Gate 44: reusable-seven-year-matrix-dataset`.
2. Optimize pair-decision persistence and multi-week bar/source preparation
   before separated-year expansion.
3. Only after historical M1 and Strength coverage are proven, materialize clean
   separated historical years and then seven-year strategy sweeps.
6. Focused failure/concentration breakout for top Dealer/Commercial rows,
   especially `2026-01-19`, JPY/NZD/USD concentration, and Friday-snapshot
   coverage gaps.
7. If Freedom approves, run the two graduated definitions backward with COT at
   `15` ADR basket SL and Dealer/Commercial at `0.70` ADR pair inventory SL.
8. Keep ADR Grid parameter tuning and live promotion frozen until source-side
   and basket-SL evidence survive a stronger validation window.

## Repo Size / Consolidation WIP

Baseline captured 2026-06-12 with `git ls-files`:

- tracked repo files: 2150
- tracked `app/` files: 1844
- tracked `app/src/` files: 681
- tracked `docs/` files: 81
- tracked `app/releases/` files: 399
- `app/src` split: `lib` 353, `components` 172, `app` 153

Use this as a working metric. As gates touch an area, classify stale files and
prefer consolidation/archive over adding more owners. New files are acceptable
only when they simplify ownership enough to retire older paths.

## Active Context

- Version UI should use `liveVersion` and `devVersion` only.
- Current live version is `v2.0.5`.
- `pendingRelease` must not be runtime UI truth or visible as a separate
  runtime state.
- Documents/release docs should use one simple structure across versions.
- Version popover should be compact: live is the current public version; dev is
  the new working version.
- Freedom approved Gate 28 visuals as good enough for v2.0.4 packaging. Runtime
  truth remains split into `liveVersion` and `devVersion`; both are `v2.0.4` at
  the promotion boundary until Gate 29 names the next dev version.
- Data page baseline copy should be derived from data/config, not hardcoded or
  release-branded.
- Weekly Hold manual checks mostly matched the indicator, but the repo still
  needs its own reproducible proof path.
- ADR Grid is the major app-vs-indicator blocker: fills, TP counts, returns,
  drawdowns, basket counts, and recent-vs-stored week behavior need audit.
- Strategy work is three layers: baseline/data direction, ADR Grid execution,
  and risk management.
- Do not optimize trading logic until current numbers are trusted.

## Gate 31 Notes

- Current-week Weekly Hold portfolio rows now expand and collapse instead of
  being forced open for signal-only direction rows.
- Stored Weekly Hold single-trade symbols flatten to one row, e.g.
  `Commercial > AUDCAD`, with direction, asset class, trade count, W/L, source,
  and P/L in the header.
- Stored ADR Grid symbol/grid headers now show direction and source/sleeve in
  the header.
- Basket focused/dimmed state resets when week, scope, strategy, or view mode
  changes.
- Browser proof on port 3000 covered current-week collapse, stored Weekly Hold
  flattening, week-switch focus reset, and ADR Grid header identity.
- Validation passed: TypeScript, focused basket/ledger tests, `npm run build`,
  and `git diff --check`.
- Pushed as part of `831a99f Gate 30-32: finalize v2.0.5 readiness`.
- No `app/releases/v2/canon/*.json` files changed.

## Gate 32 Notes

- Performance repeat visits now reuse the existing persistent strategy kernel
  payload cache when metadata matches.
- Client router cache stale time now follows the hourly cron cadence instead of
  expiring after a short idle window.
- Performance keeps warmed Summary, Simulation, and Basket sections mounted so
  tab switches do not remount the heavy chart/Basket trees.
- Browser speed receipt:
  `app/releases/v2/screenshots/performance-data-correctness-2026-06-12/gate32-performance-speed-evidence.json`.
  It showed initial Performance hydration hit `strategy-kernel-payload`, repeat
  Performance after Data avoided it, and warmed Summary/Simulation/Basket tab
  switches were sub-second in headless verification.
- v2 release docs now use `manifest.json`/`release-manifest.json` as current
  version truth and record v2.0.5 as cumulative Gates 29-32 readiness.
- Added visible release screenshots for Jun 15 Weekly Hold current directions
  and Jun 01 flattened Weekly Hold drilldown under the existing v2.0.5 evidence
  folder.
- Validation passed: TypeScript, focused basket/ledger/release tests,
  `npm run build`, and `git diff --check`.
- Pushed as part of `831a99f Gate 30-32: finalize v2.0.5 readiness`.
- No `app/releases/v2/canon/*.json` files changed.

## Gate 30-32 Result

Pushed as v2.0.5 readiness completion:

- Commit: `831a99f Gate 30-32: finalize v2.0.5 readiness`
- Remote: `origin/main`
- Scope: Friday rollover/source readiness, Basket expansion parity,
  Performance speed/cache, release docs truth, and evidence receipts.
- Verification before push: `git diff --check`, `git diff --cached --check`,
  `npx tsc --noEmit --project app/tsconfig.json --pretty false`, focused
  basket/ledger/release Vitest suite, `npm run build`, browser speed receipt,
  and screenshot evidence.
- No `app/releases/v2/canon/*.json` files changed.

## Gate 29 Notes

- Current-week Summary card shading is visually accepted.
- Basket behavior is visually consistent across current and previous weeks.
- Jun 08, Jun 01, and May 25 Basket views show 144 total grids and 36 grids per
  portfolio after the selected trade-row path was shared.
- Stored-week Simulation now shows Equity and Balance. The shared
  `EquityCurveChart` should not render Total/Equity as white in light mode.
- No-fill current-week grids still show `P/L 0.00%`; changing that is strategy
  math and belongs in ADR Grid indicator parity.
- `/api/system/mode` can report normal/fresh COT while the missing warning
  banner leaves the user unsure whether new data has arrived. Rollover/status
  should show source freshness clearly without reviving "sentiment-only" copy.
- Dealer/Commercial COT may be fresh while Sentiment/Strength update later.
  Rollover logic should distinguish partial source readiness instead of making
  the app feel blocked on every source.

## Gate 29 Result

Packaged as `v2.0.5`:

- Runtime manifests now use `liveVersion: v2.0.5` and
  `cacheNamespace: v2.0.5-gate29-performance-data-correctness`.
- Current, stored, and all-time Basket views share the selected trade-row
  hierarchy.
- Planned ADR grid rows are present for Basket count parity without counting as
  fills or changing P/L.
- Stored-week Simulation keeps Equity, Balance, and Total path visibility.
- Summary portfolio cards shade from signed return across current and stored
  weeks.
- The stale COT banner copy no longer exposes old sentiment-only mode language.
- Equity/Total chart colours are theme-safe in light and dark mode.
- Release evidence lives under
  `app/releases/v2/screenshots/performance-data-correctness-2026-06-12/`.
- No `app/releases/v2/canon/*.json` files were changed.

Next chat should not reopen Gate 29 unless Freedom explicitly asks. Gate 30 is
the active Friday rollover/source-readiness review.

## Gate 28 Result

Corrective pass was committed and pushed:

- Commit: `4651a37 Gate 28: finalize v2.0.4 readiness`
- Remote: `origin/main`
- Full SHA: `4651a37f9e1020c3ed36c94f5d8addf012ccba49`

- Version popover is active-runtime only in dev and does not show the public
  live version in the dev popover.
- Documents use one version rail plus one tab skeleton for v1 and v2.
- Documents navigation uses app-native `Link` navigation instead of raw anchors.
- Long History/Documents content scrolls inside the selected panel while the
  page itself does not become a long scroll.
- Changelog/history entries are sorted newest-to-oldest.
- Documents discover screenshots under each release's `screenshots/` folder and
  use manifest descriptions only as optional metadata.
- Evidence screenshots open into an enlarged overlay with close and previous/next
  controls inside the selected screenshot group.
- The custom loading-bar keyframe added in the failed pass was removed. Route
  loading screens now use the existing shared `LimniLoading` owner with one
  width-transition progress bar.
- Route loading labels are no longer set in individual route `loading.tsx`
  files. They derive from `DashboardLayout`'s canonical navigation table, with a
  route-name fallback for non-canonical pages.
- The shared loader checks runtime version once per session/cache when needed,
  then shows `Loading Limni v2.0.4...`; later page switches show route labels
  like `Loading Data...` and `Loading Documents...`.
- Data dashboard filters were trimmed back to controls only: no visible Bias,
  active-baseline, trading-week provenance, Friday-freeze/COT, or Asset Class
  labels in the filter block.
- Sentiment summary cards now use the same centered `SummaryCards` sizing path
  as Dealer/Commercial/Strength.
- App Truth route readiness no longer renders a visible page blocker on Data or
  Performance. It stays as route metadata, and local missing-DB readiness errors
  fail open to the app content.
- Dashboard COT history loading now fails open to an empty history when the
  local database is unavailable instead of throwing the Data page.
- Login now falls back to the repo-root auth username/password env keys when the
  Next dev server is launched with `next dev app`; the fallback is limited to
  `AUTH_USERNAME` and `AUTH_PASSWORD` and does not load root `AUTH_BYPASS`.
- Root layout no longer shows a generic `Loading page...` fallback before
  route-specific loading screens.
- Added one release note: `app/releases/v2/patches/v2.0.4.md`.
- No release canon regeneration.
- Final proof run: `git diff --check`, TypeScript project check, focused
  release/canon tests, `npm run build`, version API smoke, and fresh-login
  Playwright smoke for Data, Performance, Documents, and Status.
- Broader Playwright route sweep before packaging checked 32 app routes. Dynamic
  account detail routes were skipped because no connected account records were
  present.

Still not solved as a full release-process system:

- There is no general release screenshot capture automation script yet. Current
  Documents rendering is automatic from release folders, but capture itself is a
  separate release-process gate.
