# Codex Handoff: Performance Unified Drilldown Baseline

Date: 2026-05-19

## Context

The Performance page is now closer to numerically correct: summary, basket, and simulation can all see non-FX trades, and asset sleeve simulation no longer collapses to FX-only when the trade log contains indices, commodities, or crypto.

The next problem is interaction design and data consistency. The page still behaves like separate widgets instead of one unified analysis tool. Selecting `FX`, `Indices`, `Commodities`, or `Crypto` in the Simulation section only changes the simulation widgets. Summary, basket, research, sidebar stats, return distribution, and calendar still mostly read the unfiltered page payload.

That makes deep review frustrating because the user has to mentally reconcile different scopes across the same page.

## Goal

Create one page-level drilldown state that controls the entire Performance page.

If the user selects `Crypto`, the whole page should become crypto-only until the user changes it back. If the user selects `All`, the whole page should return to full portfolio stats.

This is the baseline for a later institutional-grade drilldown model where the user can zoom from:

- all assets
- asset class
- individual pair/symbol
- week/day/hour
- trade-level analytics

## Required Behavior

Add a shared page-level asset scope:

```ts
type PerformanceAssetScope = "all" | "fx" | "indices" | "commodities" | "crypto";
```

This scope must be owned above the individual section widgets, most likely in `PerformanceViewSection` or a small performance-page context.

The scope must also live in the URL:

```txt
?scope=crypto
```

This should sit alongside the existing strategy/filter/week params so refreshes and shared links preserve the drilldown state.

The Simulation section sleeve buttons should update this shared scope instead of keeping local-only state.

The selected scope should apply to:

- sidebar selected-week stats
- sidebar all-time/current strategy stats where possible
- Summary cards
- Simulation chart
- Simulation return / max DD / trades cards
- Rolling windows
- Asset contribution
- Return distribution
- Returns calendar
- Basket trade list
- Research diagnostics
- Notes context if it displays scoped stats later

## Current Problem Example

For `Agreement · ADR Grid · Exposure Cap · Apr 06 2026`, Summary and Basket show all asset classes correctly:

- FX return exists
- commodities / indices return exists
- crypto return exists
- basket contains non-FX trades such as `ETHUSD`, `XAGUSD`, `WTIUSD`, `NIKKEIUSD`

Simulation now also shows the full contribution after the recent fix. But the selection still does not propagate to the rest of the page.

## Weekend / Market-Hours Behavior

There is also an asset-aware calendar/chart issue.

Current code still applies FX-style market filtering in places:

- `PerformanceSimulationSection.tsx` always passes `skipWeekends` to `EquityCurveChart`
- `dailySimulationReturns.ts` only allows Monday-Friday day labels
- weekend points are stripped before daily returns are built

That is correct for FX, indices, and commodities in most cases, but it is wrong for crypto.

Expected behavior:

- `fx`: skip closed-market weekend points
- `indices`: skip closed-market weekend points
- `commodities`: skip closed-market weekend points
- `crypto`: include Saturday and Sunday
- `all`: include weekend points because at least one selected asset class can trade on weekends. FX/indices/commodities should carry forward through closed periods while crypto moves.

The daily calendar should show weekend returns for crypto. Week view can still force daily mode, but daily mode should not force a Mon-Fri-only layout when the active scope is crypto.

## Sidebar Scoping

The sidebar has two different stat surfaces:

- selected-week stats
- all-time aggregate stats

When scope is not `all`, both must be scoped.

Preferred implementation: compute scoped sidebar stats client-side from the `engineWeekResults` already in the payload. Do not add server-side per-scope artifact variants. The trade results already contain `assetClass`, so a helper such as `deriveScopedSidebarStats(weekResults, scope)` can derive total return, trades, wins/losses, weekly win rate, expectancy, and streaks without changing the artifact format.

## Continuous Price Path Note

The all-time equity curve may still look stair-stepped or jumpy after the recent correctness fixes.

