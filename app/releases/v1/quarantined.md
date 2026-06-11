# Quarantined Code Reference

Canonical source: [`docs/QUARANTINED_CODE_INVENTORY.md`](../../docs/QUARANTINED_CODE_INVENTORY.md).

This file snapshots the v1 baseline quarantines for release reference.

## Performance Legacy Scope Tabs

- `src/components/performance/PerformanceGrid.tsx`
- `src/components/performance/PerformanceViewSection.tsx`

Legacy in-panel section tabs duplicated the canonical top-level `PerformanceScopeControl`. Rendering is disabled; code is preserved for future cleanup review.

## Basket Local Mode Toggle

- `src/components/performance/PerformanceViewSection.tsx`

The first Basket Phase 2 pass added a local `This Week / All Time` toggle. This duplicated the top-level week selector. It is quarantined; Basket should inherit the top-level week selection.

## Basket Paginated Browser

- `src/components/common/basket/BasketAllTimeBrowser.tsx`
- `src/components/common/basket/BasketLoadMore.tsx`
- `src/app/api/basket/weeks/route.ts`
- `src/app/api/basket/week-pairs/route.ts`

The paginated lazy-load model contradicted immutable historical canon. Preserved until v2 canon-backed Basket replaces the flow.

## Basket Phase 2 Week/Pair Renderers

- `src/components/common/basket/WeekRow.tsx`
- `src/components/common/basket/PairRow.tsx`
- `src/components/common/basket/WeekDetailExpanded.tsx`

These support only `Week -> Pair` and cannot represent portfolio/tier/grid/fill/trade levels. Preserved until future cleanup.

## Basket Hierarchy v3 Active UI

- Mount point: `src/components/performance/PerformanceViewSection.tsx`
- Preserved implementation: `src/components/common/basket/BasketHierarchy.tsx`

The v3 active UI failed browser review due to loading state, rough expandable rows, and over-complex sort controls. It is hidden behind the containment notice. The data layer is preserved for v2 canon work.

## Legacy Research Scripts

See [`docs/research/LEGACY_SCRIPT_AUDIT_2026-05-28.md`](../../docs/research/LEGACY_SCRIPT_AUDIT_2026-05-28.md) for the quarantined research-script inventory. Scripts are preserved, not deleted.
