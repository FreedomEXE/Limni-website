# Limni EA Modular Refactor Plan (Institutional-Scale)

## 1) Purpose
Build a production-grade modular EA architecture that:
1. Scales to billions of dollars under management across 100+ client accounts.
2. Maintains complete client separation and regulatory compliance.
3. Uses Limni app + APIs as the single source of truth (SSOT).
4. Enables rapid iteration via modular architecture (100k+ lines maintainable).
5. Provides complete audit trail for research, compliance, and attribution.

This plan is designed for institutional hedge fund operations with CTO review and AI-accelerated implementation.

## 2) Non-Negotiable Principles
1. **Complete client isolation**: 1 VPS per account, no shared state between clients.
2. **Trading-critical execution must never depend on telemetry/UI/network success**.
3. **One canonical contract** for reason codes, state keys, and event types.
4. **No behavior drift during refactor** without explicit approval and parity evidence.
5. **Every order decision must be replayable and auditable**.
6. **All changes are reversible** with clean rollback points.
7. **Regulatory compliance first**: clean separation, audit trails, best-execution evidence.
8. **Open/closed strategy architecture**: core execution/risk engines remain stable; new strategies are added via composable modules/contracts, not rewrites.
9. **Unified risk-capital sizing model**: `1:1` sizing is based on risk capital (personal account risk capital or prop max daily drawdown), not nominal prop account size.
10. **Prop per-order stop losses are compliance controls, not strategy exits**: strategy exits remain basket/weekly logic; SLs exist only to satisfy prop rules.

## 2.5) Deployment Model: 1-VPS-per-Account

### Architecture Principle
**Complete account isolation for institutional scale.**

### Infrastructure
- **1 VPS per client account** (dedicated MT5 instance per account)
- VPS specs: 2 CPU, 4GB RAM, 50GB SSD (overkill for safety margin)
- Provider: AWS/GCP/Azure with auto-scaling and monitoring
- Cost: $5-10/account/month = negligible vs AUM managed

### EA Role: Thin Execution Agent
- **Pulls** from website: signals, policy, risk limits, kill-switch status
- **Executes** locally: rollover, reconciliation, sizing, broker orders
- **Pushes** to website: decision events, position snapshots, health heartbeat, errors
- **Autonomous during website downtime**: cached signals, conservative fallback mode

### Website Role: Control Plane
- **Signal generation**: 1 COT calculation → broadcast to N accounts (filtered per client)
- **Policy distribution**: per-account configs, risk multipliers, symbol filters
- **Event ingestion**: aggregate all EA events into research data lake
- **Risk monitoring**: cross-account exposure limits, concentration checks
- **Orchestration**: kill-switches, version rollouts, coordinated actions

### Benefits
1. **Complete client separation** (regulatory compliance, fiduciary responsibility)
2. **Isolated failures** (1 account crash ≠ all accounts frozen)
3. **Gradual rollouts** (test EA v1.4 on 1 canary account, then expand)
4. **Client-specific policies** (different risk/assets/trail per client tier)
5. **Performance isolation** (no resource contention, dedicated CPU/memory per account)
6. **Audit simplicity** (each account has independent execution log)

### Trade-offs
- Higher infrastructure cost (acceptable: $500-1000/mo for 100 accounts managing $1B+)
- Server-side coordination required (handled by website orchestration service)
- **Worth it**: cost is 0.0001% of AUM, client safety/compliance worth infinitely more

## 2.6) Poseidon Operations Layer

### Architecture Principle
**Poseidon is the autonomous operations brain for the full trading infrastructure, with zero manual memory maintenance.**

### System Scope
1. Poseidon is the existing AI operations system composed of:
   - `Proteus`
   - `Triton`
   - `Nereus`
   - `Poseidon God`
2. Poseidon consumes the EA/bot telemetry streams already defined in this architecture:
   - heartbeats
   - decision events
   - position snapshots
   - kill-switch state/events
3. Human escalation target is `Freedom`; human contact occurs only when Poseidon cannot self-resolve an issue through deterministic or approved autonomous actions.

### 1) Poseidon Core (Rule-Based Monitoring — Phase 1)
1. A lightweight deterministic operations engine runs 24/7 with zero LLM dependency/cost.
2. Core responsibilities:
   - heartbeat watchdog across all EA/bot instances (including auto-restart and kill-switch escalation paths)
   - execution verification (expected signals/plans vs actual trades; mismatch detection)
   - sizing-drift detection, PnL anomaly detection, and latency monitoring
   - version drift detection across EA instances and strategy runtimes
3. Self-healing follows a strict escalation ladder:
   - retry → restart → kill-switch → Telegram alert to `Freedom`
4. This layer is the operational foundation that higher intelligence layers build on.

### 2) Poseidon Intelligence (AI-Enhanced — Phase 2)
1. Layer existing `Poseidon God` reasoning on top of the deterministic core.
2. Intelligence must be self-discovering by querying APIs/database state to determine:
   - currently deployed strategies and where they are running
   - account inventory and active configurations
   - executed trades and decision rationale (reason codes from decision events)
   - current system health status across all running instances
3. Responsibilities:
   - anomaly reasoning (e.g., underperformance diagnostics correlated with market conditions/regime shifts)
   - cross-account pattern detection (systemic failures vs isolated account issues)
   - natural-language daily/weekly reporting via Telegram
   - strategic recommendations based on observed multi-account performance

### 3) Self-Discovery Principle (Hard Requirement)
1. Every infrastructure service must expose state through queryable APIs and/or database tables.
2. Poseidon context is runtime-discovered, never manually curated:
   - new strategy registered in `StrategyRegistry` → discovered on next query cycle
   - new account provisioned → discovered on next query cycle
   - policy/config change applied → discovered on next query cycle
3. Hard architectural rule: **if Poseidon cannot discover it programmatically, it does not exist in the system.**

### 4) Reporting Cadence
1. Real-time: critical alerts only (failures, kill-switch events, execution mismatches).
2. Daily: Telegram operations summary (`PnL`, active strategies, anomalies, automated actions taken).
3. Weekly: comparative performance analysis across strategies and accounts.

### 5) Containerization for Portability
1. All services are containerized with Docker Compose for environment portability (current VPS topology now, bare-metal later).
2. High-level stack:
   - one runtime instance per trading account:
     - MT5 accounts on dedicated Windows VPS instances
     - Bitget/crypto bots as Linux containers
   - Limni website control plane services
   - Poseidon services
   - PostgreSQL
