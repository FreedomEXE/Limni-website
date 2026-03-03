/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: institutional-audit-comparison.md
 *
 * Description:
 * Side-by-side institutional readiness audit comparing findings from
 * Claude (CTO) and Codex, conducted March 2, 2026. Both auditors
 * independently reached the same verdict: NO-GO for institutional
 * hardened start. This document synthesizes both perspectives into
 * a unified gap analysis with prioritized remediation.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

# Institutional Readiness Audit — Combined Findings

**Date:** March 2, 2026
**Auditors:** Claude (CTO), Codex
**Subject:** Limni ATS (Automated Trading System) — plan.md + codebase
**Verdict:** **NO-GO** (unanimous)

---

## Executive Summary

Both auditors independently concluded the **architecture is strong but the system is not institutionally hardened.** The plan.md is one of the best trading system blueprints at this stage, but "institutional grade" has a specific regulatory and operational bar that has not been met.

**Claude overall score:** B- (strong blueprint, pre-institutional execution)
**Codex verdict:** NO-GO until P0/P1 gaps closed as explicit, testable gates

The good news: every gap is addressable. Nothing requires a redesign — it's all additive hardening.

---

## Status Revalidation (March 2, 2026 — Post-Audit Repo Check)

The initial audit verdict remains **NO-GO**, but several statements needed precision updates after same-day repo revalidation:

1. **Poseidon schedulers exist in code paths** (`startTriton`, `scheduleNereus`, `schedulePoseidon` in startup flow). The remaining gap is production runtime reliability evidence, not architectural absence.
2. **Poseidon session state is DB-backed** (`poseidon_kv`) in current implementation; the unresolved issue is policy consistency about what is authoritative for operations context vs prompt memory context.
3. **MT5 liveness signaling exists** via `mt5_accounts.last_sync_utc` and Triton stale-account monitoring; however, a dedicated heartbeat event table/contract is still not formalized.
4. **Strategy lifecycle abstraction is now defined in `plan.md`**; implementation remains pending.

These updates do **not** change the final institutional readiness decision: critical P0/P1 controls are still open.

---

## Unified Verdict: What Both Auditors Agree On

| Area | Agreement |
|------|-----------|
| Architecture design | **Excellent.** 1-VPS-per-account, thin EA + control plane, modular decomposition — this is how real funds operate |
| Risk capital model | **Correct.** Unified sizing math for personal + prop via RiskCapitalUsd is clean and scalable |
| Migration strategy | **Sound.** 7-phase canary → beta → prod rollout prevents catastrophic deployment failures |
| Security model | **Undecided and critical.** API auth, request signing, replay protection, key rotation — all explicitly open |
| Pre-trade risk checks | **Insufficient.** No hard-block controls before order submission |
| Operational resilience | **Undefined.** No SLA, RTO, RPO, failover — can't objectively gate go/no-go |
| Monitoring layer (Poseidon) | **Partially implemented, not yet proven.** Schedulers/monitors exist in code, but production runtime reliability and escalation evidence are not yet institutionalized |
| Contracts layer | **Does not exist.** Biggest technical gap in the system |
| Deployment automation | **Manual.** VPS updates are manual, creating drift risk at scale |

---

## Finding-by-Finding Comparison

### CRITICAL SEVERITY

#### 1. Security Model Undecided
| | Claude | Codex |
|---|--------|-------|
| **Finding** | No API key rotation policy, no secrets management, no credential rotation, tokens in env vars, no IP allowlisting | API auth, request signing (HMAC), nonce/timestamp replay protection, and key rotation are explicitly open items |
| **Evidence** | Codebase audit — no Vault/Secrets Manager integration, env vars only | plan.md L568-569 — "Open Decisions for CTO + Claude Review" |
| **Impact** | Control plane trust boundary is not hardened. EA-to-website communication can be intercepted, replayed, or spoofed | Same |
| **Standard** | SEC written cybersecurity policies, NIST CSF 2.0, AES-256 at rest, TLS 1.3 in transit, automated key rotation every 2-3 months | SEC Rule 15c3-5, NIST CSF 2.0 |

**Unified Assessment:** Both auditors flagged this as the #1 critical gap. The security model isn't just weak — it's undecided. You can't harden what you haven't designed.

---

#### 2. No Contracts Layer
| | Claude | Codex |
|---|--------|-------|
| **Finding** | No `contracts/` directory, no Zod schemas, no payload validation. EA pushes JSON accepted on faith | (Implicit in pre-trade control finding — no validation middleware) |
| **Evidence** | Codebase audit — directory does not exist, plan.md deliverables unchecked | plan.md deliverables checklist |
| **Impact** | One malformed payload can corrupt the database. Contract drift between EA and website goes undetected | Same |

