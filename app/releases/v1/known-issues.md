# Known Issues

## External / Service Issues

- **Vercel 402 Payment Required:** production cron execution is deliberately paused. Hourly cron-driven current-week refresh can be stale until service status is restored.

## Intentional Quarantines

- Basket v3 hierarchical UI is hidden behind a containment placeholder.
- Matrix surface remains in the repo and is targeted for active-flow quarantine in v2.
- Summary card click-to-modal handlers are targeted for v2 quarantine.
- Legacy in-grid scope tabs in `PerformanceGrid` are disabled.
- Legacy paginated Basket routes/components are preserved, not deleted.
- 41 legacy research scripts are preserved and tracked by [`docs/research/LEGACY_SCRIPT_AUDIT_2026-05-28.md`](../../docs/research/LEGACY_SCRIPT_AUDIT_2026-05-28.md).
- Trade identity tests no longer hardcode UUID literals in affected files; version-stable assertions are in place.

## Actual App Bugs

No confirmed v1 baseline app bugs are recorded in this snapshot. The Basket hierarchy UX/performance failure is treated as an intentional quarantine, not an active production surface.

## Deferred Architecture Work

- v2 versioning + immutable historical canon.
- Canon-backed Basket rebuild using `TradeList`.
- Indicator visual verification.
- Automation workstreams after v2.
- EA refactor follow-up phases.
- Pantheon multi-agent context architecture.
- Documentation architecture cleanup.
- Netted view / Position Mode axis.
- TimescaleDB and other future infrastructure upgrades when trigger conditions are met.