3. Migration to bare metal preserves service topology by reusing the same compose-defined stack on different hosts.
4. MT5 constraint: MT5 account runtimes remain on separate Windows VPS instances and integrate through the shared API contract (not Linux containers).

## 3) Target End State
1. **EA becomes thin execution agent** (orchestrates modules, minimal business logic).
2. **Logic split across focused `.mqh` modules** with strict interfaces.
3. **Website handles heavy lifting**: signal calculation, risk aggregation, research, compliance.
4. **Contract-driven integration**: website + EA use same generated enums/schemas.
5. **Research/event data is append-only** and powers attribution, optimization, client reports.
6. **LLM (future) is advisory only**, never direct execution.
7. **Portfolio construction is modular and composable** (Universal/Tiered/Composite variants are configuration + plug-in blocks, not bespoke EA forks).
8. **One-size-fits-all account risk sizing**: the same `1:1` math applies to personal + prop accounts via a unified risk-capital input.
9. **Broker differences remain in symbol specs only**: lot size, step, tick value, margin, and contract specs are broker-specific execution details, not account-risk logic.

## 4) Proposed EA Module Structure
```text
mt5/Experts/
  LimniBasketEA.mq5                  # Thin orchestrator (OnInit/OnTimer/OnDeinit)
  Include/
    Core/
      Context.mqh                    # Shared state structs, config, constants
      Orchestrator.mqh               # Main event loop coordination + lifecycle dispatch by strategy config
    Domain/
      Models.mqh                     # DTOs for signals, positions, decisions
      Enums.mqh                      # Reason codes, event types, state flags
    Strategy/
      PortfolioPlanEngine.mqh        # Applies normalized portfolio plan -> executable legs
      StrategyRegistry.mqh           # Resolves configured strategy family/version/blocks + lifecycle type
      Lifecycles/
        WeeklyBasketLifecycle/
          WeeklyBasketLifecycle.mqh  # Universal/Tiered weekly basket lifecycle orchestration
        IntradayLifecycle/
          IntradayLifecycle.mqh      # Katarakti/day-trade intraday lifecycle orchestration
        CryptoPerpsLifecycle/
          CryptoPerpsLifecycle.mqh   # Bitget/future crypto perps lifecycle orchestration
      Blocks/
        UniversalBuilder.mqh         # Universal V1/V2/V3 portfolio construction
        TieredBuilder.mqh            # Tiered V1/V2/V3 portfolio construction
        TierClassifier.mqh           # Shared tier rules (winner logic, tier assignment)
        OverlapResolver.mqh          # Stacked vs de-dup/vote-weighted composition
      RolloverEngine.mqh             # Friday/Sunday rollover contracts (BTC/ETH carry, prop vs non-prop)
      ReconcileEngine.mqh            # Keep/close reconciliation against new signals
      EntryEngine.mqh                # Entry windows, loser-add logic, add gates
    Risk/
      RiskBudgetEngine.mqh           # Computes sizing risk capital + compliance bases (personal vs prop)
      SizingEngine.mqh               # Target lot → constraints → final lot (per-client policy)
      RiskGuards.mqh                 # Basket exits/limits + compliance-only prop SL enforcement
    Execution/
      BrokerAdapter.mqh              # Unified buy/sell/close wrappers with retry logic
      SymbolResolver.mqh             # Symbol mapping, canonicalization, family bucketing
    State/
      StateStore.mqh                 # GV/file persistence, schema versioning, migration helpers
    Infra/
      ApiClient.mqh                  # HTTP fetch/parse for signals, policy, kill-switch
      TelemetryAgent.mqh             # Non-blocking event/snapshot push to website
    Diagnostics/
      AuditLog.mqh                   # Structured event logging (why, when, what, result)
      HealthMonitor.mqh              # Self-diagnostics, anomaly detection, alerts
    UI/
      Dashboard.mqh                  # Chart rendering only (isolated from trading logic)
    Generated/
      Contract.mqh                   # Generated from website SSOT contract (enums, validation)
```

### Strategy Lifecycle Abstraction
1. Introduce a lifecycle dispatch layer in `StrategyRegistry` so strategy resolution returns both:
   - strategy variant/manifests (`family`, `version`, configured blocks)
   - `lifecycle_type` (execution lifecycle contract)
2. `Orchestrator` dispatches to the resolved lifecycle module based on strategy config, instead of assuming one universal pipeline for all strategies.
3. Lifecycle modules own entry/exit/position-management behavior, while sharing common infrastructure:
   - `BrokerAdapter`
   - `RiskBudgetEngine`
   - `SizingEngine`
   - `TelemetryAgent`
   - `StateStore`
   - `AuditLog`
   - `Dashboard`
4. Initial lifecycle types:
   - `WeeklyBasketLifecycle`:
     - Scope: `Universal V1/V2/V3`, `Tiered V1/V2/V3`
     - Flow: COT/sentiment signal → `PortfolioPlanEngine` → `EntryEngine` → `BasketManager`
     - Responsibilities: basket TP/trailing, weekly reconcile, Friday-Sunday rollover
   - `IntradayLifecycle`:
     - Scope: `Katarakti Phase 2`, `Katarakti Lite`, future day-trade strategies
     - Flow: `SessionRange` builder → `SweepDetection` → `PerTradeManager`
     - Responsibilities: ATR-based per-trade exits, no basket grouping, no weekly rollover
   - `CryptoPerpsLifecycle`:
     - Scope: `Bitget V2`, `Bitget V3`, future crypto strategies
     - Flow: `SessionRange` → Handshake/SustainedDeviation → `ScalingManager`
     - Responsibilities: milestone-based leverage scaling, trailing stops, week-close

### 4A) Strategy Composition Design (Future-Proof)
1. Separate **execution profile** from **portfolio strategy**:
   - `execution_profile`: broker/account behavior (`EIGHTCAP`, `5ERS`, etc.)
   - `portfolio_strategy`: signal construction (`Universal V1/V2/V3`, `Tiered V1/V2/V3`, composite variants)
