# Next Session Guardrail: Phase 0 Only

Date: 2026-06-08
Status: Active handoff guardrail
Scope: Planning/inventory/docs containment only

## Hard Rule

Approved next step is Phase 0 only.

Do not change app/runtime code yet.

Do not begin:

- IndexedDB
- Data cache
- Performance payload optimization
- cron cadence changes
- UI patches
- app behavior fixes
- canon regeneration
- release tagging
- baseline retirement

## Approved Phase 0 Work

Start with:

1. Architecture inventory and stale-path audit.
2. Canonical architecture index.
3. Superseded banners on stale docs.
4. `LegacyPathRegister`.
5. `RouteTruthContract` inventory.
6. `SchedulerRunLedger` / `MaterializationRunLedger` inventory.
7. Data/Performance fetch/cache/preload path map.
8. Status diagnostics requirements list.

## Legacy Path Requirements

Every legacy path must get:

- current owner
- replacement owner
- risk
- migration status
- deletion gate
- required acceptance test
- Status diagnostic requirement

## One-Driver Mode

Keep one-driver mode intact.

Codex is the primary repo driver. Other AIs may compress or review context, but they do not drive repo state.

Meaningful decisions must be preserved in persistent memory, not only repo docs.

## Phase 0 Complete When

Phase 0 is complete only when:

- every Data/Performance historical fetch/cache/preload path is listed
- stale authoritative docs are marked superseded
- current architecture index points to the new truth spec and implementation plan
- every known fallback has a deletion gate
- Status requirements include legacy-path and namespace diagnostics
- no app code has changed

## Main Risk

Do not let the next session say:

> We also fixed X while we were there.

That is not approved. Phase 0 is containment and inventory only.

## Current Source Docs

- `docs/architecture/APP_TRUTH_ARCHITECTURE_V1_SPEC_2026-06-08.md`
- `docs/architecture/APP_TRUTH_ARCHITECTURE_IMPLEMENTATION_PLAN_2026-06-08.md`

## Human Breakdown

What changed: this file locks the next session to Phase 0 only.

Why it matters: the next work must contain legacy truth paths before building new ones.

What passed/failed: planning passed; implementation has not started.

Next gate: complete Phase 0 inventory/docs containment, then review before app code changes.
