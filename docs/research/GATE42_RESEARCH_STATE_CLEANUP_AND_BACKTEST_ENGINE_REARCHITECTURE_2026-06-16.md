# Gate 42 Research State Cleanup And Backtest Engine Rearchitecture

Date: 2026-06-16

Status: next-agent handoff. This is not a strategy-optimization gate and not a
Research UI build.

## Why This Gate Exists

Gate 36 through Gate 41 produced useful strategy-research evidence, but the
local research workflow is now too slow and too dirty to keep compounding.

Freedom's constraint is explicit: `30` to `60` minute test cycles are
unacceptable. The next improvement should not be a polished app Research
section. It should be a faster local backtest/research pipeline that preserves
evidence, avoids lookahead, and can later become the backbone of an
institutional app research engine.

## Current Engine Truth

The app and research scripts are partially shared, not fully unified.

Shared source/data owners already used by the research scripts:

- `app/src/lib/performance/basketSource.ts`
- `app/src/lib/performance/selectorEngine.ts`
- `app/src/lib/strength/weeklyStrength.ts`
- `app/src/lib/strength/canonicalDirection.ts`
- `app/src/lib/cotStore.ts`
- canonical DB-backed COT, Strength, source-freeze, and price/bar reads

The current app Performance engine still lives mainly in:

- `app/src/lib/performance/weeklyHoldEngine.ts`

The newer hedged 28-pair ADR Grid research logic is still research-only:

- `app/scripts/verification/export-fx-hedged-adr-grid-week.ts`
- `app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts`

Do not pretend these are already one institutional engine. The next architecture
step is to make the research kernel fast, reproducible, and clean enough that a
future winning candidate can be promoted into a shared runtime boundary with
parity tests.

## Gate 42A: Repo State Cleanup

Goal: lock the research state into git without staging the whole dirty tree.

Recommended staging buckets:

1. Durable research scripts:
   - `app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts`
   - `app/scripts/verification/export-fx-hedged-adr-grid-week.ts`
   - new Weekly Hold / COT verification scripts referenced by `package.json`
2. Durable research handoffs:
   - Gate 36 through Gate 42 docs under `docs/research/`
   - `docs/backlog/CURRENT_WORK.md`
3. Selected evidence receipts only:
   - Gate 40 COT and Dealer/Commercial runner receipts
   - Gate 41 clean-2025 COT and Dealer/Commercial `39w` receipts
   - Gate 41 `1w` diagnostic receipt proving `missing_friday_strength`

Do not stage blindly:

- the whole `app/reports/data-verification/` tree;
- every per-week hedged-grid path/trades dump;
- ignored JSON receipts unless there is an explicit reason to force-add a
  small manifest or canonical evidence file;
- `app/scripts/pinescript/limni-adr-verifier.pine` unless opening a separate
  TradingView parity cleanup;
- release canon or runtime app surfaces.

No deletes without Freedom approval.

## Gate 42B: Backtest Engine Rearchitecture

Goal: reduce local research cycle time before more broad sweeps.

Current pain point:

- Gate 41 clean-2025 candidate runs took several minutes per row family and
  would become worse for 2024, stitched years, or parameter matrices.
- The current scripts repeatedly read/parse large receipt files, rebuild source
  contexts, rebuild marked paths, and emit heavyweight receipts.

Target speed expectations for 28 FX pairs, adapted from Freedom's external
benchmark note:

```txt
Daily bars, about 7k total rows:
  vectorized/matrix pass: <0.05s
  event-style pass:       <0.5s

Hourly bars, about 45k total rows:
  vectorized/matrix pass: 0.1s-0.3s
  event-style pass:       1s-3s

1-minute bars, about 2.7M total rows:
  vectorized/matrix pass: 1s-3s
  event-style pass:       15s-45s
```

For this repo, do not interpret that as "rewrite in Python/Polars" by default.
The practical translation is:

- use vectorized/matrix-style preprocessing for bars, source masks, ADR values,
  and candidate filters;
- use event-driven logic only where stateful order execution requires it;
- keep event loops over compact numeric arrays, not heavyweight per-tick
  objects.

### First Optimization Pass

Profile before rewriting. Add timers around:

- DB reads;
- canonical 1H bar loading;
- receipt JSON parsing;
- source context building;
- marked path rebuilding;
- runner simulation;
- pair/basket stop simulation;
- Markdown/CSV/JSON output.

Then split the local engine into four layers:

