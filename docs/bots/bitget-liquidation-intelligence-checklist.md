# Bitget Liquidation Intelligence - Implementation Checklist

> Companion to: `docs/bots/bitget-liquidation-intelligence-implementation.md`  
> Purpose: Exact file-level tasks to ship data capture, research features, and backtest validation.

---

## Phase 0 - Schema + Persistence

- [x] Add migration for forward-looking heatmap snapshots  
  File: `migrations/009_liquidation_heatmap_snapshots.sql`
- [ ] Apply migration in DB environment(s)  
  Command: run SQL migration pipeline used for 007/008.
- [ ] Validate table/indexes exist after migration  
  Query: `SELECT * FROM market_liquidation_heatmap_snapshots LIMIT 1;`

---

## Phase 1 - Data Collection

- [x] Add insert helper for full heatmap snapshot rows  
  File: `src/lib/marketSnapshots.ts`  
  Function target: `insertLiquidationHeatmapSnapshot(...)`
- [x] Add symbol/interval/exchange collection loop  
  File: `src/lib/marketSnapshots.ts`  
  Target constants:
  - `HEATMAP_SNAPSHOT_SYMBOLS` (start: BTC, ETH)
  - `HEATMAP_INTERVALS` (6h, 1d, 7d, 30d)
  - `HEATMAP_EXCHANGE_GROUPS` (binance_bybit default)
- [x] Add dedupe/hash guard before insert  
  File: `src/lib/marketSnapshots.ts`  
  Behavior: skip if node hash unchanged vs previous row.
- [x] Reuse/extend existing heatmap fetcher  
  File: `src/lib/coinank.ts`  
  Function: `fetchLiquidationHeatmap(...)` (already present)

---

## Phase 2 - Cron Wiring

- [x] Extend market snapshot cron response to include heatmap insert counts  
  File: `src/app/api/cron/market-snapshots/route.ts`  
  Add: `heatmap` count + errors in response JSON.
- [x] Add config toggles for heatmap collection cadence/enablement  
  File: `.env.example`  
  Variables:
  - `LIQ_HEATMAP_COLLECTION_ENABLED=true|false`
  - `LIQ_HEATMAP_INTERVALS=6h,1d,7d,30d`
  - `LIQ_HEATMAP_EXCHANGE_GROUPS=binance_bybit`

---

## Phase 3 - Research Feature Extraction

- [x] Add read helpers for nearest heatmap snapshot by timestamp  
  File: `src/lib/marketSnapshots.ts`  
  Function target: `readNearestLiquidationHeatmapSnapshot(...)`
- [x] Add feature builder (fuel/risk ratios, band pressure)  
  File: `src/lib/bitgetLiquidationFeatures.ts` (new)  
  Outputs:
  - directional fuel
  - opposing risk
  - fuel/risk ratio
  - near-field (0-2%) pressure
  - cluster milestone candidates

---

## Phase 4 - Backtest Harness

- [x] Create initial backtest stub scaffold  
  File: `scripts/bitget-v2-liquidation-backtest-stub.ts`
- [ ] Add baseline strategy adapter (fixed milestones)  
  File: `scripts/bitget-v2-liquidation-backtest-stub.ts`  
  Read from historical trade records.
- [ ] Add liquidation-aware variant adapter  
  File: `scripts/bitget-v2-liquidation-backtest-stub.ts`  
  Rule candidates:
  - dynamic milestone spacing via cluster path
  - skip/wait on opposing near-field dominance
- [ ] Emit comparison report JSON  
  Output: `reports/bitget-liquidation-backtest-stub.json`

---

## Phase 5 - Strategy Gating (Paper Only First)

- [x] Add "advisory only" decision logs to bot metadata  
  File: `src/lib/bitgetBotEngine.ts`  
  Add fields:
  - `marketData.liquidation_intelligence.advisory.mode`
  - `marketData.liquidation_intelligence.advisory.skip_suggested`
  - `marketData.liquidation_intelligence.advisory.milestone_hints`
- [ ] Keep live execution unchanged until validation complete  
  File: `src/lib/bitgetBotRisk.ts`  
  Note: fixed milestones remain active by default.

---

## Phase 6 - Docs + Ops

- [x] Core implementation plan doc  
  File: `docs/bots/bitget-liquidation-intelligence-implementation.md`
- [x] Link from strategy decisions document  
  File: `docs/bots/bitget-v2-strategy-decisions.md`
- [x] File-level execution checklist  
  File: `docs/bots/bitget-liquidation-intelligence-checklist.md`
- [ ] Add migration runbook notes for production deploy  
  File: `docs/DATABASE_MIGRATION_TODO.md` or dedicated ops doc.

---

## Definition Of Done (Research Readiness)

- [ ] 8+ weeks of uninterrupted heatmap snapshot history collected.
- [ ] Backtest report comparing fixed vs liquidation-aware variants generated.
- [ ] Paper-mode advisory logs show stable behavior and no data gaps.
- [ ] Decision review approved before enabling any live gating.
