# External Review Addendum: Kernel, Preloader, Versioning, And Cleanup

> Self-contained addendum for an outside reviewer without repo access. This should be reviewed together with the earlier Limni app truth/domain architecture review. Do not propose code.

Date: 2026-06-08
Status: For second external architecture review
Related brief: `APP_DOMAIN_ARCHITECTURE_EXTERNAL_REVIEW_BRIEF_2026-06-08.md`
Internal post-review draft: `APP_TRUTH_ARCHITECTURE_V1_SPEC_2026-06-08.md`

## Why This Addendum Exists

The first external review correctly reframed the problem:

> This is app truth architecture with domain-owned caches, not cache architecture first.

However, one major part needs explicit review before implementation:

> How should the existing preloader/kernel/versioning architecture fit into the new app truth architecture?

Limni already has kernel/preloader/versioning concepts. The risk is that a new "truth architecture" could accidentally ignore them, duplicate them, or build a second orchestration layer beside them.

There is also a cleanup risk: old bad code, stale docs, and legacy architecture paths can keep influencing new work unless cleanup is part of the migration plan.

## Existing Concepts To Account For

The app already has these architectural ideas in some form:

- App/version manifest.
- Version badge / release candidate indicator.
- Preload gate shown during app readiness checks.
- Performance/canon kernel concept.
- Historical week shards / strategy kernel payloads.
- Browser-side persisted historical data for parts of Performance.
- Runtime cache and preload manifests.
- Strategy preload tasks.
- Current/live week paths.
- Stale-canon and candidate-version blockers.

The problem is not that none of this exists. The problem is that it is inconsistent:

- Some pages act like the kernel/preloader owns readiness.
- Some pages still server-load or fetch their own historical data.
- Some paths use versioned historical/kernel payloads.
- Some paths use no-store page data.
- Some UI surfaces show stale or split-brain data.
- Status/version diagnostics are not yet the authoritative control plane.

## Key Architecture Question

Should the existing kernel/preloader/versioning layer become the central orchestration layer for app truth?

Proposed framing:

```text
Version / Kernel Layer
  release identity
  candidate identity
  active baseline manifest
  domain namespace comparison
  weekly lifecycle state visibility
  readiness orchestration
  preload policy
  diagnostics

Domain Stores
  own domain data
  expose selectors
  hydrate frozen data
  refresh live overlays
  report readiness/degraded states

Pages
  render selectors
  do not own truth
  do not infer week readiness
  do not own duplicate historical fetch/cache paths
```

In this model, the kernel does not become a giant data store. It coordinates truth lifecycle and readiness. Domain stores own the data.

## Preloader Role

The preloader should not be a page spinner or a generic "checking updates" screen.

It should become a route/domain-aware readiness coordinator.

Potential responsibilities:

- check app/candidate version
- check active baseline manifest
- check required domain manifests for the current route
- hydrate required frozen domain data when valid local cache exists
- fetch required frozen data only when namespace is missing/stale
- release the route when required truth is usable
- start live overlays after frozen data is usable
- never block Status diagnostics

Potential anti-patterns to reject:

- full historical preload on every route entry
- page-specific preload logic
- preload repairing or inventing truth silently
- preloader hiding split-brain data
- preloader blocking the app because a live overlay failed
- generic loading wall with internal diagnostic text as the main user experience

## Kernel Role

The kernel should answer:

- What app/candidate version is active?
- What baseline/window is active?
- Which domains are required for this route?
- Which frozen namespaces are valid?
- Which weeks are ready, missing, current, degraded, or blocked?
- Which live overlays are refreshing or failed?
- What can safely render now?
- What must be shown as unavailable?

The kernel should not:

- duplicate domain data
- make pages infer readiness
- hide stale old paths
- become an all-purpose global store
- treat cache as authority

## Versioning Role

The architecture must distinguish:

- live/stable release identity
- local/candidate release identity
- app shell version
- UI version
- active baseline/window id
- source contract namespace
- source snapshot namespace
- engine logic namespace
- execution logic namespace
- trade-row schema namespace
- performance materialization namespace
- domain bundle namespace