**Unified Assessment:** Claude flagged this explicitly as "THE biggest gap." Codex captured it implicitly through the pre-trade control finding. Both agree: typed schemas with build-time validation are non-negotiable.

---

#### 3. Poseidon Truth-Source Ambiguity
| | Claude | Codex |
|---|--------|-------|
| **Finding** | Poseidon scheduler paths are implemented, but production scheduler reliability is not yet proven/operationalized | "Self-discovery only" requirement conflicts with documented prompt-memory curation patterns and unclear authority boundaries |
| **Evidence** | Startup flow invokes Triton/Nereus/Poseidon scheduling; previous incident context indicated runtime issues on Render | plan.md L104, poseidon-architecture.md L110, PROTEUS_CORE.md L110, CODEX_MEMORY_ARCHITECTURE.md L77, plus DB-backed state implementation |
| **Impact** | Without runtime reliability evidence, autonomous monitoring cannot be trusted. Without clear authority boundaries, ops context can drift between queryable state and curated memory | Both: The "if I died it would run itself" vision cannot work |

**Unified Assessment:** The gap is now framed as **proof and governance**, not just feature existence. Scheduler startup paths exist; institutional readiness still requires runtime SLO evidence, alerting evidence, and a hard rule that operational truth comes from queryable APIs/DB contracts.

---

### HIGH SEVERITY

#### 4. No MT5 Kill-Switch
| | Claude | Codex |
|---|--------|-------|
| **Finding** | Bitget has kill-switch, MT5 does not. No remote emergency stop for EA | Kill-switch activation criteria undefined (plan.md L580) |
| **Evidence** | Codebase audit — `bitgetBotEngine.ts` has kill-switch, no equivalent for MT5 | plan.md L580 — listed as open decision |
| **Impact** | Rogue EA on prop account = uncontrolled losses. Knight Capital lost $460M in 45 min without a kill switch | Same |

**Unified Assessment:** Both agree. Non-negotiable before deploying to prop capital.

---

#### 5. Pre-Trade Risk Checks Insufficient
| | Claude | Codex |
|---|--------|-------|
| **Finding** | No pre-trade validation gate. No position limits, exposure limits, or margin checks before order submission | Pre-trade hard-block spec not explicit enough — no credit/capital thresholds, no erroneous/duplicate order prevention, no parameter governance per venue/account |
| **Evidence** | Codebase audit — RiskGuards planned but not implemented | plan.md L470, L846 |
| **Impact** | Orders can exceed position limits, duplicate orders can fire, sizing errors go uncaught until post-trade | Same |
| **Standard** | SEC Rule 15c3-5 mandates pre-trade risk controls | SEC Rule 15c3-5, EU RTS 6 |

**Unified Assessment:** Codex provided more granular detail (per-venue parameter governance, duplicate prevention). Both agree this is high severity. The plan mentions `RiskGuards.mqh` but the spec isn't detailed enough for implementation.

---

#### 6. Operational Resilience Undefined (SLA/RTO/RPO)
| | Claude | Codex |
|---|--------|-------|
| **Finding** | No documented RTO/RPO, no hot site, no failover procedures. VPS provider outage = control plane gone, EAs flying blind | SLA, RTO, RPO are open items — failover/recovery acceptance cannot be objectively gated |
| **Evidence** | Codebase audit — no DR documentation | plan.md L572 — listed as open decision |
| **Impact** | Can't measure recovery. Can't set acceptance criteria. Can't test failover | Same |

**Unified Assessment:** Complete agreement. You can't claim institutional grade without defined and tested resilience targets.

---

#### 7. No Independent Risk/Compliance Validation
| | Claude | Codex |
|---|--------|-------|
| **Finding** | No parameter change logging, no algorithm version identification in trades, audit trail incomplete | No defined independent risk/compliance validation function for annual control attestations and algorithm validation cycles |
| **Evidence** | Codebase audit — trades logged but no change management trail | plan.md L568, L524 |
| **Impact** | Claude: Can't answer "who changed what, when" for regulators. Codex: No annual algorithm review cycle = regulatory non-compliance | Both: Audit trail doesn't meet 5-7 year retention requirements |
| **Standard** | MiFID II Article 17, SEC algo trading rules, FINRA 2025 Market Access findings | Same + RTS 6 annual validation requirement |

