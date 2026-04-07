# CODEX: Path-True Equity Engine Spec

**Date:** 2026-04-06  
**Owner / Idea Origin:** Freedom_EXE  
**Status:** Draft for Nyx review  
**Goal:** Replace the current coarse weekly-close simulation and drawdown logic with one shared path-true portfolio engine across the app, then extend it cleanly to lower-resolution canonical bars later.

---

## Why This Exists

This phase was explicitly initiated by **Freedom_EXE** after the weekly-hold stack was substantially re-engineered at the source and composite layers.

The current system is directionally useful, but the simulation and drawdown layer is still too coarse:

- weekly-hold drawdown is mostly derived from weekly return curves, not true intraweek basket path
- the Performance simulation section is using coarse start/end or week-by-week points
- current DD does not reflect concurrent basket behavior at actual timestamps
- later overlays like DCA, ADR pullback layering, and more advanced exit logic cannot be modeled honestly without a path engine

The decision is to **pause new systems / new overlays** and focus next on:

1. accurate app-wide equity curves  
2. accurate portfolio drawdown  
3. one shared simulation data contract  
4. future-proof canonical bar infrastructure that can later slot in `5m` and below

---

## Confirmed Findings

### 1. Performance and Research already use the same chart component

This is good news and simplifies the refactor.

- Performance uses [PerformanceSimulationSection.tsx](C:/Users/User/Documents/GitHub/limni-website/src/components/performance/PerformanceSimulationSection.tsx)
- That component already renders [EquityCurveChart.tsx](C:/Users/User/Documents/GitHub/limni-website/src/components/research/EquityCurveChart.tsx)
- Research also uses [EquityCurveChart.tsx](C:/Users/User/Documents/GitHub/limni-website/src/components/research/EquityCurveChart.tsx)

Conclusion:

- **Do not build a second equity widget**
- Standardize on `EquityCurveChart.tsx` as the single app-wide curve component
- Fix the **data layer**, not the widget

### 2. Current Performance simulation data is too coarse

Current weekly-hold simulation output in [engineAdapter.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/engineAdapter.ts):

- single-week simulation is effectively start-point + end-point
- multi-week simulation is effectively one point per week
- this produces straight-line curves in Performance
- this prevents true intraweek drawdown / peak measurement

### 3. Current drawdown helpers are return-series based, not path-true

[drawdown.ts](C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/drawdown.ts) currently computes DD from:

- percent return series
- simple cumulative return series

This is valid for coarse weekly comparisons, but not valid for:

- true intraweek basket DD
- multi-entry systems
- staggered entries
- path-based peak / trough analysis

### 4. Current canonical price coverage

Current `canonical_price_bars` coverage confirms:

- `1d` bars exist app-wide
- `1h` bars exist app-wide
- `5m` bars do **not** currently exist in canonical storage

Conclusion:

- the engine should be designed to support `5m` globally
- but the first implementation should not assume `5m` is already available
- the first architecture pass should work with `1h`
- a later data/backfill pass can promote the same engine to `5m`

---

## Core Principle

**Drawdown is a portfolio path problem, not a per-trade or per-week summary problem.**

The new engine must compute a basket equity curve by timestamp from concurrently active positions.

Example:

- `EURUSD` long is `+5%`
- `EURGBP` long is `-6%`
- if both are active at the same timestamp and equally weighted
- basket equity at that moment is `-1%`

This must hold regardless of:

- how many pairs are active
- when each pair entered
- whether entries were simultaneous or staggered
- whether the system is weekly hold, ADR pullback, DCA, or future intraday

---

## Design Goals

### Functional

- one shared path-true portfolio engine for weekly systems
- one shared equity curve data contract for app consumers
- one shared DD calculation standard across Performance, Research, and future backtests
- support concurrent positions and staggered entries
- expose peak, trough, and true basket drawdown
- remain compatible with future `5m` and lower canonical bars

### Architectural

- keep provider-specific logic behind the canonical price layer
- consumers request **canonical path bars**, not provider bars
- chart UI remains shared and app-wide
- backtest / research consumers migrate to the same path engine
- no duplicated DD logic by section

### Product

- show honest and path-true metrics
- accept that some systems may look worse after the upgrade
- prefer accuracy over flattering metrics

---

## Non-Goals

