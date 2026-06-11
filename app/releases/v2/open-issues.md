# v2 Open Issues

> Active release issues found after v2 launch. Keep entries factual and update
> them when diagnosed, fixed, or intentionally deferred.

## 1. Week Rollover / Recent Week Empty State Regression

- **Opened:** 2026-05-31 19:45 America/Toronto
- **Reported by:** Freedom
- **Severity:** High
- **Status:** Fixed locally in the v2.0.3 institutional-seed candidate; monitor next production rollover after promotion
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

Production API checks initially showed the server had valid `MAY 25 2026` historical payload shells:

- `/api/performance/strategy-page-data?...scope=full` returned `2026-05-24T23:00:00.000Z` in `weekOptions`, `engineWeekMap`, `engineSimMap`, and `engineWeekResults`.
- `/api/performance/strategy-current-week?...scope=full` correctly returned only the new current week, while also carrying week selector options.

The first bug was client-side. The strategy client cache and session store considered any payload with maps plus week results to be a complete full session. During rollover, a current-week-only payload could satisfy that check, leaving historical week labels visible but without matching historical maps/results.

Browser verification then exposed a second server-side rollover gap. The closed-week refresh wrote canonical weekly return rows for the newly closed May 25 week, but did not write execution-anchor weekly return rows. ADR Grid strategy artifacts read execution-anchor rows, so the week had signals but no execution price rows. That produced `tradeCount: 0` and the empty previous-week state even after the cache readiness fix.

### Lifecycle

- **Reported:** 2026-05-31
- **Fixed locally:** 2026-05-31, commit `6e5dd4d`
- **Pushed:** 2026-05-31, accidental push before version formalization
- **Formalized:** v2.0.1 local patch follow-up
- **Verified locally:** 2026-05-31 after execution-anchor refresh and strategy artifact repair
- **Verified in production:** Pending after v2.0.1 deploy
- **Monitoring window:** Through the next week rollover and after the next major release
- **Fix mechanism:** Cache readiness check plus `cacheNamespace: v2.0.1` client invalidation while reusing `canonVersion: v2`; closed-week refresh now derives canonical and execution weekly return rows separately

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
- 2026-05-31: Formalized the fix as v2.0.1 so clients get a cache namespace bump instead of continuing to restore stale v2.0.0 state.
- 2026-05-31: Added execution-anchor weekly return derivation to the closed-week refresh job and split coverage checks by anchor. After running the repaired refresh and repairing strategy artifacts locally, `/api/performance/strategy-artifacts/status` reported 12/12 ready with no stale weeks. May 25 verification: Tandem ADR Grid Pair Fill Cap returned 1,417 trades; Tiered ADR Grid Pair Fill Cap returned 168 trades.
- 2026-06-01: Added the v2.0.2 kernel Phase 1/2 architecture spec, read-only canon inventory/week-shard API contracts, IndexedDB shard stores, and local inventory gap helpers. This does not close the issue yet; it establishes the release-canon + closed-week-delta contract and local diffing primitives required for the full rollover fix.
- 2026-06-01: Added non-blocking active-variant kernel sync and closed-history bundle composition. Browser smoke verified first fill to `Kernel: ready (18/18 weeks)` for `tandem-weekly_hold-none`, then reload reused IndexedDB shards with one inventory request and zero week-shard requests. Basket closed-history snapshots now prefer kernel-composed bundles with legacy canon fallback. The issue remains open until full strategy rendering composes from the kernel and closed-week delta materialization is implemented.
- 2026-06-01: Implemented server-derived `closed-week-delta` entries in the canon inventory and `/api/canon/v2/week` fallback. Post-release closed weeks are now eligible for active-variant delta fetch without mutating `releases/v2/canon/`. The issue remains open until rollover browser verification proves the active page consumes the delta path end to end.
- 2026-06-01: Added active Performance kernel payload routing so the active page consumes the release-canon plus closed-week-delta server path through `/api/performance/strategy-kernel-payload`. Status page diagnostics now expose the active shard inventory and closed/live boundary. The issue remains open pending final browser inspection and the next rollover monitoring window.
- 2026-06-09: v2.0.3 institutional-seed candidate fixed the broader weekly rollover failure mode. Active closed history now contains 15 receipt-backed weeks through Jun 01 2026, while Jun 08 2026 is visible as live overlay only. Source-freeze and active-baseline certification receipts are materialized and visible in Status. Data and Performance route readiness report `15/15`. Browser evidence is saved under `screenshots/weekly-rollover-active-baseline-2026-06-09/`.

