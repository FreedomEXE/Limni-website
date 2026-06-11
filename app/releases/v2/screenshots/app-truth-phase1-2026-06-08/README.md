# App Truth Phase 1 Browser Evidence

Date: 2026-06-08

Purpose: screenshot evidence for the first App Truth Phase 1 gate and the route-aware preload correction.

## Captures

- `dashboard-after-route-aware-gate.png`
  - Route: `/` redirecting to `/dashboard?bias=dealer&asset=all&report=2026-06-02&view=heatmap`
  - Expected: Dashboard renders without the app-version preload wall.
  - Observed: Dashboard rendered without `Checking app version`, `blockedEndpoint`, or `App update failed`.

- `status-full-page-app-truth.png`
  - Route: `/status`
  - Expected: Status renders and includes the App Truth diagnostic section.
  - Observed: Status rendered and included `App Truth Control Plane`.

- `status-app-truth-section.png`
  - Route: `/status`
  - Expected: Focused proof of the App Truth section.
  - Observed: App Truth release, baseline, lifecycle, scheduler, route, and legacy-path diagnostics were visible.

- `performance-summary-no-app-version-wall.png`
  - Route: `/performance?strategy=tandem&f1=adr_grid&f2=pair_fill_cap&view=summary`
  - Expected: Performance should not show the global app-version wall.
  - Observed: Performance rendered its page shell and local loading state without `Checking app version` or `blockedEndpoint`.

## Playwright Evidence

See `playwright-evidence.json` for route URLs, text samples, and runtime events.

Captured runtime events:

- Dashboard hydration mismatch warning involving a checkbox `style` attribute. This did not block render, but remains an audit item.
- One aborted `/api/system/mode` request during browser navigation. This did not block render.
