# ADR Grid Drawdown Unification Spec

Documented: 2026-06-03

## Status

This is the v2.0.3 scope expansion spec for ADR Grid P/L and drawdown parity. It follows the P/L unit fix where one ADR-normalized grid TP equals `tpMultiple`, so a `0.20 ADR` TP is `+0.20%` ADR-normalized and `adrPct * 0.20` raw percent.

The TradingView Pine verifier is currently the zoom-in source of truth for the corrected math and visual rule interpretation. Its practical limit is that it verifies one chart symbol and one target week at a time. The app must still become the trusted source for larger scopes, including all pairs, full weekly baskets, and the full 19-week performance history.

Current verification target:

- EURUSD selected week `2026-05-31T23:00:00.000Z`
- ADR Grid + Pair Fill Cap
- Expected EURUSD result after the P/L unit fix:
  - 4 grid TP fills
  - raw P/L about `+0.3517%`
  - ADR-normalized P/L `+0.80%`
  - no grid reset for this pair/week

## Problem

The app currently exposes drawdown through several partially overlapping paths:

- sidebar `Max DD`
- Simulation card `Max DD`
- Returns calendar daily DD
- rolling-window DD
- basket grid detail `Path DD (fills)`
- live/current-week basket fill `MAE`
- research/comparison/static tables
- engine diagnostics and API responses

Those values are not all the same measurement. Some are synchronized portfolio path drawdown, some are weekly close-to-close drawdown, some are simple fill-return sequence drawdown, and some are per-trade MAE. That makes ADR Grid hard to verify because a basket can have many fills active at once, and per-fill worst adverse movement cannot be safely summed into basket drawdown unless those adverse points happen at the same timestamp.

## Verification Model

Use two verification layers:

1. Pine verifier zoom-in checks:
   - one pair,
   - one week,
   - exact entry/TP/reset behavior,
   - raw P/L,
   - ADR-normalized P/L,
   - per-fill/current/max DD behavior.
2. App-scale checks:
   - all selected pairs,
   - selected basket week,
   - all 19 closed weeks,
   - path drawdown consistency across sidebar, simulation, basket, and logs,
   - artifact/preloader stability after version bumps.

Trust graduation rule:

- The Pine verifier validates the rule implementation for sampled pair/week cases.
- The app is trusted for larger periods only after targeted Pine samples, deterministic app scripts, and UI surfaces all agree on the same P/L and drawdown contract.
- Any mismatch between app and Pine starts as an app investigation unless the mismatch is clearly caused by TradingView feed/session limitations.

## Drawdown Taxonomy

Use these names consistently in code, docs, and UI copy:

| Name | Meaning | Correct source |
|---|---|---|
| `tradeMaeRawPct` | Worst adverse excursion for one closed trade/fill, raw percent from entry. | Engine fill/trade scan over execution bars. |
| `tradeMaeAdrPct` | `tradeMaeRawPct / adrPct`. Display as ADR-normalized percent. | Derived from `tradeMaeRawPct` and pair ADR percent. |
| `gridPathDrawdownPct` | Synchronized path drawdown for one grid parent/pair, including active fills at the same timestamps. | Path engine or a grid-level path derived on the same time grid. |
| `basketPathMaxDrawdownPct` | Synchronized portfolio/basket equity peak-to-trough DD. | `basketPathEngine` summary. |
| `weeklyCloseDrawdownPct` | Peak-to-trough DD from weekly realized return sequence only. | Fallback/reporting only. |
| `legacyStaticDrawdownPct` | Imported/static report drawdown. | Legacy tables only, not ADR Grid source of truth. |

Rules:

- Headline Performance drawdown must be `basketPathMaxDrawdownPct`.
- Basket grid row drawdown should be `gridPathDrawdownPct` when available.
- Fill/trade detail drawdown should be `tradeMaeRawPct` or `tradeMaeAdrPct`, depending on view mode.
- Never compute basket drawdown by summing per-fill MAE rows.
- Never label simple realized fill-return sequence DD as true path DD.

## Audit

### Authoritative Path Engine