1. Data preparation/cache
   - pre-align timestamps across all 28 pairs;
   - build canonical bar arrays once per week/symbol;
   - cache ADR values, close/open/high/low arrays, and path timestamps;
   - detect missing data gaps before strategy scoring starts.
2. Source context cache
   - build Dealer, Commercial, COT Faces, Strength-open, Strength-Friday, and
     source-freeze rows once per week/symbol;
   - expose source masks as compact arrays keyed by variant.
3. Simulation kernel
   - evaluate candidate variants in one pass where possible;
   - avoid rebuilding fills/paths per variant;
   - avoid class/object allocation inside tight loops;
   - use numeric arrays, plain structs, or tuples for active fills;
   - enforce no-lookahead by making the execution timestamp boundary explicit.
4. Output/report layer
   - write compact summaries by default;
  - write detailed trade/path/qualification ledgers only when requested;
  - calculate expensive metrics at the end, not on every bar.

## Gate 42C: 1-Minute Execution Data Migration

Goal: move the research execution layer from confirmed `1h` bars to canonical
`1m` bars where data coverage is available.

Current state:

- The hedged ADR Grid research receipts rebuild marked paths from canonical
  `1h` bars.
- That forced guardrails around same-bar behavior and prevented overclaiming
  intrabar precision.
- The repo already has the ability to load and save `1m` Oanda bars, and the
  canonical price-bar work was built with alternate resolutions/providers in
  mind.

Direction:

- Make `1m` bars the preferred research execution substrate for ADR Grid style
  tests once coverage and caching are verified.
- Keep data-source and resolution selection behind a simple canonical bar
  adapter so Oanda is not hardwired into strategy logic.
- Use `1h` only as a coarse fallback or smoke/debug path after `1m` is proven.
- Remove or retire the hourly-bar overstatement guardrails only after parity
  receipts prove the `1m` execution path is active and stable.
- Refactor the Pine verifier after the research engine has a stable `1m`
  execution contract. Pine parity is expected to change; do not block the local
  engine cleanup on Pine UI polish.

Important sequencing:

`1m` bars will improve execution trust but can multiply row volume heavily. Do
not switch broad sweeps to `1m` before the cache/prealignment work in Gate 42B
is in place. The simple path is:

1. verify existing `1m` Oanda load/save coverage;
2. add a canonical `1m` bar read path for the research scripts;
3. cache/prealign the `1m` arrays once per week/symbol;
4. run a small 2026 smoke test against a known Gate 40/41 command;
5. compare directionally against the old `1h` receipt to confirm the pipeline is
   working, while expecting trade timing/results to change.

Minimum smoke receipt after migration:

- current-2026 closed weeks only;
- no source-definition changes;
- one COT candidate row and one Dealer/Commercial candidate row;
- report runtime, selected pair sides, trade count, total ADR, worst path DD,
  week-close ADR, and any missing `1m` coverage.

### Required Safety Rules

- Strategy decisions at time `t` may only use data available at or before `t`.
- Fill semantics must be explicit: same-bar, next-bar, confirmed-bar, and
  week-close behavior cannot be ambiguous.
- Global metrics like Sharpe, profit factor, max drawdown, and concentration
  should be lazy final calculations unless needed for an online stop rule.
- Data storage should not hard-limit to a rolling 10-year window. Full history
  is needed for macro regimes such as 2008 and 2020. Sliding windows are for
  walk-forward training/evaluation, not for deleting history.
- The research engine must produce receipts that can later be compared against
  app/runtime results before automation.

## Gate 42D: Source-Coverage Decision

Gate 41 clean 2025 could not validate the exact Gate 40 candidate rows because
Friday Strength/frozen-source coverage starts in 2026.

After cleanup and speed work, choose one of:

1. reconstruct historical Friday Strength/frozen-source coverage for 2025/2024;
2. change the backward-validation definition to a source row with true 2025
   coverage;
3. park the Friday Strength candidate as current-2026-only and select a
   different one-system automation candidate.

Do not run 2024 broad sweeps before this decision. They will hit the same
candidate-definition blocker.

## Recommended Next-Agent Order

1. Recover state from `CODEX_SESSION.md`, `CODEX_CKB.md`, `AGENTS.md`, and
   `docs/backlog/CURRENT_WORK.md`.
2. Classify the dirty tree and stage only Gate 36-42 durable research assets.
3. Do not force-add large ignored JSON unless selecting a specific evidence
   manifest.
