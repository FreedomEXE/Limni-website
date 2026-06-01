# v2 Open Issues

> Active release issues found after v2 launch. Keep entries factual and update
> them when diagnosed, fixed, or intentionally deferred.

## 1. Week Rollover / Recent Week Empty State Regression

- **Opened:** 2026-05-31 19:45 America/Toronto
- **Reported by:** Freedom
- **Severity:** High
- **Status:** Fixed locally, pending production verification
- **Surface:** Performance
- **Affected context:** Tandem / ADR Grid, Summary view, current and most-recent week selection

### Symptoms

- A new `JUN 01 2026` week button appeared during the evening rollover window.
- Selecting `JUN 01 2026` shows:
  `Current week in progress -- no realized fills yet. Switch to Simulation view to see the equity path.`
- Selecting the previous `MAY 25 2026` week also shows an empty/no-realized-data state in at least one captured context.
- The sidebar can show either all-time totals or a selected-week empty state while the main panel shows no realized rows, creating uncertainty about whether the data is stale, missing, or intentionally unavailable.

### Evidence

Screenshots were captured from production at `limni-website-nine.vercel.app` around 19:45 America/Toronto:

- `c:/Users/User/Desktop/LIMNI/V2 Screenshots/Screenshot_31-5-2026_194418_limni-website-nine.vercel.app.jpeg`
- `c:/Users/User/Desktop/LIMNI/V2 Screenshots/Screenshot_31-5-2026_194427_limni-website-nine.vercel.app.jpeg`

### Why This Blocks Follow-On Work

Current and most-recent week rendering is operationally load-bearing. If week rollover or recent-week data availability is ambiguous, the app can appear unusable even when historical canon is correct. This also risks invalid comparisons against the future indicator verification track.

### Initial Hypotheses To Verify

- Week selector is exposing the next trading week at the canonical Sunday 19:00 America/New_York rollover; that part is expected.
- Closed-week canonical handoff from live data to release/current-week data is delayed or not mapped consistently after rollover.
- Current-week and previous-week logic are using different week anchors or different freshness gates.
- The client cache/session store may treat a current-week-only payload as a full historical payload.
- The summary pane, sidebar, and simulation paths may resolve different data sources during rollover.
- v2 canon preload correctly handles historical closed weeks, but the live/current-week split needs a dedicated transition contract.

### Diagnosis

Production API checks showed the server had valid `MAY 25 2026` historical payloads:

- `/api/performance/strategy-page-data?...scope=full` returned `2026-05-24T23:00:00.000Z` in `weekOptions`, `engineWeekMap`, `engineSimMap`, and `engineWeekResults`.
- `/api/performance/strategy-current-week?...scope=full` correctly returned only the new current week, while also carrying week selector options.

The empty previous-week UI was therefore client-side. The strategy client cache and session store considered any payload with maps plus week results to be a complete full session. During rollover, a current-week-only payload could satisfy that check, leaving historical week labels visible but without matching historical maps/results.

### Fix Direction

Implement a modular week-transition contract rather than patching individual views:

- Define a single source of truth for week status: `future`, `current_incomplete`, `closing_pending`, `closed_live`, `closed_canon`.
- Gate week selector visibility by that status instead of raw date labels alone.
- Keep the previous closed week usable while the new current week has no realized fills.
- If a current week has no realized fills yet, show an explicit live-week status with last refresh time and next expected refresh, not a generic empty state.
- Ensure Summary, Basket, Simulation, sidebar, and current-week APIs consume the same week-status resolver.

### Acceptance Criteria

- At week rollover, the new week does not make the previous week appear empty.
- The new week appears only with an accurate status and clear explanation of what data is available.
- Previous week remains selectable and renders realized performance once it has closed.
- Current week empty state distinguishes "no fills yet" from "data stale/missing".
- Sidebar and main panel agree for the selected week.
- Regression test covers the rollover window around Monday 00:00 UTC.

### Resolution Log

- 2026-05-31: Added a shared strategy payload completeness guard. Current-week-only slices no longer satisfy full historical readiness; full/matrix payloads must contain `all` or at least one closed historical week. Week-option merging now preserves historical options while keeping `all` first and the current week second.
