# v2 Changes

## v2.0.4 - 2026-06-12 - Gate 28 Runtime Readiness

v2.0.4 closes the Gate 28 corrective pass. It promotes the public runtime
metadata to `liveVersion: v2.0.4`, keeps dev/live rendering separated by
channel, bumps the runtime cache namespace to `v2.0.4-gate28-runtime`, and keeps
`canonVersion: v2`.

This patch ships shared loading ownership, strict version-badge popover
separation, a modular Documents release index, click-to-enlarge evidence
screenshots, repo-root auth/database environment recovery, Data/Performance
fail-open readiness, and Data filter/shell cleanup. No `releases/v2/canon/*.json`
files are regenerated or promoted in this patch.

Verification covered TypeScript, focused release/canon tests, production build,
and a Playwright route sweep across the active app routes. Dynamic account detail
routes were skipped because the local account payload had no connected accounts.
See `patches/v2.0.4.md` for the focused release note.

## v2.0.3 - 2026-06-09 - Institutional Seed

v2.0.3 is the institutional seed runtime release. The old clean14 lane is now
historical evidence only. The active baseline id is
`v2.0.3-institutional-seed`: 15 receipt-backed closed weeks through the week
displayed as Jun 01 2026, with the week displayed as Jun 08 2026 visible only
as current live overlay.

This patch adds the app-truth control layer, active-baseline certification,
route readiness, scheduler/materialization run ledgers, source-freeze lifecycle
scripts, source-freeze and active-baseline cron routes, selected-ledger receipt
checks, and runtime naming/cache namespaces for the institutional-seed
release. Data, Performance, and Status now share the same active-baseline
contract instead of mixing old clean14/seed-window assumptions with broader
historical data.

The local technical gate passed on 2026-06-09:

- source-freeze receipts: `15/15`
- canonical and execution weekly returns: `1080/1080`
- strategy week shards: `180/180`
- Data and Performance route readiness: `15/15`
- Jun 01 included in closed active history
- Jun 08 visible as live overlay and excluded from closed certification
- Status shows Active Baseline ready and Weekly Lifecycle ready

Final browser evidence is under
`releases/v2/screenshots/weekly-rollover-active-baseline-2026-06-09/`.
Key files:

- `status-cron-lifecycle-final.png`
- `dashboard-june8-freeze-ledger-ready.png`
- `performance-june8-freeze-ledger-live-overlay.png`
- `cron-source-freeze-current-final-evidence.json`
- `cron-active-baseline-certification-final-evidence.json`
- `current-week-api-loss-count-aligned-evidence.json`

The immutable v2 canon artifacts are not part of this patch. The modified files
under `releases/v2/canon/*.json` must remain out of the v2.0.3 release commit
unless Freedom explicitly approves a separate canon regeneration gate.

Remaining non-blocking work moves to v2.0.4: speed/workflow cleanup, issue
register triage, remaining UI/data concerns, TradingView/Pine parity expansion,
and broader automation-readiness decisions. See `patches/v2.0.3.md` for the
release boundary and evidence ledger.

## v2.0.2 - 2026-06-01 - Patch

Kernel Phase 1/3 read-only canon inventory, week-shard API contracts, closed-week delta shards, client shard-store groundwork, active-variant runtime sync, closed-history bundle composition, active strategy kernel payload, active Performance kernel gate, active-only strategy session boot on kernel routes, Status page kernel diagnostics, Matrix provisional/degraded status, version badge kernel diagnostics, and release-polish UI fixes. This patch adds the architecture spec, `/api/canon/v2/inventory`, `/api/canon/v2/week`, `/api/performance/strategy-kernel-payload`, IndexedDB v2 shard stores, deterministic shard/gap/composition/delta tests, versioned aggregate-slot metadata, non-blocking active strategy shard sync, Basket snapshot fallback through kernel-composed closed history, active Performance route release on kernel readiness, active-selection kernel diagnostics with `/status` query-param inspection, current-week grid drilldown detail, consistent Basket count/W/L row context across all periods, normalized per-grid fill display ordering for sparse delta sequences, aligned week-strip overflow arrows, a bounded opaque scrollable version popover with no-store manifest reads, and skips the old all-strategy background preload/repair/stamp path plus delayed monolithic canon download for kernel routes while preserving immutable `v2` canon files. See `patches/v2.0.2.md` for details.

## v2.0.1 - 2026-05-31 - Patch

Week rollover cache readiness fix, execution-anchor weekly return refresh, current-week Basket UI alignment, version discipline formalization, and preload gate cleanup so v2 canon is the only full-screen historical gate while strategy/current-week refreshes run after the app opens. See `patches/v2.0.1.md` for details.

## v2.0.0 - 2026-05-30 - Major

## Versioning

- Added a root `release-manifest.json`.
- Added `/api/version/current`.
- Added `AppVersionBadge` mounted from the app shell.

## Immutable Canon

- Added `scripts/build-canon-bundle.ts`.
- Materialized all 12 visible strategy variants as static JSON artifacts under `releases/v2/canon/`.
- Added `/api/canon/v2/historical?strategyVariant=...` to serve static artifacts only.
- Added IndexedDB cache layout:
  - DB: `limni-canon`
  - Store: `bundles`
  - Bundle key: `v2::<strategyVariant>::all`
  - Store: `meta`
  - Meta key: `v2`

## Basket

- Swapped Basket to the canon-backed `basketDataSource`.
- Rebuilt active Basket rendering through `TradeList`.
- Removed active Basket loading state for historical data.

## Quarantines

- Matrix is hidden from top-level nav and `/matrix` renders a quarantine notice.
- Performance summary cards are static displays; card modal click handlers are quarantined.

## Verification Anchors

- AUDCAD 2026-05-11 matrix remains the reference:
  - Canonical raw: `-0.5836%`
  - Canonical ADR-normalized: `-0.7756%`
  - Execution raw: `-0.7082%`
  - Execution ADR-normalized: `-0.9411%`
- Pair Fill Cap gate remains `cap_violated = TRUE`: `0`.
