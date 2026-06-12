# Current Work

Status: active checklist. Keep this short and update it when gates change.

This is the running repo-visible checklist. Persistent memory stays in
`C:/Users/User/Documents/GitHub/freedom-ops/.codex/`; this file tracks the
current Limni work plan so Freedom does not have to reconstruct it from chat.

## Workflow

- Use at most three active running surfaces:
  - `CODEX_SESSION.md` for hot recovery and frozen areas.
  - `docs/backlog/CURRENT_WORK.md` for the active checklist.
  - One focused gate/release doc only when the active gate needs durable detail.
- Archive completed or stale notes under `archive/` using mirrored repo paths.
- Do not start coding until the active gate is named.
- For broad issue sets, classify first, then patch one gate at a time.
- Gate labels use a sequence number plus a scope slug. The slug is the real
  boundary; the number is only a recovery handle.

## Active Gate

Gate 29: performance-data-correctness.

Status: completed and packaged as v2.0.5.

Goal:

- Align current-week and stored-week Performance UI behavior without changing
  untrusted strategy numbers.
- Keep Basket counts data-derived and consistent across current, previous, and
  all-time views.
- Preserve equity-vs-balance path visibility for stored weeks.
- Keep current-week Summary card tone consistent with stored weeks.
- Do not start strategy optimization, Pair Fill Cap redesign, or sentiment
  decisions until ADR Grid numbers are trusted.

## Next Gates

Recommended next data gate: `Gate 30: adr-grid-parity`.

1. ADR Grid app-vs-indicator parity audit.
2. Weekly Hold engine verification.
3. Sentiment decision gate.
4. Rollover/status UX audit for COT, sentiment, and strength source readiness.

## Repo Size / Consolidation WIP

Baseline captured 2026-06-12 with `git ls-files`:

- tracked repo files: 2150
- tracked `app/` files: 1844
- tracked `app/src/` files: 681
- tracked `docs/` files: 81
- tracked `app/releases/` files: 399
- `app/src` split: `lib` 353, `components` 172, `app` 153

Use this as a working metric. As gates touch an area, classify stale files and
prefer consolidation/archive over adding more owners. New files are acceptable
only when they simplify ownership enough to retire older paths.

## Active Context

- Version UI should use `liveVersion` and `devVersion` only.
- Current live version is `v2.0.5`.
- `pendingRelease` must not be runtime UI truth or visible as a separate
  runtime state.
- Documents/release docs should use one simple structure across versions.
- Version popover should be compact: live is the current public version; dev is
  the new working version.
- Freedom approved Gate 28 visuals as good enough for v2.0.4 packaging. Runtime
  truth remains split into `liveVersion` and `devVersion`; both are `v2.0.4` at
  the promotion boundary until Gate 29 names the next dev version.
- Data page baseline copy should be derived from data/config, not hardcoded or
  release-branded.
- Weekly Hold manual checks mostly matched the indicator, but the repo still
  needs its own reproducible proof path.
- ADR Grid is the major app-vs-indicator blocker: fills, TP counts, returns,
  drawdowns, basket counts, and recent-vs-stored week behavior need audit.
- Strategy work is three layers: baseline/data direction, ADR Grid execution,
  and risk management.
- Do not optimize trading logic until current numbers are trusted.

## Gate 29 Notes

- Current-week Summary card shading is visually accepted.
- Basket behavior is visually consistent across current and previous weeks.
- Jun 08, Jun 01, and May 25 Basket views show 144 total grids and 36 grids per
  portfolio after the selected trade-row path was shared.
- Stored-week Simulation now shows Equity and Balance. The shared
  `EquityCurveChart` should not render Total/Equity as white in light mode.
- No-fill current-week grids still show `P/L 0.00%`; changing that is strategy
  math and belongs in ADR Grid indicator parity.
- `/api/system/mode` can report normal/fresh COT while the missing warning
  banner leaves the user unsure whether new data has arrived. Rollover/status
  should show source freshness clearly without reviving "sentiment-only" copy.
