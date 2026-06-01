# v2 Changes

## v2.0.1 - 2026-05-31 - Patch

Week rollover cache readiness fix and version discipline formalization. See `patches/v2.0.1.md` for details.

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