Important rule:

> UI-only deploys should not invalidate frozen historical truth.

Another important rule:

> Data/source changes and execution/engine changes should invalidate different domains according to dependency.

## Cleanup Requirement

The implementation plan must include cleanup and documentation migration.

This is not optional. If old code paths remain active or old docs remain authoritative, new work will keep drifting.

Cleanup should include:

- inventory existing fetch/cache/preload paths by page and domain
- mark old architecture docs as superseded where appropriate
- define one current architecture source of truth
- remove or quarantine stale page-level historical fetch paths
- remove duplicate page-local caches after replacement
- remove stale compatibility fallbacks after proof
- update handoffs/release docs to point at the current truth architecture
- keep Status as the live diagnostic surface for migration progress

## Cleanup Questions

Please review these cleanup questions:

1. Should cleanup be a formal phase before implementation, or run in parallel with each migrated domain?
2. What stale artifacts should be marked superseded immediately?
3. How do we prevent old page-local fetch paths from silently continuing to drive UI?
4. Should there be an architecture inventory table listing every page, domain, data source, cache source, and owner?
5. Should every legacy compatibility path have an explicit deletion gate?
6. What should be the rule for docs: one canonical spec plus historical superseded docs, or a living architecture index?

## Open Design Questions For Review

Please answer at a CTO/architecture level:

1. Where exactly should the kernel sit in the app truth architecture?
2. Should the kernel own active baseline/window selection, or should a separate baseline service own it and the kernel only consume it?
3. Should the preloader be route-aware, domain-aware, or both?
4. How should the preloader avoid becoming another source of truth?
5. Should every domain expose readiness to the kernel through one shared interface?
6. How should Status consume kernel/domain diagnostics without depending on successful app hydration?
7. What is the minimum viable kernel/preloader migration for v2.0.3-clean14?
8. Should Performance and Data be migrated through the existing kernel, or should the kernel be refactored first?
9. How should version namespaces be modeled so UI-only changes do not invalidate historical data?
10. What cleanup work must happen before any new implementation begins?

## Proposed Implementation Order For Review

Current proposed order after first review:

1. Diagnostics and Status truth visibility.
2. Shared Active Baseline Manifest.
3. Weekly Lifecycle Ledger visibility.
4. Performance execution/trade-row source unification.
5. Atomic Performance selection state.
6. Data/Performance active baseline alignment.
7. Central rollover/freeze/materialization state machine.
8. Durable browser persistence.
9. Release/candidate version popover.
10. Extend pattern to other domains.

Question for reviewer:

Where should kernel/preloader/versioning cleanup fit in this order?

Possible revised order:

1. Architecture inventory and stale-path audit.
2. Kernel/preloader responsibility definition.
3. Status diagnostics surface for kernel/domain truth.
4. Shared Active Baseline Manifest.
5. Weekly Lifecycle Ledger visibility.
6. Performance ledger/trade-row unification.
7. Atomic Performance selection state.
8. Data/Performance baseline alignment.
9. Rollover/freeze/materialization state machine.
10. Durable persistence after truth is stable.
11. Version badge/popover.
12. Delete legacy paths and mark stale docs superseded.

Please critique this order.

## Reviewer Output Requested

Please provide:

- verdict on kernel/preloader/versioning role
- recommended ownership boundaries
- implementation order correction
- cleanup/doc migration plan
- risks of keeping legacy paths during migration
- non-negotiable tests for kernel/preloader behavior
- what to avoid overengineering

Do not write code.

## Human Breakdown

What changed: this addendum asks how the existing preloader/kernel/versioning architecture fits into app truth architecture.

Why it matters: implementation must not create a second architecture beside the existing kernel, and stale paths/docs must not keep poisoning new work.

What passed/failed: first review passed the app-truth direction but did not explicitly settle kernel/preloader/versioning integration.

Next gate: second external review before finalizing implementation plan.