4. Add lightweight profiling to the current research scripts.
5. Verify existing `1m` Oanda bar load/save coverage and the canonical bar
   adapter boundary.
6. Produce one timing receipt for a known slow Gate 41 command.
7. Propose the smallest rearchitecture that cuts the run time materially and
   makes `1m` execution practical.
8. Run a small current-2026 smoke test on the `1m` path before broader sweeps.
9. Only after cleanup, speed, `1m`, and source-coverage decisions, resume
   one-system validation.

## Progress: 2026-06-16 Codex Pass

Dirty-tree classification/staging:

- Staged the durable Gate 36-42 research scripts/docs and selected side-selector
  receipts only.
- Left `app/scripts/pinescript/limni-adr-verifier.pine` unstaged because
  TradingView parity cleanup is a separate gate.
- Did not stage bulk untracked research receipts, release screenshots, `$1`,
  local profile outputs, or release canon files.

Profiling result:

- Slow Gate 41-style side-selector path was profiled with
  `--profile` against the clean-2025 39-week COT receipt list.
- Before the source-context split, the profile was dominated by
  `source_context_build`: about `287.8s` total across 39 weeks. Numeric
  simulation was not the bottleneck.
- After splitting requested source layers, the same COT-only path was still
  source-bound at about `273.9s`, with `source_context_cot_base` and
  `source_context_open_strength` dominating.
- A small shared-cache patch added a batch canonical weekly return reader in
  `app/src/lib/pairReturns.ts` and uses it from
  `app/src/lib/strength/canonicalDirection.ts` for Strength lookbacks. A
  one-week mixed COT plus Dealer/Commercial smoke dropped
  `source_context_build` from about `4.6s` to about `1.6s` while preserving the
  same summary results.

Research pipeline changes now staged:

- `audit-fx-hedged-adr-grid-side-selectors.ts` has profiling buckets,
  source-context need selection, and `--path-resolution=1h|1m`.
- `export-fx-hedged-adr-grid-week.ts` has `--path-resolution=1h|1m` and emits
  the selected path resolution in the receipt.
- `export-weekly-hold-fixed-band-sweep.ts` keeps `buildBaseWeek` behavior
  unchanged by default, but source-only callers can now pass
  `includePathBars: false` to avoid duplicate path-bar reads.
- Shared Strength source context now batches stored prior weekly returns instead
  of calling `getPairReturn` once per pair/prior week.
- `upsertCanonicalHourlyBarsForInstrument` now writes canonical path bars in
  batched `canonical_price_bars` upserts instead of one DB write per bar. This
  keeps the existing hourly owner and adapter boundary, but makes one-week FX
  M1 materialization practical.
- `app/src/lib/performance/pathBarLoader.ts` now also owns prealigned path-bar
  timelines and mark-price lookup construction. The FX hedged exporter and
  side-selector audit reuse that app performance owner instead of carrying
  script-local timestamp alignment code.
- A follow-up direct timeline loader reads only the path fields needed by ADR
  Grid execution (`bar_close_utc`, high, low, close) and returns prealigned
  timelines directly, so scripts no longer have to load full canonical bar
  objects and then build a separate mark-price lookup.
- The shared path loader now exposes a mark-price matrix: aligned timestamps,
  timestamp-to-index lookup, and per-symbol mark-price arrays. This is the
  first reusable numeric-prep boundary for research now and app-runtime
  promotion later.
- Side-selector mark-price matrix loading is now close-only. The high/low/close
  timeline loader remains available for exporter/path-hit logic, but runner and
  stop simulations no longer move high/low fields they do not consume.
- `getCanonicalBasketWeek` now uses the existing runtime cache pattern, so
  shared app/source callers can reuse a canonical basket week inside one
  process instead of rebuilding the same frozen/source-derived week.
- The side-selector audit now caches rebuilt variant paths by receipt, base
  variant, runner settings, and pair inventory stop threshold. Basket SL/TP
  stays outside that key because those rules operate after the pre-basket path.
- The side-selector hot path now pre-indexes each trade once with entry/exit
  milliseconds, size, and the symbol's aligned mark-price array. Runner scans
  start after the aligned original exit index when available. This keeps the
  output/report layer unchanged while moving path math toward compact numeric
  arrays.