**Unified Assessment:** Codex surfaced a gap Claude didn't emphasize enough — the need for periodic independent validation cycles, not just logging. Institutional firms run annual algorithm reviews with sign-offs. This isn't just about what you log; it's about who reviews it and how often.

---

#### 8. Key-Person Risk (Single Human Escalation)
| | Claude | Codex |
|---|--------|-------|
| **Finding** | (Implicit — "if I died" concern noted from Freedom's requirements) | Ops escalation is single-human-centric — key-person risk, weak for 24/7 institutional operations |
| **Evidence** | — | plan.md L78 |
| **Impact** | If Freedom is unavailable for 24+ hours, no human can authorize kill-switch or override Poseidon | Same |

**Unified Assessment:** Codex caught this explicitly; Claude addressed it implicitly through the self-sustaining system discussion. For true institutional posture, there needs to be at minimum: (a) a secondary authorized human, OR (b) Poseidon authorized to take defined autonomous actions without human approval up to a severity threshold.

---

### MEDIUM SEVERITY

#### 9. Test & Release Hardening
| | Claude | Codex |
|---|--------|-------|
| **Finding** | No walk-forward validation, no regression suite, no automated parity testing, manual deployment | Minimal CI workflow, limited test plans vs required chaos/security/restore drills |
| **Evidence** | Codebase audit — no test framework for EA | force-vercel-deploy.yml, ea-performance-validation.md, ea-reconnect-validation.md |

**Unified Assessment:** Both agree. Testing exists (backtests, manual validation docs) but doesn't meet the bar for automated regression, chaos testing, or deployment verification.

---

#### 10. Sensitive State Policy Contradiction
| | Claude | Codex |
|---|--------|-------|
| **Finding** | (Not explicitly flagged) | Documentation contradiction: DB-backed runtime state exists, while other docs still describe git-committed state/archives and conflicting gitignore guidance |
| **Evidence** | — | state.ts (DB-backed `poseidon_kv`) vs CODEX_MEMORY_ARCHITECTURE.md L77 and CODEX_HARDENING_PASS.md L187 |

**Unified Assessment:** Codex-only finding. The core issue is policy consistency: define one authoritative persistence model for runtime-sensitive context, then align all docs and ignore rules to it.

---

#### 11. Manual VPS Deployment
| | Claude | Codex |
|---|--------|-------|
| **Finding** | No containerization, can't portably move between providers | Manual VPS update steps increase drift risk at scale |
| **Evidence** | Codebase audit — no Docker files | plan.md L678, manual-account-setup.md |

**Unified Assessment:** Both agree. Manual deployment across 100 VPS instances is guaranteed human error. Containerization (non-MT5 stack) and automated EA deployment tooling are required.

---

## Gaps Found by Claude Only

| Gap | Severity | Detail |
|-----|----------|--------|
| No dedicated heartbeat event contract | High | Liveness exists via `mt5_accounts.last_sync_utc`, but no dedicated `mt5_heartbeats` table/contract for historical liveness analytics and strict heartbeat governance |
| No risk event logging | High | No `mt5_risk_events` table. Violations not persisted |
| No cross-account risk aggregation | Medium | Can't see total exposure across 100 accounts |
| Health endpoint bare minimum | Medium | `/api/health` returns "ok" — no subsystem checks |
| No anomaly detection | Medium | Latency spikes, sizing drift, PnL anomalies go unnoticed |
| Strategy lifecycle blind spot | Low (plan-level resolved) | `plan.md` now defines lifecycle abstraction; implementation and testing remain pending |

---

## Gaps Found by Codex Only

| Gap | Severity | Detail |
|-----|----------|--------|
| Key-person risk (explicit) | High | Single-human escalation path = 24/7 ops weakness |
| Independent risk/compliance function | High | No annual algorithm validation cycle with sign-offs |
| Sensitive state policy contradiction | Medium | DB-backed runtime state vs file/git guidance in docs — conflicting persistence policy |
| Cyber governance elevation | Medium | Security should be enterprise risk governance, not just technical controls |
| RTS 6 testing environment requirement | Medium | Explicit testing environments with controlled deployment required by EU regulation |

---

## Unified Priority Remediation Plan

Based on combined findings, here's what must happen before the refactor begins:

### P0 — Block Refactor Start (Do These First)

| # | Action | Addresses | Owner | Est. Effort |
|---|--------|-----------|-------|-------------|
| 1 | **Design API security contract** — auth model, HMAC signing, replay protection, key rotation policy | Critical #1 | CTO + Claude | 1 day design |
| 2 | **Build contracts layer** — Zod schemas for every EA↔Website payload, CI validation gate | Critical #2 | Codex | 2-3 days |
| 3 | **Prove Poseidon runtime reliability** — verify Triton/Nereus/Poseidon schedules in production with last-run telemetry, failure alerts, and restart evidence | Critical #3 | Codex | 0.5-1 day |
| 4 | **Resolve Poseidon truth-source authority** — enforce queryable DB/API state as ops source-of-truth; constrain prompt memory to non-authoritative summarization | Critical #3 | CTO design + Codex impl | 1-2 days |
| 5 | **Build MT5 kill-switch API** — `/api/mt5/kill-switch` with EA-side polling | High #4 | Codex | 1 day |
| 6 | **Formalize heartbeat architecture** — either add `mt5_heartbeats` table or ratify `mt5_accounts.last_sync_utc` as canonical heartbeat contract with retention/SLO rules | Claude-only | Codex | 1 day |

### P1 — Gate Before First Canary Deployment

| # | Action | Addresses | Owner | Est. Effort |
|---|--------|-----------|-------|-------------|
| 7 | **Spec pre-trade hard-block controls** — position limits, duplicate prevention, per-venue parameter governance | High #5 | CTO design | 1 day design |
| 8 | **Define SLA/RTO/RPO targets** — document, test failover, acceptance criteria | High #6 | CTO + Freedom | Half day |
| 9 | **Build risk event logging** — `mt5_risk_events` table, structured event persistence | Claude-only | Codex | 1 day |
| 10 | **Define escalation beyond Freedom** — secondary authorized human or Poseidon autonomous action thresholds | High #8 | Freedom decision | — |
| 11 | **Resolve sensitive state policy** — decide git vs DB for Poseidon state, enforce consistently | Medium #10 | Codex | Half day |

### P2 — Gate Before Production Rollout (50+ Accounts)

| # | Action | Addresses | Owner | Est. Effort |
|---|--------|-----------|-------|-------------|
| 12 | **Containerize non-MT5 stack** — Docker Compose for website, bots, Poseidon, Postgres | Medium #11 | Codex | 2-3 days |
| 13 | **Build automated EA deployment tooling** — replace manual VPS updates | Medium #11 | Codex | 2-3 days |
| 14 | **Implement CI test gates** — regression suite, parity testing, contract drift detection | Medium #9 | Codex | 2-3 days |
| 15 | **Add cross-account risk aggregation** — total exposure monitoring across all accounts | Claude-only | Codex | 1-2 days |
| 16 | **Define annual validation cycle** — algorithm review, control attestation, compliance sign-off | Codex-only | CTO + Freedom | 1 day |
| 17 | **Implement strategy lifecycle abstraction modules** — architecture is now defined in `plan.md`; execute implementation + parity tests | Claude-only | Codex | 1-2 days |

---

## Regulatory Standards Referenced

| Standard | Relevance |
|----------|-----------|
| **SEC Rule 15c3-5** | Pre-trade risk controls, market access, annual review/certification |
| **EU RTS 6** (Delegated Regulation 2017/589) | Algo trading organizational requirements, testing environments, controlled deployment |
| **MiFID II Article 17** | Effective systems, risk controls, resilience, prevention of market abuse |
| **MiFID II / MiFIR Reform Package** | Amended reporting and register requirements (jurisdiction-specific applicability/timeline validation required) |
| **FINRA 2025 Market Access** | Kill switches, aberrant algo behavior monitoring |
| **NIST CSF 2.0** | Cybersecurity framework — identify, protect, detect, respond, recover |
| **NIST SP 1299** | CSF 2.0 implementation guide |
| **Knight Capital (Aug 2012)** | $460M loss in 45 min — deployment failure, no kill switch, no pre-trade checks |
| **2010 Flash Crash** | Market-wide circuit breaker inadequacy, algo cascading |

---

## Bottom Line

**Architecture: A-tier.** The design is genuinely excellent and scales to billions under management.

**Hardening: Not there yet.** Both auditors independently reached the same conclusion — strong blueprint, pre-institutional execution.

**Path forward is clear:** Close P0 gaps (5-7 days of focused work), then begin Phase 0 of the refactor with confidence. The plan doesn't need a rewrite — it needs the safety rails installed before the car hits the track.

---

*Audit conducted by Claude (CTO) and Codex independently. Findings merged March 2, 2026.*
