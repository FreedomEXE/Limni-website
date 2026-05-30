# Performance ViewMode + Scope Consistency Sweep

Date: 2026-05-30

## Scope

This sweep audits Performance-adjacent display surfaces for two invariants:

- Metric display must resolve at the consuming boundary from the active ViewMode: execution/canonical anchor and raw/ADR-normalized metric.
- Asset scope filters must gate rendered cards/sections, not only blank out data inside inactive cards.

Backend engines, ledger schema, trade readers, ViewMode store, and resolver helpers were intentionally left unchanged.

## Classification

| Surface | Status | Finding | Action |
| --- | --- | --- | --- |
| Performance all-time summary cards | Fixed | Baked normalized weekly aggregate rows stayed unchanged when toggling raw/ADR. | Rebuilt all-time card rows from `engineWeekResults` at the consuming boundary using current ViewMode and strategy card-slot semantics. |
| Performance weekly summary cards | Fixed | Scoped weekly views filtered row data but still rendered inactive asset cards as blank/zero cards. | Single-week scope filtering now removes inactive model cards before render. |
| StrategySidebar | Resolved | Uses `computeScopedSidebarStats`, `buildResolvedWeekReturns`, `resolveStrategyTradeReturn`, and resolved simulation metrics. | Verified. No code change. |
| PerformanceSimulationSection return and MaxDD | Resolved | Uses `resolveSimulationGroupForViewMode`; raw fallback uses resolved weekly returns when no raw hourly path exists. | Verified. No code change. |
| PerformanceSimulationSection equity chart | Resolved | Uses resolved return-mode series, or a resolved weekly additive series for raw fallback. | Verified. No code change. |
| RollingPerformanceWindows | Resolved | Consumes already-resolved weekly returns and the selected chart series. | Verified. No code change. |
| AssetContributionChart | Resolved | In raw mode receives resolved asset contribution bars; otherwise derives from active resolved series. | Verified. No code change. |
| ReturnDistribution | Resolved | Consumes already-resolved weekly returns. | Verified. No code change. |
| ReturnsCalendar | Resolved | Receives resolved weekly returns or the resolved chart series from Simulation. | Verified. No code change. |
| Performance basket pair rows | Resolved | Weekly rows are projected through `projectGridPropsForViewMode`; all-time basket receives resolved weekly rows after this sweep. | Verified. No extra code change beyond all-time projection. |
| Performance research cards | Resolved | Uses the same `PerformanceGrid` projected model data as summary cards. | Verified. No extra code change beyond all-time projection. |
| PerformanceComparisonPanel | Inactive in current source/UI | Source reference audit found no active imports/usages outside docs; Playwright sweep found no DOM hits across normal Performance tabs, strategy variants, and legacy query variants. | No change. Treat as parked legacy code unless reintroduced. |
| PerformanceAllSystemsTable | Inactive in current source/UI | Source reference audit found no active imports/usages outside docs; Playwright sweep found no DOM hits across normal Performance tabs, strategy variants, and legacy query variants. | No change. Treat as parked legacy code unless reintroduced. |
| PerformanceStrategyViewSection | Resolved wrapper | Passes bootstrapped payloads into `PerformanceViewSection`; no independent metric rendering. | Verified. No code change. |
| PerformanceFlagshipCard | Inactive in current source/UI | Source reference audit found no active imports/usages outside docs; Playwright sweep found no DOM hits across normal Performance tabs, strategy variants, and legacy query variants. | No change. Treat as parked legacy code unless reintroduced. |
| Matrix RiskBoard | Resolved | Uses `useViewMode("matrix")` and `resolveDisplayReturn` for displayed rows. | Verified. No code change. |
| Matrix FlagshipBoard | Resolved | Uses `useViewMode("matrix")` and `resolveDisplayReturn` for displayed rows. | Verified. No code change. |
| MatrixViewSection aggregates | Resolved wrapper | Dispatches sidebar stats from already-resolved Matrix payloads. | Verified. No code change. |
| FlagshipBoard matrix aggregates | Resolved | Row display resolves through ViewMode; aggregate boards use the same resolved row values. | Verified. No code change. |

## Fix Notes

### All-time card projection

All-time Performance cards previously relied on pre-computed aggregate rows in `engineWeekMap["all"]`. Those rows were normalized-only week totals. The fix keeps the cached artifact as an input but rebuilds displayed card rows from `engineWeekResults` inside `PerformanceViewSection`, using:

- `scopedStrategyTrades`
- `resolveStrategyTradeReturn`
- the active `performanceViewMode`
- the active asset scope
- the strategy card-slot semantics from `strategyConfig`

This preserves Agreement asset-class cards, Tandem source cards, and Tiered confidence-tier cards.

### Weekly scoped card rendering

`filterGridPropsByPerformanceScope` now removes inactive filtered models in single-week mode. With Crypto selected, the Performance summary renders only the Crypto card instead of FX and Commodities & Indices zero cards.

## Verification Targets

The regression suite now includes:

- Performance all-time Crypto summary changes between ADR-normalized and raw.
- Performance weekly Crypto scope renders exactly one summary card and hides FX / Commodities & Indices cards.

Manual browser verification should confirm:

- Agreement Weekly Hold, All Time, Crypto: main summary card matches sidebar in ADR-normalized and raw.
- Agreement Weekly Hold, May 11 2026, Crypto: only Crypto card renders.
- Simulation return, MaxDD, chart, rolling windows, asset contribution, distribution, and calendar update consistently with raw/ADR.

## Follow-up Clarification

After the initial sweep, `PerformanceComparisonPanel`, `PerformanceAllSystemsTable`, and `PerformanceFlagshipCard` were rechecked with both source references and Playwright. The only source hits are their own component definitions and documentation references. A Playwright sweep across Performance Summary, Simulation, Basket, Research, Notes, visible strategy variants, and legacy/flagship/matrix query variants found zero matching DOM markers:

- `data-testid="comparison-return"`
- `data-testid="flagship-return"`
- All Systems table heading/copy

Conclusion: these are parked legacy component files, not active Performance ViewMode surfaces as of this audit.