- do not add DCA in this phase
- do not redesign or add new weekly systems in this phase
- do not build a second equity chart widget
- do not hardcode OANDA assumptions into consumers
- do not ship ad hoc `5m` logic directly into Performance without a shared path contract

---

## Required Outputs

The new engine must make the following metrics available as first-class outputs:

- `Total Return %`
- `Peak %`
- `Max DD %`
- `Peak-to-Close Giveback %`
- `Trough-to-Close Recovery %`
- `Losing Weeks`
- `Trades`
- `Weekly WR`

Future-ready but optional in Phase 1:

- underwater duration
- timestamp of peak
- timestamp of trough
- intraweek recovery duration
- MAE / MFE per basket

---

## Proposed Architecture

## Layer 1: Canonical Path Bars

Introduce a provider-agnostic path-bar contract.

Consumers should ask for:

- symbol
- timeframe / resolution
- from UTC
- to UTC

And receive canonical bars only.

### Rule

- consumers never request “OANDA bars”
- consumers request **canonical path bars**
- provider selection and normalization remain internal to the canonical layer

### Required behavior

- support at least `1h` immediately
- design API to support `5m`, `1m`, or lower later
- support future source replacement without changing downstream consumers
- support consistent UTC timestamps across all assets

### Suggested interface

```ts
type CanonicalPathResolution = "1h" | "5m" | "1m";

type CanonicalPathBar = {
  symbol: string;
  assetClass: string;
  resolution: CanonicalPathResolution;
  barOpenUtc: string;
  barCloseUtc: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  sourceProvider: string;
  qualityStatus: string;
};
```

Note:

- the current canonical layer already supports `1d` and `1h`
- `5m` is a planned data expansion, not an already-available input

### Quality status requirements

The path layer must distinguish between:

- `real` = actual provider bar
- `carried` = no fresh bar for this timestamp, last valid close carried forward
- `missing` = no valid price available, investigate / exclude from canonical confidence

The basket path engine should treat:

- `real` as normal mark-to-market input
- `carried` as flat mark-to-market using the last valid price
- `missing` as a data-quality condition that should be surfaced, not silently ignored

### Timestamp alignment rule

The engine should aggregate on a **master calendar grid per resolution**, not on the union of all provider timestamps.

For Phase 1:

- define one canonical hourly grid from week open to week close
- snap or map bar closes onto that grid
- where an instrument does not trade at a given timestamp, carry forward the last valid price

This keeps mixed-schedule baskets debuggable across:

- FX
- indices
- commodities
- crypto

---

## Layer 2: Position Ledger

Every strategy-week must resolve to normalized position events before path aggregation.

### Position event fields

Each active leg should contain:

- pair
- asset class
- direction
- entry timestamp
- optional exit timestamp
- weight
- entry style
- strategy id
- optional leg metadata

### Weight and ADR normalization

These are separate concepts and both are required.

- `weight` = portfolio allocation for the pair within the basket
- `adrMultiplier` = canonical risk normalization for that pair-week

Rule:

- each active pair gets a base weekly allocation
- for a basket with `N` active pairs, the pair budget starts at `1 / N`
- if the pair has multiple legs, those legs split the pair budget
- the sum of all leg weights for a given pair-week must equal that pair's total budget

ADR normalization remains canonical:

- each pair-week gets an ADR scalar from the canonical weekly ADR map
- this is the same `targetADR / pairADR` logic already used today
- it changes week to week
- it is **frozen for the entire pair-week**
- it must not drift intrAweek

This means the total effective contribution of a leg is:

`weight × adrMultiplier × directed mark-to-market return`

### Why this layer matters

It allows the same path engine to model:

- weekly hold
- ADR pullback
- future DCA
- selective systems
- future intraday systems

### Example

```ts
type PositionLeg = {
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  entryTimeUtc: string;
  exitTimeUtc: string | null;
  weight: number;
  adrMultiplier: number;
  entryPrice: number;
  strategyId: string;
  entryStyleId: string;
  meta?: Record<string, unknown>;
};
```

---

## Layer 3: Basket Path Engine

This is the core new engine.

For a given strategy-week:

1. build the position ledger  
2. load canonical path bars for all active pairs  
3. mark each position to market at each bar timestamp  
4. aggregate all active positions into one basket equity path  
5. derive metrics from that path