- `src/lib/performance/basketPathEngine.ts`
  - Builds hourly synchronized equity paths.
  - Marks open legs with price bars.
  - Carries realized closed P/L forward.
  - Emits `BasketPathSummary.maxDrawdownPct`.
  - This should remain the canonical source for sidebar and simulation path drawdown.

### Sidebar

- `src/components/shared/StrategySidebar.tsx`
  - Displays `allTime.maxDrawdownPct` in all-time mode.
  - Displays `maxDrawdownPct` in selected-week mode.
  - Does not calculate DD itself.
- `src/lib/performance/engineAdapter.ts`
  - `weeklyHoldToSidebarStatsWithPath()` already prefers `currentWeekPathSummary?.maxDrawdownPct` and `multiWeekPathSummary?.maxDrawdownPct`.
- `src/components/performance/PerformanceViewSection.tsx`
  - `applySimulationMetricsToSidebarStats()` can override sidebar DD from selected/all-time simulation metrics.
  - `computeScopedSidebarStats()` uses `computeSidebarAllTimeMetricBasis()` for all-time path points, but selected-week scope currently falls back to base stats unless simulation metrics override it.

### Simulation

- `src/components/performance/PerformanceSimulationSection.tsx`
  - Displays `Max DD` from selected simulation series `drawdown_pct`.
  - Raw view can fall back to weekly additive series when no raw hourly path exists.
- `src/lib/performance/performanceMetricBasis.ts`
  - `computeSidebarAllTimeMetricBasis()` uses `drawdown_pct` from path points when present.
- `src/lib/performance/resolvedPerformanceMetrics.ts`
  - Raw fallback series uses weekly additive returns and `computeMaxDrawdownSimple()`.
  - This is acceptable only as fallback when no raw path exists.

### Basket

- `src/lib/basket/basketSummaryTypes.ts`
  - `ClosedHistoryRow` currently has `returnMatrix` but no drawdown/MAE matrix.
- `src/lib/canon/canonWeekShard.server.ts`
  - Builds canon/delta basket rows from `WeeklyHoldTrade`.
  - Currently drops `trade.detail.maePct`.
- `src/lib/basket/buildBasketTradeListNodes.ts`
  - Aggregates return only.
  - No drawdown aggregation contract exists.
- `src/components/common/basket/BasketHierarchy.tsx`
  - `InlineGridDetail` computes `Path DD (fills)` using simple realized fill-return sequence DD.
  - `InlineTradeDetail` shows return, prices, cap info, but not MAE/DD.
- `src/components/performance/PerformanceViewSection.tsx`
  - Live/current-week fallback `TradeDetailRow` can show `MAE`, but it reads the same generic `maePct` without raw/ADR display contract.

### Kernel and Artifact Flow

- `src/lib/performance/weeklyHoldEngine.ts`
  - ADR Grid now captures `detail.maePct` from per-fill adverse movement.
  - The field is raw percent today.
- `src/lib/performance/positionLedger.ts`
  - Converts trades into path legs for `basketPathEngine`.
  - Return basis and weights feed path P/L.
- `src/lib/performance/strategyPageData.ts`
  - Computes week path artifacts and simulation maps.
  - Reconstructs path summaries from cached simulations.
- `src/lib/performance/strategyArtifactVersions.ts`
  - Controls shard and assembly invalidation.
- `src/lib/preload/preloadContract.ts`
  - Controls browser global preload stamp reuse.
- `src/components/AppPreloadGate.tsx`
  - Should not need a mechanics change; it should consume versioned readiness.

### Legacy and Research Surfaces

The following surfaces show DD but are not ADR Grid source-of-truth surfaces:

- `src/components/performance/PerformanceGrid.tsx`
- `src/components/performance/PerformanceComparisonPanel.tsx`
- `src/components/performance/PerformanceFlagshipCard.tsx`
- `src/components/performance/PerformanceAllSystemsTable.tsx`
- `src/components/performance/StrategyPerformanceSummary.tsx`
- `src/components/research/StrategiesExplorerClient.tsx`
- `src/lib/performance/allTime.ts`
- `src/lib/performance/kataraktiHistory.ts`
- `src/lib/performance/kataraktiMetrics.ts`
- `src/lib/performance/strategyBacktestHistory.ts`
- `src/lib/performance/strategyBacktestStore.ts`