2. Execution path should consume a normalized leg plan and remain agnostic to how it was built.
3. New strategy variants should be added by registering blocks/builders, not by editing `OnTimer()` / `TryAddPositions()` logic.
4. Support composition by configuration:
   - single builder (e.g., `Tiered V3`)
   - multi-builder stacked (`Tiered V1 + V2 + V3`)
   - overlap-resolved composite (`dedup_weighted`)
5. Practical constraint: “no code changes” means **stable core engines**; new behavior usually requires adding a new block/module, then wiring via registry/config.

### 4B) Block Registry / Manifest Model (Add-Remove, Not Rewrite)
1. Treat a strategy as a **pipeline of blocks** with stable interfaces:
   - `signal_source_block` (which raw signal sets/voters are used)
   - `classification_block` (universal passthrough vs tier classifier)
   - `weighting_block` (tier weights, per-leg multipliers)
   - `overlap_block` (stacked vs de-dup/vote-weighted)
   - `filter_block` (optional symbol/client/account filters)
2. The EA core should load a registry/manifest and compose the pipeline at runtime (or on weekly plan refresh), rather than hardcoding strategy branches.
3. Future change examples (no execution-core edits):
   - run `Tiered V1 + Tiered V2 + Tiered V3` together = add/remove builder blocks + set `overlap_block`
   - switch `Tiered V3` from `1/1/1` to `1/1/2` = update weighting block config only
   - introduce `Tiered V4` = add a new builder/classifier block, register it, no `EntryEngine` changes
4. Core invariant: `EntryEngine`, `RiskGuards`, `SizingEngine`, `BrokerAdapter`, and `StateStore` consume normalized legs and must not know strategy family/version internals.
5. Registry/manifest changes must be auditable:
   - strategy manifest version
   - block list/order
   - block-specific params
   - effective hash included in decision events

### 4C) Unified Risk Capital Model (Personal + Prop)
1. Define `1:1` sizing as:
   - **a 1% move in the instrument corresponds to ~1% move in the account's sizing risk capital on that leg** (before risk-mode scaling, asset multipliers, broker rounding, and guards).
2. Separate account sizing from broker execution specs:
   - **Account risk model** decides how much capital is exposed (`RiskCapitalUsd`)
   - **Broker symbol specs** decide how that target becomes an executable lot (`min lot`, `lot step`, `tick value`, `contract size`, margin model)
3. Personal accounts:
   - `RiskCapitalUsd = account risk capital` (typically balance/equity baseline)
   - `God mode = 1.0x` of personal risk capital (e.g., 5k personal account => size off 5k)
4. Prop accounts (non-trailing firms only, by current operating policy):
   - `RiskCapitalUsd = max_daily_drawdown_usd`
   - Example: `100k prop` with `5%` daily max DD => `RiskCapitalUsd = 5,000`
   - This makes `God mode` sizing equivalent to a `5k` personal account in `God mode` (before broker symbol-spec differences)
5. Prop stop-loss policy is a **separate compliance layer**:
   - per-order SL is intentionally wide and exists only to satisfy firm rules (e.g., `<= 2%` of nominal account, set around `1.9%`)
   - strategy exits remain basket TP/trailing/weekly reconcile logic
6. Refactor invariant:
   - `SizingEngine` consumes `RiskCapitalUsd`
   - `RiskGuards` / `CompliancePolicy` enforce prop SL rules using nominal account rule bases where required
   - do not mix nominal prop account size into `1:1` sizing math

## 5) Single Source of Truth (Limni Website)

### Canonical Contract Files (in repo)
1. `contracts/mt5_event_contract.json` (authoritative machine contract)
2. `src/lib/mt5/contracts.ts` (TypeScript types derived from contract)
3. `mt5/Experts/Include/Generated/Contract.mqh` (EA constants generated from contract)

### Contract Includes
1. `reason_code` enum (e.g., `friday_winner_close`, `weekly_flip`, `basket_tp`, `trail_lock`)
2. `event_type` enum (e.g., `decision`, `lifecycle`, `health`, `error`)
3. `state_key` enum (e.g., `baseline_equity`, `trailing_active`, `week_start_gmt`)
4. Required/optional payload fields and validation constraints

### Contract Rules
1. EA emits only contract-defined values.
2. `/api/mt5/push` validates payloads against the same contract schema.
3. CI fails if generated artifacts are out of sync with contract source.
4. Contract version increments trigger EA upgrade notifications.

## 5A) EA-Website API Contract

### Pull Endpoints (EA → Website)
```
GET /api/mt5/signals?account_id={id}
Response: {
  report_date: string,
  trading_allowed: boolean,
  pairs: [{symbol, direction, model, asset_class}],
  trail_profile: {avg_peak_pct, start_pct, offset_pct},
  portfolio_strategy?: {
    family: "universal" | "tiered" | "composite_tiered",
    version: "v1" | "v2" | "v3",
    overlap_mode?: "stacked" | "dedup_weighted",
    weights?: { tier1?: number, tier2?: number, tier3?: number },
    voters?: string[],
    blocks?: string[]
  },
  portfolio_plan?: {
    plan_id: string,
    report_date: string,
    legs: [{
      symbol: string,
      direction: "LONG" | "SHORT",
      asset_class: string,
      model_hint?: string,
      tier?: 1 | 2 | 3,
      weight_multiplier: number,
      source_family: "universal" | "tiered" | "composite_tiered",
      source_version: "v1" | "v2" | "v3",
      source_block?: string,
      reason_code: string,
      vote_trace?: {
        voters: string[],
        long_votes: number,
        short_votes: number,
        neutral_votes: number
      }
    }]
  },
  contract_version: string
}

GET /api/mt5/policy?account_id={id}
Response: {
  risk_mode: "high" | "low" | "god",
  leg_scale: number,
  sizing_capital_mode: "balance" | "equity" | "prop_max_daily_dd",
  risk_capital_usd?: number,               // optional explicit override (recommended for props)
  prop_nominal_account_usd?: number,       // compliance basis (e.g., 100000)
  prop_max_daily_drawdown_usd?: number,    // sizing basis for non-trailing props (e.g., 5000)
  per_trade_sl_compliance_mode?: "none" | "prop_pct_of_nominal",
  per_trade_sl_cap_pct_of_nominal?: number,// e.g. 1.9 to satisfy <=2% rule
  asset_filter: string[],
  trail_start_pct: number,
  trail_offset_pct: number,
  basket_tp_pct: number,
  basket_sl_pct: number,
  max_positions: number,
  policy_version: string
}

GET /api/mt5/kill-switch?account_id={id}
Response: {
  halt: boolean,
  liquidate: boolean,
  reason: string,
  issued_at: string
}

GET /api/mt5/version-check?account_id={id}&current_version={ver}
Response: {
  required_version: string,
  deprecated: boolean,
  upgrade_required: boolean,
  grace_period_ends: string | null
}
```