### Path computation rule

At each timestamp:

- each active position contributes weighted mark-to-market P/L
- basket equity is the sum of all active position contributions

This solves the concurrency problem cleanly.

### Mark-to-market formula

For an active leg at a path timestamp:

```ts
directedReturn = directionSign * ((barClose - entryPrice) / entryPrice)
legPnl = weight * adrMultiplier * directedReturn
```

Where:

- `directionSign` is `+1` for `LONG`, `-1` for `SHORT`
- `weight` is the pair or leg allocation inside the basket
- `adrMultiplier` is the frozen week-level `targetADR / pairADR` scalar

Then:

```ts
basketEquity = sum(activeLegPnl)
```

This preserves current ADR-normalized economics while upgrading the timing resolution from week-close-only to path-true mark-to-market.

### Engine outputs

```ts
type BasketPathPoint = {
  tsUtc: string;
  equityPct: number;
  peakPct: number;
  drawdownPct: number;
  activePositions: number;
};

type BasketPathSummary = {
  totalReturnPct: number;
  peakPct: number;
  maxDrawdownPct: number;
  peakToCloseGivebackPct: number;
  troughToCloseRecoveryPct: number;
  maxActivePositions: number;
};
```

---

## Layer 4: Shared Simulation Contract

All app sections should consume the same simulation series format.

This is already close to what [EquityCurveChart.tsx](C:/Users/User/Documents/GitHub/limni-website/src/components/research/EquityCurveChart.tsx) expects:

```ts
type SimulationSeriesPoint = {
  ts_utc: string;
  equity_pct: number;
  lock_pct: number | null;
};
```

### Rule

- keep the chart component
- upgrade the series generator
- Performance, Research, Accounts, and future strategy research should all consume the same path-derived series contract

---

## Metric Definitions

### Total Return %

- final basket equity at end of observation window

### Peak %

- highest basket equity reached at any timestamp during the window

### Max DD %

- largest peak-to-trough decline on the path-true basket equity curve
- not weekly-close DD
- not simple per-trade DD

### Peak-to-Close Giveback %

- `Peak % - Final Return %`

### Trough-to-Close Recovery %

- `Final Return % - Worst Path Value %`

### Losing Week

- weekly basket close below weekly starting equity

---

## Resolution Strategy

## Phase 1 Resolution

Use `1h` canonical bars for weekly systems immediately.

Reason:

- `1h` already exists app-wide
- it is sufficient to replace straight-line weekly simulation
- it is sufficient to make DD materially more honest than current weekly-close approximations
- it should be considered canonical immediately, not just transitional

## Phase 2 Resolution

Backfill and adopt `5m` canonical bars app-wide.

Reason:

- better intraweek path accuracy
- necessary for advanced entry timing systems
- necessary for more exact intraday research

## Phase 3 Resolution

Allow lower-than-`5m` path sources later if needed.

Rule:

- this should require only data-layer extension, not consumer rewrites

---

## DCA / ADR / Multi-Entry Compatibility

This spec must explicitly support future multi-entry systems.

That means:

- entries can occur at different timestamps within the same week
- multiple adds can coexist on the same pair
- each add can carry its own weight
- basket equity must reflect all active entries at each bar

This is why the ledger + path-engine architecture is required.

Without it:

- DCA is dishonest
- ADR pullback path risk is understated
- peak / DD analysis is incomplete

---

## Consumers To Migrate

The following consumers should eventually read from the new path engine or its derived artifacts:

### App consumers

- Performance simulation section
- Performance summary DD / peak metrics
- Research equity curves
- Accounts / related equity views where shared chart logic applies

### Engine / backtest consumers

- strategy comparison endpoints
- weekly-hold backtest metrics
- future DCA research
- future overlay/filter research
- any script or endpoint reporting equity curve or DD

### Rule

- once the path engine exists, new research should not keep inventing its own DD math
- path-derived metrics become the standard
- old scripts do not need retroactive rewrites, but all new DD-sensitive research should use the shared helper

---

## UI Standardization

### Approved chart component

Use only:

- [EquityCurveChart.tsx](C:/Users/User/Documents/GitHub/limni-website/src/components/research/EquityCurveChart.tsx)

### Why

It already supports the visual language we want:

