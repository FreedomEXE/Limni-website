# App Truth Architecture Index

Date: 2026-06-08
Status: Current architecture index
Scope: Limni app truth, readiness, lifecycle, cache, and legacy-path migration

## Current Authority

Use these documents as the active architecture source of truth:

1. `docs/architecture/APP_TRUTH_ARCHITECTURE_V1_SPEC_2026-06-08.md`
2. `docs/architecture/APP_TRUTH_ARCHITECTURE_IMPLEMENTATION_PLAN_2026-06-08.md`
3. `docs/architecture/APP_TRUTH_PHASE0_INVENTORY_2026-06-08.md`
4. `docs/handoffs/NEXT_SESSION_PHASE0_APP_TRUTH_GUARDRAIL_2026-06-08.md`

Current gate:

> Route-readiness gate completed after active-baseline certification; selected Basket ledger gate started Phase 6. The Phase 0 inventory/index is the planning base; current code work remains limited to durable receipts, Status visibility, manifest-driven baseline certification, Data/Performance route gates, and selected-row proof surfaces.

## Current Implementation Status

| Area | Status | Notes |
| --- | --- | --- |
| App truth spec | Current planning authority | Reframes the problem as truth/lifecycle/parity first, cache second. |
| Implementation plan | Active gate sequence | Phase 0 is complete enough to support narrow app-truth gates; broad future phases remain sequenced but not automatically authorized. |
| Phase 0 inventory | Current working register | Lists Data/Performance fetch/cache/preload/fallback paths, route contracts, ledger gaps, and Status diagnostics. |
| App code | Narrow app-truth gates started | Runtime changes are limited to Status diagnostics, active baseline/Data alignment, Performance selected truth, weekly lifecycle visibility, cron register, and scheduler/materialization receipts. |
| Scheduler/materialization receipts | Implemented as a first durable contract | `app_truth_scheduler_run_ledger` and `app_truth_materialization_run_ledger` are DB-backed, lazy-created, visible on Status, and wired to the main materialization producers. |
| Active-baseline certification | Implemented for the current active baseline | `app-truth:certify-active-baseline` audits source-freeze rows, canonical/execution weekly returns, and visible strategy week shards before writing receipt-backed certification evidence. |
| Route readiness gates | Implemented for Data and Performance route shells | `/dashboard` and `/performance` read active-baseline materialization receipts before rendering trusted route payloads; ready state is verified at `14/14` for `v2.0.3-clean14`. |
| Selected Basket ledger | Implemented for active Performance Basket view | Basket now requires `selectedTradeRowsBundle`, exposes selected execution/trade-row ledger IDs, and no longer calls the closed-history fallback in the verified active route. |
| Release/canon | Not authorized | No canon regeneration, baseline retirement, release tagging, or promotion. |

## Superseded Or Historical Architecture Docs

These docs can still be useful as history or evidence, but they are not the current implementation authority.

| Document | Current status | Use now |
| --- | --- | --- |
| `docs/architecture/DATA_FROZEN_BUNDLE_CACHE_V1_SPEC_2026-06-08.md` | Superseded | Historical narrow Data-cache framing only. |
| `docs/architecture/APP_DOMAIN_CACHE_ARCHITECTURE_V1_SPEC_2026-06-08.md` | Superseded | Historical cache-first/domain-store review target only. |
| `docs/architecture/APP_DOMAIN_ARCHITECTURE_EXTERNAL_REVIEW_BRIEF_2026-06-08.md` | Review package | Context for external review, not implementation authority. |
| `docs/architecture/APP_TRUTH_ARCHITECTURE_EXTERNAL_REVIEW_ADDENDUM_KERNEL_PRELOADER_CLEANUP_2026-06-08.md` | Review package | Context for kernel/preloader cleanup review. |
| `docs/architecture/KERNEL_DATA_ARCHITECTURE_SPEC.md` | Historical implementation evidence | Useful for existing kernel/shard design, superseded as the top-level authority by App Truth Architecture. |
| `docs/BOOTSTRAP_UI_ARCHITECTURE.md` | Historical rule set | Useful local-selection-speed reference, superseded where it conflicts with RouteTruthContract, ActiveBaselineManifest, and domain truth ownership. |

## Missing Referenced Document

`AGENTS.md` and older handoffs reference `docs/FUTURE_UPGRADES.md`, but that file is not present in the current repo state during this Phase 0 audit.

Until the missing file is restored or intentionally replaced, the active equivalent rule is:

> Closed historical weeks are immutable under an app/engine/source-contract version. New all-time historical UI should consume a versioned local/bundled canon shape, or a temporary whole-bundle endpoint with the same shape. Do not introduce paginated/lazy historical fetching for closed-week canon without explicit approval.

## No-New Rules During Migration

These rules apply until the App Truth migration is complete:

- No new page-owned historical fetch path.
- No new page-local historical cache.
- No invisible fallback that can populate Data or Performance without Status visibility.
- No Performance surface may use a trade-row source different from Summary/Basket/export/parity after migration.
- No Data active mode may expose weeks outside the active baseline unless explicitly in Archive/History mode.
- No cron/materialization change may be treated as proof of truth without an inspectable run ledger receipt.

## Human Breakdown

What changed: this index declares one current architecture authority, demotes older cache/kernel/bootstrap docs to historical or supporting status, and records durable receipts, active-baseline certification, route readiness, and selected Basket ledger proof as implemented gates.

Why it matters: implementation should not keep pulling from stale docs with conflicting assumptions, and future baseline upgrades should feed the same receipt/route contract instead of causing another route rewrite.

What passed/failed: architecture source-of-truth containment is explicit; Data and Performance route readiness pass for clean14; Basket selected ledger proof passes; release/canon promotion and remaining Summary/export/drilldown/parity ledger proof remain blocked.

Next gate: unify selected ExecutionLedger / TradeRowLedger for Performance Summary and exports, then drilldown and parity.
