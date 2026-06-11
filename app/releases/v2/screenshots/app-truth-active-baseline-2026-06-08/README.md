# App Truth Active Baseline Evidence

Date: 2026-06-08

Purpose: screenshot evidence for the read-only active baseline contract gate.

## Captures

- `status-active-baseline-full-page.png`
  - Route: `/status`
  - Expected: Status renders with the active baseline contract visible.
  - Observed: Status rendered and showed `v2.0.3-clean14`.

- `status-active-baseline-section.png`
  - Route: `/status`
  - Expected: Focused proof of the App Truth active baseline card and route diagnostics.
  - Observed:
    - Active baseline id: `v2.0.3-clean14`
    - Source window: `v2.0.3-clean-14w`
    - Performance window: `v2.0.3-clean14`
    - Active weeks: `14`
    - Latest active baseline closed week: `May 24, 2026`
    - Source ledger coverage: `match`, `14/14`
    - Performance kernel coverage: `partial`, `14/14` matched with `6` extra weeks

## Meaning

The source-freeze ledger matches the clean14 active baseline exactly.

The existing Performance canon/kernel inventory still exposes extra weeks. This is now visible as a control-plane mismatch instead of being hidden by route behavior.

No Data, Performance, Basket, cache, cron, canon, or release-promotion behavior was changed in this gate.

## Playwright Evidence

See `playwright-evidence.json`.

All focused checks passed and no bad browser responses, failed requests, console errors, or page errors were captured for this Status run.