These can keep their legacy/static definitions, but labels must not imply they are the ADR Grid path DD unless they receive the same path contract.

## Data Contract

Add a risk/drawdown matrix alongside `returnMatrix` instead of overloading return fields.

Phase 1 implemented row contract:

```ts
export type BasketRiskMatrix = {
  canonical: {
    maeRawPct: number | null;
    pathDrawdownRawPct: number | null;
  } | null;
  execution: {
    maeRawPct: number | null;
    pathDrawdownRawPct: number | null;
  } | null;
  adrPct: number | null;
};
```

Extend `ClosedHistoryRow`:

```ts
riskMatrix?: BasketRiskMatrix;
```

The field is optional so old frozen canon artifacts remain loadable. New engine-derived closed-week delta rows populate it.

For ADR Grid:

- Fill rows:
  - `riskMatrix.execution.maeRawPct` = per-fill raw MAE from the engine.
  - `riskMatrix.execution.pathDrawdownRawPct` can be null until a fill-level path field is explicitly added.
- Grid rows:
  - `riskMatrix.execution.pathDrawdownRawPct` = null in phase 1.
  - `riskMatrix.execution.pathDrawdownRawPct` = synchronized grid parent/pair path DD when implemented in phase 2.
  - `riskMatrix.execution.maeRawPct` = max child MAE only and must be labeled as max fill MAE, not basket DD.
- Trade rows:
  - `riskMatrix.execution.maeRawPct` = per-trade raw MAE.

Display helpers:

- Add `resolveDisplayDrawdown(riskMatrix, viewMode, field)` beside `resolveDisplayReturn()`.
- Raw mode returns raw percent.
- ADR-normalized mode returns `rawPct / adrPct`.
- Missing ADR denominator returns null, not zero.

Backward compatibility:

- Existing artifacts without `riskMatrix` should render `--` for MAE/DD details.
- Do not crash canon/preload when old rows are loaded.

Phase 1 implementation status:

- `src/lib/basket/basketSummaryTypes.ts` defines optional `BasketRiskMatrix`.
- `src/lib/viewMode/resolveDisplayValue.ts` exports `resolveDisplayDrawdown()`.
- `src/lib/canon/canonWeekShard.server.ts` writes engine-derived fill MAE and grid max-fill MAE into closed-week delta rows.
- `src/lib/basket/buildBasketTradeListNodes.ts` rolls `maxMaePct` and `maxPathDrawdownPct` through week, portfolio/sleeve, tier, symbol, grid, fill, and trade nodes.
- `src/components/common/basket/BasketHierarchy.tsx` displays `Grid DD`, `Max fill MAE`, and fill/trade `MAE`.
- Basket row headers display risk beside P/L:
  - leaf rows: `P/L`, `MAE`;
  - grid rows: `P/L`, `Grid DD` when true path DD exists, `Max MAE`;
  - zoomed-out rows: `P/L`, `Max DD` only from true path-DD fields, `Max MAE` from descendants.
- The same node contract covers Weekly Hold and future non-grid strategy families through `trade` rows.
- ADR Grid Pair Fill Cap and ADR Grid no-cap variants share the same `grid`/`fill` node path; cap metrics are row metadata and detail-panel fields, not separate hierarchy code.
- `src/lib/performance/strategyArtifactVersions.ts` and `src/lib/preload/preloadContract.ts` invalidate ADR Grid artifacts and global preload stamps for the new contract.

Phase 1.1 simulation/calendar status:

- `src/components/performance/PerformanceSimulationSection.tsx` now classifies the active simulation series as either an intraday path or a weekly-close fallback.
- Simulation summary DD is labeled `Path DD` for true path data and `Close DD` for raw weekly-close fallback.
- `src/components/performance/RollingPerformanceWindows.tsx` computes window DD from the active path only when a true path is passed; otherwise it labels the fallback as `Close DD`.
- `src/components/performance/ReturnsCalendar.tsx` uses path-derived daily rows for monthly, weekly, and daily calendar cells when an intraday path exists.
- Calendar monthly/weekly fallback uses additive weekly P/L and the max of available week DD and weekly close-to-close DD; the label distinguishes `Week DD` from `Close DD`.
- Calendar daily cells explicitly label their risk as `Path DD` and are not shown for weekly-close fallback paths.
- `src/components/performance/returnsCalendarMetrics.ts` contains the tested pure aggregation contract so future strategies and sleeves can feed the same period P/L/DD rules.