### Push Endpoints (EA → Website)
```
POST /api/mt5/events
Payload: {
  event_id: uuid,
  account_id: string,
  ts_utc: string,
  ea_version: string,
  event_type: "decision" | "lifecycle" | "health" | "error",
  reason_code: string,
  symbol?: string,
  ticket?: number,
  action?: "open" | "close" | "skip",
  lot?: number,
  price?: number,
  retcode?: number,
  metadata: object
}

POST /api/mt5/heartbeat
Payload: {
  account_id: string,
  ts_utc: string,
  ea_version: string,
  state: "idle" | "ready" | "active" | "paused" | "closed",
  open_positions: number,
  basket_pnl_pct: number,
  equity: number,
  errors_last_hour: number
}

POST /api/mt5/positions-snapshot
Payload: {
  account_id: string,
  ts_utc: string,
  positions: [{ticket, symbol, type, lots, profit, swap, open_time}]
}
```

### Fallback Behavior (Website Unreachable)
1. **<5 min downtime**: use cached signals/policy, continue normal operation
2. **5-15 min downtime**: halt new entries, hold existing positions, retry API every 30s
3. **>15 min downtime**: stay in defensive mode (no new entries), continue managing existing positions with local TP/SL/trail/weekly logic, keep retrying API, alert ops
4. **Extended outage policy (optional, per account)**: after a long outage window (for example >120 min), allow controlled risk-reduction unwind if explicitly enabled; default is **no forced liquidation**
5. **Kill-switch received**: immediate liquidate, halt EA, ignore cached state
6. **Portfolio-plan fallback**: if `portfolio_plan` missing but raw `pairs` available, EA may use local strategy blocks (registry-configured) to build a plan from cached/raw signals.
7. **Risk-capital fallback**: if policy is unavailable, EA must fall back to last-known `RiskCapitalUsd` policy (or conservative local defaults) and never silently revert prop sizing to nominal account balance.

## 6) Data + Research Foundation (Self-Improvement Ready)

### 6.1 Required Event Tables
1. `mt5_decision_events` (append-only: every skip/open/close decision with reason)
2. `mt5_position_lifecycle_events` (open/modify/close timeline per position)
3. `mt5_portfolio_exposure_snapshots` (basket/pair/factor exposure at 30s intervals)
4. `mt5_attribution_factors` (P&L decomposition by signal, model, regime, execution)
5. `mt5_execution_quality` (fill price, slippage, latency per order)

### 6.2 Core Event Fields
1. **Identity**: `event_id`, `account_id`, `ticket/position_uid`, `ts_utc`
2. **Versioning**: `ea_version`, `config_hash`, `contract_version`
3. **Context**: `broker`, `server`, `profile`, `report_date`, `symbol`, `model`, `direction`
4. **Decision**: `event_type`, `reason_code`, `action`, `expected_outcome`
5. **Execution result**: `retcode`, `fill_price`, `slippage`, `latency_ms`, `success`
6. **Sizing trace**: `target_lot`, `post_clamp_lot`, `final_lot`, `constraint_reasons`
7. **Strategy trace**: `strategy_family`, `strategy_version`, `source_block`, `tier`, `weight_multiplier`, `overlap_mode`, `vote_trace`

### 6.3 Weekly Research Outputs
1. **Universal system**: return, drawdown, turnover, risk concentration
2. **Basket-level**: attribution, model interaction, correlation analysis
3. **Pair-level**: expectancy, hold-time distribution, regime sensitivity
4. **Execution quality**: by broker, symbol, session, fill quality
5. **Policy attribution**: Friday/Sunday/TP/SL/trail impact on returns

### 6.4 Compliance & Regulatory Outputs
1. **Best-execution evidence**: broker quotes at order time, fill quality metrics
2. **Pre-trade compliance logs**: risk limit checks, concentration checks, halt triggers
3. **Client reporting**: monthly attribution, turnover, execution quality, policy changes
4. **Audit trail export**: complete decision timeline per account, immutable event log

## 7) Migration Strategy (Non-Destructive)

### Phase 0: Freeze + Baseline
1. Freeze strategy behavior before rollout windows.
2. Capture baseline logs/metrics for parity comparison.
3. Tag baseline commit (`baseline-pre-refactor`) and define rollback command path.
4. Document current behavior in test scenarios (Friday rollover, Sunday open, TP hit, etc.).

### Phase 1: Contract and Schema
1. Add `contracts/mt5_event_contract.json` (authoritative contract source).
2. Generate TS types (`src/lib/mt5/contracts.ts`) and MQL enums (`Include/Generated/Contract.mqh`).
3. Add DB tables: `mt5_decision_events`, `mt5_position_lifecycle_events`, `mt5_attribution_factors`.
4. Add API validation middleware using contract schema.
5. Add CI gate: fail build if generated artifacts out of sync with contract.

### Phase 2: Extract Rollover First
1. Move Friday/Sunday logic to `RolloverEngine.mqh` (winner-close, reconcile, crypto carry).
2. Keep behavior bit-for-bit identical (existing EA calls new module functions).
3. Add parity tests: Friday non-prop, Friday prop, Sunday with losers, BTC/ETH carry.
4. Ship to 1 canary account, monitor 1 full week.

### Phase 3: Extract Risk and Sizing
1. Add `RiskBudgetEngine.mqh` to compute `RiskCapitalUsd` (personal balance/equity or prop max daily DD) and separate compliance bases.
2. Move sizing logic to `SizingEngine.mqh` (target lot → constraints → final lot) and make it consume `RiskCapitalUsd` only.
3. Move risk guards to `RiskGuards.mqh` (basket exits/trail/emergency halt) and isolate prop per-order SL as compliance-only logic.
4. Add structured sizing/compliance decisions with explicit reason codes (`risk_capital_source`, `compliance_sl_basis`, broker-spec clamps).
5. Add broker-profile + symbol-spec matrix checks for known account types (same risk capital, different executable lots due to specs).
6. Ship to 5 beta accounts, monitor 1 week.