## 1a. Current-Week Basket Legacy Renderer Regression

- **Opened:** 2026-05-31
- **Reported by:** Freedom
- **Severity:** Medium
- **Status:** Fixed locally for v2.0.2; pending Freedom browser inspection
- **Surface:** Performance Basket
- **Affected context:** Current/incomplete week Basket view

### Symptoms

- Current-week Basket rendered the pre-v2 legacy list with `show detail` links.
- Historical closed-week Basket rendered the updated inline hierarchy, so the same surface changed style depending on week selection.

### Diagnosis

The Basket path intentionally avoided the canon-backed `BasketHierarchy` for `selectedWeek === currentWeek`, because current-week rows are live data and not part of frozen v2 canon. That was correct architecturally, but the fallback renderer was still the old pre-v2 Basket list.

### Resolution Log

- 2026-05-31: Replaced the current-week fallback with an inline hierarchy-style live Basket renderer that uses the same Performance row language, asset-class chips, expandable detail panels, and summary counts. It still reads live strategy data rather than frozen canon, preserving the current-week/canon split.
- 2026-06-01: v2.0.2 kernel spec records the permanent boundary: current/open week stays live-only, while closed weeks come from release canon plus future closed-week deltas.
- 2026-06-01: Preserved active current-week grid children/details in the full current-week payload, unified count/W/L row context across current, closed-week, and all-time Basket drilldowns, and normalized displayed fill ordinals per grid so sparse/global source sequences render as entry-ordered `Fill 1`, `Fill 2`, ...

## 1b. ADR Grid Capped Basket Return/DD Regression

- **Opened:** 2026-06-04
- **Reported by:** Freedom
- **Severity:** High
- **Status:** Fix candidate browser-verified locally; keep open for final parity/approval gate
- **Surface:** Performance Basket, Simulation, sidebar
- **Affected context:** Tiered / ADR Grid / Pair Fill Cap, FX-only scope, week `May 18 2026`

### Symptoms

- ADR-normalized grid TP rows display `+0.04%` instead of `+0.20%`.
- Basket shows a small positive selected-week result while Simulation/sidebar shows `-13.36%` for the same selected week.
- EURUSD capped grid row shows missing `Grid DD`, `Max fill MAE`, and fill-level MAE/DD values.
- Basket currently groups ADR Grid as grid -> fills, but the verifier evidence is easier to audit as grid -> level -> fills.

### Required Fix Direction

- Re-verify both ADR-normalized and Raw return math for ADR Grid close-and-rearm fills.
- Reconcile Basket, Simulation, sidebar, and canonical/script data sources for May 18 before treating v2.0.3 app numbers as a frozen baseline.
- Add Basket grid-level grouping so each price level totals fills, TP/loss/reset counts, return, and MAE/DD before expanding to individual fills.

### Resolution Log

- 2026-06-04: Implemented ADR Grid return/risk fix candidate. ADR-normalized TP rows now read the stored ADR-normalized fill return, so a `0.20` ADR TP displays as `+0.20%`; raw mode remains true price-return based. Added May 18 Tiered / ADR Grid / Pair Fill Cap correction shard routing for closed-history composition, and changed Basket ADR Grid detail to `Grid -> Level -> Fill` with cap, `Grid DD`, `Max fill MAE`, and fill MAE metadata.
- 2026-06-04: Rechecked EURUSD May 18 Tiered / ADR Grid / Pair Fill Cap with `scripts/verification/inspect-adr-grid-week.ts`; output showed `7` fills, each `adrNormalizedReturnPct: 0.2`, total raw `+0.6940235423%`, total ADR-normalized `+1.4000000000%`, grid DD raw `0.4938782544%`, max fill MAE raw `0.2637717154%`, cap state `3/3`.
- 2026-06-04: Re-ran the 12-system comparison with `scripts/report-corrected-path-metrics.ts`; current app-visible rows match `reports/data-verification/app/visible-engine-stats-2026-06-04.md`.
- 2026-06-04: Playwright-verified the fresh local server at `http://127.0.0.1:3104/performance?strategy=tiered_4w&f1=adr_grid&f2=pair_fill_cap&view=basket&week=2026-05-17T23%3A00%3A00.000Z&scope=fx`. Expanded May 18 FX Basket showed EURUSD `+1.40%`, levels `+0.60% / +0.60% / +0.20%`, fill rows `+0.20%`, `Grid DD -1.00%`, `Max fill MAE -0.53%`, cap `3/3 max active`, and no visible bad `+0.04%` TP display. Screenshot: `screenshots/codex-performance-3104-tiered-may18-fx-basket-expanded-clean-2026-06-04.png`.

