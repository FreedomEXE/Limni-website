/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: BOOTSTRAP_UI_ARCHITECTURE.md
 *
 * Description:
 * Practical implementation rules for keeping Limni UI selection changes fast.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

# Bootstrap UI Architecture

Date: 2026-03-29
Status: ACTIVE RULESET
Related: `docs/SESSION_BOOTSTRAP_LOADER_SPEC_2026-03-28.md`

## Purpose

This document turns the bootstrap loader spec into concrete implementation rules for daily feature work.

If a new strategy, filter, selector, or section is added, it should follow this document by default.

## Core Rule

Local selection changes must switch preloaded state on the client.

They must not trigger a route-level historical recompute.

Examples of local selection changes:

- changing week in Matrix / Performance / Data
- switching Dealer / Commercial / Sentiment on Data
- switching among already-bootstrapped strategy/filter combinations
- switching tabs or view mode inside an already loaded section

## Required Pattern

### 1. Server bootstrap once

The server page or loader should:

- resolve the current selection
- load canonical historical payloads once
- reuse cached artifacts when possible
- pass precomputed maps to a client view component

The server should do heavy work here, not during every click after mount.

### 2. Client view owns selection state

The client view should:

- keep `selectedWeek`, `selectedStrategy`, `selectedBias`, `selectedView`, etc. in local state
- derive the current display from precomputed maps
- update URL state with `history.replaceState` when appropriate

The URL should mirror state, not drive recomputation.

### 3. Artifact reuse before recompute

Historical loaders must:

- check for an existing cached artifact
- compare source watermarks and engine version
- rebuild only if inputs changed

Navigation is not a valid invalidation trigger.

## Current Reference Implementations

Use these files as the reference pattern before adding a new system:

- `src/components/performance/PerformanceStrategyViewSection.tsx`
- `src/components/matrix/MatrixViewSection.tsx`
- `src/components/dashboard/DashboardViewSection.tsx`
- `src/lib/performance/strategyPageData.ts`
- `src/lib/performance/strategyArtifactCache.ts`
- `src/lib/performance/strategySelection.ts`

## Strategy / Filter Additions

When adding a new strategy or filter:

1. Register it in `src/lib/performance/strategyConfig.ts`
2. Ensure it is covered by `listStrategyBootstrapSelections()`
3. Ensure the relevant section reads from the bootstrapped selection map instead of recomputing on selection change
4. Ensure artifact invalidation is based on input metadata, not user navigation

If step 2 is missed, the UI may work but the fast-path bootstrap contract is broken.

## Section Additions

When adding a new section backed by historical data:

1. Build a server bootstrap payload
2. Pass precomputed maps into a client view component
3. Switch among those maps with local state
4. Keep live overlays separate from historical state

Do not introduce a new section that reloads the whole page for week or model toggles unless that interaction is explicitly intended to be server-driven.

## What Is Allowed To Stay Server-Driven

These are acceptable reasons to rerun the server page:

- entering a different major section
- switching to a different asset domain when that domain was not bootstrapped
- requesting a genuinely missing artifact
- loading data after a real source/version invalidation

## Regression Smells

Treat these as architecture regressions:

- adding `router.push` / `router.replace` for a local week or model toggle
- recomputing strategy history directly inside a UI component
- bypassing `strategyPageData` for new strategy combinations
- introducing a selector whose options are not included in the bootstrap registry
- mixing live overlay fetches with historical rebuild logic

## Guardrails

The codebase should keep these protections:

- tests that enforce bootstrap registry coverage
- comments at major preload/selection boundaries
- shared helper modules for selection registries and client selection events

If a future feature does not clearly fit this architecture, update this doc before implementing the new loading pattern.