### Phase 3.5: Introduce Portfolio Strategy Blocks (No Execution Drift)
1. Add `StrategyRegistry` + `PortfolioPlanEngine` interfaces with current behavior as parity baseline.
2. Implement `UniversalBuilder` parity mode first (existing basket behavior preserved).
3. Add `TierClassifier` + `TieredBuilder` for `Tiered V3`, then `Tiered V1/V2`.
4. Add `OverlapResolver` for stacked vs `dedup_weighted` composite tiered modes.
5. Add manifest-driven block composition (`builder -> classifier -> weighting -> overlap`) with deterministic ordering.
6. Ensure `EntryEngine` consumes normalized legs only (no version-specific branching).
7. Emit strategy trace fields in decision events for replay/research parity (including manifest hash/version).
8. Ship to canary account with identical strategy first, then promote new builders behind config.

### Phase 4: Extract Execution and State
1. Move order wrappers to `BrokerAdapter.mqh` (unified buy/sell/close with retry).
2. Move GV/file persistence to `StateStore.mqh` (schema versioning, migration helpers).
3. Add idempotent operation support for crash recovery.
4. Ship to 20 accounts, monitor 1 week.

### Phase 5: Telemetry and Dashboard Isolation
1. Move telemetry to `TelemetryAgent.mqh` (non-blocking event/snapshot push).
2. Move dashboard rendering to `Dashboard.mqh` (UI isolated from trading logic).
3. Ensure trading path works even if telemetry/UI fails.
4. Ship to 50 accounts, monitor 1 week.

### Phase 5.5: Deploy Poseidon Core (Rule Engine Monitoring)
1. Deploy deterministic Poseidon Core services for 24/7 monitoring across all EA/bot instances.
2. Enable heartbeat watchdog, execution verification, sizing/PnL anomaly checks, latency and version-drift checks.
3. Wire self-healing escalation ladder (`retry -> restart -> kill-switch -> Telegram`) with full audit logging.
4. Run in shadow mode first, then enable autonomous actions per account policy.

### Phase 6: Website Service Build-out (Parallel)
1. Build account registry service (track all EA instances, versions, health).
2. Build policy distribution service (push client-specific configs to EAs).
3. Build signal fanout service (1 COT calculation → N accounts).
4. Build risk aggregation service (cross-account exposure monitoring).
5. Build circuit breaker service (detect misbehaving EA, issue kill-switch).
6. Build event ingestion pipeline (all EA events → data lake).
7. Build attribution engine (P&L decomposition for client reports).

### Phase 7: Final Cleanup
1. Main `.mq5` reduced to orchestration and wiring only (<500 lines).
2. Remove dead code and duplicated logic.
3. Final parity report across all accounts.
4. Signoff and rollout to all production accounts.

### Phase 8: Layer Poseidon Intelligence (AI Reasoning + Reporting)
1. Add Poseidon Intelligence on top of Poseidon Core using self-discovered API/database context.
2. Enable anomaly reasoning and cross-account pattern analysis workflows.
3. Enable daily/weekly Telegram reporting for operations and strategy performance.
4. Add recommendation loop for strategy/policy improvements with human approval controls.

## 8) Quality Gates Per Phase
1. **Compile gate**: EA compile must pass with zero warnings.
2. **Behavioral gate**: parity scenarios pass (expected closes/holds/skips match baseline).
3. **Contract gate**: generated files match contract source, API validator accepts events.
4. **Data gate**: event ingestion valid, no missing required fields, schema correct.
5. **Ops gate**: rollback tested and documented, canary account monitored.
6. **Performance gate**: no latency regression, no memory leaks, stable under load.

## 9) Immediate High-Priority Scenarios to Lock
1. Friday report-date change with non-prop accounts (winner-close → reconcile).
2. Friday report-date change with prop/5ERS accounts (close all non-crypto).
3. BTC/ETH carry through Friday and Sunday close.
4. TP/SL/trail close precedence over weekly close policy.
5. Post-Friday loser-hold blocking new entries until Sunday rollover.
6. Failed close retry behavior for non-crypto prop positions.
7. Website API downtime fallback (cached signals, halt new entries).
8. Kill-switch activation (immediate liquidate, halt EA).
9. EA crash mid-rollover recovery (idempotent operations, server reconciliation).
10. Version mismatch handling (deprecated EA → upgrade notification).

## 10) Governance and Change Control
1. Every strategy-affecting change requires:
   - Contract version update (if enum/shape changes).
   - Reasoned migration note in changelog.
   - Replay/parity evidence from test accounts.
   - CTO approval before production merge.
2. No direct merges to production branch without passing all quality gates.
3. Weekly architecture review with:
   - Change log (what changed, why, evidence)
   - Unresolved risks and mitigations
   - Rollback plan if issues detected
4. Incident response protocol:
   - Halt affected accounts immediately
   - Isolate to single account if possible
   - Rollback to last stable version
   - Post-mortem within 24h

## 11) LLM Integration (Future)
1. LLM proposes hypotheses/config deltas only (not direct execution).
2. Rule engine validates proposals against hard risk rules.
3. Human approval required for production promotion.
4. No direct order placement path from LLM.
5. LLM advisory outputs logged for audit trail.

## 12) API Security Contract
**Status:** Resolves former Open Decision #1 (API security contract).

### Authentication Model: Token + HMAC-SHA256 with Canonical Request Signing
Every request from an EA to the website includes:
- `x-mt5-token` (account identifier)
- `x-mt5-key-id` (signing key version identifier)
- `x-mt5-timestamp` (Unix epoch seconds, UTC)
- `x-mt5-nonce` (unique request ID for mutating/write routes only; omitted for read-only GET)
- `x-mt5-signature` (HMAC-SHA256 over canonical request string)

Canonical request string format:
```text
METHOD\n
PATH\n
QUERY_STRING\n
TIMESTAMP\n
NONCE\n
SHA256(REQUEST_BODY)
```

Where:
- `METHOD` = uppercase HTTP method (`GET`, `POST`)
- `PATH` = request path (e.g., `/api/mt5/push`)
- `QUERY_STRING` = sorted query parameters (empty string if none)
- `TIMESTAMP` = `x-mt5-timestamp`
- `NONCE` = `x-mt5-nonce` (empty string for read-only routes)
- `SHA256(REQUEST_BODY)` = hex-encoded SHA-256 hash of raw request body (use empty-body hash for GET with no body)