## 2. Preloader Status Loop / Legacy Broad Strategy Gate

- **Opened:** 2026-05-31 22:00 America/Toronto
- **Reported by:** Freedom
- **Severity:** High
- **Status:** Reduced locally for v2.0.1; v2.0.2 kernel active-variant sync added; full closure requires runtime kernel composition/gate cutover
- **Surface:** App preload gate
- **Affected context:** First load and cache-namespace upgrade flows after v2 canon preload

### Symptoms

- App can sit for multiple minutes cycling through vague messages such as checking for updates and loading app data.
- Progress bar does not make it clear whether the app is restoring v2 canon, checking strategy payloads, or computing current-week live data.
- The behavior makes v2.0.1 look like it is re-preloading all historical data even when `canonVersion: v2` should be reused.

### Diagnosis

The canon preloader correctly separates `cacheNamespace: v2.0.1` from `canonVersion: v2`; the patch namespace invalidates runtime caches while preserving IndexedDB canon bundles. However, after canon restored, the older strategy session preloader still performed a broad strategy-artifact status/repair pass before opening the app. That broad pre-v2 gate is redundant with the v2 canon model and can block the UI on non-active strategy repair checks.

### Fix Direction

- Historical canon remains the only all-variant preload gate.
- Runtime strategy, broad strategy repair, and current-week refresh must run after the app opens.
- The full-screen preload UI must describe only version/canon work, never generic strategy or live-week work.
- Page-level surfaces may show their own local live/current-week state if the active view needs it.

### Resolution Log

- 2026-05-31: Changed the pre-gate strategy preload to check only the active strategy artifact with a short timeout. Removed the broad all-strategy repair pass from the blocking path. Updated preload copy from generic "Checking for updates / Loading app data" to selected-strategy/current-week language.
- 2026-05-31: Tightened the boundary further: the global `AppPreloadGate` now blocks only on version/canon readiness. Strategy payloads and current-week refreshes still start after canon, but they no longer keep the full app on the loading screen.
- 2026-06-01: Added the v2.0.2 kernel Phase 1/2 contract with active-first readiness, background variant sync, inspectable kernel debug state, and non-blocking shard-store groundwork. The current app gate is not fully replaced yet, so this issue remains open until the runtime kernel cutover is verified.
- 2026-06-01: Wired the active strategy variant into a non-blocking client kernel store and exposed `Kernel: <status> (<ready>/<total> weeks, <rows> rows)` in the version badge popover. Browser smoke verified shard reuse on reload.
- 2026-06-01: Updated the app preload gate so active Performance routes can open on kernel readiness. Legacy monolithic canon remains delayed fallback/background work and still protects non-kernel routes or kernel failure states.
- 2026-06-01: Updated kernel-route strategy session boot so it explicitly loads the active strategy payload while skipping the old all-strategy background preload queue. Inactive strategy variants are deferred to the future kernel background-sync path instead of being pulled into the app boot path.
- 2026-06-01: Added `/api/performance/strategy-kernel-payload` and wired Performance to prefer it on active kernel routes. The payload still uses the existing server-side strategy week shard assembly, but it now has an explicit kernel contract and avoids the legacy `strategy-page-data` client path during active Performance boot.
- 2026-06-01: Active kernel Performance boot no longer consults the legacy artifact status, repair, or global preload stamp path. The Status page now exposes `Kernel Data Layer` cards for version/cache/canon identity, active shard inventory, and closed/live boundary. Matrix CFD/Crypto are marked provisional and intentionally outside the v2.0.2 readiness gate.
