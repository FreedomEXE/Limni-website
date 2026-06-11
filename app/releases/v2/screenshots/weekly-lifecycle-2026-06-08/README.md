# Weekly Lifecycle Visibility Evidence - 2026-06-08

Scope: read-only Status visibility for active closed weeks, current/open week, and extra Performance kernel weeks.

## Before

Evidence:

- `status-weekly-lifecycle-before-section.png`
- `status-weekly-lifecycle-before-full-page.png`
- `before-playwright-evidence.json`

Observed state:

- Status showed `Weekly Lifecycle`.
- The card only reported that `WeeklyLifecycleLedger` was not implemented.
- It did not list per-week closed readiness states.
- It did not clearly isolate the current/open week as a live overlay.

## After

Evidence:

- `status-weekly-lifecycle-after-section.png`
- `status-weekly-lifecycle-after-full-page.png`
- `after-playwright-evidence.json`

Observed state:

- Status shows `Weekly Lifecycle` as `DEGRADED`, not release-ready, because the formal ledger contract is still missing.
- Read-only projection shows `Closed ready 14/14`.
- The current/open week is isolated as `CURRENT LIVE OVERLAY` and explicitly says it does not satisfy closed-week readiness.
- All 14 active clean14 closed weeks show `CLOSED READY`.
- Each closed week lists source readiness, Performance readiness, and its Friday 5:00 PM ET freeze timestamp.
- Status lists 6 extra Performance kernel weeks separately instead of letting them masquerade as active baseline weeks.
- Final Playwright evidence had no bad responses, failed requests, console errors, or page errors.

## Route Smoke

Evidence:

- `smoke-dashboard-after-lifecycle.png`
- `smoke-performance-after-lifecycle.png`
- `smoke-playwright-evidence.json`

Observed state:

- Dashboard still shows the active baseline label.
- Performance still shows `14 WEEKS TRACKED`.
- Neither route showed the app-version wall or `blockedEndpoint`.
- No bad responses or failed requests appeared.
- Known residual issue: Dashboard still emits the existing React hydration mismatch warning around a checkbox `style` attribute. This was observed before this lifecycle patch and remains a separate UI cleanup item.

## Remaining Scope

This gate did not implement durable `WeeklyLifecycleLedger`, `SchedulerRunLedger`, or `MaterializationRunLedger`. It made rollover state visible enough to prevent closed-week, current-week, and archive/extra-week confusion while the formal ledger work remains pending.