Signature:
- `HMAC-SHA256(account_secret, canonical_string)`

### Server-Side Verification Algorithm
For each incoming request:
1. Extract `x-mt5-token`, `x-mt5-key-id`, `x-mt5-timestamp`, `x-mt5-nonce`, `x-mt5-signature`.
2. Reject if required headers are missing (`400`).
3. Look up account by token. Reject if not found (`401`).
4. Look up signing key by `key_id`. Reject if unknown or revoked (`401`).
5. Validate timestamp is within `±60s` of server time. Reject if stale (`401`, `REQUEST_EXPIRED`).
6. For write endpoints, validate nonce has not been seen in TTL cache (`60-120s` window). Reject duplicate (`409`, `DUPLICATE_REQUEST`). Store nonce on success.
7. Rebuild canonical string, compute expected HMAC, and constant-time compare against provided signature. Reject mismatch (`401`, `INVALID_SIGNATURE`).
8. For telemetry push (`/api/mt5/events`), additionally require unique `event_id` in payload and reject duplicates (`409`, `DUPLICATE_EVENT`).
9. If all checks pass, continue to route handler.

Error codes:
- `MISSING_AUTH_HEADERS` (`400`)
- `UNKNOWN_ACCOUNT` (`401`)
- `UNKNOWN_KEY_ID` (`401`)
- `REVOKED_KEY` (`401`)
- `REQUEST_EXPIRED` (`401`)
- `DUPLICATE_REQUEST` (`409`)
- `DUPLICATE_EVENT` (`409`)
- `INVALID_SIGNATURE` (`401`)
- `IP_NOT_ALLOWED` (`403`) when IP allowlisting is enabled

### Replay Protection
1. Read-only endpoints (`GET /api/mt5/signals`, `/api/mt5/policy`, `/api/mt5/kill-switch`, `/api/mt5/version-check`):
   - timestamp window only (`±60s`)
   - no nonce required
2. Write endpoints (`POST /api/mt5/events`, `/api/mt5/heartbeat`, `/api/mt5/positions-snapshot`):
   - timestamp window (`±60s`) + nonce uniqueness via short-TTL in-memory cache (`120s`)
   - no database writes for nonce tracking
3. Telemetry push (`/api/mt5/events`):
   - enforce unique `event_id`
   - reject duplicate `event_id` with `409`

### Key Rotation: Dual-Key Rolling Model
Each account has two key slots (`primary`, `secondary`); server accepts valid signatures from either active key.

Key record schema:
- `account_id`, `key_id`, `key_slot` (`primary|secondary`), `encrypted_secret`, `created_at`, `expires_at`, `revoked_at`

Rotation state machine:
1. `STEADY`: only primary active, secondary empty.
2. `ROTATING`: new secondary generated; both keys valid while EA picks up new key.
3. `PROMOTED`: secondary promoted to primary; old primary enters grace (`7 days`).
4. `EXPIRED`: old key rejected after grace period.

Rotation cadence:
- every `90 days`
- automated reminder via Poseidon
- manual trigger via admin API

Immediate revoke path:
- admin may set `revoked_at` immediately for any key (compromise response)
- immediate revoke bypasses grace period

### Transport Security
1. HTTPS enforced (`TLS 1.2+`) for all EA↔Website calls.
2. Strict host validation: EA must validate certificate hostname.
3. IP allowlisting is optional defense-in-depth at edge/middleware, not primary auth.
4. Primary protection remains token + HMAC + freshness checks.
5. If allowlisting enabled, reject unknown IP with `403` (`IP_NOT_ALLOWED`) before auth processing.

### Credential Storage
Server-side:
1. Store signing secrets encrypted with `AES-256-GCM` using envelope encryption.
2. Keep encryption key in environment (`MT5_SECRET_ENCRYPTION_KEY`), never in database.
3. Secrets remain recoverable for HMAC verification (not hashed).
4. Keep key metadata (`key_id`, slot, timestamps, revoke status) in plaintext columns for lookup/indexing.

EA-side phased policy:
1. Phase 1 (dev/canary, Freedom-controlled VPS): EA input parameter allowed.
2. Phase 2 (institutional/client accounts): encrypted file on VPS with per-machine decryption key; EA decrypts on init; secret not exposed in MT5 terminal UI.

### MQL5 Implementation Notes
MQL5 native primitives are sufficient:
- `CryptEncode(CRYPT_HMAC_SHA256, ...)` for request signing
- `CryptEncode(CRYPT_HASH_SHA256, ...)` for request body hash
- `WebRequest()` for HTTPS calls with custom headers

No external libraries required for signing.

## 13) Open Decisions for CTO + Claude Review
1. Version governance precedence: exact rule for `pinned_ea_version` vs `auto_upgrade_enabled` (pinned must override auto-upgrade).
2. Canonical trading calendar policy: ET/DST handling, Friday/Sunday rollover windows, and holiday/session exceptions.
3. Operational SLOs: heartbeat SLA, alert thresholds, incident response windows, RTO/RPO targets.
4. Final contract versioning scheme (`semver` vs date-based vs hash-based).
5. Event retention policy and archival cadence (hot storage vs cold archive).
6. Required minimum telemetry for production accounts (heartbeat interval, event sampling).
7. Broker-profile policy packs and override hierarchy (global → client tier → account).
8. Release cadence for refactor phases during live operations (weekly? bi-weekly?).
9. Client onboarding workflow (how to add new account + VPS provisioning).
10. Cross-account risk limit policy (max exposure per currency, model, asset class).
11. Kill-switch activation criteria (what triggers emergency liquidate?).

## 14) Deliverables Checklist

### Core Infrastructure
- [ ] `contracts/mt5_event_contract.json` (contract source)
- [ ] TS and MQL generated contract artifacts + CI validation
- [ ] New event tables + migrations (`mt5_decision_events`, `mt5_position_lifecycle_events`, etc.)
- [ ] API contract validation middleware
- [ ] API security middleware: canonical request reconstruction + constant-time HMAC verification
- [ ] Nonce replay TTL cache for write endpoints (`120s`) + `DUPLICATE_REQUEST` handling
- [ ] Telemetry `event_id` idempotency enforcement + `DUPLICATE_EVENT` handling
- [ ] Dual-key signing key store + rotation/revoke admin API (`primary`/`secondary`, `key_id`)
- [ ] Secret encryption service (`AES-256-GCM` envelope encryption) with `MT5_SECRET_ENCRYPTION_KEY`
- [ ] Optional IP allowlisting middleware toggle + `IP_NOT_ALLOWED` handling