Phase 1.2 balance/equity path status:

- `src/lib/performance/basketPathEngine.ts` now emits three synchronized path values:
  - `balancePct`: realized closed P/L carried forward after each fill/trade exit.
  - `equityPct`: balance plus close-marked open-position P/L.
  - `adverseEquityPct`: balance plus high/low adverse marks for active positions on the same hourly bar.
- `drawdownPct` is computed from `adverseEquityPct` against the close-equity running peak, so ADR Grid DD stacks all active fills at the same timestamp instead of taking only the worst individual fill.
- Same-bar ADR Grid fills now realize balance at the exit timestamp while still retaining the bar's adverse mark for path DD.
- `src/lib/performance/engineAdapter.ts`, `src/components/performance/PerformanceSimulationSection.tsx`, and `src/components/performance/RollingPerformanceWindows.tsx` carry the balance/adverse fields through multi-sleeve simulation aggregation.
- `src/components/research/EquityCurveChart.tsx` renders mark-to-market equity and realized balance as separate lines when the series contains both values.
- Legacy or cached paths that only have `equity_pct` are reconstructed with `balancePct = equityPct` and `adverseEquityPct = equityPct`.
- `scripts/pinescript/limni-adr-verifier.pine` now stacks active ADR Grid fill adverse DD on the same bar instead of displaying only the worst individual active fill.
- `src/lib/__tests__/basketPathEngine.test.ts` covers:
  - 36 concurrent Weekly Hold legs,
  - concurrent and staggered overlapping ADR Grid fills,
  - same-bar grid entry/TP with an adverse wick,
  - no-cap versus pair-cap exposure,
  - realized P/L carry after TP.

## Calculation Contract

1. Engine captures per-fill/per-trade MAE in raw percent.
2. ADR normalization derives display DD from raw MAE and pair ADR percent.
3. Position ledger builds synchronized legs.
4. Basket path engine computes synchronized realized balance, close-marked equity, adverse equity, and path DD on the same return basis as the selected view mode.
5. Sidebar and simulation consume path summaries.
6. Simulation charts show realized balance separately from mark-to-market equity when both exist.
7. Basket grid detail consumes grid-level path DD when available.
8. Basket fill/trade detail consumes per-fill/per-trade MAE.

## Versioning

The drawdown contract changes persisted data. When implemented:

- Bump ADR Grid entry engine version from `adr-grid-canonical-weekly-anchor-v3-pnl-unit-fix` to a v4 drawdown contract key.
- Bump `STRATEGY_ASSEMBLY_VERSION` because existing shards may be re-read into a changed aggregate/basket shape.
- Bump `GLOBAL_PRELOAD_CACHE_VERSION` so browser preload stamps do not trust old cached payloads.
- Keep preloader mechanics unchanged unless a real readiness bug appears.

Implemented candidate version labels:

- Shard version: `strategy-artifact-v29`
- Path simulation version: `path-simulation-v8-balance-adverse-equity`
- ADR Grid entry version: `adr-grid-canonical-weekly-anchor-v5-adverse-path`
- Assembly version: `assembly-v6-adverse-path`
- Global preload suffix: `adr-grid-adverse-path-v5`

Release-number decision:

- Keep the active working docs under `v2.0.3` while implementation and verification are local.
- Promote the final ship version to `v3.0.0` if this spec is implemented as the release contract, because corrected ADR Grid P/L units plus persisted risk/drawdown rows materially change the product data model and user-facing performance numbers.
- A patch release remains reasonable only if the final shipped scope is reduced back to documentation/verifier/preloader changes without the persisted risk contract.

## UI Contract

Performance sidebar:

- `Max DD` = synchronized path DD.
- All-time = multi-week synchronized path DD.
- Selected week = selected week synchronized path DD.

Simulation:

- `Max DD` = selected chart series drawdown.
- ADR Grid charts should distinguish:
  - `Equity`: mark-to-market path including open fills.
  - `Balance`: realized closed-fill P/L only.
