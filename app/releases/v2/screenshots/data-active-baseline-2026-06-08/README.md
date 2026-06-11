# Data Active Baseline Evidence

Date: 2026-06-08

Purpose: before/after browser evidence for migrating the default Data dashboard week options to the active `v2.0.3-clean14` baseline.

## Before

- `dashboard-before-active-baseline-full-page.png`
- `before-playwright-evidence.json`

Observed before:

- Default Data exposed current/open week `Jun 08 2026`.
- It exposed extra pending/closed week `Jun 01 2026`.
- It exposed archive weeks back to `Dec 22 2025`.
- The route was not aligned to the clean14 active baseline.

## After

- `dashboard-after-active-baseline-full-page.png`
- `after-playwright-evidence.json`

Observed after:

- Data shows `ACTIVE BASELINE V2.0.3-CLEAN14 | 14 WEEKS | ARCHIVE SEPARATE`.
- Default active Data week strip shows the clean14 week set:
  - `May 25 2026` through `Feb 23 2026`
- Default active Data hides:
  - current/open `Jun 08 2026`
  - extra `Jun 01 2026`
  - archive `Dec 22 2025`
- Latest active week shows a ready source-freeze ledger.

## Verification

`npx tsc --noEmit --pretty false` passed.

Playwright after-checks passed:

- active baseline label visible
- 14-week label visible
- current/open `Jun 08 2026` hidden
- extra `Jun 01 2026` hidden
- archive `Dec 22 2025` hidden
- latest clean14 `May 25 2026` visible
- earliest clean14 `Feb 23 2026` visible

No bad browser responses, failed requests, console errors, or page errors were captured in the after run.

## Smoke

- `smoke-performance-after-data-baseline.png`
- `smoke-playwright-evidence.json`

Smoke checks passed:

- `/` redirects to `/dashboard?bias=dealer`
- Dashboard shows active baseline
- Dashboard hides archive `Dec 22 2025`
- `/status` shows App Truth
- `/status` shows `v2.0.3-clean14`
- `/performance?strategy=tandem&f1=adr_grid&f2=pair_fill_cap&view=summary` does not show the app-version wall

Smoke captured navigation noise:

- aborted local font request
- aborted `/api/system/mode` requests during route changes
