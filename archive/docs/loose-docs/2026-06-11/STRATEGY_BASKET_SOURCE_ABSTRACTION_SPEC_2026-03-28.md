/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
# Strategy Basket Source Abstraction Spec
/*-----------------------------------------------
  Manifested by Codex
-----------------------------------------------*/

Date: 2026-03-28
Status: DESIGN
Owner: Codex + Freedom
Implementation target: Nyx

## Purpose

Define the canonical historical basket layer that sits below the strategy engine so Matrix, Performance, Research, Automation, and the Data section can never drift.

This spec is not a UI brief.
This spec is not a direct code patch.
This spec defines the contract Nyx should implement before any Matrix UI cleanup continues.

## Locked Architecture Principle

Historical strategy data in Limni must have exactly one source-of-truth chain with no parallel reconstruction paths.

That chain is:

1. Data-layer historical inputs and weekly anchors
2. Canonical basket source
3. Strategy engine
4. Page loaders
5. Section UIs

If a historical basket, trade, or stat can be produced by more than one code path, the architecture is still wrong.

## Why This Exists

The current shared loader work is a good direction, but it is not enough by itself.

Today:

- the Data section derives visible dealer/commercial baskets in [`src/app/dashboard/page.tsx`](../src/app/dashboard/page.tsx)
- the engine independently resolves directions in [`src/lib/performance/weeklyHoldEngine.ts`](../src/lib/performance/weeklyHoldEngine.ts)
- Matrix has historically read a separate hardcoded basket path

That means the app still has multiple historical basket-construction paths.

Even if those paths mostly agree today, they will drift the moment:

- COT interpretation changes
- sentiment interpretation changes
- neutrality rules change
- missing-data backfill rules change
- pair mapping rules change

The fix must happen at the basket layer, not only at the page-loader layer.

## Current Storage Reality

This is the important grounding point:

- Limni already has canonical stored historical inputs
- Limni does not yet expose a dedicated reusable historical basket-source contract

What exists now:

- COT snapshots in [`src/lib/cotStore.ts`](../src/lib/cotStore.ts)
  - backed by `cot_snapshots`
- sentiment aggregates in [`src/lib/sentiment/store.ts`](../src/lib/sentiment/store.ts)
  - backed by `sentiment_aggregates`
- canonical surfaced week mapping in [`src/lib/dataSectionWeeks.ts`](../src/lib/dataSectionWeeks.ts)
  - backed by `pair_period_returns`

What does not yet exist cleanly:

- one shared server-side module that says:
  - "for week X, here are the canonical dealer/commercial/sentiment pair directions"
  - "these directions are what Data, Matrix, and Performance all mean when they say the historical basket"

So this spec does not require a brand-new database table first.
It requires a new abstraction first.

An explicit persisted `basket_history` table may be added later if it becomes useful for caching, audit, or faster reads.
That is optional.
The abstraction is not optional.

## Canonical Ownership

### Data layer owns

The Data layer owns canonical historical base inputs and weekly alignment:

- historical COT snapshots
- historical sentiment aggregates
- canonical week list / week-to-report-date mapping

This is the source layer where COT or sentiment interpretation changes should be fixed once and propagated everywhere.

### Basket source owns

The basket source owns canonical historical pair directions for the three base models:

- dealer
- commercial
- sentiment

Its job is to turn stored historical inputs into one canonical pair-direction record set per week.

### Strategy engine owns

The engine owns:

- derived strategy composition
- basket filtering
- risk profile / P&L model application
- trade execution logic
- strategy stats
- per-week and multi-week outputs

The engine does not own independent historical basket reconstruction anymore.

### Pages and sections own

Pages and sections own display only:

- Matrix
- Performance
- Research
- Automation
- Data views

They do not derive historical basket truth.

## Required Module

Create a new shared module, recommended path:

- `src/lib/performance/basketSource.ts`

Alternative acceptable path:

- `src/lib/data/canonicalBasketSource.ts`

The exact filename is less important than the boundary.

The engine must depend on this module.
The Dashboard/Data section should also be able to depend on this module.