### EA Modules
- [ ] `RolloverEngine.mqh` with parity tests
- [ ] `RiskBudgetEngine.mqh` + `SizingEngine.mqh` + `RiskGuards.mqh` with broker matrix tests
- [ ] `StrategyRegistry.mqh` + `PortfolioPlanEngine.mqh` (normalized leg pipeline)
- [ ] `UniversalBuilder.mqh`, `TieredBuilder.mqh`, `TierClassifier.mqh`, `OverlapResolver.mqh`
- [ ] Strategy block manifest schema + config loader (versioned, auditable)
- [ ] `BrokerAdapter.mqh` + `StateStore.mqh` with recovery tests
- [ ] `TelemetryAgent.mqh` + `Dashboard.mqh` isolated from trading logic
- [ ] Main EA reduced to orchestration (<500 lines)
- [ ] MQL5 canonical signing utility (body hash + canonical string + HMAC headers: token/key-id/timestamp/nonce/signature)

### Website Services
- [ ] Account registry service (track EA instances, versions, health)
- [ ] Policy distribution service (per-account configs)
- [ ] Signal fanout service (1 COT calc → N accounts) + optional prebuilt portfolio-plan manifests
- [ ] Risk aggregation service (cross-account exposure monitoring)
- [ ] Circuit breaker service (kill-switch management)
- [ ] Event ingestion pipeline (EA events → data lake)
- [ ] Attribution engine (P&L decomposition)

### Documentation & Ops
- [ ] Architecture doc update (thin EA + website control plane)
- [ ] Risk-capital policy packs (personal vs non-trailing prop) with examples (`5k` personal == `100k prop / 5k daily DD` in God mode)
- [ ] Rollback runbook (per phase)
- [ ] Incident response protocol
- [ ] Client onboarding guide
- [ ] Version upgrade procedure

## 15) Recovery & Reconnect Protocol

### On EA Init (or after crash/reconnect)
1. EA queries website for current state:
   ```
   GET /api/mt5/reconcile?account_id={id}
   Response: {
     server_policy_version: string,
     server_positions: [{ticket, symbol, type, lots}],
     pending_kill_switch: boolean,
     expected_ea_version: string
   }
   ```
2. EA compares local state vs server state:
   - **Position mismatch**: push full snapshot to server, wait for reconciliation response
   - **Policy version mismatch**: pull latest policy, log upgrade event
   - **Kill-switch pending**: halt immediately, do not execute any orders
3. Server responds with reconciliation action:
   - `"ok"`: continue normal operation
   - `"close_positions"`: liquidate specified positions, then resume
   - `"halt"`: stop all activity, wait for manual intervention

### Idempotent Event Submission
1. Each event has client-side UUID (generated before execution).
2. EA retries failed pushes with same UUID.
3. Website deduplicates events on UUID (prevents double-counting).
4. Event submission failure does NOT block trading (events queued locally, retry async).

### Crash Recovery
1. On crash, VPS auto-restarts MT5 + EA.
2. EA loads state from GlobalVariables + local file.
3. EA queries website for position reconciliation (detect orphaned positions).
4. If mismatch detected, server instructs close or keep per position.
5. EA logs recovery event with pre-crash state snapshot.

## 16) Version Control & Deployment

### Per-Account Version Pinning
Website tracks EA version per account:
```sql
account_registry:
  account_id, pinned_ea_version, auto_upgrade_enabled, last_heartbeat, status
```

### Version Check on Every Signal Pull
```
GET /api/mt5/signals?account_id={id}
Response includes: required_ea_version, deprecated_version_list
```
- If EA version < required: log warning, continue (grace period)
- If EA version in deprecated list: halt and alert ops (upgrade required)

### Rollout Strategy
1. **Canary tier** (1-2 accounts): deploy EA v1.4, monitor 48h
2. **Beta tier** (5-10 accounts): if canary stable, deploy to beta, monitor 1 week
3. **Production tier** (all accounts): if beta stable, promote to prod

### Version Upgrade Procedure
1. Build new EA version with contract version increment.
2. Deploy to canary account VPS.
3. Monitor logs, events, execution quality for 48h.
4. If stable: promote to beta tier (manually update VPS instances).
5. If stable: promote to prod tier (website updates `required_ea_version`).
6. Old version accounts auto-upgrade on next init (if `auto_upgrade_enabled`).

## 17) Operations Dashboard (Website)

### Account Health Grid
Real-time view of all EA instances:
```
account_id | EA version | Last heartbeat | State | Positions | P&L | Errors (1h)
7936840    | 1.4.2      | 30s ago        | ACTIVE| 12        | +2.3%| 0
26043051   | 1.4.2      | 35s ago        | ACTIVE| 8         | +1.1%| 0
...
```

### Aggregate Risk View
Cross-account exposure monitoring:
```
Total exposure by currency: EUR +$2.3M, USD -$1.8M, JPY +$0.9M
Total exposure by model: dealer +$3.1M, blended +$1.2M, sentiment -$0.5M
Concentration limits: EUR 78% of limit, dealer 62% of limit
Accounts exceeding thresholds: [account_7936840: trail DD 18%]
```

### Event Stream Live Tail
Real-time decision events from all accounts:
```
[15:32:05 UTC] account_7936840: friday_winner_close EURUSD dealer +$412 (profit+swap > 0)
[15:32:06 UTC] account_26043051: weekly_flip GBPUSD blended -$87 (signal flipped SHORT→LONG)
[15:32:07 UTC] account_7936840: reconcile_keep USDJPY dealer (direction matches)
```
Filters: account, symbol, reason_code, event_type, time range

### Circuit Breaker Controls
Emergency controls per account or global:
```
Per-account:
- Kill-switch (liquidate all positions, halt EA)
- Policy override (temporary risk reduction: leg_scale *= 0.5)
- Version pin (prevent auto-upgrade)

Global:
- Emergency halt all accounts
- Pause new entries (hold existing positions)
- Force upgrade to specific version
```

## 18) Website Service Architecture

### Required Services (Parallel to EA Refactor)