- Dealer/Commercial COT may be fresh while Sentiment/Strength update later.
  Rollover logic should distinguish partial source readiness instead of making
  the app feel blocked on every source.

## Gate 29 Result

Packaged as `v2.0.5`:

- Runtime manifests now use `liveVersion: v2.0.5` and
  `cacheNamespace: v2.0.5-gate29-performance-data-correctness`.
- Current, stored, and all-time Basket views share the selected trade-row
  hierarchy.
- Planned ADR grid rows are present for Basket count parity without counting as
  fills or changing P/L.
- Stored-week Simulation keeps Equity, Balance, and Total path visibility.
- Summary portfolio cards shade from signed return across current and stored
  weeks.
- The stale COT banner copy no longer exposes old sentiment-only mode language.
- Equity/Total chart colours are theme-safe in light and dark mode.
- Release evidence lives under
  `app/releases/v2/screenshots/performance-data-correctness-2026-06-12/`.
- No `app/releases/v2/canon/*.json` files were changed.

Next chat should not reopen Gate 29 unless Freedom explicitly asks. Start with
`Gate 30: adr-grid-parity` unless Freedom redirects.

## Gate 28 Result

Corrective pass was committed and pushed:

- Commit: `4651a37 Gate 28: finalize v2.0.4 readiness`
- Remote: `origin/main`
- Full SHA: `4651a37f9e1020c3ed36c94f5d8addf012ccba49`

- Version popover is active-runtime only in dev and does not show the public
  live version in the dev popover.
- Documents use one version rail plus one tab skeleton for v1 and v2.
- Documents navigation uses app-native `Link` navigation instead of raw anchors.
- Long History/Documents content scrolls inside the selected panel while the
  page itself does not become a long scroll.
- Changelog/history entries are sorted newest-to-oldest.
- Documents discover screenshots under each release's `screenshots/` folder and
  use manifest descriptions only as optional metadata.
- Evidence screenshots open into an enlarged overlay with close and previous/next
  controls inside the selected screenshot group.
- The custom loading-bar keyframe added in the failed pass was removed. Route
  loading screens now use the existing shared `LimniLoading` owner with one
  width-transition progress bar.
- Route loading labels are no longer set in individual route `loading.tsx`
  files. They derive from `DashboardLayout`'s canonical navigation table, with a
  route-name fallback for non-canonical pages.
- The shared loader checks runtime version once per session/cache when needed,
  then shows `Loading Limni v2.0.4...`; later page switches show route labels
  like `Loading Data...` and `Loading Documents...`.
- Data dashboard filters were trimmed back to controls only: no visible Bias,
  active-baseline, trading-week provenance, Friday-freeze/COT, or Asset Class
  labels in the filter block.
- Sentiment summary cards now use the same centered `SummaryCards` sizing path
  as Dealer/Commercial/Strength.
- App Truth route readiness no longer renders a visible page blocker on Data or
  Performance. It stays as route metadata, and local missing-DB readiness errors
  fail open to the app content.
- Dashboard COT history loading now fails open to an empty history when the
  local database is unavailable instead of throwing the Data page.
- Login now falls back to the repo-root auth username/password env keys when the
  Next dev server is launched with `next dev app`; the fallback is limited to
  `AUTH_USERNAME` and `AUTH_PASSWORD` and does not load root `AUTH_BYPASS`.
- Root layout no longer shows a generic `Loading page...` fallback before
  route-specific loading screens.
- Added one release note: `app/releases/v2/patches/v2.0.4.md`.
- No release canon regeneration.
- Final proof run: `git diff --check`, TypeScript project check, focused
  release/canon tests, `npm run build`, version API smoke, and fresh-login
  Playwright smoke for Data, Performance, Documents, and Status.
- Broader Playwright route sweep before packaging checked 32 app routes. Dynamic
  account detail routes were skipped because no connected account records were
  present.

Still not solved as a full release-process system:

- There is no general release screenshot capture automation script yet. Current
  Documents rendering is automatic from release folders, but capture itself is a
  separate release-process gate.
