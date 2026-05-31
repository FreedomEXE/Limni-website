# High-Signal File Audit

This is a folder-level map plus critical files. It is not a mechanical file listing.

```text
src/
├── app/                         Next.js routes, API handlers, layouts, loading states.
│   ├── api/                     Route handlers; see api-surface.md.
│   ├── performance/             Performance route shell.
│   ├── dashboard/               Dashboard/Data-like route.
│   ├── accounts/                Account pages.
│   ├── automation/              Bot/research automation pages.
│   └── matrix/                  Matrix route, targeted for v2 quarantine.
├── components/
│   ├── common/                  Shared UI primitives and trade inspection components.
│   │   ├── trade-list/          Canonical standalone trade-list component.
│   │   ├── trades/              Phase 1 trade drilldown modal/rows/fills.
│   │   ├── disclosure/          Shared disclosure chevron/height atoms.
│   │   └── basket/              Preserved Basket v3/quarantined hierarchy files.
│   ├── performance/             Performance section UI.
│   ├── shared/                  Shared layout/sidebar controls.
│   ├── accounts/                Account UI.
│   ├── dashboard/               Dashboard/Data UI.
│   ├── matrix/                  Matrix UI, targeted for v2 active-flow quarantine.
│   └── research/                Research lab UI.
├── lib/
│   ├── trades/                  Universal Trade Ledger types/readers/identity/display IDs.
│   ├── viewMode/                ViewMode store, resolver, and aggregation helpers.
│   ├── basket/                  Basket data-source abstraction and closed-history contracts.
│   ├── performance/             Strategy config, engines, artifacts, preload/session store.
│   ├── preload/                 Global preload contract and registry.
│   ├── canonical*               Canonical price/return derivation.
│   ├── execution*               Execution anchor windows and weekly returns.
│   ├── accounts/                Account view/data contracts.
│   ├── research/                Research engine/helpers.
│   └── poseidon/                Agent memory/state modules.
└── migrations/                  Database migrations, including 024-026 migration sequence.
```

## Critical Files

- [`src/lib/performance/strategyConfig.ts`](../../src/lib/performance/strategyConfig.ts) - active strategy, entry style, and risk overlay registry.
- [`src/lib/performance/strategySelection.ts`](../../src/lib/performance/strategySelection.ts) - visible bootstrap selections and runtime keys.
- [`src/lib/performance/strategySessionStore.ts`](../../src/lib/performance/strategySessionStore.ts) - current preload/session store; v2 extends this.
- [`src/lib/preload/preloadContract.ts`](../../src/lib/preload/preloadContract.ts) - current global preload cache version.
- [`src/lib/basket/basketDataSource.ts`](../../src/lib/basket/basketDataSource.ts) - Basket data-source abstraction; v2 swaps in canon backend.
- [`src/lib/basket/basketSummaryTypes.ts`](../../src/lib/basket/basketSummaryTypes.ts) - closed-history bundle contracts.
- [`src/lib/basket/basketSummaries.ts`](../../src/lib/basket/basketSummaries.ts) - current closed-history bundle builder.
- [`src/lib/trades/tradeIdentity.ts`](../../src/lib/trades/tradeIdentity.ts) - deterministic trade UUID derivation.
- [`src/lib/trades/tradeReaders.ts`](../../src/lib/trades/tradeReaders.ts) - ledger read API; UI/routes should use this rather than raw SQL.
- [`src/lib/viewMode/resolveDisplayValue.ts`](../../src/lib/viewMode/resolveDisplayValue.ts) - display return resolver.
- [`src/components/common/trade-list/TradeList.tsx`](../../src/components/common/trade-list/TradeList.tsx) - canonical trade-list renderer for future list displays.
- [`src/components/performance/PerformanceViewSection.tsx`](../../src/components/performance/PerformanceViewSection.tsx) - main Performance surface and current Basket containment mount.
- [`src/components/performance/PerformanceGrid.tsx`](../../src/components/performance/PerformanceGrid.tsx) - summary card grid and legacy modal path.

## Migration Files Of Interest

- [`migrations/024_pair_period_return_anchor_metadata.sql`](../../migrations/024_pair_period_return_anchor_metadata.sql)
- [`migrations/025_universal_trade_ledger.sql`](../../migrations/025_universal_trade_ledger.sql)
- [`migrations/026_trade_identity_direction_natural_key.sql`](../../migrations/026_trade_identity_direction_natural_key.sql)