Likely reason:

The repaired asset sleeves can fall back to trade-derived series when native path series are missing, flat, or mismatched. Trade-derived series are numerically safer, but they are coarser. They can look less smooth than a native realized path because they may only move at week/day/trade aggregation points.

Before the recent fix, some curves looked smoother because they were often displaying whichever native path series existed, even when that meant FX-only or partial asset data. Smoother did not necessarily mean more correct.

Later improvement:

Build or preserve continuous realized price paths for every asset sleeve, not just the combined/FX path. The correct future state is:

- every asset class has its own native path
- every pair/symbol can expose its own path
- all-time/week/day/hour drilldowns use the same path source
- trade-derived fallback is only a fallback, not the primary visual source

This is not the immediate next fix, but it should be tracked as the next quality upgrade after unified scope.

Observed follow-up:

Some non-FX sleeves, especially indices/commodities/crypto in certain weekly-hold views, still render as flat-through-week plus one final jump. That means the selected sleeve is using a coarse weekly/trade-derived fallback instead of a canonical hourly path. In those cases, return may be numerically right, but drawdown and intraperiod shape are not reliable.

Next path-engine task:

- audit `canonical_price_bars` coverage for non-FX symbols used by strategy paths
- verify `loadPathBars()` returns hourly rows for symbols like `SPXUSD`, `NDXUSD`, `NIKKEIUSD`, `XAUUSD`, `XAGUSD`, `WTIUSD`, `BTCUSD`, `ETHUSD`
- preserve native asset paths when their final return matches the trade log
- only use trade-derived fallback when hourly data is truly unavailable
- expose a path-quality flag in simulation data so the UI can distinguish `hourly` vs `weekly fallback`

## Implementation Plan

1. Add shared asset scope state.

Own this in `PerformanceViewSection` or a small local context used by its children.

The default is `all`.

2. Update `PerformanceSimulationSection`.

Remove local-only sleeve state or make it controlled:

```ts
assetScope: PerformanceAssetScope;
onAssetScopeChange(scope: PerformanceAssetScope): void;
```

The existing sleeve buttons become the global selector.

3. Add scoped selectors/helpers.

Create helper functions that can derive scoped data from the canonical payload:

- filter `WeeklyHoldResult.trades` by asset class
- derive scoped return, trades, wins, losses, win rate
- derive scoped simulation series
- derive scoped basket rows
- derive scoped weekly/all-time return arrays
- derive scoped daily returns

Avoid duplicating calculations in each component.

4. Apply scope to all visible sections.

The page should not show one scope in Simulation and another scope in Summary/Basket/Research.

5. Make calendar and chart asset-aware.

Pass the active asset scope into chart/calendar helpers.

Crypto scope should include weekends.

6. Add validation cases.

Use known weeks where non-FX trades exist:

- `Agreement · ADR Grid · Exposure Cap · Apr 06 2026`
- current week selections with crypto/indices/commodities trades

Verify:

- selecting `Crypto` changes chart, cards, calendar, distribution, basket, and sidebar to crypto-only
- selecting `Indices` does the same
- selecting `All` restores full portfolio numbers
- crypto weekend calendar cells appear when crypto has weekend points

## Acceptance Criteria

- The asset selector is global within Performance.
- The selected asset scope persists while navigating between Summary, Simulation, Basket, Research, and Notes for the same strategy/week.
- Simulation metrics and sidebar selected-week metrics agree for the selected asset scope.
- Basket rows match the selected asset scope.
- Return distribution and calendar use the selected asset scope.
- Crypto daily returns can include weekends.
- FX-only views do not show crypto weekend data.
- No regression to FX-only asset contribution when non-FX trades exist.

## Out Of Scope For This Pass

- Full pair-level drilldown
- Hour-level drilldown
- Trade detail modal redesign
- Rebuilding all historical artifacts
- Replacing all trade-derived fallback paths with continuous native paths

These are the next layer after the unified asset scope is stable.
