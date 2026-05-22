/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: PERFORMANCE_DATA_ARCHITECTURE_AUDIT_2026-05-21.md
 *
 * Description:
 * Performance page data architecture audit and refactor plan.
 * Defines the systemic issues behind missing weeks, scoped stats
 * mismatches, empty ready shards, and future drilldown requirements.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

# Performance Data Architecture Audit

Date: 2026-05-21

Status: Planning document for review. Do not implement until reviewed.

## Purpose

The Performance page is now good enough to show that the strategy stats are promising, but not yet trustworthy enough as an institutional research surface. The current issues are not isolated UI bugs. They point to a fragmented data architecture where different sections read from different payload slices and derive scoped stats independently.

This document defines the next architecture target before another implementation pass. The goal is to prevent narrow fixes that solve one visible case while leaving the same class of bug alive elsewhere.

## Confirmed Symptoms

### 1. Ready artifact with empty selected-week data

Observed selection:

- Signal model: `Agreement`
- Execution: `ADR Grid`
- Risk overlay: `Pair Fill Cap`
- Week: `2026-02-02T00:00:00.000Z`

Production API check showed:

- `engineWeekResults["2026-02-02T00:00:00.000Z"]` exists
- `engineSimMap["2026-02-02T00:00:00.000Z"]` exists
- `engineWeekMap["2026-02-02T00:00:00.000Z"]` exists
- artifact status is `ready`
- `missingWeeks` is empty

But the actual selected-week data is empty:

- return: `0.00%`
- max DD: `0.00%`
- trades: `0`
- asset series contain one point only

Control comparison:

| Selection | Feb 02 Return | Trades |
|---|---:|---:|
| Agreement · ADR Grid · None | +9.97% | 299 |
| Agreement · ADR Grid · Pair Fill Cap | 0.00% | 0 |

For Feb 09, both overlays have real data:

| Selection | Feb 09 Return | Trades |
|---|---:|---:|
| Agreement · ADR Grid · None | +12.76% | 438 |
| Agreement · ADR Grid · Pair Fill Cap | +12.62% | 357 |

Interpretation:

This is not a week strip issue or preload missing-week issue. It is a shard validity problem: a ready shard can currently be semantically invalid.

Based on the concentration-throttle research script, a broad Pair Fill Cap engine bug is less likely. The research replay showed parity against the production engine across all 17 weeks and 4 strategies. If the pair-fill-cap engine had a general state leak or trigger-ordering bug, it likely would have appeared there. The more likely cause is stale or mislabeled shard contamination during the v24 -> v25 transition: a shard may have been written or marked ready with the v25 Pair Fill Cap version before the final pair-fill-cap engine path generated real data for that week.

Phase 0 should therefore check stored shard engine versions and metadata before assuming the engine itself is broken.

### 2. Scoped all-time Simulation works, but Summary/Basket/Research do not

Observed selection:

- Signal model: `Agreement`
- Execution: `ADR Grid`
- Risk overlay: `Pair Fill Cap`
- Week: `All Time`
- Scope: `Commodities`

Correct sections:

- Simulation shows `+2.91%`, `199 trades`, valid equity path
- Sidebar all-time card shows `+2.91%`, `199 trades`

Incorrect sections:

- Summary cards show `0.00%`
- Basket shows `0 trades`
- Research shows no realized performance data

Interpretation:

The app already has enough data to derive commodity-only all-time stats, but only Simulation and Sidebar are using that derivation path. Summary, Basket, and Research are reading from older or incompatible structures.

### 3. Refresh/preload behavior is too heavy

Expected behavior:

- If historical artifacts are already complete and engine versions did not change, app refresh should be fast.
- Refresh should mainly check status, hydrate cached payloads, and update current-week data by hour.

Observed behavior:

- Refresh can cycle through heavy preload phases.
- After a version bump or partial artifact state, the gate can feel like it is rebuilding too much.

Interpretation:

The app needs clearer separation between:

- historical artifact readiness
- current-week live refresh
- client payload hydration
- background repair

## Architecture Diagnosis

The Performance page currently has multiple derived data paths:

1. Server payloads:
   - `engineWeekMap`
   - `engineSimMap`
   - `engineWeekResults`
   - `sidebarStats`
   - `weekOptions`
   - `artifactMeta`

2. Client derivations:
   - Simulation derives scoped paths from series.
   - Sidebar derives scoped stats from week results/trades.
   - Summary cards appear to read a different summary/model layer.
   - Basket appears to read selected-week trades and does not aggregate all-time scope.
   - Research appears to read selected-week diagnostics and does not aggregate all-time scope.

The bug class is not "Commodities are broken." The bug class is:

> There is no single canonical scoped performance model consumed by every Performance section.

Until that exists, scope support will remain inconsistent.

## Target Architecture

### Core principle

The page should have one canonical client-side object:

```ts
type ScopedPerformanceModel = {
  selection: RuntimeStrategySelection;
  week: "all" | string;
  scope: PerformanceScope;
  sourceScope: SourceScope;
  tierScope: TierScope;
  symbolScope: SymbolScope;
  status: "ready" | "loading" | "empty" | "invalid";
  invalidReasons: string[];

  summary: ScopedSummary;
  simulation: ScopedSimulation;
  basket: ScopedBasket;
  research: ScopedResearch;
  calendar: ScopedCalendar;
  sidebar: ScopedSidebarStats;
  diagnostics: ScopedDiagnostics;
};
```

Every visible section should read from this object:

- Sidebar selected-week card
- Sidebar all-time card
- Summary
- Simulation
- Basket
- Research
- Notes context
- Calendar / daily / weekly / monthly returns

No section should independently decide how to filter asset classes, sources, tiers, symbols, or weeks.

### Scope model

Current scope support:

- `All`
- `FX`
- `Indices`
- `Commodities`
- `Crypto`

Future scope support should be designed now:

- asset class scope
- source/model slice:
  - dealer
  - commercial
  - sentiment
  - strength
- tier scope:
  - tier 1
  - tier 2
  - tier 3 if retained for diagnostics
- symbol/pair scope:
  - single pair
  - custom symbol basket
- time scope:
  - all time
  - week
  - day
  - hour
- execution state scope:
  - filled
  - TP
  - reset
  - week close
  - skipped by overlay
  - active/open

The key design point: these should be composable filters over the same canonical event/trade/path data, not separate one-off UI modes.

## Required Data Invariants

### Artifact readiness is not enough

Current artifact readiness checks whether the expected shards exist and match the expected engine version. That is necessary but not sufficient.

Add semantic validation:

1. If a non-overlay baseline has trades for a week and a risk overlay returns zero trades, the shard must record why.
2. If a week has canonical basket signals and path bars, a ready shard with zero trades should be marked suspicious unless the engine records an intentional skip count.
3. If `weekOptions` includes a week, then the selected week must have consistent data across:
   - `engineWeekResults`
   - `engineSimMap`
   - `engineWeekMap`
   - basket trades
   - research diagnostics
4. If an all-time scoped sidebar has nonzero trades, then Summary/Basket/Research for the same scope must not show zero unless they explicitly state that the view is unsupported.

### Empty data must be explicit

There are two different empty states:

1. Legitimate empty:
   - no trades because the strategy produced no signals
   - no trades because a risk overlay explicitly skipped all candidates
   - no data because the selected scope genuinely has no trades

2. Invalid empty:
   - payload exists but lost trades
   - path series has one synthetic point while basket has trades
   - sidebar has nonzero scoped stats while section shows zero
   - selected week exists in the strip but maps are missing or zero without explanation

The UI should distinguish these states.

## Proposed Refactor Plan

### Phase 0: Audit script before code changes

Create a diagnostic script that pulls production payloads for all visible combinations and validates:

- every `weekOptions` entry has matching `engineWeekResults`
- every week result has matching simulation group
- every simulation group with trades has nonempty series
- every all-time scoped sidebar stat matches simulation for each asset scope
- every all-time scoped basket count matches scoped trade count
- ready shards with zero trades are compared against the no-overlay baseline

Output should identify exact invalid weeks and exact sections likely affected.

This gives us a measurable before/after target.

### Phase 1: Define `ScopedPerformanceModel`

Add a pure derivation module, not UI code:

```ts
deriveScopedPerformanceModel(payload, filters): ScopedPerformanceModel
```

Inputs:

- full strategy payload
- selected week
- asset class scope
- source scope (typed placeholder in Phase 1)
- tier scope (typed placeholder in Phase 1)
- symbol scope (typed placeholder in Phase 1)

Outputs:

- scoped summary
- scoped simulation
- scoped basket
- scoped research
- scoped calendar
- scoped sidebar stats
- diagnostics

This function should be unit-tested heavily.

Phase 1 implementation scope must stay intentionally narrow:

- Implement real filtering for `week` and asset-class scope only.
- Include `sourceScope`, `tierScope`, `symbolScope`, and sub-week time fields in the type so the interface is future-proof.
- Do not implement source/tier/symbol/hour/fill-state filtering in Phase 1.
- For future scopes, return unfiltered data and mark those filters as unsupported/inactive in diagnostics.

This prevents the first refactor from turning into a full drilldown engine before basic page consistency is fixed.

### Phase 2: Move Simulation and Sidebar onto the shared model

Simulation and Sidebar are currently the closest to correct. Move them first so the shared model is proven against known-good output.

Acceptance criteria:

- `All Time · Commodities` still shows `+2.91%` and `199 trades` for the current Agreement example.
- Week-level commodity scope still matches existing Simulation behavior.

### Phase 3: Move Summary, Basket, and Research onto the shared model

Summary/Basket/Research should stop deriving their own scoped data.

Acceptance criteria:

- `All Time · Commodities` Summary must not show `0.00%` if sidebar/simulation show `+2.91%`.
- Basket must show the 199 commodity trades or explicitly support an aggregate representation.
- Research must show scoped aggregate diagnostics, not selected-week-only empty data.

### Phase 4: Add semantic shard validation

Extend artifact readiness or add a companion validation endpoint.

Rules:

- ready shard cannot silently contain `0 trades` if baseline has trades and overlay did not record all candidates skipped
- ready shard cannot have weekOptions that map to empty data without an explicit invalid reason
- asset series cannot be one-point placeholders if trade count is nonzero

For Pair Fill Cap specifically:

- record skipped fill count
- record active fill cap hits
- record per-week candidate count
- if trade count is zero, expose whether all candidates were skipped or whether no candidates existed

### Phase 5: Preload gate trigger logic

The existing system already has most of the required lanes:

1. Historical readiness:
   - artifact status endpoint checks existence/version readiness

2. Current week:
   - current week overlay/read path refreshes live data

3. Client hydration:
   - client memory/browser cache hydrates version-current payloads

The needed change is not a full preload rewrite. The gate should make better rebuild decisions:

- Missing or invalid historical shard: run historical repair.
- Stale/current week only: refresh current week, do not rebuild history.
- Version-current cached payload: hydrate quickly.
- Semantic invalid warning: show the app with an explicit warning unless the missing data blocks the selected view.

The gate should not rebuild everything on every refresh.

## Pair Fill Cap Specific Concern

The Feb 02 empty week must be investigated before production automation decisions rely on Pair Fill Cap.

Possible causes:

1. Engine state leak:
   - active fill count persists between symbols or weeks
   - cap thinks every pair already has 3 active fills

2. Trigger ordering bug:
   - cap check happens before expected fills are initialized correctly
   - cap blocks the anchor/open fill unexpectedly

3. Shard cache contamination:
   - stale empty shard was saved as v25-ready
   - repair rebuilt the shell but not the actual path

4. Legitimate but unexplained:
   - Pair Fill Cap skipped all fills due to active fill state
   - if so, the UI needs diagnostics showing skipped/candidate fills

Required audit:

- recompute `Agreement · ADR Grid · Pair Fill Cap · 2026-02-02` locally
- compare candidate fills vs accepted fills
- compare no-overlay path vs pair-fill-cap path
- confirm whether zero trades is reproducible
- if reproducible, print why every candidate was skipped
- check whether the stored shard engine version and metadata truly match `risk-overlay-pair-fill-cap-v1`
- force rebuild the shard and compare before/after values

## Future Institutional Drilldown Model

The longer-term Performance page should become a drilldown tool, not just cards.

Target capabilities:

- select any week and see:
  - all trades
  - all fills
  - all resets
  - hourly path
  - pair-level grid visualization

- select a pair and see:
  - weekly grid levels
  - fills by timestamp
  - TP/rearm cycles
  - reset events
  - mark-to-market path
  - source agreement behind the pair

- select a source/tier and see:
  - source-only path
  - source-only basket
  - source-only research diagnostics
  - source-only drawdown and return distribution

- select an asset class and see:
  - all sections filtered consistently
  - calendar/daily/monthly returns scoped consistently
  - basket/research/summary scoped consistently

This should be implemented as composable filters over one event model.

## Non-Goals For The Next Pass

Do not:

- patch only Feb 02
- patch only Commodities
- make Summary/Basket/Research each implement their own scope filters
- add more UI drilldowns before the canonical scoped model exists
- move to automation based on Performance page numbers until semantic shard validation exists
- delete legacy data paths until the new model is validated against production output

## Recommended Next Step

Build the Phase 0 audit script first.

The script should answer:

1. Which ready shards are semantically invalid?
2. Which weeks are empty under Pair Fill Cap while baseline has trades?
3. Which scopes disagree between Simulation, Sidebar, Summary, Basket, and Research?
4. Which failures are data-generation problems versus client-derivation problems?

Only after that should code changes start.

## Review Questions For Nyx/Freedom

1. Should the app block on semantic invalid artifacts, or show the app with an explicit invalid-data warning?
   - Current answer: show the app with an explicit invalid-data warning. Blocking hides useful information.
2. Should Basket in all-time scoped mode show every trade, aggregate by symbol, or both?
   - Current answer: aggregate by symbol first, with expandable trade-level detail later.
3. Should Research in all-time mode aggregate diagnostics across all weeks, or remain week-only until rebuilt?
   - Current answer: aggregate diagnostics across weeks.
4. Is `All Time` intended to support every scope that week view supports?
   - Current answer: yes. No exceptions.
5. Should source/tier/symbol scope be added now to the shared model, or designed now and implemented after asset-scope parity is fixed?
   - Current answer: design now, implement after asset-scope parity.
6. Should the Pair Fill Cap empty-week audit block automation work?
   - Current answer: it should not block automation planning, but it should block trusting that specific shard until rebuilt/validated.

## Proposed Acceptance Criteria

Before this architecture pass is considered complete:

- Agreement · ADR Grid · Pair Fill Cap · Feb 02 is either valid with real trades or explicitly marked invalid with a diagnostic reason.
- All Time · Commodities shows the same return/trade count across Sidebar, Simulation, Summary, Basket, and Research.
- Week-level scopes behave consistently across all tabs.
- Refresh does not rebuild historical artifacts when all historical artifacts are ready and version-current.
- A production audit script reports zero semantic mismatches for the visible strategy combinations.