- The side-selector now builds prepared receipt weeks before variant
  evaluation. Each prepared week owns the parsed receipt, source contexts, and
  close-only M1 mark matrix. Week-list preloading is bounded by
  `--week-preload-concurrency` or `SIDE_SELECTOR_WEEK_PRELOAD_CONCURRENCY`;
  source context and bar matrix loads stay sequential inside a week to avoid DB
  connection contention.
- The side-selector now has `--source-coverage-only`. It uses the same prepared
  source-context path and pair-qualification logic, but skips path-bar loading
  and variant simulation so source blockers can be reproduced without creating
  fake strategy scores.
- `basketSource` now exposes a model-filtered canonical basket read for callers
  that need only Dealer/Commercial or another subset. The existing all-model
  `getCanonicalBasketWeek` API remains intact.
- `buildBaseWeek` keeps execution/ADR context on by default, but source-only
  callers can now opt out with `includeExecutionContext: false`. The
  side-selector uses this for source decisions so it does not pull execution
  returns or ADR when it only needs COT/source masks.
- Canonical Strength now has a pair-filtered read. The FX side-selector asks
  for only its 28 expected FX pairs instead of resolving every asset class and
  triggering non-FX fallback work.

Verification receipts from this pass:

- `Local Environment/gate42-profile/export-smoke-1h/fx-28pair-hedged-adr-grid-2026-06-08-20260616-202712.md`
  - `1h` exporter smoke passed: 28 pairs, 56 engines, 579 fills, final
    `+81.4034` ADR, max drawdown `-17.4714` ADR.
- `Local Environment/gate42-profile/export-smoke-1m/fx-28pair-hedged-adr-grid-2026-06-08-20260616-202805.md`
  - `1m` exporter smoke ran but produced 0 engines/fills. Treat this as stored
    M1 coverage missing, not a strategy result.
- `Local Environment/gate42-profile/smoke-mixed-batch-strength/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-203142.md`
  - Current-2026 mixed smoke passed one COT candidate row and one
    Dealer/Commercial row with the batched Strength path.
- `Local Environment/gate42-profile/export-smoke-1m-materialized/fx-28pair-hedged-adr-grid-2026-06-08-20260616-211327.md`
  - After M1 materialization, the `1m` exporter smoke passed: 28 pairs, 56
    engines, 611 fills, final `+87.8034` ADR, max drawdown `-21.3196` ADR.
- `Local Environment/gate42-profile/side-selector-1m-cot-smoke/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-211426.md`
  - One-week `1m` COT candidate-family smoke passed. The exact stop+runner row
    returned `+19.04` ADR, `-8.89` DD, `+3.94` week-close ADR.
- `Local Environment/gate42-profile/side-selector-1m-dealer-commercial-smoke/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-211423.md`
  - One-week `1m` Dealer/Commercial candidate-family smoke passed. The exact
    pair-stop+runner row returned `+2.38` ADR, `-4.14` DD, `+0.00`
    week-close ADR.
- `Local Environment/gate42-profile/export-smoke-1m-direct-timeline/fx-28pair-hedged-adr-grid-2026-06-08-20260616-214823.md`
  - Direct timeline-loader exporter smoke preserved the materialized M1 output:
    28 pairs, 56 engines, 611 fills, final `+87.8034` ADR, max drawdown
    `-21.3196` ADR.
- `Local Environment/gate42-profile/side-selector-1m-cot-direct-timeline/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-214901.md`
  - Direct timeline-loader COT smoke preserved the exact stop+runner row:
    `+19.04` ADR, `-8.89` DD, `+3.94` week-close ADR. Profile:
    `canonical_bar_load` about `2.6s`, `variant_evaluation` about `5.6s`,
    `pair_stop_path_build` about `4.4s`.
- `Local Environment/gate42-profile/side-selector-1m-dealer-commercial-direct-timeline/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-214841.md`
  - Direct timeline-loader Dealer/Commercial smoke preserved the exact
    pair-stop+runner row: `+2.38` ADR, `-4.14` DD, `+0.00` week-close ADR.
    Profile: `canonical_bar_load` about `3.0s`, `variant_evaluation` about
    `1.6s`, `pair_stop_path_build` about `0.8s`.
- `Local Environment/gate42-profile/side-selector-1m-cot-path-cache/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-215015.md`
  - Variant path-cache COT smoke preserved the same row results and cut
    repeated path rebuilding across four rows: `pair_stop_path_build` about
    `1.5s`.
