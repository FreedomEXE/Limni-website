# Quarantined Code Inventory

> Single source of truth for code that is intentionally disabled but preserved
> for reference, audit, or possible reuse. Future cleanup passes consult this
> doc before deletion. Adding to this doc is mandatory whenever quarantining.

## Entries

### 1. PerformanceGrid in-panel section tabs

- **File:** `src/components/performance/PerformanceGrid.tsx`
- **Quarantined:** 2026-05-30
- **Reason:** Legacy duplicate of top-level `<PerformanceScopeControl>`. Rendered both controls for Tandem and Tiered, while Agreement was special-cased off. This was UI duplication, not a metric correctness issue.
- **Replacement:** `<PerformanceScopeControl>` at the top of the Performance section.
- **Removal criteria:** Future cleanup pass; verify no strategy variant relies on in-grid tabs.

### 2. PerformanceViewSection showSectionTabs special case

- **File:** `src/components/performance/PerformanceViewSection.tsx`
- **Quarantined:** 2026-05-30
- **Reason:** Agreement special case existed only to suppress the duplicate in-grid tabs. With those tabs quarantined in `PerformanceGrid`, the special case is vestigial.
- **Replacement:** No separate replacement needed. Top-level `<PerformanceScopeControl>` is uniform across strategies.
- **Removal criteria:** Future cleanup pass; ensure no test fixture or caller depends on the `showSectionTabs` prop signature.

### 3. Basket-local This Week / All Time mode toggle

- **File:** `src/components/performance/PerformanceViewSection.tsx`
- **Quarantined:** 2026-05-30
- **Reason:** Duplicate navigation control from the first Basket Phase 2 pass. The top-level week selector is the canonical entry point: All Time starts the hierarchy at Week, while a selected week skips Week.
- **Replacement:** `<BasketHierarchy>` inherits `selectedWeek` from the existing top-level week selector.
- **Removal criteria:** Future cleanup pass; verify no test fixture depends on `src/lib/basket/basketModeStore.ts`.

### 4. Basket paginated all-time browser and load-more path

- **Files:** `src/components/common/basket/BasketAllTimeBrowser.tsx`, `src/components/common/basket/BasketLoadMore.tsx`, `src/app/api/basket/weeks/route.ts`, `src/app/api/basket/week-pairs/route.ts`
- **Quarantined:** 2026-05-30
- **Reason:** Paginated lazy-load contradicted the immutable historical canon direction and duplicated data-source responsibilities.
- **Replacement:** Bundle-backed `src/components/common/basket/BasketHierarchy.tsx` consuming `basketDataSource.loadClosedHistory(...)` and `/api/basket/closed-history`.
- **Removal criteria:** Future cleanup pass after v2.0.0 canon-bundle data source lands and browser verification confirms no fallback path still uses the paginated routes.

### 5. Basket Phase 2 WeekRow / PairRow renderers

- **Files:** `src/components/common/basket/WeekRow.tsx`, `src/components/common/basket/PairRow.tsx`, `src/components/common/basket/WeekDetailExpanded.tsx`
- **Quarantined:** 2026-05-30
- **Reason:** These renderers only support the first Phase 2 hierarchy shape (`Week -> Pair`) and cannot represent portfolio, tier, grid, fill, or trade levels.
- **Replacement:** `src/components/common/basket/BasketHierarchyLevel.tsx`.
- **Removal criteria:** Future cleanup pass; remove with legacy paginated browser once no tests or docs reference the old selectors.

### 6. Basket Hierarchy v3 active UI

- **File:** `src/components/performance/PerformanceViewSection.tsx`
- **Quarantined:** 2026-05-30
- **Reason:** UX and performance failures found in Freedom browser review: visible loading state on Basket open, a third expandable-row pattern in the app, and over-engineered sort controls. The underlying data layer (`/api/basket/closed-history`, `basketDataSource`, and drilldown modal extensions) is preserved.
- **Replacement:** Rebuild Basket on the v2.0.0 canon foundation after the shared trade-list/disclosure primitive audit and Performance tab-switching perf audit complete.
- **Removal criteria:** Full Basket rebuild on canon completes and Freedom verifies the rebuilt UI and speed in browser.

## Related Inventories

- `docs/research/LEGACY_SCRIPT_AUDIT_2026-05-28.md` tracks quarantined legacy research scripts.
