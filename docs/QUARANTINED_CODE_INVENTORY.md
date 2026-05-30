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

## Related Inventories

- `docs/research/LEGACY_SCRIPT_AUDIT_2026-05-28.md` tracks quarantined legacy research scripts.
