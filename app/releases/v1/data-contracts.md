# Data Contracts

This snapshots the contracts v2 will consume, version, or extend.

## Trade Ledger

Kernel-core trade data lives in the Universal Trade Ledger.

Key schema/version files:

- [`migrations/025_universal_trade_ledger.sql`](../../migrations/025_universal_trade_ledger.sql)
- [`migrations/026_trade_identity_direction_natural_key.sql`](../../migrations/026_trade_identity_direction_natural_key.sql)
- [`src/lib/trades/tradeTypes.ts`](../../src/lib/trades/tradeTypes.ts)
- [`src/lib/trades/tradeIdentity.ts`](../../src/lib/trades/tradeIdentity.ts)
- [`src/lib/trades/tradeReaders.ts`](../../src/lib/trades/tradeReaders.ts)

Current identity version: `trade-identity-v2-direction-key`.

Direction is part of the V2 natural key. This prevents deterministic UUID collisions when the same strategy/week/symbol can produce both long and short legs under future hedged or overlapping sleeve strategies.

## ViewMode

ViewMode contracts live in [`src/lib/viewMode/viewModeTypes.ts`](../../src/lib/viewMode/viewModeTypes.ts):

- `AnchorValue`: `canonical | execution`
- `NormalizationValue`: `raw | adr_normalized`
- `ViewSurface`: `performance | matrix | data | research`
- Defaults and available axes are surface-specific.

Display resolution lives in [`src/lib/viewMode/resolveDisplayValue.ts`](../../src/lib/viewMode/resolveDisplayValue.ts), and aggregate helpers live in [`src/lib/viewMode/aggregateReturns.ts`](../../src/lib/viewMode/aggregateReturns.ts).

## Weekly Return Display

[`src/lib/weeklyReturnDisplay.ts`](../../src/lib/weeklyReturnDisplay.ts) carries both anchors for a weekly return row:

- `canonical: { rawPct }`
- `execution: { rawPct } | null`
- `adrPct`
- optional `warnings`

Known missing execution rows carry the warning `execution_close_bar_missing`.

## Closed History Basket Bundle

[`src/lib/basket/basketSummaryTypes.ts`](../../src/lib/basket/basketSummaryTypes.ts) defines:

- `ClosedHistoryRow`
- `ClosedHistoryBundle`
- `CurrentWeekSlice`

Rows carry `returnMatrix` with both anchors and ADR denominator:

- `canonical: { rawPct } | null`
- `execution: { rawPct } | null`
- `adrPct: number | null`

Current implementation is API-backed via [`src/lib/basket/basketDataSource.ts`](../../src/lib/basket/basketDataSource.ts) and [`src/app/api/basket/closed-history/route.ts`](../../src/app/api/basket/closed-history/route.ts). v2 will add an IndexedDB-backed canon source and keep the API source as fallback/debug.

## Strategy Artifacts And Preload

Key files:

- [`src/lib/performance/strategyArtifactVersions.ts`](../../src/lib/performance/strategyArtifactVersions.ts)
- [`src/lib/performance/strategyClientPayload.ts`](../../src/lib/performance/strategyClientPayload.ts)
- [`src/lib/performance/strategyClientCache.ts`](../../src/lib/performance/strategyClientCache.ts)
- [`src/lib/performance/strategySessionStore.ts`](../../src/lib/performance/strategySessionStore.ts)
- [`src/lib/preload/preloadContract.ts`](../../src/lib/preload/preloadContract.ts)
- [`src/lib/preload/preloadRegistry.ts`](../../src/lib/preload/preloadRegistry.ts)

Current preload cache version:

`global-preload-v1:canonical-weekly-v3-full-coverage:execution-weekly-v1:strategy-artifact-v28:dashboard-cache-v2`

Current strategy artifact shard version: `strategy-artifact-v28`.

## Release Manifest

v1 introduces the documentation-only manifest shape in [`manifest.json`](./manifest.json). v2 will make this an active runtime contract via `/api/version/current`, a version badge, and an IndexedDB canon cache keyed by version.
