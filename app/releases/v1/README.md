# v1 Baseline / Pre-v2 State

Documented: 2026-05-30

`a424b04` (`Normalize performance ratio displays`, 2026-05-22) is the last shipped v1 anchor. This release folder documents the current pre-v2 baseline: the repo after accumulated migration work that has landed since that v1 anchor, before the v2 versioning and immutable-canon push.

This is a snapshot, not a full copy of the broader docs tree. The purpose is to define the reference state that v2 measures against: architecture, active systems, data contracts, API/UI surfaces, quarantines, verification evidence, and known issues.

## Contents

- [manifest.json](./manifest.json) - machine-readable v1 baseline manifest shape for v2 to reference.
- [architecture.md](./architecture.md) - architecture summary and canonical deeper-doc links.
- [active-systems.md](./active-systems.md) - active strategy lineup and signal semantics.
- [data-contracts.md](./data-contracts.md) - current contracts that v2 will consume or extend.
- [api-surface.md](./api-surface.md) - active API route groups and purposes.
- [ui-surfaces.md](./ui-surfaces.md) - page/component surface map and quarantined UI.
- [file-audit.md](./file-audit.md) - high-signal folder and critical-file audit.
- [quarantined.md](./quarantined.md) - v1 quarantine reference.
- [verification.md](./verification.md) - AUDCAD matrix and latest green checks.
- [known-issues.md](./known-issues.md) - categorized known issues, quarantines, and deferred work.

## Scope

The baseline includes two-layer canonical/execution return display, Universal Trade Ledger V2 identity, ViewMode/UI wiring stabilization, metric-basis cleanup, Phase 1 trade drilldown, the standalone canonical `TradeList`, and current quarantines.

The baseline does not include v2 app-versioning, immutable historical canon in IndexedDB, canon-backed Basket rebuild, Matrix active-flow quarantine, or summary-card modal quarantine. Those are the v2 workstream.
