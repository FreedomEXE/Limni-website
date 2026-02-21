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

## 3) Target End State
1. **EA becomes thin execution agent** (orchestrates modules, minimal business logic).
2. **Logic split across focused `.mqh` modules** with strict interfaces.
3. **Website handles heavy lifting**: signal calculation, risk aggregation, research, compliance.
4. **Contract-driven integration**: website + EA use same generated enums/schemas.
5. **Research/event data is append-only** and powers attribution, optimization, client reports.
6. **LLM (future) is advisory only**, never direct execution.

## 4) Proposed EA Module Structure
```text
mt5/Experts/
  LimniBasketEA.mq5                  # Thin orchestrator (OnInit/OnTimer/OnDeinit)
  Include/
    Core/
      Context.mqh                    # Shared state structs, config, constants
      Orchestrator.mqh               # Main event loop coordination
    Domain/
      Models.mqh                     # DTOs for signals, positions, decisions
      Enums.mqh                      # Reason codes, event types, state flags
    Strategy/
      RolloverEngine.mqh             # Friday/Sunday rollover contracts (BTC/ETH carry, prop vs non-prop)
      ReconcileEngine.mqh            # Keep/close reconciliation against new signals
      EntryEngine.mqh                # Entry windows, loser-add logic, add gates
    Risk/
      SizingEngine.mqh               # Target lot → constraints → final lot (per-client policy)
      RiskGuards.mqh                 # TP/SL/trail/limits/emergency halt
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
  contract_version: string
}

GET /api/mt5/policy?account_id={id}
Response: {
  risk_mode: "high" | "low" | "god",
  leg_scale: number,
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
1. Move sizing logic to `SizingEngine.mqh` (target lot → constraints → final lot).
2. Move risk guards to `RiskGuards.mqh` (TP/SL/trail/emergency halt).
3. Add structured sizing decisions with explicit reason codes.
4. Add broker-profile matrix checks for known account types.
5. Ship to 5 beta accounts, monitor 1 week.

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

## 12) Open Decisions for CTO + Claude Review
1. API security contract: endpoint auth model, request signing (HMAC), nonce/timestamp replay protection, and key rotation policy.
2. Version governance precedence: exact rule for `pinned_ea_version` vs `auto_upgrade_enabled` (pinned must override auto-upgrade).
3. Canonical trading calendar policy: ET/DST handling, Friday/Sunday rollover windows, and holiday/session exceptions.
4. Operational SLOs: heartbeat SLA, alert thresholds, incident response windows, RTO/RPO targets.
5. Final contract versioning scheme (`semver` vs date-based vs hash-based).
6. Event retention policy and archival cadence (hot storage vs cold archive).
7. Required minimum telemetry for production accounts (heartbeat interval, event sampling).
8. Broker-profile policy packs and override hierarchy (global → client tier → account).
9. Release cadence for refactor phases during live operations (weekly? bi-weekly?).
10. Client onboarding workflow (how to add new account + VPS provisioning).
11. Cross-account risk limit policy (max exposure per currency, model, asset class).
12. Kill-switch activation criteria (what triggers emergency liquidate?).

## 13) Deliverables Checklist

### Core Infrastructure
- [ ] `contracts/mt5_event_contract.json` (contract source)
- [ ] TS and MQL generated contract artifacts + CI validation
- [ ] New event tables + migrations (`mt5_decision_events`, `mt5_position_lifecycle_events`, etc.)
- [ ] API contract validation middleware

### EA Modules
- [ ] `RolloverEngine.mqh` with parity tests
- [ ] `SizingEngine.mqh` + `RiskGuards.mqh` with broker matrix tests
- [ ] `BrokerAdapter.mqh` + `StateStore.mqh` with recovery tests
- [ ] `TelemetryAgent.mqh` + `Dashboard.mqh` isolated from trading logic
- [ ] Main EA reduced to orchestration (<500 lines)

### Website Services
- [ ] Account registry service (track EA instances, versions, health)
- [ ] Policy distribution service (per-account configs)
- [ ] Signal fanout service (1 COT calc → N accounts)
- [ ] Risk aggregation service (cross-account exposure monitoring)
- [ ] Circuit breaker service (kill-switch management)
- [ ] Event ingestion pipeline (EA events → data lake)
- [ ] Attribution engine (P&L decomposition)

### Documentation & Ops
- [ ] Architecture doc update (thin EA + website control plane)
- [ ] Rollback runbook (per phase)
- [ ] Incident response protocol
- [ ] Client onboarding guide
- [ ] Version upgrade procedure

## 14) Recovery & Reconnect Protocol

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

## 15) Version Control & Deployment

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

## 16) Operations Dashboard (Website)

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

## 17) Website Service Architecture

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

## 18) Failure Modes & Runbooks

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

**Implementation timeline:** With AI-accelerated tools, 2-3 weeks for core infrastructure, ongoing iteration for advanced features.

**Next steps:** CTO + Claude review, contract specification, Phase 0-1 kickoff.
