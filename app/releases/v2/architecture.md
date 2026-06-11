# v2 Architecture Snapshot

Documented: 2026-06-03

This file is the v2 institutional architecture snapshot. It complements the v1 baseline files and records what changed through the local `v2.0.3` release candidate without treating the candidate as shipped.

## Release Identity

v2 introduced a runtime release manifest and visible version badge:

- Root runtime manifest: [`release-manifest.json`](../../release-manifest.json)
- Release-line manifest: [`releases/v2/manifest.json`](./manifest.json)
- Runtime manifest loader: [`src/lib/version/releaseManifest.ts`](../../src/lib/version/releaseManifest.ts)
- Version route: [`src/app/api/version/current/route.ts`](../../src/app/api/version/current/route.ts)
- Version badge: [`src/components/AppVersionBadge.tsx`](../../src/components/AppVersionBadge.tsx)

`v2.0.3` is currently a pending local candidate. It keeps `canonVersion: v2`; frozen release canon files under `releases/v2/canon/` are not mutated.

## Historical Canon Kernel

v2.0.2 added the read-only kernel layer over frozen release canon plus closed-week deltas. v2.0.3 hardens that kernel for release usage.

Key behavior:

- Release canon is immutable and versioned under `releases/v2/canon/`.
- Post-release closed weeks are exposed as `closed-week-delta` shards.
- Current/open week remains live-only and is not written into release canon.
- Active Performance route gates only on the selected strategy variant, not all visible variants.
- Background warmup can fetch visible strategy payloads after the app is usable.
- Once the app gate releases in a browser session, page and strategy switches do not re-cover the app with the global preloader.

Key files:

- [`src/lib/canon/canonShardTypes.ts`](../../src/lib/canon/canonShardTypes.ts)
- [`src/lib/canon/canonWeekShard.server.ts`](../../src/lib/canon/canonWeekShard.server.ts)
- [`src/lib/canon/canonKernelStore.ts`](../../src/lib/canon/canonKernelStore.ts)
- [`src/app/api/canon/[version]/inventory/route.ts`](../../src/app/api/canon/%5Bversion%5D/inventory/route.ts)
- [`src/app/api/canon/[version]/week/route.ts`](../../src/app/api/canon/%5Bversion%5D/week/route.ts)
- [`src/app/api/performance/strategy-kernel-payload/route.ts`](../../src/app/api/performance/strategy-kernel-payload/route.ts)

## Preloader Contract

The global app preloader is a release-history gate, not a page-switch gate.

v2.0.3 candidate behavior:

- First load may hydrate missing active release history and current strategy payload.
- If the release baseline already covers the latest closed week, inventory returns without rebuilding strategy deltas.
- If one closed week is missing from the release baseline, inventory can build that delta once and memoize it in-process.
- After release, route changes to Data, Performance, Accounts, and strategy changes must stay interactive.

Key files:

- [`src/components/AppPreloadGate.tsx`](../../src/components/AppPreloadGate.tsx)
- [`src/lib/performance/strategySessionStore.ts`](../../src/lib/performance/strategySessionStore.ts)
- [`src/lib/performance/strategyClientCache.ts`](../../src/lib/performance/strategyClientCache.ts)
- [`src/lib/preload/preloadRegistry.ts`](../../src/lib/preload/preloadRegistry.ts)

## Strategy Execution Layer

v2.0.3 candidate keeps the current app ADR Grid source-of-truth after research rejected a runner/refill interpretation for this pass.

Active execution styles:

- `weekly_hold`: enter at weekly window open, exit at weekly window close.
- `adr_grid`: app close-and-rearm fill model, `0.20 ADR` step, full close at next step, same-level rearm after TP.

Risk overlays:

- `none`: no grid cap.
- `pair_fill_cap`: max active fills per pair.

Important behavior preserved from v2.0.2:

- ADR Grid defaults to Pair Fill Cap in UI normalization.
- ADR Grid still supports `None`; users can compare capped and uncapped grids.
- `normalizeFilterSelection()` maps legacy `exposure_cap` to `pair_fill_cap`.

Key files:

- [`src/lib/performance/strategyConfig.ts`](../../src/lib/performance/strategyConfig.ts)
- [`src/lib/performance/weeklyHoldEngine.ts`](../../src/lib/performance/weeklyHoldEngine.ts)
- [`src/lib/performance/engineAdapter.ts`](../../src/lib/performance/engineAdapter.ts)
- [`src/components/shared/StrategySelector.tsx`](../../src/components/shared/StrategySelector.tsx)

## Weekly Anchor Contract

The v2.0.3 ADR Grid candidate aligns execution with the canonical display week anchor for historical comparison. The A/B harness showed this as the correct app-vs-indicator reconciliation path.

Key files:

- [`src/lib/weekAnchor.ts`](../../src/lib/weekAnchor.ts)
- [`scripts/adr-grid-weekly-anchor-ab.ts`](../../scripts/adr-grid-weekly-anchor-ab.ts)
- [`docs/trading/ADR_GRID_CANONICAL_WEEKLY_ANCHOR.md`](../../docs/trading/ADR_GRID_CANONICAL_WEEKLY_ANCHOR.md)
- [`docs/research/ADR_GRID_WEEKLY_ANCHOR_AB_2026-06-02.md`](../../docs/research/ADR_GRID_WEEKLY_ANCHOR_AB_2026-06-02.md)

## Documents Architecture

The Documents page renders release folders, not arbitrary research folders. v2 institutional docs should live beside the release:

- `releases/v2/architecture.md`
- `releases/v2/active-systems.md`
- `releases/v2/data-contracts.md`
- `releases/v2/api-surface.md`
- `releases/v2/ui-surfaces.md`
- `releases/v2/verification.md`
- `releases/v2/handoff.md`

Screenshots must be registered in `releases/v2/manifest.json` and stored under `releases/v2/screenshots/...` to appear in the app.
