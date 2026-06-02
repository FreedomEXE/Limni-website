# v2.0.2 Handoff: Kernel Stabilization to Data Verification

## Status

v2.0.2 is the loading/cache/version kernel stabilization release. It keeps the v2 release canon immutable, adds a closed-week delta path, isolates the live week, and moves Performance away from the brittle broad preload/repair flow for active strategy data.

Do not tag or rewrite history unless Freedom explicitly asks.

## What v2.0.2 Covers

- Kernel architecture spec: `docs/architecture/KERNEL_DATA_ARCHITECTURE_SPEC.md`.
- Release canon + closed-week delta + live-week data model.
- Canon inventory and per-week shard APIs.
- Client IndexedDB v2 week shard stores and active-variant kernel hydration.
- Active Performance strategy payload now uses explicit kernel payload readiness.
- Status page shows the kernel data layer.
- Version badge shows exact v2.0.2 state and compact kernel diagnostics.
- Basket UI now shares drilldown counts across current week, closed weeks, and all time.
- Current-week Basket grids now retain grid/fill structure instead of flattening into asset rows.
- Fill display order is normalized by entry order with per-grid display numbering.

## Verification Completed Before Push

- `npx tsc --noEmit` passed.
- `npm test` passed: 53 files, 188 tests.
- `npm run build` passed with existing warnings only.
- `releases/v2/canon/` remained untouched.
- Playwright checked current-week Basket on local dev server:
  - Tiered / ADR Grid / Pair Fill Cap / Basket / current week.
  - Single-fill grid expanded as `Fill 1`.
  - Multi-fill grid expanded sequential fills with detail rows.
- Spot checks confirmed closed-week fill display order is by entry order while preserving source sequence context.

## Known Residuals

- Public v2.0.1 crash was reported by Freedom on the authenticated app. A public unauthenticated check redirected to `/login` without reproducing the crash. Re-check production after v2.0.2 deploy.
- Matrix remains provisional/degraded for v2.0.2 and is not part of the critical Performance path.
- `BasketHierarchyContainmentNotice` remains as preserved/quarantined unused code in `PerformanceViewSection.tsx`; do not delete without approval.

## Immediate Production Inspection Checklist

1. Confirm production shows exact `v2.0.2` in the version popover.
2. Confirm status page kernel cards show ready/degraded state clearly.
3. Confirm Performance loads without the old vague preload hang.
4. Confirm Basket views for Tiered and Tandem / ADR Grid / Pair Fill Cap:
   - Current week.
   - May 25 closed week.
   - All Time.
5. Confirm current week shows real grids and fills, not flattened asset-only rows.
6. Confirm the version popover is scrollable/bounded and does not show week arrows behind it.

## Next Stage

The next major stage is data verification against the TradingView indicator before automation work.

Roadmap:

1. Found a configuration that works on paper.
2. Verify the data is correct.
3. Select one system to automate.
4. Create a bot to trade that system.

## Data Verification Focus

- Upgrade the TradingView indicator to match the app execution rules.
- Compare app vs indicator trade-by-trade, system-by-system.
- Verify pair, direction, entry, exit, fill order, return, grid grouping, weekly totals, and all-time totals.
- Resolve discrepancies before selecting the first automation candidate.