- non-straight curves when path data exists
- profit / drawdown area separation
- peak / trough markers
- timestamped path points
- compare / isolate behavior

### Required UI improvement after path migration

The widget should be fed enough data to show:

- weekly open baseline
- real path through the week
- real peak
- real trough
- visible drawdown and recovery segments

---

## Data and Cache Considerations

### Current limitation

- `5m` canonical bars are not currently stored app-wide

### Required cache principle

Path-derived artifacts must invalidate when:

- relevant canonical path bars change
- relevant position legs change
- relevant strategy engine version changes
- resolution changes

### Suggested artifact fingerprint additions

- path resolution used
- price-bar watermark per week / symbol set
- path engine version

### Suggested artifact storage

Path results should be cached as computed artifacts, not recomputed on every page load.

Suggested table:

`strategy_path_artifacts`

Suggested key dimensions:

- strategy id
- entry style id
- overlay / filter ids where applicable
- week open UTC
- engine version
- path resolution

Suggested payloads:

- serialized basket path points
- serialized per-slot path points where needed
- summary metrics (`return`, `peak`, `maxDD`, `giveback`, etc.)
- source fingerprint metadata

---

## Suggested Implementation Plan

## Phase 0: Spec Lock

- confirm the path engine contract
- confirm metric definitions
- confirm `EquityCurveChart` remains the only chart
- confirm Phase 1 uses `1h`, Phase 2 backfills `5m`

## Phase 1: Shared Path Engine

- create canonical basket path engine using `1h`
- generate path points for weekly systems
- compute true peak / DD / giveback / recovery

## Phase 2: Performance Migration

- refactor Performance simulation to use path points
- refactor summary metrics to use path-derived DD and peak
- preserve current UI component, change only data feed

## Phase 3: Research / Comparison Migration

- update strategy comparison and research helpers to read path-derived metrics
- stop using legacy weekly-return-only DD for new research

## Phase 4: 5m Canonical Backfill

- backfill `5m` canonical bars app-wide
- upgrade path engine resolution where appropriate
- keep consumers unchanged

## Phase 5: DCA / Advanced Entry Research

- only after the path engine is trusted

---

## Risks

### Expected

- some systems will likely show higher DD than today
- some returns may look less impressive after honest path measurement
- strategy rankings may shift

### Possible positive surprise

- some systems may show strong path recovery
- peak capture may reveal exit opportunities not visible in close-to-close returns
- peak / trough analysis may expose better overlay ideas later

### Product stance

This is acceptable and desired.

The goal is not flattering metrics. The goal is accurate metrics.

---

## Decisions Locked By This Spec

- pause new systems / overlays until path accuracy is upgraded
- do not build a second equity chart widget
- use one shared path engine
- support future provider swaps and lower resolutions cleanly
- treat `1h` as immediate path resolution
- plan `5m` as app-wide canonical backfill, not as ad hoc one-off logic

---

## Questions For Nyx Review

1. Should Phase 1 `1h` path metrics be considered canonical immediately, or only transitional until `5m` arrives?
Answer from review direction:

- treat `1h` as canonical immediately for weekly systems
- later `5m` is a precision upgrade, not a redefinition of the engine
2. Should `Peak %` and `Peak-to-Close Giveback %` be promoted into the main Performance summary immediately after migration?
Answer from review direction:

- yes, both should be promoted immediately
3. Should the path engine aggregate on the union of all bar timestamps, or should it normalize to a single master calendar grid per resolution?
Answer from review direction:

- use a master calendar grid per resolution
4. For future multi-entry systems, should per-leg weights always sum to `1.0` at the pair-week level?
Answer from review direction:

- yes, per-leg weights should sum to the pair-week budget
- pair-week budgets then aggregate into the basket
5. Should current research scripts be migrated gradually, or should a shared path helper be required before any new DD-sensitive research ships?
Answer from review direction:

- do not rewrite frozen historical research
- do require the shared helper for all new DD-sensitive research

---

## Short Version

Freedom_EXE’s next major architecture move is to replace coarse weekly simulation and DD logic with one shared, path-true basket engine.

Use one chart component.  
Fix the path data.  
Ship `1h` first.  
Backfill `5m` next.  
Then resume DCA and advanced overlay research on top of an honest engine.