## Required Public Contract

The basket source should expose a contract equivalent to this:

```ts
export type BaseBasketModel = "dealer" | "commercial" | "sentiment";

export type BasketDirection = "LONG" | "SHORT" | "NEUTRAL";

export type CanonicalBasketSignal = {
  weekOpenUtc: string;
  model: BaseBasketModel;
  symbol: string;
  assetClass: string;
  direction: BasketDirection;
  sourceTimestampUtc?: string | null;
  sourceReportDate?: string | null;
  metadata?: Record<string, unknown>;
};

export type CanonicalBasketWeek = {
  weekOpenUtc: string;
  signals: CanonicalBasketSignal[];
};

export async function getCanonicalBasketWeek(
  weekOpenUtc: string,
): Promise<CanonicalBasketWeek>;

export async function getCanonicalBasketWeeks(
  weekOpenUtcs: string[],
): Promise<Record<string, CanonicalBasketWeek>>;
```

This does not need to be the exact final type spelling.
It does need to preserve the boundary:

- one week in
- canonical base-model basket records out

## Required Behavioral Rules

### Rule 1: Historical weeks must resolve from stored historical inputs

For a historical week:

- dealer/commercial directions must resolve from the stored COT snapshot aligned to that week
- sentiment directions must resolve from the stored sentiment aggregate aligned to that week

No page may directly rebuild these directions for itself once the basket source exists.

### Rule 2: The basket source returns base-model truth, not derived strategy truth

The basket source should return:

- dealer
- commercial
- sentiment

It should not directly return:

- `tiered_v3`
- `agree_2of3`
- `tandem`

Those remain engine responsibilities.

Reason:
derived strategies are business logic compositions over base truth.
They should stay in the strategy layer.

### Rule 3: Neutral must be explicit

If a pair is historically tracked but does not qualify as long or short, the canonical record should still resolve explicitly as `NEUTRAL`.

Do not allow sections to infer neutrality differently.

### Rule 4: Missing data handling must be centralized

If a model cannot produce a direction for a given symbol/week because data is missing:

- the basket source must decide the canonical outcome
- sections must not each invent their own fallback

Preferred behavior:

- return an explicit `NEUTRAL`
- include a metadata reason where useful

Examples:

- missing sentiment aggregate for symbol/week
- missing COT snapshot for asset class/week
- week/report-date mismatch

### Rule 5: Week alignment must use shared canonical week helpers

The basket source must resolve historical weeks using the same canonical week helpers already used by the Data section:

- [`src/lib/dataSectionWeeks.ts`](../src/lib/dataSectionWeeks.ts)

Do not create another separate week-anchor system.

### Rule 6: Live/current-week context must not rewrite historical truth

Historical basket truth is server-side and canonical.

Live or current-week overlays may still exist for:

- trigger states
- current prices
- active trade state
- current week visualization

But they must never replace or mutate the historical basket record for closed weeks.

## Source Mapping Rules

### Dealer / Commercial

Initial implementation may continue to read from stored `cot_snapshots`.

But that read must be wrapped by the basket source.

The engine should stop calling `readSnapshot()` directly inside `resolveDirections()` for historical base-model resolution.

Instead:

1. basket source reads the correct snapshot for the week
2. basket source resolves canonical pair directions
3. engine consumes the resulting base-model signals

### Sentiment

Initial implementation may continue to read from stored sentiment aggregates:

- `getAggregatesForWeekStartWithBackfill()`
- or a stricter week-locked helper if you decide the current helper is too permissive

But that read must also be wrapped by the basket source.

The engine should stop resolving sentiment directions directly for historical weeks.

## Strategy Composition Rules

Once the engine receives canonical base-model signals from the basket source, it composes higher-order strategies.

### Dealer

- all non-neutral dealer signals become weekly strategy directions

### Commercial

- all non-neutral commercial signals become weekly strategy directions

### Sentiment

- all non-neutral sentiment signals become weekly strategy directions

### Tiered V3

Compose from canonical base-model signals for the same week/symbol:

- 3 aligned votes = tier 1
- 2 aligned votes = tier 2
- 1 aligned vote with no opposition = tier 3
- mixed opposition = no signal

### 2-of-3 Agree

Compose from canonical base-model signals for the same week/symbol:

- at least two aligned long votes = `LONG`
- at least two aligned short votes = `SHORT`
- otherwise no signal

### Tandem

Compose from canonical base-model signals for the same week/symbol:

- emit one independent signal per approving model
- do not collapse these into one pair-level position

## Engine Refactor Requirement

`weeklyHoldEngine.ts` should be refactored so that historical direction resolution is split into two layers:

### Layer A: base basket read

Consumes the basket source and returns canonical dealer/commercial/sentiment signals.

### Layer B: strategy composition

Builds:

- single-model strategies
- tiered
- 2-of-3
- tandem

from those canonical signals.

The key architectural change is:

- `resolveDirections()` must stop being both the historical source reader and the strategy composer

It should become a composition layer over canonical basket reads.

## Dashboard / Data Section Refactor Requirement

The Dashboard/Data section should stop deriving its own base-model pair directions inline once the basket source exists.

Today, [`src/app/dashboard/page.tsx`](../src/app/dashboard/page.tsx) derives historical pair directions directly from snapshot currencies.

That should move to:

1. read canonical basket week for the selected week/model
2. display those canonical signals

This is what makes Data and Strategy surfaces share the same historical basket truth.

## Shared Loader Relationship

The existing shared loader direction remains valid:

- [`src/lib/performance/strategyPageData.ts`](../src/lib/performance/strategyPageData.ts)

But the loader must sit above the corrected stack:

1. basket source
2. engine
3. page loader
4. Matrix / Performance

Shared loader is necessary.
Shared loader is not sufficient if the engine still rebuilds base baskets separately from Data.

## Canonical Output Responsibilities

After this abstraction is in place:

- Data section canonical basket numbers come from basket source
- strategy trade results come from engine
- sidebar stats come from engine
- Matrix stats bar comes from engine
- LONG / SHORT copy buttons come from engine-selected canonical basket signals

That gives Limni one historical basket truth and one historical strategy-execution truth.

## Compatibility With Future Risk Profiles

This basket-source abstraction is independent of the future `Risk Profile` selector.

That is intentional.

The layering should be:

1. basket source
2. strategy composition
3. risk profile
4. basket filter
5. intraday trigger filter
6. execution / P&L

Do not mix risk-profile concepts into the basket source.

The basket source only answers:

- what was the canonical directional basket truth for this week?

## Implementation Sequence

Nyx should implement in this order:

1. Create basket source module and types
2. Move dealer/commercial/sentiment historical resolution into basket source
3. Refactor engine to compose derived strategies from basket source outputs
4. Rewire Dashboard/Data section to read canonical basket source for historical pair directions
5. Keep shared page loader on top of the new engine boundary
6. Remove remaining historical hardcoded basket paths from Matrix

Only after that should Matrix UI cleanup proceed.

## Acceptance Criteria

This abstraction passes if all of these are true:

1. Historical dealer/commercial/sentiment pair directions for a given week come from exactly one shared server-side module.
2. The engine no longer directly resolves historical base-model directions from raw snapshot reads inline.
3. The Dashboard/Data section no longer derives historical base-model pair directions independently.
4. Matrix and Performance historical basket membership for the same strategy/week match because they come from the same engine output.
5. Changing the interpretation of COT or sentiment in the basket source changes every downstream section without page-specific rewrites.
6. Zero-trade weeks remain canonical and do not fall back to raw scanner endpoints.
7. Current-week live overlays remain allowed, but historical closed-week truth does not depend on them.

## Explicit Non-Goals

This spec does not require:

- immediate creation of a new `basket_history` database table
- UI redesign
- new Risk Profile implementation
- take-profit/stop-loss selector implementation
- intraday trigger redesign

Those are separate tasks.

## Final Rule

If Freedom changes how Limni interprets COT data or sentiment data in the future, that change should be made once at the canonical basket source layer and every dependent section should inherit the update automatically through the engine.

That is the point of this abstraction.
