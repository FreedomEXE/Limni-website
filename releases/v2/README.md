# v2

v2 is the first active app-level version after the documented v1 baseline.

Current patch: `v2.0.1`.

## Scope

- App version manifest and `/api/version/current`.
- Materialized immutable historical canon under `releases/v2/canon/`.
- IndexedDB-backed first-load canon preload, then synchronous in-memory reads.
- Version badge with release popover.
- Basket rebuilt on canon using the shared `TradeList` component.
- Matrix active flow quarantined behind a placeholder.
- Performance summary-card modal click handlers quarantined.

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