#### 1. Account Registry Service
- Track all EA instances: account_id, VPS IP, EA version, last heartbeat, status
- Health monitoring: detect unresponsive EAs, alert ops
- Version management: track upgrades, rollback history

#### 2. Policy Distribution Service
- Store per-account configs: risk_mode, leg_scale, asset_filter, trail params
- Hierarchical override: global defaults → client tier → account specific
- Config audit trail: who changed what, when, why

#### 3. Signal Fanout Service
- Calculate COT signals once per week (Friday 15:30 ET)
- Broadcast to all accounts with client-specific filtering
- Cache signals for EA fallback during website downtime
- Optionally pre-build and distribute normalized `portfolio_plan` payloads (Universal/Tiered/Composite) per account

#### 4. Risk Aggregation Service
- Sum exposure across all accounts: by currency, model, asset class
- Detect concentration limits breaches
- Alert ops when thresholds exceeded

#### 5. Circuit Breaker Service
- Monitor EA health, execution quality, error rates
- Auto-issue kill-switch if anomalies detected (e.g., repeated failed closes, excessive slippage)
- Manual kill-switch UI for ops team

#### 6. Event Ingestion Pipeline
- Receive events from all EAs via POST /api/mt5/events
- Validate against contract schema
- Write to data lake (append-only, immutable)
- Stream to real-time analytics + ops dashboard

#### 7. Attribution Engine
- Consume event stream + position lifecycle data
- Decompose P&L by: signal source, model, regime, execution quality
- Generate weekly client reports: attribution, turnover, execution quality

#### 8. Compliance Service
- Pre-trade compliance checks (account restrictions, concentration limits)
- Best-execution evidence (capture broker quotes at order time)
- Regulatory audit export (complete decision timeline, immutable)

## 19) Failure Modes & Runbooks

### 1. EA Crashes Mid-Rollover
**Detection**: heartbeat missing for >2 min
**Impact**: positions may be partially closed, state inconsistent
**Response**:
1. VPS auto-restarts MT5 + EA
2. EA queries website for position reconciliation
3. Server compares local vs expected positions
4. Server instructs EA: close orphaned positions or resume
5. Log recovery event with pre-crash state snapshot

**Prevention**: idempotent operations, state snapshots before critical actions

### 2. Website API Downtime
**Detection**: API fetch timeout or 5xx error
**Impact**: EA cannot pull signals/policy, cannot push events
**Response**:
- <5 min: use cached signals, continue
- 5-15 min: halt new entries, hold positions, retry every 30s
- >15 min: remain defensive (no new entries), manage open risk locally, keep retrying API, alert ops
- Extended outage (optional per account): controlled unwind only if explicit policy flag is enabled; default is no forced liquidation

**Prevention**: signal cache with TTL, fallback conservative mode

### 3. Broker API Downtime
**Detection**: order execution timeout or broker-reported error
**Impact**: cannot open/close positions
**Response**:
1. Retry failed orders 3x with exponential backoff
2. If all retries fail: log error event, alert ops
3. Do not halt EA (hold positions, wait for broker recovery)

**Prevention**: broker status monitoring, multi-broker fallback (future)

### 4. Corrupt State Detected
**Detection**: state validation fails (negative equity, impossible position count, etc.)
**Impact**: EA behavior unpredictable
**Response**:
1. Halt EA immediately
2. Push full state snapshot to website
3. Alert ops for manual review
4. Ops resets state from server-side reconciliation

**Prevention**: state schema versioning, validation on load, periodic sanity checks

### 5. Misbehaving EA Detected
**Detection**: excessive errors, repeated failed closes, abnormal slippage
**Impact**: risk of runaway losses, broker complaints
**Response**:
1. Circuit breaker service auto-issues kill-switch
2. EA liquidates all positions, halts
3. Ops reviews logs, events, determines root cause
4. Manual restart after fix confirmed

**Prevention**: anomaly detection, error rate thresholds, ops alerts

### 6. Version Mismatch After Upgrade
**Detection**: EA version < required_version from website
**Impact**: EA may use outdated logic, contract mismatches
**Response**:
1. EA logs warning, continues (grace period)
2. If version deprecated: halt and alert ops
3. Ops manually upgrades EA on VPS or enables auto-upgrade

**Prevention**: version check on every signal pull, auto-upgrade enabled by default

### 7. Cross-Account Risk Limit Breach
**Detection**: risk aggregation service detects EUR exposure >80% of limit
**Impact**: concentration risk, regulatory breach
**Response**:
1. Alert ops immediately
2. Circuit breaker issues temporary policy override: reduce leg_scale for EUR-heavy accounts
3. Ops reviews and adjusts global limits or closes positions

**Prevention**: pre-trade compliance checks, real-time risk monitoring

### 8. Client Requests Emergency Liquidation
**Detection**: ops receives client request via support ticket
**Impact**: need to liquidate specific account immediately
**Response**:
1. Ops issues kill-switch for account via dashboard UI
2. EA receives kill-switch on next poll, liquidates all positions
3. EA halts, logs liquidation event
4. Ops confirms positions closed, notifies client

**Prevention**: kill-switch testing in canary tier, documented procedure

---

## Summary

This plan provides a complete roadmap for transforming the EA from a 6k-line monolith into an institutional-grade modular system capable of managing billions of dollars across 100+ client accounts with complete isolation, regulatory compliance, and research-driven optimization.

**Key architectural decisions:**
- 1-VPS-per-account for complete client isolation
- Thin EA + website control plane for heavy lifting
- Contract-driven integration for zero drift
- Event sourcing for research, compliance, attribution
- Modular EA structure for rapid iteration at scale
- Strategy composition layer (Universal/Tiered/Composite) so future variants are added as plug-in blocks, not monolith rewrites
- Strategy manifests/registries so most future changes are add/remove/reorder blocks, not execution-core edits
- Unified `1:1` sizing based on **risk capital** (personal risk capital or prop max daily drawdown), not nominal prop account balance
- Broker-specific symbol specifications affect executable lot sizing, but not the account-risk model
- Prop per-order stop losses are compliance controls (rule-satisfaction), not strategy exits

**Implementation timeline:** With AI-accelerated tools, 2-3 weeks for core infrastructure, ongoing iteration for advanced features.

**Next steps:** CTO + Claude review, contract specification, Phase 0-1 kickoff.