- `Local Environment/gate42-profile/side-selector-1m-dealer-commercial-path-cache/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-215012.md`
  - Variant path-cache Dealer/Commercial smoke preserved the same row results
    and cut repeated path rebuilding across four rows:
    `pair_stop_path_build` about `0.6s`.
- `Local Environment/gate42-profile/side-selector-1m-cot-indexed-runner-profile/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-221716.md`
  - Indexed-trade matrix COT smoke preserved the exact stop+runner row:
    `+19.04` ADR, `-8.89` DD, `+3.94` week-close ADR. Profile:
    `pair_stop_path_build` about `0.2s`, `runner_simulation` about `0.5s`,
    `variant_evaluation` about `1.0s` across four rows.
- `Local Environment/gate42-profile/side-selector-1m-dealer-commercial-indexed-runner-profile/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-221739.md`
  - Indexed-trade matrix Dealer/Commercial smoke preserved the exact
    pair-stop+runner row: `+2.38` ADR, `-4.14` DD, `+0.00` week-close ADR.
    Profile: `pair_stop_path_build` about `0.07s`, `runner_simulation` about
    `0.02s`, `variant_evaluation` about `0.5s` across four rows.
- `Local Environment/gate42-profile/side-selector-1m-cot-close-matrix-profile/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-222357.md`
  - Close-only mark-price matrix COT smoke preserved the exact stop+runner row:
    `+19.04` ADR, `-8.89` DD, `+3.94` week-close ADR. Profile:
    `canonical_bar_load` about `1.9s`, `variant_evaluation` about `0.3s`
    across four rows.
- `Local Environment/gate42-profile/side-selector-1m-dealer-commercial-close-matrix-profile/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-222410.md`
  - Close-only mark-price matrix Dealer/Commercial smoke preserved the exact
    pair-stop+runner row: `+2.38` ADR, `-4.14` DD, `+0.00` week-close ADR.
    Profile: `canonical_bar_load` about `2.2s`, `variant_evaluation` about
    `0.3s` across four rows.
- `Local Environment/gate42-profile/side-selector-1m-mixed-close-source-cache-profile/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-222536.md`
  - Mixed COT plus Dealer/Commercial smoke preserved both base rows in one
    process: COT `+19.60` ADR / `-7.83` DD, Dealer/Commercial `+3.28` ADR /
    `-3.79` DD. This exercises the shared source-context path and the cached
    canonical basket week owner.
- `Local Environment/gate42-profile/side-selector-1m-mixed-prepared-week-profile/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-225010.md`
  - Prepared-week mixed smoke preserved both base rows in one process with
    `--week-preload-concurrency=2`: COT `+19.60` ADR / `-7.83` DD,
    Dealer/Commercial `+3.28` ADR / `-3.79` DD.
- `Local Environment/gate42-profile/side-selector-1m-cot-prepared-week-profile/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-225029.md`
  - Prepared-week COT candidate smoke preserved the exact stop+runner row:
    `+19.04` ADR, `-8.89` DD, `+3.94` week-close ADR.
- `Local Environment/gate42-profile/side-selector-1m-dealer-commercial-prepared-week-profile/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-225042.md`
  - Prepared-week Dealer/Commercial candidate smoke preserved the exact
    pair-stop+runner row: `+2.38` ADR, `-4.14` DD, `+0.00` week-close ADR.
- `Local Environment/gate42-profile/source-coverage-clean-2025/fx-28pair-hedged-adr-grid-source-coverage-39w-20260616-231922.md`
  - Source-only clean-2025 audit reproduced the Gate 41 blocker without
    numeric strategy scoring. COT exact candidate selected `0/1092` rows with
    `1092` missing Friday Strength. Dealer/Commercial exact candidate selected
    `0/1092` rows with `407` missing Friday Strength; the remaining exclusions
    are source filters such as Dealer/Commercial disagreement. Wall time fell
    to about `34s`; `source_context_build` profile total was about `23.2s`
    across all `39` weeks after the model/pair-filtered source prep.
- `Local Environment/gate42-profile/side-selector-1m-cot-source-filter-smoke/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-232049.md`
  - Current-2026 M1 COT smoke after source filtering preserved the exact
    stop+runner row: `+19.04` ADR, `-8.89` DD, `+3.94` week-close ADR.
- `Local Environment/gate42-profile/side-selector-1m-dealer-commercial-source-filter-smoke/fx-28pair-hedged-adr-grid-side-selectors-1w-20260616-232123.md`
  - Current-2026 M1 Dealer/Commercial smoke after source filtering preserved
    the exact pair-stop+runner row: `+2.38` ADR, `-4.14` DD, `+0.00`
    week-close ADR.

