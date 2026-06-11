# v1 Architecture Snapshot

This file summarizes current architecture and links to canonical deeper docs. It intentionally avoids duplicating the research/audit documents.

## Data And Return Model

v1 baseline has a two-layer return model:

- **Canonical anchor:** market-truth weekly windows by asset class.
- **Execution anchor:** unified Monday 00:00 UTC strategy execution window.
- **Normalization axis:** raw percentage return or ADR-normalized return.

Key references:

- [`docs/research/EXECUTION_LAYER_MIGRATION_AUDIT_2026-05-27.md`](../../docs/research/EXECUTION_LAYER_MIGRATION_AUDIT_2026-05-27.md)
- [`docs/research/UI_SURFACE_AUDIT_AND_VIEWMODE_SPEC_2026-05-27.md`](../../docs/research/UI_SURFACE_AUDIT_AND_VIEWMODE_SPEC_2026-05-27.md)
- [`docs/research/UI_WIRING_COMPLETION_SWEEP_2026-05-28.md`](../../docs/research/UI_WIRING_COMPLETION_SWEEP_2026-05-28.md)

## Universal Trade Ledger

The trade ledger is the kernel-core source for trade identity and drilldown. Deterministic UUIDs use a V2 natural key that includes direction, preventing future long/short sleeve collisions. UI consumers must read through `src/lib/trades/tradeReaders.ts`, not raw SQL.

Key files:

- [`migrations/025_universal_trade_ledger.sql`](../../migrations/025_universal_trade_ledger.sql)
- [`migrations/026_trade_identity_direction_natural_key.sql`](../../migrations/026_trade_identity_direction_natural_key.sql)
- [`src/lib/trades/tradeIdentity.ts`](../../src/lib/trades/tradeIdentity.ts)
- [`src/lib/trades/tradeReaders.ts`](../../src/lib/trades/tradeReaders.ts)
- [`src/lib/trades/displayId.ts`](../../src/lib/trades/displayId.ts)

## ViewMode Infrastructure

ViewMode is the UI contract for anchor/normalization display. The active defaults are:

- Performance: execution anchor, ADR-normalized by default, normalization toggle only.
- Matrix: execution + ADR-normalized by default, both axes available.
- Data and Research: execution + raw by default, both axes available.

Key files:

- [`src/lib/viewMode/viewModeTypes.ts`](../../src/lib/viewMode/viewModeTypes.ts)
- [`src/lib/viewMode/viewModeStore.ts`](../../src/lib/viewMode/viewModeStore.ts)
- [`src/lib/viewMode/resolveDisplayValue.ts`](../../src/lib/viewMode/resolveDisplayValue.ts)
- [`src/lib/viewMode/aggregateReturns.ts`](../../src/lib/viewMode/aggregateReturns.ts)
- [`src/components/common/ViewModeControls.tsx`](../../src/components/common/ViewModeControls.tsx)

## Strategy Engine And Signal Pipeline

The active strategy pipeline resolves signal source models, entry style, and risk overlay into strategy artifacts. Historical strategy artifacts are currently preloaded via `strategySessionStore.ts` and the strategy artifact cache; v2 will replace repeated historical fetches with immutable canon under version.

Key files:

- [`src/lib/performance/strategyConfig.ts`](../../src/lib/performance/strategyConfig.ts)
- [`src/lib/performance/strategySelection.ts`](../../src/lib/performance/strategySelection.ts)
- [`src/lib/performance/weeklyHoldEngine.ts`](../../src/lib/performance/weeklyHoldEngine.ts)
- [`src/lib/performance/engineAdapter.ts`](../../src/lib/performance/engineAdapter.ts)
- [`src/lib/performance/strategyArtifactVersions.ts`](../../src/lib/performance/strategyArtifactVersions.ts)
- [`src/lib/performance/strategySessionStore.ts`](../../src/lib/performance/strategySessionStore.ts)

## UI Architecture

The Performance section is the main operational surface. Basket v3 is currently contained and scheduled to be rebuilt on v2 canon with the shared `TradeList`. Matrix code remains present but is targeted for v2 active-flow quarantine.

Key UI files:

- [`src/components/performance/PerformanceViewSection.tsx`](../../src/components/performance/PerformanceViewSection.tsx)
- [`src/components/performance/PerformanceSimulationSection.tsx`](../../src/components/performance/PerformanceSimulationSection.tsx)
- [`src/components/shared/StrategySidebar.tsx`](../../src/components/shared/StrategySidebar.tsx)
- [`src/components/common/trade-list/TradeList.tsx`](../../src/components/common/trade-list/TradeList.tsx)
- [`src/components/common/trades/TradeDrilldownModal.tsx`](../../src/components/common/trades/TradeDrilldownModal.tsx)

## Roadmap Context

- [`docs/CODEX_PERFORMANCE_DATA_CORRECTNESS_PLAN_2026-05-27.md`](../../docs/CODEX_PERFORMANCE_DATA_CORRECTNESS_PLAN_2026-05-27.md)
- [`docs/FUTURE_UPGRADES.md`](../../docs/FUTURE_UPGRADES.md)
