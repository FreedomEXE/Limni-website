# v2 Changes

## v2.0.2 - 2026-06-01 - Patch

Kernel Phase 1/3 read-only canon inventory, week-shard API contracts, closed-week delta shards, client shard-store groundwork, active-variant runtime sync, closed-history bundle composition, active strategy kernel payload, active Performance kernel gate, active-only strategy session boot on kernel routes, Status page kernel diagnostics, Matrix provisional/degraded status, version badge kernel diagnostics, and release-polish UI fixes. This patch adds the architecture spec, `/api/canon/v2/inventory`, `/api/canon/v2/week`, `/api/performance/strategy-kernel-payload`, IndexedDB v2 shard stores, deterministic shard/gap/composition/delta tests, versioned aggregate-slot metadata, non-blocking active strategy shard sync, Basket snapshot fallback through kernel-composed closed history, active Performance route release on kernel readiness, active-selection kernel diagnostics with `/status` query-param inspection, current-week grid drilldown detail, consistent Basket count/W/L row context across all periods, normalized per-grid fill display ordering for sparse delta sequences, aligned week-strip overflow arrows, a bounded opaque scrollable version popover with no-store manifest reads, and skips the old all-strategy background preload/repair/stamp path plus delayed monolithic canon download for kernel routes while preserving immutable `v2` canon files. See `patches/v2.0.2.md` for details.

## v2.0.1 - 2026-05-31 - Patch

Week rollover cache readiness fix, execution-anchor weekly return refresh, current-week Basket UI alignment, version discipline formalization, and preload gate cleanup so v2 canon is the only full-screen historical gate while strategy/current-week refreshes run after the app opens. See `patches/v2.0.1.md` for details.

## v2.0.0 - 2026-05-30 - Major

## Versioning

- Added a root `release-manifest.json`.
- Added `/api/version/current`.
- Added `AppVersionBadge` mounted from the app shell.

## Immutable Canon

- Added `scripts/build-canon-bundle.ts`.
- Materialized all 12 visible strategy variants as static JSON artifacts under `releases/v2/canon/`.
- Added `/api/canon/v2/historical?strategyVariant=...` to serve static artifacts only.
- Added IndexedDB cache layout:
  - DB: `limni-canon`
  - Store: `bundles`
  - Bundle key: `v2::<strategyVariant>::all`
  - Store: `meta`
  - Meta key: `v2`

## Basket

- Swapped Basket to the canon-backed `basketDataSource`.
- Rebuilt active Basket rendering through `TradeList`.
- Removed active Basket loading state for historical data.

## Quarantines

- Matrix is hidden from top-level nav and `/matrix` renders a quarantine notice.
- Performance summary cards are static displays; card modal click handlers are quarantined.

## Verification Anchors

- AUDCAD 2026-05-11 matrix remains the reference:
  - Canonical raw: `-0.5836%`
  - Canonical ADR-normalized: `-0.7756%`
  - Execution raw: `-0.7082%`
  - Execution ADR-normalized: `-0.9411%`
- Pair Fill Cap gate remains `cap_violated = TRUE`: `0`.