Current `1m` truth:

- The canonical bar loader already accepts alternate resolutions, and the Oanda
  client has an M1 fetch path.
- Current local stored FX bar coverage was effectively hourly/daily before this
  pass. The current smoke week `2026-06-08` is now materialized for all 28 FX
  pairs at M1; broader historical M1 coverage is not assumed.
- The existing canonical hourly backfill/coverage owner now accepts
  `--timeframe=1m` while preserving the default `1h` behavior for existing cron,
  API, and CLI callers.
- `1m` is the intended shared execution-data path for both local research and a
  future app runtime engine. Keep `1h` as fallback/debug until parity receipts
  justify retiring hourly guardrails.
- Read-only coverage check:
  `npx tsx app/scripts/backfill-canonical-hourly-bars.ts --coverage-only --asset=fx --symbols=EURUSD --weeks=2026-06-08 --timeframe=1m`
  returned missing M1 storage: `0/7200` bars.
- Dry-run materialization check:
  `npx tsx app/scripts/backfill-canonical-hourly-bars.ts --asset=fx --symbols=EURUSD --weeks=2026-06-08 --timeframe=1m --dry-run --delay-ms=0`
  fetched `7159` complete Oanda M1 bars and wrote `0` bars, proving fetch path
  readiness without changing DB state.
- Intentional EURUSD write:
  `npx tsx app/scripts/backfill-canonical-hourly-bars.ts --asset=fx --symbols=EURUSD --weeks=2026-06-08 --timeframe=1m --delay-ms=0`
  fetched and upserted `7159` M1 bars; coverage read back as complete at
  `99.43%`.
- Gap-only all-FX write:
  `npx tsx app/scripts/backfill-canonical-hourly-bars.ts --asset=fx --weeks=2026-06-08 --timeframe=1m --only-gaps --delay-ms=0`
  filled the other `27` FX pairs, fetched/upserted `192619` M1 bars, and ended
  with 28/28 complete coverage, lowest coverage `95.24%`.
- Current next speed target is the week-level numeric cache/kernel layer. The
  direct timeline loader reduced the single-week M1 DB payload enough to bring
  `canonical_bar_load` to about `2.6s` to `3.0s` in single direct smokes, and
  removed the separate script-local `mark_lookup_build` bucket. Parallel DB
  runs are noisy, so do not use one parallel profile as the source of truth.
- Path-cache smokes show repeated path rebuilding can be cut materially without
  changing results. COT `pair_stop_path_build` dropped from about `4.4s` to
  about `1.5s` across four rows; Dealer/Commercial dropped from about `0.8s`
  to about `0.6s`.
- The remaining broad-sweep risk is not solved by another script wrapper. The
  next rearchitecture should load/cache each week of M1 bars and source masks
  once as compact numeric arrays, then let the simulation kernel consume those
  arrays for both research and future app-engine promotion.
- After the indexed-trade pass, marked-path reconstruction is no longer the
  limiting factor in the one-week M1 smokes. Remaining bottlenecks are
  `canonical_bar_load` and source-context reads, which means the next cache
  should be week-level data/source context reuse across receipt weeks and
  variant families.
- After the close-only mark matrix pass, `canonical_bar_load` is materially
  smaller for side-selector runs, but multi-week M1 sweeps should still avoid
  naive per-week DB churn. Next step: pre-load/cache weekly mark matrices and
  source contexts for a receipt list in bounded chunks, then feed variants from
  those prepared week objects.
- Prepared-week loading is now implemented for the side-selector. The next
  broad-run guardrail is still coverage/source truth: do not run broad M1
  sweeps until the historical Friday Strength/frozen-source coverage decision
  is made, and materialize M1 coverage for the selected weeks first.
- Source coverage can now be checked before numeric scoring with
  `--source-coverage-only`. The clean-2025 exact Gate 40 candidates are still
  blocked by missing Friday Strength, so do not run 2024/broad M1 validation
  until Freedom decides whether to reconstruct historical Friday
  Strength/frozen-source coverage or change the backward-validation definition.

## Non-Goals

- No app Research UI in this gate.
- No live strategy promotion.
- No ADR Grid parameter tuning.
- No new AI-agent research system yet.
- No deleting generated receipts without approval.
- No release canon changes.
- No broad `1m` sweeps before the cache/prealignment path is verified.
