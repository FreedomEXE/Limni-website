# v2

v2 is the first active app-level version after the documented v1 baseline.

Current live patch: `v2.0.4`.

## Scope

- App version manifest and `/api/version/current`.
- Materialized immutable historical canon under `releases/v2/canon/`.
- IndexedDB-backed first-load canon preload, then synchronous in-memory reads.
- Version badge with release popover.
- Basket rebuilt on canon using the shared `TradeList` component.
- Basket drilldown row context is consistent across all-time, closed-week, and current-week views, with current-week grid detail kept live-only.
- Kernel Phase 1/3 read-only canon inventory, week/delta shard contracts, active sync, closed-history composition, active strategy kernel payload, active Performance kernel gate, active-selection Status diagnostics, and active-only strategy boot on kernel routes.
- Matrix active flow remains quarantined/provisional and outside the v2.0.2 kernel readiness gate.
- Performance summary-card modal click handlers quarantined.
- v2.0.3 institutional-seed docs, screenshots, source-freeze/certification receipts, and app-truth architecture records.
- v2.0.4 Gate 28 runtime-readiness docs, release-index structure, loading/version UI, and route-readiness fixes.
- Data, Performance, and Status share the same active-baseline contract: 15 closed certified weeks through Jun 01 2026, with Jun 08 2026 exposed only as current live overlay.

## Institutional Docs

The v2 Documents page should expose these records together so the release can be audited without scrolling back into v1:

- [`architecture.md`](architecture.md) - active v2 architecture and kernel/preloader contract.
- [`../../docs/architecture/APP_TRUTH_ARCHITECTURE_V1_SPEC_2026-06-08.md`](../../docs/architecture/APP_TRUTH_ARCHITECTURE_V1_SPEC_2026-06-08.md) - current app-truth architecture authority for active baseline, route truth, lifecycle ledgers, and kernel/preloader control-plane boundaries.
- [`../../docs/architecture/APP_TRUTH_ARCHITECTURE_INDEX.md`](../../docs/architecture/APP_TRUTH_ARCHITECTURE_INDEX.md) - architecture document index and supersession map.
- [`../../docs/architecture/APP_TRUTH_CRON_REGISTER_2026-06-08.md`](../../docs/architecture/APP_TRUTH_CRON_REGISTER_2026-06-08.md) - current source-freeze and active-baseline scheduler register.
- [`active-systems.md`](active-systems.md) - active strategies, execution styles, risk overlays, and verification systems.
- [`strategy-execution-spec.md`](strategy-execution-spec.md) - source-system, Weekly Hold, ADR Grid, Favorable Gap, reset, cap, return-mode, and ambiguity definitions.
- [`patches/v2.0.4.md`](patches/v2.0.4.md) - Gate 28 runtime readiness, loading/version/Documents fixes, and verification summary.
- [`patches/v2.0.3.md`](patches/v2.0.3.md) - final v2.0.3 institutional-seed boundary, evidence ledger, and explicit exclusions.
- [`data-contracts.md`](data-contracts.md) - release manifest, canon inventory, payload, week-key, ADR Grid P/L, drawdown/MAE, verification trust, and screenshot contracts.
- [`api-surface.md`](api-surface.md) - release, canon, Performance, Data, Status, and cron/warm API surfaces.
- [`ui-surfaces.md`](ui-surfaces.md) - Performance, Data, Accounts, Status, Documents, Matrix, and release UI behavior.
- [`verification.md`](verification.md) - test/build/browser evidence and indicator parity checkpoint.
- [`handoff.md`](handoff.md) - next-chat handoff and release continuation instructions.

Older clean14 comparisons, TradingView/Pine research, source-gap investigations,
database-institutionalization backlog, and strategy-research notes are retained
as historical working-tree evidence but are not part of the v2.0.4 runtime
release package.

## Canon Freeze Policy

Historical data is frozen under each release. After v2 ships, the closed-week ledger rows captured in `releases/v2/canon/*.json` are the immutable canonical truth for v2's lifetime. New closed weeks accumulate in the live DB and become canonical when v2.1 or higher ships and materializes a new canon.

Direct DB writes to historical rows after release should never happen. If they do, they are bugs to be reverted, not authoritative truth.

## Previous Version

v2 references [`../v1/manifest.json`](../v1/manifest.json) as its previous version.

## Open Issues

Active post-launch issues are tracked in [`open-issues.md`](open-issues.md).

## Version History

Patch-level changes inside the v2 line are tracked in [`changes.md`](changes.md)
and focused patch notes under [`patches/`](patches/).
