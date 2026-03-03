# EA Modular Refactor — Progress Tracker

> **Master plan:** `docs/plan.md` (read this first for full architecture)
> **Audit comparison:** `docs/institutional-audit-comparison.md`
> **Last updated:** 2026-03-02

## What This Is
Breaking the 8,713-line monolithic `mt5/Experts/LimniBasketEA.mq5` into ~24 modular `.mqh` files with institutional-grade safety infrastructure. Target: scalable to 100+ accounts across multiple VPS instances, with autonomous AI monitoring (Poseidon).

## Architecture Summary
- **Thin EA + Website Control Plane**: EA pulls signals/policy, executes locally, pushes telemetry
- **1-VPS-per-account deployment model** for complete client isolation
- **Strategy Lifecycle Abstraction**: WeeklyBasket (Universal/Tiered), Intraday (Katarakti), CryptoPerps (Bitget)
- **Poseidon AI Operations**: Self-discovering monitoring system (queries APIs/DB, never hardcoded memory)
- **Contract-driven integration**: Single JSON source generates both TypeScript Zod schemas and MQL5 constants

## Completed Work (P0 Safety Rails + Phase 1-2)

| Item | Status | Key Files |
|------|--------|-----------|
| API Security Contract Design | DONE | `docs/plan.md` Section 12 (Token + HMAC-SHA256 canonical signing) |
| Contracts Layer | DONE | `contracts/mt5_event_contract.json`, `src/lib/mt5/contracts.ts`, `mt5/Experts/Include/Generated/Contract.mqh`, `scripts/generate-contracts.ts`, `.github/workflows/contract-artifacts-sync.yml` |
| Poseidon Runtime Reliability | DONE | `src/lib/poseidon/triton.ts`, `nereus.ts`, `poseidon-god.ts`, `memory.ts` hardened |
| Poseidon Truth-Source Authority | DONE | Memory docs marked non-authoritative, self-discovery principle enforced |
| MT5 Kill-Switch API | DONE | `src/app/api/mt5/kill-switch/route.ts`, `migrations/014_mt5_kill_switch_and_risk_events.sql` |
| Heartbeat Architecture | DONE | `src/app/api/mt5/heartbeat/route.ts`, `src/lib/mt5/heartbeatMonitor.ts` |
| Phase 1: Event DB Tables | DONE | `migrations/015_mt5_event_tables.sql` (mt5_decision_events, mt5_position_lifecycle_events, mt5_attribution_factors) |
| Phase 2: Foundation Modules | DONE | `mt5/Experts/Include/Domain/Enums.mqh`, `Models.mqh`, `Include/Core/Context.mqh` |
| Phase 2: RolloverEngine Extraction | DONE | `mt5/Experts/Include/Strategy/RolloverEngine.mqh` (13 functions extracted) |

## Current Monolith State
- **Before refactor:** 8,713 lines
- **After Phase 2:** 8,152 lines (561 lines extracted to 4 modules)
- **Include order in monolith:** Enums → Models → Context → RolloverEngine → Contract → HistoricalReconstruction
- **Not yet compiled in MetaEditor** — textual extraction, needs compile verification on VPS

## Next Steps (in order)

1. **Phase 3: Extract Risk and Sizing** — `RiskBudgetEngine.mqh`, `SizingEngine.mqh`, `RiskGuards.mqh` (~1,500 lines, lines 1862-3434 + 4758-4965)
2. **Phase 3.5: Portfolio Strategy Blocks** — `StrategyRegistry.mqh`, `PortfolioPlanEngine.mqh`, `UniversalBuilder.mqh`, `TieredBuilder.mqh`, `OverlapResolver.mqh`, `TierClassifier.mqh`
3. **Phase 4: Extract Execution and State** — `BrokerAdapter.mqh`, `SymbolResolver.mqh`, `StateStore.mqh`
4. **Phase 5: Telemetry and Dashboard** — `TelemetryAgent.mqh`, `Dashboard.mqh`, `AuditLog.mqh`, `HealthMonitor.mqh`
5. **Purchase VPS #1** — Contabo VPS L, UK location, ~$17/mo (decided: 3 VPS total for Universal/Tiered/Katarakti)
6. **Deploy & verify telemetry loop** — signals pull → trade execution → telemetry push → kill-switch polling → heartbeat
7. **Run migrations 014 + 015** on production DB
8. **Deploy updated website** to Vercel (kill-switch + heartbeat endpoints)

## Structural Map Reference
A complete function-by-function map of the monolith was generated during the Phase 2 session. To regenerate it, read `mt5/Experts/LimniBasketEA.mq5` and map all functions to the target module structure in `docs/plan.md` Section 4.

## Key Design Decisions Made
- **Auth:** Token + HMAC-SHA256 with canonical request signing (method+path+query+timestamp+nonce+body_hash)
- **Replay protection:** Timestamp-only for GET, timestamp+nonce for write endpoints
- **Secret storage:** AES-256-GCM envelope encryption (NOT bcrypt — HMAC needs recoverable secret)
- **VPS provider:** Contabo VPS L (~$17/mo each, 3 total = ~$51/mo)
- **MetaQuotes built-in VPS rejected:** No RDP, no file access, custom header issues, walled garden
- **Poseidon stays on Render** (centralized), not on VPS instances
- **Latency irrelevant** for weekly basket strategies (30-80ms fine)