- Raw mode should use raw hourly path if available; weekly additive fallback should be visually documented only in code/docs, not promoted as equal precision.

Basket:

- Header shows return and risk together so zoomed-out and zoomed-in rows use the same metric contract.
- `P/L` stays additive by selected view mode.
- `Max DD` rolls up only synchronized path-DD fields.
- `Max MAE` rolls up descendant fill/trade MAE and grid parent max-fill MAE.
- Weekly Hold rows display as `trade` leaves with the same `P/L`, `MAE`, and optional `Max DD` fields.
- No-cap ADR Grid rows display through the same `grid` and `fill` components as Pair Fill Cap; when no cap is active, cap fields remain neutral metadata.
- Grid detail should show:
  - `Grid DD`
  - `Max fill MAE`
  - `Cap`
  - `Violations`
- Fill/trade detail should show:
  - `Return`
  - `MAE`
  - `ADR Used` in ADR-normalized mode
  - raw context when ADR-normalized mode is active.

Copy rule:

- Use `MAE` for per-fill/per-trade adverse excursion.
- Use `Path DD` only for synchronized equity path drawdown.
- Use `Grid DD` only for a grid/pair path, not a child-fill sequence.

## Implementation Steps

1. Add `BasketRiskMatrix` and `resolveDisplayDrawdown()`.
2. Carry `WeeklyHoldTrade.detail.maePct` into `ClosedHistoryRow.riskMatrix`.
3. Update `buildBasketTradeListNodes()` to aggregate risk values explicitly.
4. Replace `InlineGridDetail` simple fill-return DD label with either:
   - true grid path DD, or
   - `Fill Return Sequence DD` until grid path DD exists.
5. Add fill/trade `MAE` display in `InlineTradeDetail`.
6. Add tests for raw and ADR-normalized drawdown display conversion.
7. Add EURUSD ADR Grid Pair Fill Cap regression:
   - selected week 4 fills
   - raw P/L about `+0.3517%`
   - ADR-normalized P/L `+0.80%`
   - no grid reset
   - per-fill MAE is present.
8. Rebuild strategy artifacts after version bump.
9. Re-run focused tests and browser screenshots.
10. Replace v2.0.3 screenshots and update release docs.
11. Add balance/equity/adverse path fields to generated artifacts after the next rebuild.

## Screenshot Plan

Existing v2.0.3 screenshots in `releases/v2/screenshots/performance/` are now historical candidate evidence from before the ADR Grid P/L unit fix and drawdown unification.

Keep them, but document them as earlier work:

- `v2.0.3-local-tandem-adr-grid-pair-fill-cap-summary.png`
- `v2.0.3-local-tandem-adr-grid-pair-fill-cap-simulation.png`

Add replacement screenshots after rebuilt artifacts:

1. Summary/sidebar after P/L unit fix and DD unification.
2. Simulation tab with matching raw/ADR-normalized path DD.
3. Basket tab expanded to EURUSD, showing:
   - 4 fills
   - raw/ADR-normalized P/L by view mode
   - per-fill MAE
   - no incorrect grid reset.
4. TradingView verifier screenshot for the same EURUSD week.

Release docs to update after screenshots:

- `releases/v2/verification.md`
- `releases/v2/changes.md`
- `releases/v2/handoff.md`
- `releases/v2/patches/v2.0.3.md`
- `releases/v2/manifest.json`

## Open Questions

- Should grid-level path DD be calculated per symbol/source/tier/direction from the same hourly path bars, or derived from a filtered position ledger first and reused by both basket and simulation?
- Should fill MAE use high/low within hourly bars or close-only path bars? Current engine MAE uses adverse high/low and is more conservative than close-only path DD.
- Should all non-ADR Grid strategy families receive the same `riskMatrix` now, or should v2.0.3 scope only guarantee ADR Grid and Weekly Hold?

Recommended answers:

- Use filtered position ledgers for grid-level path DD so the same engine produces basket, slot, asset, and grid paths.
- Keep fill MAE high/low based and label it `MAE`, not `Path DD`.
- Add the contract generically, but only require ADR Grid and Weekly Hold population for v2.0.3.
